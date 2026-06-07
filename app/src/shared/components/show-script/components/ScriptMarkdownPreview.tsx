import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import { useNavigate } from "react-router-dom";
import { useProjectRolesQuery } from "../../../../features/project/api/project-api";
import type { SceneRolesDataV1 } from "../../../../features/scene";
import {
  selectActiveStepMarkdownContext,
  selectAnnotations,
  selectShowScriptMarkdownUi,
} from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import type { ActorAnnotation } from "../../../../sync/api/actor-notes";
import { fetchImageStreamBlobUrl, getPlayUrl } from "../../../../sync/api/files";
import { getDesktopApi } from "../../../platform/desktop-api";
import {
  httpUrlToImageFileName,
  decodeOrchestraImageStorageKey,
  storageKeyToImageBasename,
} from "../../../utils/markdownImages";
import { Buttons } from "../../buttons/Buttons";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import {
  ActorAnnotationsPopover,
  type NewAnnotationDraft,
} from "../annotations/ActorAnnotationsPopover";
import { rehypeActorAnnotations } from "../annotations/rehypeActorAnnotations";
import { useAnnotationsPopoverPosition } from "../hooks/useAnnotationsPopoverPosition";
import {
  createRehypeScriptTokens,
  createRenderLightTokens,
} from "../utils/lightTokens";
import { expandKadrLabelBlockBreaks } from "../utils/expandKadrLabelBlockBreaks";
import { rehypeKadrSections } from "../utils/rehypeKadrSections";
import { KadrProjectorMediaPreview } from "./KadrProjectorMediaPreview";
import { MarkdownTrackLink } from "./MarkdownTrackLink";
import {
  MarkdownKadrMediaContext,
  type MarkdownKadrMediaLookup,
} from "./markdown-kadr-media-context";
import { rehypeStripLightKadrAnchors } from "../utils/rehypeStripLightKadrAnchors";
import { resolveLightFaders } from "../../light-console/light-console-data";
import { buildLightSchemeLookModel } from "../../light-console/light-scheme-preview";
import { applyKadrProjector } from "../../../../features/spectacle-run/model/apply-kadr-projector";
import { openProjectorWindow } from "../../../../features/projector/model/projector-playback-bridge";
import { LightSchemeLookCard } from "../../light-console/LightSchemeLookCard";
import {
  findKadrById,
  fadersForKadrDisplay,
  readStepLightKadrs,
  scanMarkdownKadrSections,
} from "../../../../features/theater/model/light-kadrs";
import { parseSoundVolumeFromFieldBody } from "../../../../features/theater/model/kadr-sound";
import type { PlaylistPlayOptions } from "../../../../features/scene/model/scene-playback-bridge";
import type { LightFixture } from "../../../types/script";
import "../../light-console/light-console.css";

const MarkdownKadrIdContext = createContext<string | null>(null);
const MarkdownKadrLightColumnContext = createContext(false);
const MarkdownKadrPictureColumnContext = createContext(false);
const MarkdownKadrBodyContext = createContext(false);
const MarkdownKadrSoundPlaybackContext = createContext<number | undefined>(undefined);
const MarkdownPreviewParagraphBridgeContext =
  createContext<Omit<MarkdownPreviewParagraphProps, "children"> | null>(null);
const MarkdownPreviewLightTokensBridgeContext =
  createContext<((children: React.ReactNode) => React.ReactNode) | null>(null);

const EMPTY_ANNOTATIONS: ActorAnnotation[] = [];

function looksLikeOpaqueMediaId(value: string): boolean {
  const t = String(value ?? "").trim();
  if (!t) return false;
  if (/^[a-f0-9]{24,}$/i.test(t)) return true;
  if (/^orchestra-image:/i.test(t)) return true;
  return false;
}

function desktopOfflineImageFromCache(
  rawHref: string,
  resolveImageSrc: (src?: string) => string | undefined,
): string | undefined {
  if (!getDesktopApi()?.invoke) return undefined;
  if (rawHref.startsWith("orchestra-image:")) {
    const enc = rawHref.replace(/^orchestra-image:/i, "").trim();
    const key = decodeOrchestraImageStorageKey(enc);
    const bn = storageKeyToImageBasename(key);
    if (!bn) return undefined;
    return resolveImageSrc(`images/${bn}`);
  }
  if (/^https?:\/\//i.test(rawHref)) {
    const bn = httpUrlToImageFileName(rawHref);
    return resolveImageSrc(`images/${bn}`);
  }
  return undefined;
}

const LINE_LABEL_CLASSNAMES = new Set([
  "markdown-speaker-label", // roles: [[ЕЛЕНА]]
  "markdown-light-chip", // lights: {{light:1}}
  "markdown-play-label", // music: {{play:123}}
  "markdown-sound-label", // sounds: {{sound:1}} / {{sfx:1}}
  "markdown-video-label", // projector: {{video:1}}
]);

type LineLabelKind = "role" | "light" | "play" | "sound" | "video";

function markdownHasRoleLightOrPlayLineLabels(markdown: string): boolean {
  const raw = String(markdown ?? "");
  if (!raw.trim()) return false;
  // Avoid false-positives from examples in code fences.
  const withoutCodeFences = raw.replace(/```[\s\S]*?```/g, "");

  // We treat "line labels" as tokens that are typically placed at the beginning of a paragraph.
  // - roles: [[ЕЛЕНА]]
  // - lights: {{light:1}} / {{blackout}}
  // - play: {{play:123}}
  // - sound: {{sound:1}} / {{sfx:"applause"}}
  const re =
    /(^|\n)\s*(\[\[\s*[^\]]+?\s*]]|\{\{\s*(?:light|blackout|play|sound|sfx)\b[^}]*}})/i;
  return re.test(withoutCodeFences);
}

const FENCE_RE = /```[\s\S]*?```/g;

function isMarkdownListItemLine(line: string): boolean {
  return /^\s{0,3}[-*+]\s+/.test(line);
}

/** Строка «сценического» блока: роль, свет/play/sfx, трек, orchestra-image. */
function isScriptishBlockLine(line: string): boolean {
  const t = line.replace(/^\s{0,3}>\s?/, "").replace(/^\s{0,3}[-*+]\s+/, "").trim();
  if (!t) return false;
  if (/^\[\[/.test(t)) return true;
  if (/^\{\{\s*(?:light|blackout|b|play|sound|sfx)\b/i.test(t)) return true;
  if (/^\[[^\]]*]\(\s*(?:track|playlist)\s*:/i.test(t)) return true;
  if (/^!\[/.test(t)) return true;
  return false;
}

/** Между двумя соседними строками исходника нужна синтетическая пустая строка, иначе commonmark склеит их в один &lt;p&gt;. */
function needsSyntheticParagraphBlankBetweenAdjacentLines(line: string, next: string): boolean {
  const lineList = isMarkdownListItemLine(line);
  const nextList = isMarkdownListItemLine(next);
  const lineScr = isScriptishBlockLine(line) && !lineList;
  const nextScr = isScriptishBlockLine(next) && !nextList;

  if (lineScr && nextScr) return true;

  /* Ремарка / абзац одной строкой, затем реплика с [[…]] — одного \n в md недостаточно для нового абзаца. */
  if (line.trim() !== "" && !lineScr && !lineList && nextScr) return true;

  /* Реплика / сценическая строка, затем проза (не сценическая): один \n иначе даёт <br>, а нужен новый абзац. */
  if (lineScr && !lineList && !nextList && !nextScr && next.trim() !== "") return true;

  return false;
}

function expandScriptLineParagraphBreaksInSegment(segment: string): string {
  const lines = segment.split("\n");
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    out.push(line);
    if (i + 1 >= lines.length) break;
    const next = lines[i + 1]!;
    if (needsSyntheticParagraphBlankBetweenAdjacentLines(line, next)) {
      out.push("");
    }
  }
  return out.join("\n");
}

/**
 * Без пустой строки commonmark склеивает соседние строки в один &lt;p&gt; — лейблы и отступы ломаются.
 * Добавляем `\n\n` между парными «сценическими» строками, между обычным текстом и следующей сценической
 * (например ремарка и `[[РОЛЬ]]`), между сценической строкой и следующей не-сценической (реплика и ремарка),
 * вне ```…```. Строки списков `- …` не трогаем.
 * Если уже есть сохранённые метки — не меняем строку (офсеты rehype совпадают с исходником).
 */
function expandScriptLineParagraphBreaks(
  markdown: string,
  annotationsMode: boolean,
  annotationCount: number,
): string {
  if (annotationsMode && annotationCount > 0) return markdown;
  const src = String(markdown ?? "");
  if (!src) return src;
  FENCE_RE.lastIndex = 0;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(src)) !== null) {
    parts.push(expandScriptLineParagraphBreaksInSegment(src.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(expandScriptLineParagraphBreaksInSegment(src.slice(last)));
  return parts.join("");
}

/**
 * CommonMark объединяет три и более подряд `\n` между блоками в один разрыв абзацев — лишний Enter
 * в редакторе не даёт дополнительного вертикального воздуха в превью. Превращаем «лишние» переводы
 * в отдельные абзацы с U+00A0 (как в типографике пустая строка с невидимым символом).
 */
function injectNbspParagraphsForTripleNewlinesInSegment(segment: string): string {
  return segment.replace(/\n{3,}/g, (run) => {
    const n = run.length;
    return "\n\n" + Array.from({ length: n - 2 }, () => "\u00a0").join("\n\n") + "\n\n";
  });
}

function injectNbspParagraphsForTripleNewlines(markdown: string): string {
  const src = String(markdown ?? "");
  if (!src) return src;
  FENCE_RE.lastIndex = 0;
  const parts: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = FENCE_RE.exec(src)) !== null) {
    parts.push(injectNbspParagraphsForTripleNewlinesInSegment(src.slice(last, m.index)));
    parts.push(m[0]);
    last = m.index + m[0].length;
  }
  parts.push(injectNbspParagraphsForTripleNewlinesInSegment(src.slice(last)));
  return parts.join("");
}

function isIgnorableLeadingNode(node: React.ReactNode): boolean {
  if (node == null || typeof node === "boolean") return true;
  if (typeof node === "string") {
    // Treat NBSP / ZWSP as whitespace too
    return /^[\s\u00A0\u200B\u200C\u200D\uFEFF]*$/.test(node);
  }
  if (React.isValidElement(node)) {
    return node.type === "br";
  }
  return false;
}

function isLineLabelElement(node: unknown): node is React.ReactElement {
  if (!React.isValidElement(node)) return false;
  const className = (node.props as any)?.className;
  if (typeof className === "string") {
    for (const part of className.split(/\s+/)) {
      if (LINE_LABEL_CLASSNAMES.has(part)) return true;
    }
    return false;
  }
  if (Array.isArray(className)) return className.some((c) => LINE_LABEL_CLASSNAMES.has(String(c)));
  return false;
}

function getLineLabelKind(el: React.ReactElement): LineLabelKind | null {
  const className = (el.props as any)?.className;
  const parts =
    typeof className === "string"
      ? className.split(/\s+/)
      : Array.isArray(className)
        ? className.map((c) => String(c))
        : [];
  if (parts.includes("markdown-speaker-label")) return "role";
  if (parts.includes("markdown-light-chip")) return "light";
  if (parts.includes("markdown-play-label")) return "play";
  if (parts.includes("markdown-sound-label")) return "sound";
  if (parts.includes("markdown-video-label")) return "video";
  return null;
}

type TrackLinkPayload = { id: number } | { name: string };
type SoundLinkPayload = { id: number } | { name: string };
type VideoLinkPayload = { id: number };

type MarkdownLightboxSlide = { src: string; alt: string };

type MarkdownLightboxState = {
  slides: MarkdownLightboxSlide[];
  index: number;
};

type MarkdownPreviewImageContextValue = {
  accessToken: string | null;
  playUrlCache: React.MutableRefObject<Map<string, string>>;
  resolveImageSrc: (src?: string) => string | undefined;
  resolveSoundIconFromPayload: (payload: SoundLinkPayload) => string | null;
  openLightbox: (src: string, alt: string) => void;
};

/** Все открываемые по клику превью-картинки в порядке документа (только уже загруженные). */
function collectLightboxSlidesFromPreviewRoot(root: HTMLElement | null): MarkdownLightboxSlide[] {
  if (!root) return [];
  const imgs = root.querySelectorAll(
    'button.markdown-image-btn span.markdown-img-with-preloader[data-state="loaded"] img',
  );
  const out: MarkdownLightboxSlide[] = [];
  imgs.forEach((node) => {
    if (!(node instanceof HTMLImageElement)) return;
    const src = String(node.currentSrc || node.getAttribute("src") || "").trim();
    if (!src) return;
    out.push({ src, alt: String(node.getAttribute("alt") ?? "").trim() });
  });
  return out;
}

const MarkdownPreviewImageContext = createContext<MarkdownPreviewImageContextValue | null>(null);

/** Параллельные MarkdownPreviewImage с одним storage key — один HTTP-запрос play-url. */
const playUrlInflight = new Map<string, Promise<string | undefined>>();

/** Presigned URL не запрашиваем, пока превью не близко к видимой области (как lazy-loading у нормальных CDN-клиентов). */
const ORCH_IMAGE_IO_ROOT_MARGIN = "420px 0px 280px 0px";

type MarkdownPreviewImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  /** Служебный HAST-узел react-markdown — не пробрасывать в DOM. */
  node?: unknown;
  children?: React.ReactNode;
};

function normalizeMarkdownImgSrc(src: unknown): string {
  if (src == null) return "";
  if (typeof src === "string") return src.trim();
  if (Array.isArray(src)) return normalizeMarkdownImgSrc(src[0]);
  return "";
}

function resolveOrchestraImageStorageKey(rawHref: string): string | null {
  const raw = String(rawHref ?? "").trim();
  if (!raw) return null;
  if (raw.startsWith("orchestra-image:")) {
    const encoded = raw.replace(/^orchestra-image:/i, "").trim();
    const key = decodeOrchestraImageStorageKey(encoded);
    return key || null;
  }
  const fromPublicUrl = /\/orchestra-media\/([^/?#]+\/image\/[^/?#]+)/i.exec(raw);
  if (fromPublicUrl?.[1]) {
    try {
      return decodeURIComponent(fromPublicUrl[1]);
    } catch {
      return fromPublicUrl[1];
    }
  }
  return null;
}

/** Must stay a stable module-level component so React does not remount every image on parent re-render. */
function MarkdownPreviewImage(props: MarkdownPreviewImageProps) {
  const ctx = useContext(MarkdownPreviewImageContext);
  const inKadrPictureColumn = useContext(MarkdownKadrPictureColumnContext);
  const { src: rawSrc, alt, onLoad, onError, node: _node, children: _children, ...rest } = props;
  const src = normalizeMarkdownImgSrc(rawSrc);
  const accessToken = ctx?.accessToken ?? null;
  const resolveToLocal = ctx?.resolveImageSrc;
  const resolveSound = ctx?.resolveSoundIconFromPayload;
  const playUrlCache = ctx?.playUrlCache;
  const raw = String(src ?? "").trim();
  const isOrchestraImage = raw.startsWith("orchestra-image:");
  const preferEagerOrchestraLoad = isOrchestraImage && inKadrPictureColumn;
  const initial =
    !ctx
      ? raw
      : raw.startsWith("sound-icon:")
        ? ""
        : raw.startsWith("orchestra-image:")
          ? desktopOfflineImageFromCache(raw, ctx.resolveImageSrc) ?? ""
          : /^https?:\/\//i.test(raw)
            ? raw
            : (ctx.resolveImageSrc(raw) || raw);
  const [resolved, setResolved] = useState<string>(initial);
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [playUrlRetry, setPlayUrlRetry] = useState(0);
  const httpTriedLocalFallbackRef = useRef(false);
  const orchestraLocalFallbackRef = useRef(false);
  const orchestraStreamFallbackRef = useRef(false);
  const blobUrlRef = useRef<string | null>(null);
  const orchSentinelRef = useRef<HTMLSpanElement | null>(null);
  /** Для orchestra-image с сетевым play-url ждём intersection; в колонке кадра грузим сразу. */
  const [orchInView, setOrchInView] = useState(() => !isOrchestraImage || preferEagerOrchestraLoad);

  useEffect(() => {
    setPlayUrlRetry(0);
    httpTriedLocalFallbackRef.current = false;
    orchestraLocalFallbackRef.current = false;
    orchestraStreamFallbackRef.current = false;
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, [src]);

  useEffect(
    () => () => {
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    },
    [],
  );

  useEffect(() => {
    const s = String(src ?? "").trim();
    setOrchInView(!s.startsWith("orchestra-image:") || inKadrPictureColumn);
  }, [src, inKadrPictureColumn]);

  useEffect(() => {
    if (!isOrchestraImage || orchInView || preferEagerOrchestraLoad) return;
    const el = orchSentinelRef.current;
    if (!el) {
      setOrchInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setOrchInView(true);
          io.disconnect();
        }
      },
      { root: null, rootMargin: ORCH_IMAGE_IO_ROOT_MARGIN, threshold: 0.01 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [src, isOrchestraImage, orchInView]);

  useEffect(() => {
    if (!ctx || !playUrlCache || !resolveToLocal || !resolveSound) return;
    let cancelled = false;
    const run = async () => {
      const s = String(src ?? "").trim();
      if (!s) return;
      if (s.startsWith("sound-icon:")) {
        const rawPayload = s.replace(/^sound-icon:/i, "").trim();
        const n = Number(rawPayload);
        const safeName = (() => {
          try {
            return decodeURIComponent(rawPayload);
          } catch {
            return rawPayload;
          }
        })();
        const payload: SoundLinkPayload = Number.isFinite(n) ? { id: n } : { name: safeName };
        const url = resolveSound(payload);
        if (!cancelled && url) setResolved(url);
        return;
      }
      if (s.startsWith("orchestra-image:")) {
        const encoded = s.replace(/^orchestra-image:/i, "").trim();
        const key = decodeOrchestraImageStorageKey(encoded);
        const tryLocalOrchestra = () => {
          const localUrl = desktopOfflineImageFromCache(s, resolveToLocal);
          if (localUrl) {
            if (!cancelled) setResolved(localUrl);
            return true;
          }
          return false;
        };
        const cached = playUrlCache.current.get(key);
        if (cached) {
          if (!cancelled) setResolved(cached);
          return;
        }
        if (!orchInView) return;
        const token =
          accessToken ??
          (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);
        if (!token) {
          tryLocalOrchestra();
          return;
        }
        try {
          let pending = playUrlInflight.get(key);
          if (!pending) {
            pending = getPlayUrl(token, key).then(({ url }) => {
              if (url) playUrlCache.current.set(key, url);
              return url;
            });
            pending.finally(() => {
              playUrlInflight.delete(key);
            });
            playUrlInflight.set(key, pending);
          }
          const url = await pending;
          if (!cancelled && url) setResolved(url);
        } catch {
          tryLocalOrchestra();
        }
        return;
      }
      if (/^https?:\/\//i.test(s)) {
        if (!cancelled) setResolved(s);
        return;
      }
      const local = resolveToLocal(s);
      if (!cancelled) setResolved(local || s);
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [
    ctx,
    src,
    accessToken,
    resolveToLocal,
    resolveSound,
    playUrlCache,
    playUrlRetry,
    orchInView,
  ]);

  useEffect(() => {
    setState("loading");
  }, [resolved]);

  if (!ctx) {
    return <img src={src} alt={alt} {...rest} />;
  }

  const canOpen = Boolean(resolved);
  const altText = String(alt ?? "").trim();

  const tryOrchestraLocalFallback = () => {
    if (!raw.startsWith("orchestra-image:") || orchestraLocalFallbackRef.current || !ctx?.resolveImageSrc) {
      return false;
    }
    const local = desktopOfflineImageFromCache(raw, ctx.resolveImageSrc);
    if (!local) return false;
    orchestraLocalFallbackRef.current = true;
    setResolved(local);
    setState("loading");
    return true;
  };

  const tryOrchestraStreamFallback = (): boolean => {
    if (orchestraStreamFallbackRef.current || !ctx) return false;
    const key = resolveOrchestraImageStorageKey(raw);
    if (!key) return false;
    const token =
      accessToken ??
      (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);
    if (!token?.trim()) return false;
    orchestraStreamFallbackRef.current = true;
    void fetchImageStreamBlobUrl(token, key).then((blobUrl) => {
      if (!blobUrl) {
        setState("error");
        return;
      }
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = blobUrl;
      ctx.playUrlCache.current.delete(key);
      setResolved(blobUrl);
      setState("loading");
    });
    return true;
  };

  const invalidatePlayUrlCacheAndRetry = () => {
    const key = resolveOrchestraImageStorageKey(raw);
    if (!key || !ctx) return;
    setPlayUrlRetry((prev) => {
      if (prev >= 3) {
        setState("error");
        return prev;
      }
      ctx.playUrlCache.current.delete(key);
      setResolved("");
      setState("loading");
      return prev + 1;
    });
  };

  const imgEl = resolved ? (
    <img
      {...rest}
      src={resolved}
      alt={altText}
      loading={preferEagerOrchestraLoad ? "eager" : "lazy"}
      decoding="async"
      onLoad={(e) => {
        setState("loaded");
        onLoad?.(e);
      }}
      onError={(e) => {
        if (tryOrchestraLocalFallback()) return;
        if (tryOrchestraStreamFallback()) return;
        if (
          /^https?:\/\//i.test(raw) &&
          !httpTriedLocalFallbackRef.current &&
          getDesktopApi()?.invoke &&
          ctx?.resolveImageSrc
        ) {
          const local = desktopOfflineImageFromCache(raw, ctx.resolveImageSrc);
          if (local) {
            httpTriedLocalFallbackRef.current = true;
            setResolved(local);
            setState("loading");
            return;
          }
        }
        if (resolveOrchestraImageStorageKey(raw)) {
          invalidatePlayUrlCacheAndRetry();
          return;
        }
        setState("error");
        onError?.(e);
      }}
    />
  ) : null;

  if (!canOpen) {
    return (
      <span
        ref={isOrchestraImage ? orchSentinelRef : undefined}
        className="markdown-img-with-preloader"
        data-state="loading"
      >
        <span className="markdown-preloader" aria-hidden="true">
          <span className="markdown-loader" />
        </span>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="markdown-image-btn"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (state !== "loaded") return;
        ctx.openLightbox(resolved, altText);
      }}
      title="Открыть изображение"
      aria-label="Открыть изображение"
      aria-busy={state === "loading"}
    >
      <span className="markdown-img-with-preloader" data-state={state}>
        {state === "loading" ? (
          <span className="markdown-preloader" aria-hidden="true">
            <span className="markdown-loader" />
          </span>
        ) : null}
        {imgEl}
      </span>
    </button>
  );
}

function getLeadingTrackPayload(children: React.ReactNode): TrackLinkPayload | null {
  const flat = flattenInertSpans(React.Children.toArray(children));
  let i = 0;
  while (i < flat.length) {
    const n = flat[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    break;
  }
  const candidate = flat[i];
  if (!React.isValidElement(candidate)) return null;
  const className = (candidate.props as any)?.className;
  const classStr = Array.isArray(className) ? className.join(" ") : String(className ?? "");
  if (!/\bmarkdown-track-link\b/.test(classStr)) return null;
  const rawId = (candidate.props as any)?.["data-track-id"];
  const rawName = (candidate.props as any)?.["data-track-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

function getPlayPayloadFromLabelEl(labelEl: React.ReactElement): TrackLinkPayload | null {
  const rawId = (labelEl.props as any)?.["data-track-id"];
  const rawName = (labelEl.props as any)?.["data-track-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

function getSoundPayloadFromLabelEl(labelEl: React.ReactElement): SoundLinkPayload | null {
  const rawId = (labelEl.props as any)?.["data-sound-id"];
  const rawName = (labelEl.props as any)?.["data-sound-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

function getLeadingSoundPayload(children: React.ReactNode): SoundLinkPayload | null {
  const flat = flattenInertSpans(React.Children.toArray(children));
  let i = 0;
  while (i < flat.length) {
    const n = flat[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    break;
  }
  const candidate = flat[i];
  if (!React.isValidElement(candidate)) return null;
  const className = (candidate.props as any)?.className;
  const classStr = Array.isArray(className) ? className.join(" ") : String(className ?? "");
  if (!/\bmarkdown-sound-link\b/.test(classStr)) return null;
  const rawId = (candidate.props as any)?.["data-sound-id"];
  const rawName = (candidate.props as any)?.["data-sound-name"];
  const id = Number(rawId);
  if (Number.isFinite(id) && id > 0) return { id };
  const name = String(rawName ?? "").trim();
  if (name) return { name };
  return null;
}

function flattenInertSpans(nodes: React.ReactNode[]): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  for (const n of nodes) {
    if (
      React.isValidElement(n) &&
      (n.type === "span" || n.type === React.Fragment) &&
      n.props &&
      (n.props as any).className == null &&
      (n.props as any).style == null &&
      (n.props as any).title == null &&
      (n.props as any).id == null
    ) {
      out.push(...flattenInertSpans(React.Children.toArray((n.props as any).children)));
      continue;
    }
    out.push(n);
  }
  return out;
}

function splitLeadingLineLabel(
  children: React.ReactNode,
): {
  label: React.ReactElement | null;
  rest: React.ReactNode[];
  kind: LineLabelKind | null;
} {
  const flat = flattenInertSpans(React.Children.toArray(children));
  let i = 0;
  while (i < flat.length) {
    const n = flat[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    break;
  }
  const candidate = flat[i];
  if (!isLineLabelElement(candidate)) {
    return { label: null, rest: flat, kind: null };
  }
  const rest = flat.slice(i + 1);
  return { label: candidate, rest, kind: getLineLabelKind(candidate) };
}

function normalizeRoleToken(v: string) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/\s+/g, " ");
}

function reactNodeHasRawLightPanelToken(node: React.ReactNode): boolean {
  if (node == null || typeof node === "boolean") return false;
  if (typeof node === "string" || typeof node === "number") {
    return /\{\{\s*lightpanel\s*:/i.test(String(node));
  }
  if (Array.isArray(node)) return node.some(reactNodeHasRawLightPanelToken);
  if (React.isValidElement(node)) {
    return reactNodeHasRawLightPanelToken((node.props as { children?: React.ReactNode }).children);
  }
  return false;
}

function reactNodePlainText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(reactNodePlainText).join("");
  if (React.isValidElement(node)) {
    return reactNodePlainText((node.props as { children?: React.ReactNode }).children);
  }
  return "";
}

function skipKadrMediaFieldPrefix(
  flat: React.ReactNode[],
  labels: string[],
  start = 0,
): number {
  let i = start;
  while (i < flat.length && isIgnorableLeadingNode(flat[i])) i += 1;
  if (i >= flat.length) return i;

  const n0 = flat[i];
  if (React.isValidElement(n0) && n0.type === "strong") {
    const token = normalizeRoleToken(reactNodePlainText(n0));
    if (labels.includes(token)) {
      const n1 = flat[i + 1];
      if (n1 == null) return i + 1;
      // Skip label + standalone colon only; keep ": текст…" in rest for trimLeadingFieldColon.
      if (typeof n1 === "string" && /^\s*:\s*$/.test(n1)) return i + 2;
      return i + 1;
    }
  }

  if (typeof n0 === "string") {
    const labelPattern = labels.map((l) => l.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    const m = new RegExp(`^\\s*(?:\\*\\*)?(?:${labelPattern})(?:\\*\\*)?\\s*:\\s*`, "i").exec(n0);
    if (m) return i + 1;
  }

  return start;
}

function skipKadrSoundFieldPrefix(flat: React.ReactNode[], start = 0): number {
  return skipKadrMediaFieldPrefix(flat, ["звук"], start);
}

function skipKadrVideoFieldPrefix(flat: React.ReactNode[], start = 0): number {
  return skipKadrMediaFieldPrefix(flat, ["видео", "проектор"], start);
}

const KADR_TEXT_FIELD_LABELS: Record<string, string> = {
  "действие/задача": "Действие/задача",
  действие: "Действие",
  переход: "Переход",
};

function resolveKadrTextFieldLabel(flat: React.ReactNode[]): string {
  for (const node of flat) {
    if (React.isValidElement(node) && node.type === "strong") {
      const token = normalizeRoleToken(reactNodePlainText(node));
      if (KADR_TEXT_FIELD_LABELS[token]) return KADR_TEXT_FIELD_LABELS[token];
    }
    if (typeof node === "string") {
      const token = normalizeRoleToken(node);
      for (const key of Object.keys(KADR_TEXT_FIELD_LABELS)) {
        if (token.startsWith(key)) return KADR_TEXT_FIELD_LABELS[key]!;
      }
    }
  }
  return "";
}

function splitKadrTextFieldLine(
  rendered: React.ReactNode,
): { label: string; rest: React.ReactNode[] } | null {
  const flat = flattenInertSpans(React.Children.toArray(rendered));
  const labels = Object.keys(KADR_TEXT_FIELD_LABELS);
  const afterPrefix = skipKadrMediaFieldPrefix(flat, labels);
  if (afterPrefix === 0) return null;
  const label = resolveKadrTextFieldLabel(flat);
  if (!label) return null;
  return { label, rest: trimLeadingFieldColon(flat.slice(afterPrefix)) };
}

function trimLeadingSoundMetaSeparator(nodes: React.ReactNode[]): React.ReactNode[] {
  if (nodes.length === 0) return nodes;
  const first = nodes[0];
  if (typeof first !== "string") return nodes;
  const trimmed = first.replace(/^\s*[·•]\s*/, "");
  if (!trimmed.trim()) return trimLeadingSoundMetaSeparator(nodes.slice(1));
  if (trimmed === first) return nodes;
  return [trimmed, ...nodes.slice(1)];
}

function trimLeadingFieldColon(nodes: React.ReactNode[]): React.ReactNode[] {
  let i = 0;
  while (i < nodes.length) {
    const n = nodes[i];
    if (isIgnorableLeadingNode(n)) {
      i += 1;
      continue;
    }
    if (typeof n === "string") {
      const t = n.replace(/^\s*:\s*/, "");
      if (!t.trim()) {
        i += 1;
        continue;
      }
      if (t !== n) return [t, ...nodes.slice(i + 1)];
    }
    break;
  }
  return nodes.slice(i);
}

function reactElementClassStr(el: React.ReactElement): string {
  const className = (el.props as { className?: string }).className;
  return Array.isArray(className) ? className.join(" ") : String(className ?? "");
}

function isPlayLabelElement(node: unknown): boolean {
  if (!React.isValidElement(node)) return false;
  return /\bmarkdown-play-label\b/.test(reactElementClassStr(node));
}

function findKadrTrackLinkInFlat(
  flat: React.ReactNode[],
  start = 0,
): React.ReactElement | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!React.isValidElement(n)) continue;
    if (/\bmarkdown-track-link\b/.test(reactElementClassStr(n))) return n;
  }
  return null;
}

function findKadrMediaChipInFlat(
  flat: React.ReactNode[],
  start = 0,
): { index: number; mediaKind: "play" | "sound" | "video"; mediaLabel: React.ReactElement } | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!isLineLabelElement(n)) continue;
    const kind = getLineLabelKind(n);
    if (kind === "play" || kind === "sound" || kind === "video") {
      return { index: i, mediaKind: kind, mediaLabel: n };
    }
  }
  return null;
}

function isKadrFieldNoiseNode(node: React.ReactNode): boolean {
  if (node == null || typeof node === "boolean") return true;
  if (typeof node === "string") {
    const t = node.trim();
    if (!t) return true;
    if (/^\{\{[\s\S]*\}\}$/.test(t)) return true;
    if (/^orchestra-image:/i.test(t)) return true;
    if (looksLikeOpaqueMediaId(t)) return true;
    return false;
  }
  if (!React.isValidElement(node)) return false;
  const cls = reactElementClassStr(node);
  if (/\bmarkdown-hold-label\b/.test(cls)) return true;
  if (/\bmarkdown-kadr-hold-chip\b/.test(cls)) return true;
  if (/\bmarkdown-video-label\b/.test(cls)) return true;
  if (/\bmarkdown-hold-link\b/.test(cls)) return true;
  if (/\bmarkdown-video-link\b/.test(cls)) return true;
  if (isPlayLabelElement(node)) return true;
  if (node.type === "em") {
    const text = reactNodePlainText(node).toLowerCase().trim();
    if (/записать проектор|не записано|ролик на экран/.test(text)) return true;
    if (text === "заставка") return true;
  }
  if (node.type === "a") {
    const href = String((node.props as { href?: string }).href ?? "").trim();
    const linkText = reactNodePlainText(node).trim();
    if (/^hold:/i.test(href)) return true;
    if (/^orchestra-image:/i.test(href)) return true;
    if (looksLikeOpaqueMediaId(linkText)) return true;
  }
  return false;
}

function collectKadrFieldRestNodes(
  flat: React.ReactNode[],
  afterPrefix: number,
  chipIndex: number | null,
  primaryLink: React.ReactElement | null,
): React.ReactNode[] {
  const rest: React.ReactNode[] = [];
  for (let i = afterPrefix; i < flat.length; i++) {
    if (chipIndex != null && i === chipIndex) continue;
    if (primaryLink && flat[i] === primaryLink) continue;
    const node = flat[i]!;
    if (isKadrFieldNoiseNode(node)) continue;
    rest.push(node);
  }
  return trimLeadingFieldColon(trimLeadingSoundMetaSeparator(rest));
}

function extractKadrVideoTitleFromRest(rest: React.ReactNode[]): string {
  const flat = flattenInertSpans(rest);
  for (const node of flat) {
    if (!React.isValidElement(node)) continue;
    if (/\bmarkdown-video-link\b/.test(reactElementClassStr(node))) {
      const title = reactNodePlainText(node).trim();
      if (title && !looksLikeOpaqueMediaId(title)) return title;
    }
  }
  return "";
}

function parseHoldHrefId(href?: string): number | null {
  const trimmed = String(href ?? "").trim();
  if (!/^hold:/i.test(trimmed)) return null;
  const id = Math.trunc(Number(trimmed.replace(/^hold:/i, "").trim()) || 0);
  return id > 0 ? id : null;
}

function findKadrHoldLinkInFlat(
  flat: React.ReactNode[],
  start = 0,
): React.ReactElement | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!React.isValidElement(n)) continue;
    const cls = reactElementClassStr(n);
    if (/\bmarkdown-hold-link\b/.test(cls)) return n;
    if (n.type === "a") {
      const href = (n.props as { href?: string }).href;
      if (parseHoldHrefId(href) != null) return n;
    }
  }
  return null;
}

function resolveKadrHoldIdFromMediaSignals(
  flat: React.ReactNode[],
  media: MarkdownKadrMediaLookup,
): number | null {
  for (const node of flattenInertSpans(flat)) {
    if (!React.isValidElement(node)) continue;
    const cls = reactElementClassStr(node);
    if (/\bmarkdown-hold-link\b/.test(cls)) {
      const id = parseNumericIdAttr(node, "data-hold-id");
      if (id != null) return id;
    }
    if (node.type === "a") {
      const href = (node.props as { href?: string }).href;
      const holdId = parseHoldHrefId(href);
      if (holdId != null) return holdId;
      const trimmedHref = String(href ?? "").trim();
      if (/^orchestra-image:/i.test(trimmedHref)) {
        const enc = trimmedHref.replace(/^orchestra-image:/i, "").trim();
        const key = decodeOrchestraImageStorageKey(enc);
        const hold = media.holdImages.find(
          (h) =>
            String(h.remoteKey ?? "").trim() === key ||
            String(h.remoteKey ?? "").trim() === enc,
        );
        if (hold) return Number(hold.id);
      }
    }
  }

  const plain = reactNodePlainText(flat);
  for (const hold of media.holdImages) {
    const key = String(hold.remoteKey ?? "").trim();
    if (key && plain.includes(key)) return Number(hold.id);
  }
  if (/\{\{\s*hold\s*(?::\s*(\d+))?\s*}}/i.test(plain)) {
    const m = /\{\{\s*hold\s*:\s*(\d+)\s*}}/i.exec(plain);
    if (m) {
      const id = Math.trunc(Number(m[1]) || 0);
      if (id > 0) return id;
    }
    return null;
  }
  return null;
}

function looksLikeKadrHoldFieldContent(flat: React.ReactNode[]): boolean {
  const plain = reactNodePlainText(flat).toLowerCase();
  if (/\bзаставка\b/.test(plain)) return true;
  if (/\{\{\s*hold\b/i.test(plain)) return true;
  return findKadrHoldLinkInFlat(flat, 0) != null;
}

function extractKadrHoldTitleFromRest(rest: React.ReactNode[]): string {
  const flat = flattenInertSpans(rest);
  for (const node of flat) {
    if (!React.isValidElement(node)) continue;
    if (/\bmarkdown-hold-link\b/.test(reactElementClassStr(node))) {
      const title = reactNodePlainText(node).trim();
      if (title && !looksLikeOpaqueMediaId(title)) return title;
    }
  }
  return "";
}

function parseNumericIdAttr(el: React.ReactElement, attr: string): number | null {
  const raw = (el.props as Record<string, unknown>)[attr];
  const id = Math.trunc(Number(raw) || 0);
  return id > 0 ? id : null;
}

function resolveKadrVideoDisplayTitle(
  rest: React.ReactNode[],
  media: MarkdownKadrMediaLookup,
  ids: { videoId?: number | null; holdId?: number | null },
  mode: "video" | "hold",
): string {
  const fromVideoLink = extractKadrVideoTitleFromRest(rest);
  const fromHoldLink = extractKadrHoldTitleFromRest(rest);
  const fromLink = mode === "hold" ? fromHoldLink || fromVideoLink : fromVideoLink || fromHoldLink;
  if (fromLink) return fromLink;

  if (ids.videoId != null) {
    const video = media.videos.find((v) => Number(v.id) === ids.videoId);
    const title = String(video?.title ?? "").trim();
    if (title && !looksLikeOpaqueMediaId(title)) return title;
    return `Видео ${ids.videoId}`;
  }

  if (ids.holdId != null) {
    const hold = media.holdImages.find((h) => Number(h.id) === ids.holdId);
    const title = String(hold?.title ?? "").trim();
    if (title && !looksLikeOpaqueMediaId(title)) return title;
    return "Заставка";
  }

  return mode === "hold" ? "Заставка" : "Видео";
}

function hasKadrVideoFieldSignals(flat: React.ReactNode[]): boolean {
  if (skipKadrVideoFieldPrefix(flat, 0) > 0) return true;
  if (findKadrMediaChipInFlat(flat, 0)?.mediaKind === "video") return true;
  if (findKadrVideoLinkInFlat(flat, 0)) return true;
  if (findKadrHoldLinkInFlat(flat, 0)) return true;
  if (findKadrHoldChipInFlat(flat, 0)) return true;
  const head = reactNodePlainText(flat.slice(0, 6)).toLowerCase();
  return /(?:видео|проектор)\s*:/.test(head);
}

function findKadrHoldChipInFlat(
  flat: React.ReactNode[],
  start = 0,
): React.ReactElement | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!React.isValidElement(n)) continue;
    const cls = reactElementClassStr(n);
    if (/\bmarkdown-kadr-hold-chip\b/.test(cls) || /\bmarkdown-hold-label\b/.test(cls)) {
      return n;
    }
  }
  return null;
}

function splitKadrSoundFieldLine(
  rendered: React.ReactNode,
): {
  mediaKind: "play" | "sound";
  rest: React.ReactNode[];
} | null {
  const flat = flattenInertSpans(React.Children.toArray(rendered));
  const afterPrefix = skipKadrSoundFieldPrefix(flat, 0);
  if (afterPrefix === 0) return null;

  const chip = findKadrMediaChipInFlat(flat, afterPrefix);
  const trackLink = findKadrTrackLinkInFlat(flat, afterPrefix);

  if (chip && (chip.mediaKind === "play" || chip.mediaKind === "sound")) {
    return {
      mediaKind: chip.mediaKind,
      rest: collectKadrFieldRestNodes(flat, afterPrefix, chip.index, null),
    };
  }

  if (trackLink) {
    return {
      mediaKind: "play",
      rest: collectKadrFieldRestNodes(flat, afterPrefix, null, null),
    };
  }

  return null;
}

function splitKadrVideoFieldLine(
  rendered: React.ReactNode,
  media: MarkdownKadrMediaLookup,
): {
  mediaKind: "video" | "hold";
  videoId: number | null;
  holdId: number | null;
  rest: React.ReactNode[];
} | null {
  const flat = flattenInertSpans(React.Children.toArray(rendered));
  if (!hasKadrVideoFieldSignals(flat)) return null;

  let afterPrefix = skipKadrVideoFieldPrefix(flat, 0);
  if (afterPrefix === 0) {
    const head = reactNodePlainText(flat.slice(0, 6)).toLowerCase();
    if (/(?:видео|проектор)\s*:/.test(head)) {
      afterPrefix = skipKadrMediaFieldPrefix(flat, ["видео", "проектор"], 0);
    }
  }
  const start = afterPrefix > 0 ? afterPrefix : 0;

  const chip = findKadrMediaChipInFlat(flat, start);
  if (chip?.mediaKind === "video") {
    return {
      mediaKind: "video",
      videoId: parseNumericIdAttr(chip.mediaLabel, "data-video-id"),
      holdId: null,
      rest: collectKadrFieldRestNodes(flat, start, chip.index, null),
    };
  }

  const holdChip = findKadrHoldChipInFlat(flat, start);
  if (holdChip) {
    return {
      mediaKind: "hold",
      videoId: null,
      holdId: parseNumericIdAttr(holdChip, "data-hold-id"),
      rest: collectKadrFieldRestNodes(flat, start, flat.indexOf(holdChip), null),
    };
  }

  const holdLink = findKadrHoldLinkInFlat(flat, start);
  if (holdLink) {
    const holdId =
      parseNumericIdAttr(holdLink, "data-hold-id") ??
      parseHoldHrefId((holdLink.props as { href?: string }).href);
    return {
      mediaKind: "hold",
      videoId: null,
      holdId,
      rest: collectKadrFieldRestNodes(flat, start, null, null),
    };
  }

  const videoLink = findKadrVideoLinkInFlat(flat, start);
  if (videoLink) {
    return {
      mediaKind: "video",
      videoId: parseNumericIdAttr(videoLink, "data-video-id"),
      holdId: null,
      rest: collectKadrFieldRestNodes(flat, start, null, null),
    };
  }

  const tail = flat.slice(start);
  if (looksLikeKadrHoldFieldContent(tail)) {
    const holdId = resolveKadrHoldIdFromMediaSignals(tail, media);
    return {
      mediaKind: "hold",
      videoId: null,
      holdId,
      rest: collectKadrFieldRestNodes(flat, start, null, null),
    };
  }

  return null;
}

function findKadrVideoLinkInFlat(
  flat: React.ReactNode[],
  start = 0,
): React.ReactElement | null {
  for (let i = start; i < flat.length; i++) {
    const n = flat[i];
    if (!React.isValidElement(n)) continue;
    if (/\bmarkdown-video-link\b/.test(reactElementClassStr(n))) return n;
  }
  return null;
}

function MarkdownPreviewUl({
  className,
  children,
  ...rest
}: React.HTMLAttributes<HTMLUListElement>) {
  const inKadrBody = useContext(MarkdownKadrBodyContext);
  if (inKadrBody) {
    return <div className="markdown-kadr__fields">{children}</div>;
  }
  return (
    <ul className={className} {...rest}>
      {children}
    </ul>
  );
}

function MarkdownPreviewLi({ children }: { children: React.ReactNode }) {
  const inKadrBody = useContext(MarkdownKadrBodyContext);
  const paragraphProps = useContext(MarkdownPreviewParagraphBridgeContext);
  const renderLightTokens = useContext(MarkdownPreviewLightTokensBridgeContext);
  if (inKadrBody && paragraphProps) {
    return (
      <MarkdownPreviewParagraph {...paragraphProps}>{children}</MarkdownPreviewParagraph>
    );
  }
  return <li>{renderLightTokens ? renderLightTokens(children) : children}</li>;
}

function MarkdownKadrSection({
  children,
  node: _node,
  ...props
}: React.HTMLAttributes<HTMLElement> & { "data-lk-id"?: string; node?: unknown }) {
  const lkId = props["data-lk-id"];
  return (
    <section {...props}>
      <MarkdownKadrIdContext.Provider
        value={typeof lkId === "string" && lkId ? lkId : null}
      >
        {children}
      </MarkdownKadrIdContext.Provider>
    </section>
  );
}

function MarkdownPreviewTrackLink({
  resolved,
  onTrackLinkClick,
  playFromPayload,
  children,
}: {
  resolved: TrackLinkPayload;
  onTrackLinkClick?: (trackId: number, options?: PlaylistPlayOptions) => void;
  playFromPayload: (payload: TrackLinkPayload) => void;
  children: React.ReactNode;
}) {
  const kadrSoundVolume = useContext(MarkdownKadrSoundPlaybackContext);
  const trackId = "id" in resolved ? Number(resolved.id) : undefined;
  const trackName = "name" in resolved ? String(resolved.name) : undefined;
  const playOptions =
    kadrSoundVolume != null ? { volume: kadrSoundVolume } : undefined;

  return (
    <MarkdownTrackLink
      trackId={trackId}
      trackName={trackName}
      onClick={() => {
        if ("id" in resolved) {
          onTrackLinkClick?.(Number(resolved.id), playOptions);
          return;
        }
        if ("name" in resolved) {
          playFromPayload({ name: String(resolved.name) });
        }
      }}
    >
      {children}
    </MarkdownTrackLink>
  );
}

type MarkdownPreviewParagraphProps = {
  children: React.ReactNode;
  renderLightTokens: (children: React.ReactNode) => React.ReactNode;
  renderLightPanel: (kadrId: string) => React.ReactNode | null;
  hasRoleOrLightLabels: boolean;
  playInlineLabels: boolean;
  onTrackLinkClick?: (trackId: number, options?: PlaylistPlayOptions) => void;
  onSoundLinkClick?: (soundId: number) => void;
  playFromPayload: (payload: TrackLinkPayload) => void;
  toggleSoundFromPayload: (payload: SoundLinkPayload) => void;
  playVideoFromPayload: (payload: VideoLinkPayload) => void;
  playHoldFromPayload: (holdId?: number | null) => void;
  resolveSoundIconFromPayload: (payload: SoundLinkPayload) => string | null;
};

function MarkdownPreviewParagraph({
  children,
  renderLightTokens,
  renderLightPanel,
  hasRoleOrLightLabels,
  playInlineLabels,
  onTrackLinkClick,
  onSoundLinkClick,
  playFromPayload,
  toggleSoundFromPayload,
  playVideoFromPayload,
  playHoldFromPayload,
  resolveSoundIconFromPayload,
}: MarkdownPreviewParagraphProps) {
  const kadrId = useContext(MarkdownKadrIdContext);
  const inKadrLightColumn = useContext(MarkdownKadrLightColumnContext);
  const inKadrBody = useContext(MarkdownKadrBodyContext);
  const kadrMedia = useContext(MarkdownKadrMediaContext);
  const rendered = renderLightTokens(children);
  const { label, rest, kind } = splitLeadingLineLabel(rendered);
  if (inKadrLightColumn && kadrId) {
    const panel = renderLightPanel(kadrId);
    if (panel) {
      return <div className="markdown-light-kadr-call">{panel}</div>;
    }
  }
  if (inKadrLightColumn) {
    return null;
  }
  if (kadrId && reactNodeHasRawLightPanelToken(rendered)) {
    const panel = renderLightPanel(kadrId);
    if (panel) {
      return <div className="markdown-light-kadr-call">{panel}</div>;
    }
  }
  if (inKadrBody || kadrId) {
    const soundField = splitKadrSoundFieldLine(rendered);
    if (soundField) {
      const hasBody = reactNodePlainText(soundField.rest).trim().length > 0;
      const kadrSoundVolume = parseSoundVolumeFromFieldBody(
        reactNodePlainText(soundField.rest),
      );
      return (
        <MarkdownKadrSoundPlaybackContext.Provider value={kadrSoundVolume}>
          <p className="markdown-dialog-line markdown-dialog-line--kadr-field">
            <span className="markdown-dialog-label">
              <span className="markdown-kadr-field-label">Звук</span>
            </span>
            <span className="markdown-dialog-text">
              {hasBody ? (
                soundField.rest
              ) : (
                <em className="markdown-parenthetical-remark">…</em>
              )}
            </span>
          </p>
        </MarkdownKadrSoundPlaybackContext.Provider>
      );
    }

    const videoField = splitKadrVideoFieldLine(rendered, kadrMedia);
    if (videoField) {
      const videoTitle = resolveKadrVideoDisplayTitle(
        videoField.rest,
        kadrMedia,
        { videoId: videoField.videoId, holdId: videoField.holdId },
        videoField.mediaKind,
      );
      const videoId = videoField.videoId;
      const holdId = videoField.holdId;
      const hasRest = reactNodePlainText(videoField.rest).trim().length > 0;
      const previewMode = videoField.mediaKind === "hold" ? "hold" : "video";
      return (
        <p className="markdown-dialog-line markdown-dialog-line--kadr-field markdown-dialog-line--kadr-projector">
          <span className="markdown-dialog-label">
            <span className="markdown-kadr-field-label">Видео</span>
          </span>
          <span className="markdown-dialog-text markdown-dialog-text--kadr-projector">
            <KadrProjectorMediaPreview
              mode={previewMode}
              videoId={videoId}
              holdId={holdId}
              title={videoTitle}
              onActivate={() => {
                if (previewMode === "video") {
                  if (videoId != null && videoId > 0) {
                    playVideoFromPayload({ id: videoId });
                  }
                  return;
                }
                playHoldFromPayload(holdId);
              }}
            />
            {hasRest ? videoField.rest : null}
          </span>
        </p>
      );
    }

    const textField = splitKadrTextFieldLine(rendered);
    if (textField) {
      const body = reactNodePlainText(textField.rest).trim();
      return (
        <p className="markdown-dialog-line markdown-dialog-line--kadr-field">
          <span className="markdown-dialog-label">
            <span className="markdown-kadr-field-label">{textField.label}</span>
          </span>
          <span className="markdown-dialog-text">
            {body ? textField.rest : <em className="markdown-parenthetical-remark">…</em>}
          </span>
        </p>
      );
    }
  }
  const leadingTrack = onTrackLinkClick ? getLeadingTrackPayload(rendered) : null;
  const leadingSound = onSoundLinkClick ? getLeadingSoundPayload(rendered) : null;
  if (!label) {
    if (leadingTrack) {
      const alignClass = hasRoleOrLightLabels
        ? "markdown-dialog-line--track-align"
        : "markdown-dialog-line--track-compact";
      return (
        <p className={`markdown-dialog-line markdown-dialog-line--label-track ${alignClass}`}>
          <span className="markdown-dialog-label" aria-hidden="true">
            <button
              type="button"
              className="markdown-track-play"
              title="Воспроизвести"
              onClick={() => playFromPayload(leadingTrack)}
            >
              ▶
            </button>
          </span>
          <span className="markdown-dialog-text">{rendered}</span>
        </p>
      );
    }
    if (leadingSound) {
      const alignClass = hasRoleOrLightLabels
        ? "markdown-dialog-line--track-align"
        : "markdown-dialog-line--track-compact";
      return (
        <p className={`markdown-dialog-line markdown-dialog-line--label-sound ${alignClass}`}>
          <span className="markdown-dialog-label" aria-hidden="true">
            <button
              type="button"
              className="markdown-sound-play"
              title="Звук: воспроизвести/остановить"
              onClick={() => toggleSoundFromPayload(leadingSound)}
            >
              ▶
            </button>
          </span>
          <span className="markdown-dialog-text">{rendered}</span>
        </p>
      );
    }

    if (!hasRoleOrLightLabels || playInlineLabels) {
      return <p>{rendered}</p>;
    }
    return (
      <p className="markdown-dialog-line markdown-dialog-line--no-label">
        <span className="markdown-dialog-label" aria-hidden="true" />
        <span className="markdown-dialog-text">{rendered}</span>
      </p>
    );
  }
  let labelHasIcon = false;
  const resolvedLabel =
    kind === "sound"
      ? (() => {
          if (!onSoundLinkClick) return label;
          const payload = getSoundPayloadFromLabelEl(label);
          if (!payload) return label;
          const iconUrl = resolveSoundIconFromPayload(payload);
          if (!iconUrl) return label;
          labelHasIcon = true;
          return (
            <span
              className="markdown-sound-label markdown-sound-label--with-icon"
              role="button"
              tabIndex={0}
              title="Звук: воспроизвести/остановить"
              data-sound-id={"id" in payload ? String(payload.id) : undefined}
              data-sound-name={"name" in payload ? String(payload.name) : undefined}
              aria-label="Звук: воспроизвести/остановить"
            >
              <img
                className="markdown-sound-label__img"
                src={iconUrl}
                alt=""
                aria-hidden="true"
              />
              <span className="markdown-sound-label__fallback">SFX</span>
            </span>
          );
        })()
      : label;
  if (kind === "light" && kadrId) {
    const panel = renderLightPanel(kadrId);
    if (panel) {
      return <div className="markdown-light-kadr-call">{panel}</div>;
    }
  }
  const kindClass =
    kind === "light"
      ? "markdown-dialog-line--label-light"
      : kind === "play"
        ? "markdown-dialog-line--label-play"
        : kind === "sound"
          ? "markdown-dialog-line--label-sound"
          : "markdown-dialog-line--label-role";
  return (
    <p
      className={[
        "markdown-dialog-line",
        kindClass,
        labelHasIcon ? "markdown-dialog-line--label-has-icon" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span className="markdown-dialog-label">{resolvedLabel}</span>
      <span className="markdown-dialog-text">{rest}</span>
    </p>
  );
}

function isInteractiveMarkdownPreviewTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.closest) return false;
  if (el.closest("a[href], button, input, textarea, select, audio, video")) return true;
  if (
    el.closest(
      [
        ".markdown-image-btn",
        ".markdown-track-play",
        ".markdown-sound-play",
        ".markdown-light-chip",
        ".markdown-play-label",
        ".markdown-video-label",
        ".markdown-kadr-hold-chip",
        ".markdown-sound-label",
        ".markdown-speaker-label",
        ".markdown-track-link",
        ".markdown-video-link",
        ".markdown-sound-link",
      ].join(", "),
    )
  ) {
    return true;
  }
  return false;
}

export function ScriptMarkdownPreview({
  projectName,
  sceneName = "script",
  onTrackLinkClick,
  onSoundLinkClick,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  newAnnotation,
  setNewAnnotation,
  activeAnnotationId,
  setActiveAnnotationId,
  readModeActivateEdit,
  showStepTitle = true,
}: {
  projectName: string;
  sceneName?: string;
  onTrackLinkClick?: (trackId: number, options?: PlaylistPlayOptions) => void;
  onSoundLinkClick?: (soundId: number) => void;
  onCreateAnnotation: (draft: NewAnnotationDraft) => Promise<void>;
  onUpdateAnnotation: (id: string, noteText: string) => Promise<void>;
  onDeleteAnnotation: (id: string) => Promise<void>;
  newAnnotation: NewAnnotationDraft | null;
  setNewAnnotation: React.Dispatch<React.SetStateAction<NewAnnotationDraft | null>>;
  activeAnnotationId: string | null;
  setActiveAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
  /** Режим чтения: клик по тексту (не по кнопкам/ссылкам) включает редактирование. */
  readModeActivateEdit?: () => void;
  showStepTitle?: boolean;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ui = useAppSelector((s) => selectShowScriptMarkdownUi(s, projectName, sceneName));
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const { data: rolesRes } = useProjectRolesQuery(projectName, {
    skip: !accessToken || !projectName,
  });
  const roles = rolesRes?.roles ?? [];
  const sceneData = useAppSelector((s) => (s as any).scene?.sceneData ?? null) as any;
  const { activeMarkdown: markdown, currentStep, activeField } = useAppSelector((s) =>
    selectActiveStepMarkdownContext(s, projectName, sceneName),
  );
  const annotations = useAppSelector((s) => {
    if (currentStep?.id == null) return EMPTY_ANNOTATIONS;
    const cacheKey = `${projectName}:${sceneName}:${currentStep.id}:${activeField}`;
    return selectAnnotations(s, cacheKey).items;
  });
  const annotationsMode = ui.annotationsMode;

  const markdownForPreview = useMemo(() => {
    const expanded = expandScriptLineParagraphBreaks(
      String(markdown ?? ""),
      annotationsMode,
      annotations.length,
    );
    const withKadrBreaks = expandKadrLabelBlockBreaks(expanded);
    if (annotationsMode && annotations.length > 0) return withKadrBreaks;
    return injectNbspParagraphsForTripleNewlines(withKadrBreaks);
  }, [markdown, annotationsMode, annotations.length]);

  const onReadModePointerDown = (e: React.PointerEvent) => {
    if (!readModeActivateEdit) return;
    if (annotationsMode && e.detail < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (isInteractiveMarkdownPreviewTarget(e.target)) return;
    readModeActivateEdit();
  };
  const markdownMode = ui.markdownMode;
  const playlistOptions = ui.playlistOptions;
  const soundsOptions = ui.soundsOptions;
  const soundsOptionsRef = useRef(soundsOptions);
  soundsOptionsRef.current = soundsOptions;
  const lightChannels = ui.lightChannels;

  const [lightbox, setLightbox] = useState<MarkdownLightboxState | null>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLightbox(null);
        return;
      }
      if (lightbox.slides.length <= 1) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setLightbox((prev) =>
          !prev || prev.slides.length <= 1
            ? prev
            : { ...prev, index: (prev.index + 1) % prev.slides.length },
        );
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setLightbox((prev) =>
          !prev || prev.slides.length <= 1
            ? prev
            : {
                ...prev,
                index: (prev.index - 1 + prev.slides.length) % prev.slides.length,
              },
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  const imageUrlCacheRef = useRef(new Map<string, string>());

  const { rootRef, popoverRef, position, setAnchorFromRect, requestClose } =
    useAnnotationsPopoverPosition({
      enabled: annotationsMode,
      activeAnnotationId,
      isOpen: Boolean(newAnnotation || activeAnnotationId),
    });

  const openLightbox = useCallback((src: string, alt: string) => {
    const slides = collectLightboxSlidesFromPreviewRoot(rootRef.current);
    if (slides.length === 0) {
      setLightbox({ slides: [{ src, alt }], index: 0 });
      return;
    }
    const idx = slides.findIndex((s) => s.src === src);
    setLightbox({ slides, index: idx >= 0 ? idx : 0 });
  }, []);

  const [dialogLabelSlotPx, setDialogLabelSlotPx] = useState<number | null>(null);
  const dialogLabelSlotPxRef = useRef<number | null>(null);

  const resolveImageSrc = useCallback(
    (src?: string) => {
      if (!src) return src;

      let path = src.trim().replace(/^\.?\//, "");

      if (!path.startsWith("images/")) {
        return src;
      }

      path = path.replace(/^images\//, "").replace(/^\/+/, "");

      const pathSegments = path.split("/").map((segment) => encodeURIComponent(segment));
      const encodedPath = pathSegments.join("/");

      let projectId: string | null = null;
      if (typeof window !== "undefined") {
        try {
          projectId = window.localStorage.getItem(`projectId:${projectName}`);
        } catch {
          // ignore
        }
      }

      const baseUrl = new URL(`project-images://${encodeURIComponent(projectName)}/`);
      baseUrl.pathname = projectId
        ? `/${encodeURIComponent(projectId)}/${encodedPath}`
        : `/${encodedPath}`;

      return baseUrl.toString();
    },
    [projectName],
  );

  const resolveSoundIconSrc = useCallback((iconFile: string) => {
    const safe = String(iconFile ?? "").trim();
    if (!safe) return "";
    let projectId: string | null = null;
    if (typeof window !== "undefined") {
      try {
        projectId = window.localStorage.getItem(`projectId:${projectName}`);
      } catch {
        // ignore
      }
    }
    const url = new URL(`project-sound-icons://${encodeURIComponent(projectName)}/`);
    const encodedFile = encodeURIComponent(safe);
    url.pathname = projectId
      ? `/${encodeURIComponent(projectId)}/${encodedFile}`
      : `/${encodedFile}`;
    return url.toString();
  }, [projectName]);

  // soundsOptions из Redux часто новый [] по ссылке → без ref контекст картинок меняется каждый рендер и play-url дергается снова.
  const resolveSoundIconFromPayload = useCallback(
    (payload: SoundLinkPayload): string | null => {
      const opts = soundsOptionsRef.current;
      const byId =
        "id" in payload
          ? opts.find((s) => Number(s?.id) === Number(payload.id)) ?? null
          : null;
      const byName =
        "name" in payload
          ? opts.find(
              (s) => String(s?.title ?? "").toLowerCase() === String(payload.name ?? "").toLowerCase(),
            ) ?? null
          : null;
      const sound = byId ?? byName;
      if (!sound) return null;
      const remote = String(sound.iconRemoteUrl ?? "").trim();
      if (remote && /^https?:\/\//i.test(remote)) return remote;
      const icon = String(sound.icon ?? "").trim();
      if (icon) return resolveSoundIconSrc(icon);
      return null;
    },
    [resolveSoundIconSrc],
  );

  const markdownPreviewImageCtx = useMemo<MarkdownPreviewImageContextValue>(
    () => ({
      accessToken,
      playUrlCache: imageUrlCacheRef,
      resolveImageSrc,
      resolveSoundIconFromPayload,
      openLightbox,
    }),
    [accessToken, resolveImageSrc, resolveSoundIconFromPayload, openLightbox],
  );

  const urlTransform = (url: string) => {
    const trimmed = url.trim().toLowerCase();
    if (trimmed.startsWith("javascript:")) {
      return "";
    }
    return url;
  };

  const normalizeTrackName = (value: string) => {
    const trimmed = value.trim();
    if (
      (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))
    ) {
      return trimmed.slice(1, -1).trim();
    }
    return trimmed;
  };

  const resolveTrackLink = (href?: string) => {
    if (!href) return null;
    const trimmed = href.trim();
    if (trimmed.startsWith("track:")) {
      const payload = trimmed.replace(/^track:/i, "").trim();
      const id = Number(payload);
      if (Number.isFinite(id)) {
        return { id };
      }
      return payload ? { name: normalizeTrackName(payload) } : null;
    }
    if (trimmed.startsWith("playlist:")) {
      const payload = trimmed.replace(/^playlist:/i, "").trim();
      const id = Number(payload);
      if (Number.isFinite(id)) {
        return { id };
      }
      return payload ? { name: normalizeTrackName(payload) } : null;
    }
    return null;
  };

  const resolveSoundLink = (href?: string) => {
    if (!href) return null;
    const trimmed = href.trim();
    if (trimmed.startsWith("sound:") || trimmed.startsWith("sfx:")) {
      const payload = trimmed.replace(/^(sound|sfx):/i, "").trim();
      const id = Number(payload);
      if (Number.isFinite(id)) {
        return { id };
      }
      return payload ? { name: normalizeTrackName(payload) } : null;
    }
    return null;
  };

  const resolveVideoLink = (href?: string): VideoLinkPayload | null => {
    if (!href) return null;
    const trimmed = href.trim();
    if (!trimmed.startsWith("video:")) return null;
    const payload = trimmed.replace(/^video:/i, "").trim();
    const id = Number(payload);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { id: Math.trunc(id) };
  };

  const resolveHoldLink = (href?: string): { id: number } | null => {
    if (!href) return null;
    const trimmed = href.trim();
    if (!trimmed.startsWith("hold:")) return null;
    const payload = trimmed.replace(/^hold:/i, "").trim();
    const id = Number(payload);
    if (!Number.isFinite(id) || id <= 0) return null;
    return { id: Math.trunc(id) };
  };

  const kadrMediaLookup = useMemo<MarkdownKadrMediaLookup>(
    () => ({
      projectSlug: projectName,
      videos: Array.isArray(sceneData?.videos) ? sceneData.videos : [],
      holdImages: Array.isArray(sceneData?.holdImages) ? sceneData.holdImages : [],
      projector: sceneData?.projector ?? null,
    }),
    [projectName, sceneData?.videos, sceneData?.holdImages, sceneData?.projector],
  );

  const playVideoFromPayload = useCallback(
    (payload: VideoLinkPayload) => {
      const videoId = Math.trunc(Number(payload.id) || 0);
      if (videoId <= 0) return;
      openProjectorWindow();
      applyKadrProjector(
        { mode: "video", videoId },
        {
          projectSlug: projectName,
          videos: sceneData?.videos,
          holdImages: sceneData?.holdImages,
          projector: sceneData?.projector ?? null,
        },
      );
    },
    [projectName, sceneData?.videos, sceneData?.holdImages, sceneData?.projector],
  );

  const playHoldFromPayload = useCallback(
    (holdId?: number | null) => {
      openProjectorWindow();
      const resolvedId =
        holdId != null && Math.trunc(Number(holdId) || 0) > 0
          ? Math.trunc(Number(holdId))
          : undefined;
      applyKadrProjector(
        resolvedId != null ? { mode: "hold", holdId: resolvedId } : { mode: "hold" },
        {
          projectSlug: projectName,
          videos: sceneData?.videos,
          holdImages: sceneData?.holdImages,
          projector: sceneData?.projector ?? null,
        },
      );
    },
    [projectName, sceneData?.videos, sceneData?.holdImages, sceneData?.projector],
  );

  const isAudioLink = (href?: string) => {
    if (!href) return false;
    return /\.(mp3|wav|ogg|m4a|flac)$/i.test(href.trim());
  };

  const markdownKadrSections = useMemo(
    () => scanMarkdownKadrSections(markdownForPreview),
    [markdownForPreview],
  );
  const markdownKadrIdLookups = useMemo(
    () => markdownKadrSections.map((s) => ({ kadrNo: s.kadrNo, id: s.id })),
    [markdownKadrSections],
  );
  const kadrBlackoutIds = useMemo(
    () =>
      readStepLightKadrs(currentStep)
        .kadrs.filter((k) => k.blackout)
        .map((k) => k.id),
    [currentStep],
  );

  const renderLightPanel = useCallback(
    (kadrId: string) => {
      const kadrs = readStepLightKadrs(currentStep);
      const kadr = findKadrById(kadrs, kadrId);
      if (!kadr) return null;
      const section = markdownKadrSections.find((s) => s.id === kadrId) ?? null;
      const baseFaders = resolveLightFaders(sceneData?.lightFaders);
      const displayFaders = fadersForKadrDisplay(kadr, baseFaders);
      const lightPlot = (Array.isArray(sceneData?.lightPlot)
        ? sceneData.lightPlot
        : []) as LightFixture[];
      const lookModel = buildLightSchemeLookModel({
        kadr,
        sectionTitle: section?.headingTitle,
        lightPlot,
        lightChannels,
        lightFaders: displayFaders,
        lightPrograms: sceneData?.lightPrograms ?? null,
        lightChannelRoles: sceneData?.lightChannelRoles ?? null,
      });
      return (
        <LightSchemeLookCard
          lookModel={lookModel}
          lightChannels={lightChannels}
          activeKadr={kadr}
          lightFaders={displayFaders}
          boardFaders={baseFaders}
          spotlights={currentStep?.theaterSpotlights ?? []}
        />
      );
    },
    [
      currentStep,
      lightChannels,
      markdownKadrSections,
      sceneData?.lightChannelRoles,
      sceneData?.lightFaders,
      sceneData?.lightPlot,
      sceneData?.lightPrograms,
      currentStep?.theaterSpotlights,
    ],
  );

  const renderLightTokens = useMemo(
    () => createRenderLightTokens(lightChannels, { renderLightPanel }),
    [lightChannels, renderLightPanel],
  );
  const rehypeScriptTokens = useMemo(
    () => createRehypeScriptTokens(lightChannels, { renderLightPanel }),
    [lightChannels, renderLightPanel],
  );

  /** Блоки `.markdown-kadr` по заголовкам h1–h3 — и для текста пьесы (`play`), не только notes/explication. */
  const kadrLayoutEnabled =
    markdownMode === "notes" || markdownMode === "explication" || markdownMode === "play";
  /** Колонка картинки + свет — только в тех. карте, не в тексте пьесы и экспликации. */
  const kadrSplitLayoutEnabled = markdownMode === "notes";

  const hasRoleOrLightLabels = useMemo(
    () => markdownHasRoleLightOrPlayLineLabels(markdown || ""),
    [markdown],
  );

  useLayoutEffect(() => {
    /* Вкладка «Текст»: без общей колонки по max-width всех лейблов — как в редакторе. */
    if (!hasRoleOrLightLabels || markdownMode === "play") {
      dialogLabelSlotPxRef.current = null;
      setDialogLabelSlotPx(null);
      return;
    }

    const root = rootRef.current;
    if (!root) return;

    const MIN = 56;
    const MAX = 220;

    const compute = () => {
      const labels = Array.from(
        root.querySelectorAll<HTMLElement>(".markdown-dialog-label"),
      );
      let max = 0;
      for (const label of labels) {
        const child = label.firstElementChild as HTMLElement | null;
        if (!child) continue;
        const w = child.getBoundingClientRect().width;
        if (Number.isFinite(w)) max = Math.max(max, Math.ceil(w));
      }
      const next = Math.max(MIN, Math.min(MAX, max || MIN));
      const prev = dialogLabelSlotPxRef.current;
      if (prev == null || Math.abs(prev - next) > 2) {
        dialogLabelSlotPxRef.current = next;
        setDialogLabelSlotPx(next);
      }
    };

    let roRaf: number | null = null;
    const scheduleCompute = () => {
      if (roRaf != null) return;
      roRaf = requestAnimationFrame(() => {
        roRaf = null;
        compute();
      });
    };

    scheduleCompute();
    const ro = new ResizeObserver(scheduleCompute);
    ro.observe(root);
    return () => {
      if (roRaf != null) cancelAnimationFrame(roRaf);
      ro.disconnect();
    };
  }, [hasRoleOrLightLabels, markdown, markdownForPreview, kadrLayoutEnabled, markdownMode]);

  const playFromPayload = (payload: TrackLinkPayload) => {
    if (!onTrackLinkClick) return;
    if ("id" in payload) {
      onTrackLinkClick(Number(payload.id));
      return;
    }
    const name = String(payload.name ?? "").trim();
    if (!name) return;
    const fromCache = playlistOptions.find(
      (item) =>
        String(item?.title ?? "").toLowerCase() === name.toLowerCase(),
    );
    if (fromCache?.id != null) {
      onTrackLinkClick(Number(fromCache.id));
    }
  };

  const toggleSoundFromPayload = (payload: SoundLinkPayload) => {
    if (!onSoundLinkClick) return;
    if ("id" in payload) {
      onSoundLinkClick(Number(payload.id));
      return;
    }
    const name = String(payload.name ?? "").trim();
    if (!name) return;
    const fromCache = soundsOptions.find(
      (item) => String(item?.title ?? "").toLowerCase() === name.toLowerCase(),
    );
    if (fromCache?.id != null) {
      onSoundLinkClick(Number(fromCache.id));
    }
  };

  const markdownParagraphProps = useMemo(
    (): Omit<MarkdownPreviewParagraphProps, "children"> => ({
      renderLightTokens,
      renderLightPanel,
      hasRoleOrLightLabels,
      playInlineLabels: markdownMode === "play",
      onTrackLinkClick,
      onSoundLinkClick,
      playFromPayload,
      toggleSoundFromPayload,
      playVideoFromPayload,
      playHoldFromPayload,
      resolveSoundIconFromPayload,
    }),
    [
      renderLightTokens,
      renderLightPanel,
      hasRoleOrLightLabels,
      markdownMode,
      onTrackLinkClick,
      onSoundLinkClick,
      playFromPayload,
      toggleSoundFromPayload,
      playVideoFromPayload,
      playHoldFromPayload,
      resolveSoundIconFromPayload,
    ],
  );

  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [rehypeStripLightKadrAnchors];
    if (kadrLayoutEnabled || annotationsMode) {
      plugins.push(rehypeScriptTokens);
    }
    if (annotationsMode) {
      plugins.push([rehypeActorAnnotations, { annotations, activeId: activeAnnotationId }]);
    }
    if (kadrLayoutEnabled) {
      plugins.push([
        rehypeKadrSections,
        {
          enabled: true,
          headingMaxLevel: 3,
          kadrIdLookups: markdownKadrIdLookups,
          kadrBlackoutIds,
          splitLayoutEnabled: kadrSplitLayoutEnabled,
        },
      ]);
    }
    return plugins;
  }, [
    annotationsMode,
    rehypeScriptTokens,
    annotations,
    activeAnnotationId,
    kadrLayoutEnabled,
    kadrSplitLayoutEnabled,
    markdownKadrIdLookups,
    kadrBlackoutIds,
  ]);

  const rangeTextLength = (range: Range) => {
    const fragment = range.cloneContents();
    const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_TEXT);
    let len = 0;
    while (walker.nextNode()) {
      len += (walker.currentNode.nodeValue ?? "").length;
    }
    return len;
  };

  const computeRenderedOffset = (
    root: HTMLElement,
    range: Range,
    atStart: boolean,
  ) => {
    const pointRange = document.createRange();
    pointRange.selectNodeContents(root);
    if (atStart) {
      pointRange.setEnd(range.startContainer, range.startOffset);
    } else {
      pointRange.setEnd(range.endContainer, range.endOffset);
    }
    return rangeTextLength(pointRange);
  };

  const handleMarkdownMouseUp = () => {
    if (!annotationsMode) return;
    const root = rootRef.current;
    if (!root) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    if (!root.contains(range.commonAncestorContainer)) return;

    const anchorRect = range.getBoundingClientRect();
    const start = computeRenderedOffset(root, range, true);
    const end = computeRenderedOffset(root, range, false);
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    const selectedText = String(sel.toString() ?? "").trim();
    if (!selectedText) return;

    setAnchorFromRect(anchorRect);
    setNewAnnotation({ start: s, end: e, selectedText, noteText: "" });
    setActiveAnnotationId(null);
  };

  const resolveRoleIdFromToken = (token: string): string | null => {
    const t = normalizeRoleToken(token);
    if (!t) return null;
    const exactTitle = roles.find((r) => normalizeRoleToken(String((r as any)?.title ?? "")) === t) ?? null;
    if (exactTitle) return String((exactTitle as any).id);
    const exactKey = roles.find((r) => normalizeRoleToken(String((r as any)?.key ?? "")) === t) ?? null;
    if (exactKey) return String((exactKey as any).id);
    const byAlias =
      roles.find((r) =>
        (Array.isArray((r as any)?.aliases) ? (r as any).aliases : []).some(
          (a: any) => normalizeRoleToken(String(a ?? "")) === t,
        ),
      ) ?? null;
    if (byAlias) return String((byAlias as any).id);
    return null;
  };

  const isRoleAttachedToCurrentStep = (roleId: string): boolean => {
    if (!currentStep?.id) return false;
    const sr = (sceneData as any)?.sceneRoles as SceneRolesDataV1 | undefined;
    if (!sr || (sr as any).v !== 1) return false;
    const stepMap = (sr as any).byStepId?.[String(currentStep.id)];
    if (!stepMap || typeof stepMap !== "object") return false;
    return Boolean(stepMap[String(roleId)]);
  };

  const handleSpeakerLabelClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && String(sel.toString() ?? "").trim()) {
      return; // allow text selection without navigation
    }
    const target = e.target as HTMLElement | null;
    if (!target) return;

    const playEl = target.closest?.(".markdown-play-label") as HTMLElement | null;
    if (playEl && onTrackLinkClick) {
      const rawId = playEl.getAttribute("data-track-id");
      const rawName = playEl.getAttribute("data-track-name");
      const id = Number(rawId);
      if (Number.isFinite(id) && id > 0) {
        e.preventDefault();
        e.stopPropagation();
        playFromPayload({ id });
        return;
      }
      const name = String(rawName ?? "").trim();
      if (name) {
        e.preventDefault();
        e.stopPropagation();
        playFromPayload({ name });
        return;
      }
    }

    const soundEl = target.closest?.(".markdown-sound-label") as HTMLElement | null;
    if (soundEl && onSoundLinkClick) {
      const rawId = soundEl.getAttribute("data-sound-id");
      const rawName = soundEl.getAttribute("data-sound-name");
      const id = Number(rawId);
      if (Number.isFinite(id) && id > 0) {
        e.preventDefault();
        e.stopPropagation();
        toggleSoundFromPayload({ id });
        return;
      }
      const name = String(rawName ?? "").trim();
      if (name) {
        e.preventDefault();
        e.stopPropagation();
        toggleSoundFromPayload({ name });
        return;
      }
    }

    const videoEl = target.closest?.(".markdown-video-label") as HTMLElement | null;
    if (videoEl) {
      const rawId = videoEl.getAttribute("data-video-id");
      const id = Number(rawId);
      if (Number.isFinite(id) && id > 0) {
        e.preventDefault();
        e.stopPropagation();
        playVideoFromPayload({ id: Math.trunc(id) });
        return;
      }
    }

    const holdEl = target.closest?.(".markdown-kadr-hold-chip") as HTMLElement | null;
    if (holdEl) {
      e.preventDefault();
      e.stopPropagation();
      const rawId = holdEl.getAttribute("data-hold-id");
      const id = Number(rawId);
      playHoldFromPayload(Number.isFinite(id) && id > 0 ? Math.trunc(id) : null);
      return;
    }

    const el = target.closest?.(".markdown-speaker-label") as HTMLElement | null;
    if (!el) return;
    const token = String(el.getAttribute("title") ?? "").trim();
    if (!token) return;
    const roleId = resolveRoleIdFromToken(token);
    if (!roleId) return;
    if (!isRoleAttachedToCurrentStep(roleId)) return;
    e.preventDefault();
    e.stopPropagation();
    navigate(`/role-workbook/${encodeURIComponent(roleId)}`);
  };

  return (
    <div
      className={[
        "markdown-preview",
        hasRoleOrLightLabels ? "markdown-preview--has-line-labels" : "",
        markdownMode === "play" ? "markdown-preview--play-inline-labels" : "",
        kadrLayoutEnabled ? "markdown-preview--kadr" : "",
        readModeActivateEdit ? "markdown-preview--read-activatable" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={
        dialogLabelSlotPx != null
          ? ({ ["--dialog-label-slot-width" as any]: `${dialogLabelSlotPx}px` } as React.CSSProperties)
          : undefined
      }
    >
      <div
        ref={rootRef}
        onClick={handleSpeakerLabelClick}
        onPointerDownCapture={readModeActivateEdit ? onReadModePointerDown : undefined}
        onMouseUp={annotationsMode ? handleMarkdownMouseUp : undefined}
      >
        {showStepTitle && currentStep?.title ? (
          <div className="script-step-title">{currentStep.title}</div>
        ) : null}
        <MarkdownPreviewImageContext.Provider value={markdownPreviewImageCtx}>
        <MarkdownPreviewParagraphBridgeContext.Provider value={markdownParagraphProps}>
        <MarkdownPreviewLightTokensBridgeContext.Provider value={renderLightTokens}>
        <MarkdownKadrMediaContext.Provider value={kadrMediaLookup}>
        <ReactMarkdown
          urlTransform={urlTransform}
          remarkPlugins={[remarkBreaks]}
          rehypePlugins={rehypePlugins}
          components={{
            section: MarkdownKadrSection,
            div: ({
              className,
              children,
              node: _node,
              ...rest
            }: React.HTMLAttributes<HTMLDivElement> & { node?: unknown }) => {
              const cls = typeof className === "string" ? className : "";
              if (cls.includes("markdown-kadr__light")) {
                return (
                  <div className={className} {...rest}>
                    <MarkdownKadrLightColumnContext.Provider value>
                      {children}
                    </MarkdownKadrLightColumnContext.Provider>
                  </div>
                );
              }
              if (cls.includes("markdown-kadr__picture")) {
                return (
                  <div className={className} {...rest}>
                    <MarkdownKadrPictureColumnContext.Provider value>
                      {children}
                    </MarkdownKadrPictureColumnContext.Provider>
                  </div>
                );
              }
              if (cls.includes("markdown-kadr__body")) {
                return (
                  <div className={className} {...rest}>
                    <MarkdownKadrBodyContext.Provider value>
                      {children}
                    </MarkdownKadrBodyContext.Provider>
                  </div>
                );
              }
              return (
                <div className={className} {...rest}>
                  {children}
                </div>
              );
            },
            p: ({ children }: { children: React.ReactNode }) => (
              <MarkdownPreviewParagraph {...markdownParagraphProps}>
                {children}
              </MarkdownPreviewParagraph>
            ),
            ul: MarkdownPreviewUl,
            li: MarkdownPreviewLi,
            span: ({
              className,
              children,
              node: _node,
              ...rest
            }: React.HTMLAttributes<HTMLSpanElement> & {
              "data-lk-id"?: string;
              node?: unknown;
            }) => {
              const lkId = rest["data-lk-id"];
              if (className?.includes("markdown-light-split-host") && lkId) {
                return (
                  <span className="markdown-light-split-host">
                    {renderLightPanel(String(lkId))}
                  </span>
                );
              }
              return (
                <span className={className} {...rest}>
                  {children}
                </span>
              );
            },
            h1: ({ children }: { children: React.ReactNode }) => (
              <h1>{renderLightTokens(children)}</h1>
            ),
            h2: ({ children }: { children: React.ReactNode }) => (
              <h2>{renderLightTokens(children)}</h2>
            ),
            h3: ({ children }: { children: React.ReactNode }) => (
              <h3>{renderLightTokens(children)}</h3>
            ),
            h4: ({ children }: { children: React.ReactNode }) => (
              <h4>{renderLightTokens(children)}</h4>
            ),
            h5: ({ children }: { children: React.ReactNode }) => (
              <h5>{renderLightTokens(children)}</h5>
            ),
            h6: ({ children }: { children: React.ReactNode }) => (
              <h6>{renderLightTokens(children)}</h6>
            ),
            blockquote: ({ children }: { children: React.ReactNode }) => (
              <blockquote>{renderLightTokens(children)}</blockquote>
            ),
            td: ({ children }: { children: React.ReactNode }) => (
              <td>{renderLightTokens(children)}</td>
            ),
            th: ({ children }: { children: React.ReactNode }) => (
              <th>{renderLightTokens(children)}</th>
            ),
            a: ({
              href,
              children,
              ...rest
            }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => {
              const resolved = resolveTrackLink(href);
              if (resolved && onTrackLinkClick) {
                return (
                  <MarkdownPreviewTrackLink
                    resolved={resolved}
                    onTrackLinkClick={onTrackLinkClick}
                    playFromPayload={playFromPayload}
                  >
                    {children}
                  </MarkdownPreviewTrackLink>
                );
              }
              const resolvedSound = resolveSoundLink(href);
              if (resolvedSound && onSoundLinkClick) {
                return (
                  <button
                    type="button"
                    className="markdown-sound-link"
                    data-sound-id={"id" in resolvedSound ? String(resolvedSound.id) : undefined}
                    data-sound-name={"name" in resolvedSound ? String(resolvedSound.name) : undefined}
                    onClick={async () => {
                      if ("id" in resolvedSound) {
                        onSoundLinkClick(Number(resolvedSound.id));
                        return;
                      }
                      if ("name" in resolvedSound) {
                        toggleSoundFromPayload({ name: String(resolvedSound.name) });
                      }
                    }}
                  >
                    {children}
                  </button>
                );
              }
              const resolvedVideo = resolveVideoLink(href);
              if (resolvedVideo) {
                return (
                  <button
                    type="button"
                    className="markdown-video-link"
                    data-video-id={String(resolvedVideo.id)}
                    onClick={() => playVideoFromPayload(resolvedVideo)}
                  >
                    {children}
                  </button>
                );
              }
              const resolvedHold = resolveHoldLink(href);
              if (resolvedHold) {
                const hold = kadrMediaLookup.holdImages.find(
                  (h) => Number(h.id) === resolvedHold.id,
                );
                const label = String(hold?.title ?? "").trim();
                const display =
                  label && !looksLikeOpaqueMediaId(label) ? label : "Заставка";
                return (
                  <button
                    type="button"
                    className="markdown-hold-link"
                    data-hold-id={String(resolvedHold.id)}
                    onClick={() => playHoldFromPayload(resolvedHold.id)}
                  >
                    {display}
                  </button>
                );
              }
              if (isAudioLink(href)) {
                return (
                  <a
                    href={href}
                    className="markdown-track-link markdown-audio-link"
                    {...rest}
                  >
                    {children}
                  </a>
                );
              }
              return (
                <a href={href} {...rest}>
                  {children}
                </a>
              );
            },
            img: ({
              node: _node,
              children: _children,
              ...imgProps
            }: React.ImgHTMLAttributes<HTMLImageElement> & {
              node?: unknown;
              children?: React.ReactNode;
            }) => <MarkdownPreviewImage {...imgProps} />,
            mark: ({ node, children, ...rest }: any) => {
              const id = (node as any)?.properties?.["data-anno-id"] as
                | string
                | undefined;
              return (
                <mark
                  {...rest}
                  onClick={(e) => {
                    if (!id) return;
                    e.preventDefault();
                    e.stopPropagation();
                    setAnchorFromRect(
                      (e.currentTarget as HTMLElement).getBoundingClientRect(),
                    );
                    setActiveAnnotationId((prev) => (prev === id ? null : id));
                    setNewAnnotation(null);
                  }}
                >
                  {children}
                </mark>
              );
            },
            code: ({
              className,
              children,
              node,
              ...rest
            }: {
              className?: string;
              children: React.ReactNode;
              node?: unknown;
            } & React.HTMLAttributes<HTMLElement>) => {
              const classStr = String(className ?? "");
              const isCodeBlock =
                /\blanguage-/.test(classStr) ||
                String(children ?? "").includes("\n");

              if (!isCodeBlock) {
                const text = String(children ?? "").replace(/\n/g, " ").trim();
                return (
                  <code
                    className="markdown-inline-code-label"
                    title={text || undefined}
                    {...rest}
                  >
                    {text || children}
                  </code>
                );
              }
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            },
          }}
        >
          {markdownForPreview || "*Пусто*"}
        </ReactMarkdown>
        </MarkdownKadrMediaContext.Provider>
        </MarkdownPreviewLightTokensBridgeContext.Provider>
        </MarkdownPreviewParagraphBridgeContext.Provider>
        </MarkdownPreviewImageContext.Provider>
      </div>

      {lightbox && (
        <div
          className="markdown-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Просмотр изображения"
          onClick={() => setLightbox(null)}
        >
          <div
            className="markdown-lightbox__content"
            onClick={(e) => e.stopPropagation()}
          >
            <Buttons.CloseButton
              variant="markdownLightbox"
              onClick={() => setLightbox(null)}
              aria-label="Закрыть"
              title="Закрыть"
            />
            <img
              key={lightbox.slides[lightbox.index]!.src}
              className="markdown-lightbox__img"
              src={lightbox.slides[lightbox.index]!.src}
              alt={lightbox.slides[lightbox.index]!.alt || ""}
            />
            {lightbox.slides.length > 1 ? (
              <>
                <button
                  type="button"
                  className="markdown-lightbox__nav markdown-lightbox__nav--prev"
                  aria-label="Предыдущее изображение"
                  title="Предыдущее (←)"
                  onClick={() =>
                    setLightbox((prev) =>
                      !prev || prev.slides.length <= 1
                        ? prev
                        : {
                            ...prev,
                            index: (prev.index - 1 + prev.slides.length) % prev.slides.length,
                          },
                    )
                  }
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="markdown-lightbox__nav markdown-lightbox__nav--next"
                  aria-label="Следующее изображение"
                  title="Следующее (→)"
                  onClick={() =>
                    setLightbox((prev) =>
                      !prev || prev.slides.length <= 1
                        ? prev
                        : { ...prev, index: (prev.index + 1) % prev.slides.length },
                    )
                  }
                >
                  ›
                </button>
                <div className="markdown-lightbox__counter" aria-live="polite">
                  {lightbox.index + 1} / {lightbox.slides.length}
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {annotationsMode ? (
        <ActorAnnotationsPopover
          position={position}
          popoverRef={popoverRef}
          newAnnotation={newAnnotation}
          setNewAnnotation={setNewAnnotation}
          activeAnnotationId={activeAnnotationId}
          setActiveAnnotationId={setActiveAnnotationId}
          annotations={annotations}
          onCreate={onCreateAnnotation}
          onUpdate={onUpdateAnnotation}
          onDelete={onDeleteAnnotation}
          onRequestClose={requestClose}
        />
      ) : null}
    </div>
  );
}

