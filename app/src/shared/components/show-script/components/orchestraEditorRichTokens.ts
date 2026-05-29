import {
  EditorSelection,
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
  ViewPlugin,
  WidgetType,
  type ViewUpdate,
} from "@codemirror/view";
import { getPlayUrl } from "../../../../sync/api/files";
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

async function resolveEditorOrchestraImageUrl(
  accessToken: string | null | undefined,
  key: string,
): Promise<string | undefined> {
  const cached = editorPlayUrlCache.get(key);
  if (cached) return cached;
  const token =
    accessToken ??
    (typeof window !== "undefined"
      ? window.localStorage.getItem("accessToken")
      : null);
  if (!token || !token.trim()) return undefined;
  let pending = editorPlayUrlInflight.get(key);
  if (!pending) {
    pending = getPlayUrl(token, key)
      .then((r) => r.url || undefined)
      .catch(() => undefined)
      .finally(() => {
        editorPlayUrlInflight.delete(key);
      });
    editorPlayUrlInflight.set(key, pending);
  }
  const url = await pending;
  if (url) editorPlayUrlCache.set(key, url);
  return url;
}

function parseOrchestraImageFromMarkdown(
  full: string,
): { alt: string; key: string } | null {
  const encM = /\]\(\s*orchestra-image:\s*([^)]+)\)/i.exec(full);
  if (!encM) return null;
  let key = String(encM[1] ?? "").trim();
  try {
    key = decodeURIComponent(key);
  } catch {
    /* keep encoded */
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

function resolveChip(
  full: string,
  m: RegExpExecArray,
  lightChannels: string[],
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
    return {
      label: text,
      classNames: "markdown-speaker-label",
      title: normalized,
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

  ignoreEvent() {
    return false;
  }
}

class OrchestraImagePreviewWidget extends WidgetType {
  private cancelled = false;

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
        media.replaceChildren();
        const err = document.createElement("span");
        err.className =
          "cm-md-orchestra-image-preview__ph cm-md-orchestra-image-preview__ph--err";
        err.textContent = "⚠";
        err.title = "Не удалось загрузить изображение";
        media.appendChild(err);
        view?.requestMeasure();
      };
      img.src = url;
      media.replaceChildren(img);
      view?.requestMeasure();
    });

    return wrap;
  }

  destroy() {
    this.cancelled = true;
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
  getImageCtx: () => EditorImageCtx,
  view: EditorView,
): { decorations: DecorationSet; hiddenAtomic: DecorationSet } {
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
      const spec = resolveChip(m[0], m, lightChannels);
      if (!spec) continue;
      if (spans.some((s) => spansOverlap(s.from, s.to, from, to))) continue;
      pushHidden(from, to);
      tokenOverlays.push({
        from,
        to,
        widget: new OrchestraChipWidget(m[0], spec),
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
      if (before === "]") continue;
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
): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet = Decoration.none;
      hiddenAtomic: DecorationSet = Decoration.none;
      lastChannelStamp = "";
      lastImageCtxStamp = "";
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
          getImageCtx,
          this.view,
        );
        this.decorations = built.decorations;
        this.hiddenAtomic = built.hiddenAtomic;
      }
      update(u: ViewUpdate) {
        const ch = getLightChannels();
        const stamp = ch.join("\n");
        const iStamp = editorImageCtxStamp(getImageCtx());
        if (
          u.docChanged ||
          u.selectionSet ||
          u.viewportChanged ||
          stamp !== this.lastChannelStamp ||
          iStamp !== this.lastImageCtxStamp
        ) {
          this.lastChannelStamp = stamp;
          this.lastImageCtxStamp = iStamp;
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

  return [plugin];
}

