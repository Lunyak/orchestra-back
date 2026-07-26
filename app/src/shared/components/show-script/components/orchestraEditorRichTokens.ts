import {
  EditorSelection,
  Prec,
  RangeSetBuilder,
  Transaction,
  type EditorState,
  type Extension,
  type SelectionRange,
} from "@codemirror/state";
import {
  Decoration,
  DecorationSet,
  EditorView,
  keymap,
  ViewPlugin,
  WidgetType,
  type ViewUpdate,
} from "@codemirror/view";
import { getPlayUrl, fetchImageStreamBlobUrl } from "../../../../sync/api/files";
import { decodeOrchestraImageStorageKey } from "../../../utils/markdownImages";
import {
  SCRIPT_PLAY_SPEAKER_LABEL_WIDGET_GAP_STYLE,
  SCRIPT_PLAY_SPEAKER_LABEL_WIDGET_STYLE,
} from "../../../settings/scriptPlayFontSize";
import {
  formatSpeakerLabelDisplay,
  getReadableTextColor,
  isColorOverrideToken,
  parseLightChannel,
  resolveLightColor,
} from "../utils/lightTokens";

type EditorImageCtx = { projectSlug: string; accessToken: string | null };

const editorPlayUrlCache = new Map<string, string>();
const editorPlayUrlInflight = new Map<string, Promise<string | undefined>>();
const editorStreamInflight = new Map<string, Promise<string | undefined>>();

function readEditorAccessToken(accessToken: string | null | undefined): string | null {
  const token =
    accessToken ??
    (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);
  return token?.trim() ? token.trim() : null;
}

function normalizeEditorOrchestraImageKey(key: string): string {
  return decodeOrchestraImageStorageKey(String(key ?? "").trim());
}

async function resolveEditorOrchestraImageStreamUrl(
  accessToken: string | null | undefined,
  key: string,
): Promise<string | undefined> {
  const storageKey = normalizeEditorOrchestraImageKey(key);
  if (!storageKey) return undefined;
  const token = readEditorAccessToken(accessToken);
  if (!token) return undefined;

  let pending = editorStreamInflight.get(storageKey);
  if (!pending) {
    pending = fetchImageStreamBlobUrl(token, storageKey)
      .then((url) => url ?? undefined)
      .catch(() => undefined)
      .finally(() => {
        editorStreamInflight.delete(storageKey);
      });
    editorStreamInflight.set(storageKey, pending);
  }
  return pending;
}

async function resolveEditorOrchestraImageUrl(
  accessToken: string | null | undefined,
  key: string,
): Promise<string | undefined> {
  const storageKey = normalizeEditorOrchestraImageKey(key);
  if (!storageKey) return undefined;

  const streamUrl = await resolveEditorOrchestraImageStreamUrl(accessToken, storageKey);
  if (streamUrl) return streamUrl;

  const cached = editorPlayUrlCache.get(storageKey);
  if (cached) return cached;

  const token = readEditorAccessToken(accessToken);
  if (!token) return undefined;

  let pending = editorPlayUrlInflight.get(storageKey);
  if (!pending) {
    pending = getPlayUrl(token, storageKey)
      .then((r) => r.url || undefined)
      .catch(() => undefined)
      .finally(() => {
        editorPlayUrlInflight.delete(storageKey);
      });
    editorPlayUrlInflight.set(storageKey, pending);
  }
  const url = await pending;
  if (url) editorPlayUrlCache.set(storageKey, url);
  return url;
}

function parseOrchestraImageFromMarkdown(
  full: string,
): { alt: string; key: string } | null {
  const encM = /\]\(\s*orchestra-image:\s*([^)]+)\)/i.exec(full);
  if (!encM) return null;
  let key = String(encM[1] ?? "").trim();
  try {
    key = decodeOrchestraImageStorageKey(key);
  } catch {
    /* keep as-is */
  }
  const altM = /!\[([^\]]*)\]\(\s*orchestra-image:/i.exec(full);
  const alt = (altM?.[1] ?? "").trim() || "Картинка";
  if (!key) return null;
  return { alt, key };
}

function editorImageCtxStamp(ctx: EditorImageCtx) {
  return `${ctx.projectSlug}\0${ctx.accessToken ?? ""}`;
}

/** Как в rehype / превью: токены сценического сценария + длинные orchestra-image. */
const ORCH_TOKEN_RE =
  /(\{\{\s*(light|blackout|b|play|sound|sfx)\s*(?::\s*([^}|]+?))?\s*(?:\|\s*([^}]+?))?\s*}})|(\[\[\s*([^\]]+?)\s*]])|(!\[[^\]]*\]\(\s*orchestra-image:[^)]+\))/gi;

/** `[подпись](track:3)` / `[подпись](playlist: 2)` — как в ScriptMarkdownPreview. */
const TRACK_OR_PLAYLIST_LINK_RE =
  /\[([^\]]*)\]\(\s*(track|playlist)\s*:\s*([^)]+?)\s*\)/gi;

const PARENTHETICAL_RE = /\([^()\n]+\)/g;

/** Каретка строго внутри токена (не на границе) — иначе «мигают» соседние лейблы. */
function selectionInsideToken(
  sel: SelectionRange,
  from: number,
  to: number,
): boolean {
  if (!sel.empty) return sel.from < to && sel.to > from;
  return sel.from > from && sel.from < to;
}

type EditableTokenRange = { from: number; to: number; text: string };

function collectEditableTokensOnLine(
  state: EditorState,
  pos: number,
): EditableTokenRange[] {
  const line = state.doc.lineAt(pos);
  if (looksLikeFenceLine(line.text)) return [];
  const out: EditableTokenRange[] = [];

  const pushMatch = (index: number, raw: string) => {
    const from = line.from + index;
    const to = from + raw.length;
    if (to - from < 2) return;
    out.push({ from, to, text: raw });
  };

  ORCH_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ORCH_TOKEN_RE.exec(line.text)) !== null) {
    pushMatch(m.index, m[0]);
  }

  TRACK_OR_PLAYLIST_LINK_RE.lastIndex = 0;
  let tm: RegExpExecArray | null;
  while ((tm = TRACK_OR_PLAYLIST_LINK_RE.exec(line.text)) !== null) {
    pushMatch(tm.index, tm[0]);
  }

  return out;
}

/** Каретка сразу после чипа → позиция внутри токена (правка `[[РОЛЬ]]`). */
function caretInsideFromRight(token: EditableTokenRange): number {
  const { from, to, text } = token;
  if (
    (text.startsWith("[[") && text.endsWith("]]")) ||
    (text.startsWith("{{") && text.endsWith("}}"))
  ) {
    return Math.max(from + 1, to - 2);
  }
  return Math.max(from + 1, to - 1);
}

/** Каретка сразу перед чипом → позиция внутри токена. */
function caretInsideFromLeft(token: EditableTokenRange): number {
  const { from, to, text } = token;
  if (
    (text.startsWith("[[") && text.endsWith("]]")) ||
    (text.startsWith("{{") && text.endsWith("}}"))
  ) {
    return Math.min(to - 1, from + 2);
  }
  return Math.min(to - 1, from + 1);
}

function isTokenGapOnly(docText: string): boolean {
  return /^[\s\u200B]*$/.test(docText);
}

/** Чип слева от каретки: граница или только пробел/ZWSP (как у `[[РОЛЬ]] (ремарка)`). */
function findTokenJustBeforeCaret(
  state: EditorState,
  head: number,
): EditableTokenRange | null {
  const tokens = collectEditableTokensOnLine(state, head);
  let best: EditableTokenRange | null = null;
  for (const token of tokens) {
    if (token.to > head) continue;
    const gap = state.doc.sliceString(token.to, head);
    if (!isTokenGapOnly(gap)) continue;
    if (!best || token.to > best.to) best = token;
  }
  return best;
}

function findTokenJustAfterCaret(
  state: EditorState,
  head: number,
): EditableTokenRange | null {
  const tokens = collectEditableTokensOnLine(state, head);
  let best: EditableTokenRange | null = null;
  for (const token of tokens) {
    if (token.from < head) continue;
    const gap = state.doc.sliceString(head, token.from);
    if (!isTokenGapOnly(gap)) continue;
    if (!best || token.from < best.from) best = token;
  }
  return best;
}

function enterEditableTokenKeymap(): Extension {
  return Prec.highest(
    keymap.of([
      {
        key: "ArrowLeft",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const token = findTokenJustBeforeCaret(view.state, sel.head);
          if (!token) return false;
          const inside = caretInsideFromRight(token);
          if (!(inside > token.from && inside < token.to)) return false;
          view.dispatch({
            selection: EditorSelection.cursor(inside),
            scrollIntoView: true,
          });
          return true;
        },
      },
      {
        key: "ArrowRight",
        run: (view) => {
          const sel = view.state.selection.main;
          if (!sel.empty) return false;
          const token = findTokenJustAfterCaret(view.state, sel.head);
          if (!token) return false;
          const inside = caretInsideFromLeft(token);
          if (!(inside > token.from && inside < token.to)) return false;
          view.dispatch({
            selection: EditorSelection.cursor(inside),
            scrollIntoView: true,
          });
          return true;
        },
      },
    ]),
  );
}

function looksLikeFenceLine(text: string): boolean {
  return /^\s{0,3}```/.test(text);
}

function spansOverlap(
  aFrom: number,
  aTo: number,
  bFrom: number,
  bTo: number,
): boolean {
  return aFrom < bTo && aTo > bFrom;
}

function normalizeTrackPayload(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

type RichSpan = { from: number; to: number; deco: Decoration };

/** Скрытый исходник без replace-виджета — поверх отдельный Decoration.widget (без cm-widgetBuffer у текста). */
const HIDDEN_SOURCE = Decoration.replace({});

type TokenOverlay = { from: number; to: number; widget: WidgetType };

function subtractIntervals(
  from: number,
  to: number,
  blocks: Array<{ from: number; to: number }>,
): Array<{ from: number; to: number }> {
  if (from >= to) return [];
  const merged = blocks
    .map((x) => ({
      from: Math.max(from, x.from),
      to: Math.min(to, x.to),
    }))
    .filter((x) => x.from < x.to)
    .sort((a, b) => a.from - b.from);
  let cur = from;
  const out: Array<{ from: number; to: number }> = [];
  for (const seg of merged) {
    if (seg.from > cur) out.push({ from: cur, to: seg.from });
    cur = Math.max(cur, seg.to);
    if (cur >= to) break;
  }
  if (cur < to) out.push({ from: cur, to });
  return out;
}

type ChipSpec = {
  label: string;
  classNames: string;
  title: string;
  style?: string;
};

function hasRealSpaceAfterRoleToken(nextChar: string): boolean {
  return nextChar === " " || nextChar === "\t";
}

function resolveChip(
  full: string,
  m: RegExpExecArray,
  lightChannels: string[],
  playTextMode: boolean,
  nextChar = "",
): ChipSpec | null {
  if (m[7]) {
    const altM = /!\[([^\]]*)\]\(\s*orchestra-image:/.exec(full);
    const alt = (altM?.[1] ?? "").trim() || "Картинка";
    const short = alt.length > 22 ? `${alt.slice(0, 22)}…` : alt;
    return {
      label: `🖼 ${short}`,
      classNames: "cm-md-orchestra-image-chip",
      title: full.length > 400 ? `${full.slice(0, 400)}…` : full,
    };
  }

  if (m[5] != null && m[6] != null) {
    const normalized = String(m[6]).trim();
    const text = formatSpeakerLabelDisplay(normalized);
    const trailingGap = hasRealSpaceAfterRoleToken(nextChar);
    const playClass = playTextMode
      ? "markdown-speaker-label markdown-speaker-label--play"
      : "markdown-speaker-label";
    return {
      label: text,
      classNames: trailingGap ? `${playClass} markdown-speaker-label--gap` : playClass,
      title: normalized,
      style: playTextMode
        ? SCRIPT_PLAY_SPEAKER_LABEL_WIDGET_STYLE +
          (trailingGap ? SCRIPT_PLAY_SPEAKER_LABEL_WIDGET_GAP_STYLE : "")
        : undefined,
    };
  }

  if (m[1] == null || !m[2]) return null;

  const rawType = String(m[2]).toLowerCase();
  const rawIndex = String(m[3] ?? "").trim();
  const rawPipe = String(m[4] ?? "").trim();

  if (rawType === "play") {
    const labelText = rawPipe || "Play";
    return {
      label: `▶ ${labelText}`,
      classNames: "markdown-play-label",
      title: full,
    };
  }

  if (rawType === "sound" || rawType === "sfx") {
    const labelText = rawPipe || "SFX";
    return {
      label: `🔊 ${labelText}`,
      classNames: "markdown-sound-label",
      title: full,
    };
  }

  if (rawType === "blackout") {
    const label = "Блекаут";
    const color =
      resolveLightColor(label, "var(--color-text-black)000", rawPipe || undefined) ?? "var(--color-text-black)000";
    const textColor = getReadableTextColor(color);
    return {
      label,
      classNames: "markdown-light-chip",
      title: full,
      style: `background-color:${color};color:${textColor ?? "var(--color-text-bright)"};border: none;`,
    };
  }

  if (rawType === "b") {
    const label = "ЗТМ";
    const color = resolveLightColor(label, "var(--color-text-black)000", rawPipe || undefined) ?? "var(--color-text-black)000";
    const textColor = getReadableTextColor(color);
    return {
      label,
      classNames: "markdown-light-chip",
        title: full,
        style: `background-color:${color};color:${textColor ?? "var(--color-text-bright)"}; border: none;`,
    };
  }

  if (rawType === "light") {
    const index = Number(rawIndex);
    if (!Number.isFinite(index) || index < 1 || index > 8) {
      return {
        label: "{{light:?}}",
        classNames: "cm-md-orchestra-raw-chip",
        title: full,
      };
    }
    const channelValue = lightChannels[index - 1] ?? "";
    const parsed = parseLightChannel(channelValue);
    const labelOverride =
      rawPipe && !isColorOverrideToken(rawPipe) ? rawPipe : "";
    const colorOverride =
      rawPipe && isColorOverrideToken(rawPipe) ? rawPipe : "";
    const label =
      labelOverride || (parsed.label ? parsed.label : String(index));
    const color = resolveLightColor(
      label,
      parsed.color,
      colorOverride || undefined,
    );
    const textColor = getReadableTextColor(color);
    return {
      label,
      classNames: "markdown-light-chip",
      title: full,
      style: color
        ? `background-color:${color};color:${textColor ?? "var(--color-text-bright)"};border-color:transparent;`
        : undefined,
    };
  }

  return null;
}

class OrchestraChipWidget extends WidgetType {
  constructor(
    readonly raw: string,
    readonly spec: ChipSpec,
    readonly getOnRoleClick?: () => ((roleToken: string) => void) | undefined,
  ) {
    super();
  }

  eq(other: OrchestraChipWidget) {
    return (
      this.raw === other.raw &&
      this.spec.label === other.spec.label &&
      this.spec.classNames === other.spec.classNames
    );
  }

  get estimatedHeight(): number {
    return 26;
  }

  toDOM() {
    const isRoleChip = this.spec.classNames.includes("markdown-speaker-label");
    const roleToken = isRoleChip ? String(this.spec.title ?? "").trim() : "";

    if (isRoleChip && roleToken) {
      const btn = document.createElement("button");
      btn.type = "button";
      for (const c of this.spec.classNames.split(/\s+/)) {
        if (c) btn.classList.add(c);
      }
      btn.classList.add("_");
      btn.textContent = this.spec.label;
      btn.title = this.spec.title;
      if (this.spec.style) btn.setAttribute("style", this.spec.style);
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.getOnRoleClick?.()?.(roleToken);
      });
      return btn;
    }

    const el = document.createElement("span");
    for (const c of this.spec.classNames.split(/\s+/)) {
      if (c) el.classList.add(c);
    }
    el.classList.add("_");
    el.textContent = this.spec.label;
    el.title = this.spec.title;
    if (this.spec.style) el.setAttribute("style", this.spec.style);
    return el;
  }

  ignoreEvent(event: Event) {
    if (this.spec.classNames.includes("markdown-speaker-label")) {
      return (
        event.type === "mousedown" ||
        event.type === "mouseup" ||
        event.type === "click" ||
        event.type === "pointerdown" ||
        event.type === "pointerup"
      );
    }
    return false;
  }
}

class OrchestraImagePreviewWidget extends WidgetType {
  private cancelled = false;
  private ownedBlobUrl: string | null = null;

  constructor(
    readonly raw: string,
    readonly alt: string,
    readonly key: string,
    readonly getImageCtx: () => EditorImageCtx,
    readonly getView: () => EditorView | null,
    /** Каретка в зоне токена: сырая разметка под превью, виджет не снимается. */
    readonly revealRaw: boolean,
  ) {
    super();
  }

  eq(other: OrchestraImagePreviewWidget) {
    return (
      other instanceof OrchestraImagePreviewWidget &&
      this.raw === other.raw &&
      this.key === other.key &&
      this.alt === other.alt &&
      this.revealRaw === other.revealRaw
    );
  }

  get estimatedHeight(): number {
    return (this.revealRaw ? 58 : 0) + 132;
  }

  private trackOwnedBlob(url: string) {
    if (!url.startsWith("blob:")) return;
    if (this.ownedBlobUrl && this.ownedBlobUrl !== url) {
      URL.revokeObjectURL(this.ownedBlobUrl);
    }
    this.ownedBlobUrl = url;
  }

  private showImageError(
    media: HTMLElement,
    view: EditorView | null,
  ) {
    media.replaceChildren();
    const err = document.createElement("span");
    err.className =
      "cm-md-orchestra-image-preview__ph cm-md-orchestra-image-preview__ph--err";
    err.textContent = "⚠";
    err.title = "Не удалось загрузить изображение";
    media.appendChild(err);
    view?.requestMeasure();
  }

  private mountImage(
    media: HTMLElement,
    view: EditorView | null,
    url: string,
    allowStreamRetry: boolean,
  ) {
    const img = document.createElement("img");
    img.className = "cm-md-orchestra-image-preview__img";
    img.alt = this.alt;
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.title =
      this.raw.length > 400 ? `${this.raw.slice(0, 400)}…` : this.raw;
    img.onload = () => {
      if (!this.cancelled) view?.requestMeasure();
    };
    img.onerror = () => {
      if (this.cancelled) return;
      if (!allowStreamRetry) {
        this.showImageError(media, view);
        return;
      }
      editorPlayUrlCache.delete(normalizeEditorOrchestraImageKey(this.key));
      void resolveEditorOrchestraImageStreamUrl(
        this.getImageCtx().accessToken,
        this.key,
      ).then((streamUrl) => {
        if (this.cancelled) return;
        if (!streamUrl) {
          this.showImageError(media, view);
          return;
        }
        this.trackOwnedBlob(streamUrl);
        this.mountImage(media, view, streamUrl, false);
      });
    };
    this.trackOwnedBlob(url);
    img.src = url;
    media.replaceChildren(img);
    view?.requestMeasure();
  }

  toDOM() {
    this.cancelled = false;
    const wrap = document.createElement("span");
    wrap.className = "cm-md-orchestra-image-preview";
    if (this.revealRaw) {
      wrap.classList.add("cm-md-orchestra-image-preview--with-raw");
      const rawEl = document.createElement("span");
      rawEl.className = "cm-md-orchestra-image-preview__raw";
      rawEl.textContent = this.raw;
      rawEl.title = this.raw.length > 500 ? `${this.raw.slice(0, 500)}…` : this.raw;
      wrap.appendChild(rawEl);
    }

    const media = document.createElement("span");
    media.className = "cm-md-orchestra-image-preview__media";
    const ph = document.createElement("span");
    ph.className = "cm-md-orchestra-image-preview__ph";
    ph.textContent = "…";
    media.appendChild(ph);
    wrap.appendChild(media);

    const { accessToken } = this.getImageCtx();
    void resolveEditorOrchestraImageUrl(accessToken, this.key).then((url) => {
      if (this.cancelled) return;
      const view = this.getView();
      if (!url) {
        ph.textContent = "🖼";
        ph.title =
          this.raw.length > 400 ? `${this.raw.slice(0, 400)}…` : this.raw;
        view?.requestMeasure();
        return;
      }
      const allowStreamRetry = !url.startsWith("blob:");
      this.mountImage(media, view, url, allowStreamRetry);
    });

    return wrap;
  }

  destroy() {
    this.cancelled = true;
    if (this.ownedBlobUrl) {
      URL.revokeObjectURL(this.ownedBlobUrl);
      this.ownedBlobUrl = null;
    }
  }
}

class TrackLinkChipWidget extends WidgetType {
  constructor(
    readonly raw: string,
    readonly label: string,
    readonly numericId: number | null,
    readonly getOnTrackClick: () => ((id: number) => void) | undefined,
  ) {
    super();
  }

  get estimatedHeight(): number {
    return 26;
  }

  toDOM() {
    const cb = this.numericId != null ? this.getOnTrackClick() : undefined;
    if (cb && this.numericId != null) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "markdown-track-link cm-md-orchestra-chip";
      btn.textContent = this.label;
      btn.title = this.raw;
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        cb(this.numericId!);
      });
      return btn;
    }
    const el = document.createElement("span");
    el.className =
      "markdown-track-link cm-md-orchestra-chip cm-md-orchestra-track-link--static";
    el.textContent = this.label;
    el.title = this.raw;
    return el;
  }

  ignoreEvent() {
    return false;
  }
}

function pickNonOverlapping(spans: RichSpan[]): RichSpan[] {
  spans.sort((a, b) => {
    if (a.from !== b.from) return a.from - b.from;
    return b.to - b.from - (a.to - a.from);
  });
  const out: RichSpan[] = [];
  let curEnd = -1;
  for (const s of spans) {
    if (s.from < curEnd) continue;
    out.push(s);
    curEnd = s.to;
  }
  return out;
}

function buildRichDecorations(
  state: EditorState,
  lightChannels: string[],
  getOnTrackLinkClick: () => ((trackId: number) => void) | undefined,
  getOnRoleClick: () => ((roleToken: string) => void) | undefined,
  getImageCtx: () => EditorImageCtx,
  getPlayTextMode: () => boolean,
  view: EditorView,
): { decorations: DecorationSet; hiddenAtomic: DecorationSet } {
  const playTextMode = getPlayTextMode();
  const sel = state.selection.main;
  const b = new RangeSetBuilder<Decoration>();
  const hiddenB = new RangeSetBuilder<Decoration>();
  const doc = state.doc;

  for (let li = 1; li <= doc.lines; li++) {
    const line = doc.line(li);
    const text = line.text;
    const spans: RichSpan[] = [];
    const tokenOverlays: TokenOverlay[] = [];
    let headingForMarks: { ht: number; level: number } | null = null;

    const pushHidden = (from: number, to: number) => {
      spans.push({ from, to, deco: HIDDEN_SOURCE });
    };

    if (!looksLikeFenceLine(text)) {
      const hm = /^(\s{0,3})(#{1,3})(\s+|\s*$)/u.exec(text);
      if (hm) {
        const ht = line.from + hm.index + hm[0].length;
        const level = hm[2].length;
        headingForMarks = { ht, level };
      }
    }

    ORCH_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = ORCH_TOKEN_RE.exec(text)) !== null) {
      const from = line.from + m.index;
      const to = from + m[0].length;
      if (selectionInsideToken(sel, from, to)) continue;
      if (m[7]) {
        const parsed = parseOrchestraImageFromMarkdown(m[0]);
        if (parsed) {
          if (spans.some((s) => spansOverlap(s.from, s.to, from, to))) continue;
          pushHidden(from, to);
          tokenOverlays.push({
            from,
            to,
            widget: new OrchestraImagePreviewWidget(
              m[0],
              parsed.alt,
              parsed.key,
              getImageCtx,
              () => view,
              false,
            ),
          });
          continue;
        }
      }
      const nextChar = text[m.index + m[0].length] ?? "";
      const spec = resolveChip(m[0], m, lightChannels, playTextMode, nextChar);
      if (!spec) continue;
      const hideTo =
        m[5] != null && hasRealSpaceAfterRoleToken(nextChar) ? to + 1 : to;
      if (spans.some((s) => spansOverlap(s.from, s.to, from, hideTo))) continue;
      pushHidden(from, hideTo);
      tokenOverlays.push({
        from,
        to: hideTo,
        widget: new OrchestraChipWidget(m[0], spec, getOnRoleClick),
      });
    }

    TRACK_OR_PLAYLIST_LINK_RE.lastIndex = 0;
    let tm: RegExpExecArray | null;
    while ((tm = TRACK_OR_PLAYLIST_LINK_RE.exec(text)) !== null) {
      const from = line.from + tm.index;
      const to = from + tm[0].length;
      if (selectionInsideToken(sel, from, to)) continue;
      if (spans.some((s) => spansOverlap(s.from, s.to, from, to))) continue;
      const innerLabel = String(tm[1] ?? "").trim();
      const payload = normalizeTrackPayload(String(tm[3] ?? ""));
      const id = Number(payload);
      const numericId = Number.isFinite(id) ? id : null;
      const display =
        innerLabel.length > 28
          ? `${innerLabel.slice(0, 28)}…`
          : innerLabel || "▶";
      pushHidden(from, to);
      tokenOverlays.push({
        from,
        to,
        widget: new TrackLinkChipWidget(
          tm[0],
          display,
          numericId,
          getOnTrackLinkClick,
        ),
      });
    }

    PARENTHETICAL_RE.lastIndex = 0;
    let pm: RegExpExecArray | null;
    while ((pm = PARENTHETICAL_RE.exec(text)) !== null) {
      const from = line.from + pm.index;
      const to = from + pm[0].length;
      const before = text[pm.index - 1] ?? "";
      // Пропуск markdown-ссылок `](…`, но не ремарок после `]](…`
      if (before === "]" && text[pm.index - 2] !== "]") continue;
      if (spans.some((s) => spansOverlap(s.from, s.to, from, to))) continue;
      spans.push({
        from,
        to,
        deco: Decoration.mark({ class: "cm-md-parenthetical-remark" }),
      });
    }

    const picked = pickNonOverlapping(spans);
    for (const s of picked) {
      if (s.deco === HIDDEN_SOURCE) {
        hiddenB.add(s.from, s.to, HIDDEN_SOURCE);
      }
    }
    const lineAdds: RichSpan[] = [...picked];
    for (const s of picked) {
      const overlay = tokenOverlays.find((o) => o.from === s.from && o.to === s.to);
      if (!overlay) continue;
      lineAdds.push({
        from: overlay.from,
        to: overlay.from,
        deco: Decoration.widget({ widget: overlay.widget, side: -1 }),
      });
    }

    if (headingForMarks && headingForMarks.ht < line.to) {
      const ht = headingForMarks.ht;
      const level = headingForMarks.level;
      const obstacles: Array<{ from: number; to: number }> = [];
      for (const s of picked) {
        const a = Math.max(s.from, ht);
        const b = Math.min(s.to, line.to);
        if (a < b) obstacles.push({ from: a, to: b });
      }
      for (const seg of subtractIntervals(ht, line.to, obstacles)) {
        lineAdds.push({
          from: seg.from,
          to: seg.to,
          deco: Decoration.mark({
            class: `cm-md-heading-body cm-md-heading-body--${level}`,
          }),
        });
      }
    }

    lineAdds.sort((a, b) => {
      if (a.from !== b.from) return a.from - b.from;
      return a.to - b.to;
    });
    for (const s of lineAdds) {
      b.add(s.from, s.to, s.deco);
    }
  }

  return { decorations: b.finish(), hiddenAtomic: hiddenB.finish() };
}

/**
 * В редакторе подменяет «стену» `{{…}}`, `[[…]]` на компактные чипы; `![…](orchestra-image:…)` —
 * на миниатюру по play-url. При каретке в токене orchestra-image под превью показывается сырая строка.
 * Для остальных чипов при каретке внутри токена показывается исходный текст.
 */
export function orchestraEditorRichTokens(
  getLightChannels: () => string[],
  getOnTrackLinkClick: () => ((trackId: number) => void) | undefined,
  getImageCtx: () => EditorImageCtx,
  getPlayTextMode: () => boolean,
  getOnRoleClick: () => ((roleToken: string) => void) | undefined = () => undefined,
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      hiddenAtomic: DecorationSet = Decoration.none;
      lastChannelStamp = "";
      lastImageCtxStamp = "";
      lastPlayTextMode = getPlayTextMode();
      constructor(readonly view: EditorView) {
        const ch = getLightChannels();
        this.lastChannelStamp = ch.join("\n");
        this.lastImageCtxStamp = editorImageCtxStamp(getImageCtx());
        this.applyBuild(view.state, ch);
      }
      applyBuild(state: EditorState, ch: string[]) {
        const built = buildRichDecorations(
          state,
          ch,
          getOnTrackLinkClick,
          getOnRoleClick,
          getImageCtx,
          getPlayTextMode,
          this.view,
        );
        this.decorations = built.decorations;
        this.hiddenAtomic = built.hiddenAtomic;
      }
      update(u: ViewUpdate) {
        const ch = getLightChannels();
        const stamp = ch.join("\n");
        const iStamp = editorImageCtxStamp(getImageCtx());
        const playTextMode = getPlayTextMode();
        if (
          u.docChanged ||
          u.selectionSet ||
          u.viewportChanged ||
          stamp !== this.lastChannelStamp ||
          iStamp !== this.lastImageCtxStamp ||
          playTextMode !== this.lastPlayTextMode
        ) {
          this.lastChannelStamp = stamp;
          this.lastImageCtxStamp = iStamp;
          this.lastPlayTextMode = playTextMode;
          this.applyBuild(u.state, ch);
        }
        if (
          u.selectionSet &&
          !u.transactions.some((t) => t.annotation(Transaction.userEvent) === "select.fix")
        ) {
          const sel = u.state.selection.main;
          if (sel.empty) {
            let pos = sel.head;
            let moved = false;
            this.hiddenAtomic.between(0, u.state.doc.length, (from, to) => {
              if (pos > from && pos < to) {
                pos = to;
                moved = true;
              }
            });
            if (moved) {
              u.view.dispatch({
                selection: EditorSelection.cursor(pos),
                annotations: Transaction.userEvent.of("select.fix"),
              });
            }
          }
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (p) =>
        EditorView.atomicRanges.of((view) => view.plugin(p)?.hiddenAtomic ?? Decoration.none),
    },
  );

  return [plugin, enterEditableTokenKeymap()];
}

