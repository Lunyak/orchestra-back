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
import { useNavigate } from "react-router-dom";
import { fetchProjectRolesThunk, selectProjectRoles } from "../../../../features/profile/model/profileRolesSlice";
import type { SceneRolesDataV1 } from "../../../../features/scene";
import {
  selectActiveStepMarkdownContext,
  selectAnnotations,
  selectShowScriptMarkdownUi,
} from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import type { ActorAnnotation } from "../../../../sync/api";
import { getPlayUrl } from "../../../../sync/api";
import { getDesktopApi } from "../../../platform/desktop-api";
import {
  httpUrlToImageFileName,
  storageKeyToImageBasename,
} from "../../../utils/markdownImages";
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
import { rehypeKadrSections } from "../utils/rehypeKadrSections";

const EMPTY_ANNOTATIONS: ActorAnnotation[] = [];

function desktopOfflineImageFromCache(
  rawHref: string,
  resolveImageSrc: (src?: string) => string | undefined,
): string | undefined {
  if (!getDesktopApi()?.invoke) return undefined;
  if (rawHref.startsWith("orchestra-image:")) {
    const enc = rawHref.replace(/^orchestra-image:/i, "").trim();
    let key: string;
    try {
      key = decodeURIComponent(enc);
    } catch {
      key = enc;
    }
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
]);

type LineLabelKind = "role" | "light" | "play" | "sound";

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
  return null;
}

type TrackLinkPayload = { id: number } | { name: string };
type SoundLinkPayload = { id: number } | { name: string };

type MarkdownPreviewImageContextValue = {
  accessToken: string | null;
  playUrlCache: React.MutableRefObject<Map<string, string>>;
  resolveImageSrc: (src?: string) => string | undefined;
  resolveSoundIconFromPayload: (payload: SoundLinkPayload) => string | null;
  setLightbox: React.Dispatch<React.SetStateAction<{ src: string; alt: string } | null>>;
};

const MarkdownPreviewImageContext = createContext<MarkdownPreviewImageContextValue | null>(null);

/** Параллельные MarkdownPreviewImage с одним storage key — один HTTP-запрос play-url. */
const playUrlInflight = new Map<string, Promise<string | undefined>>();

/** Presigned URL не запрашиваем, пока превью не близко к видимой области (как lazy-loading у нормальных CDN-клиентов). */
const ORCH_IMAGE_IO_ROOT_MARGIN = "420px 0px 280px 0px";

/** Must stay a stable module-level component so React does not remount every image on parent re-render. */
function MarkdownPreviewImage(props: React.ImgHTMLAttributes<HTMLImageElement>) {
  const ctx = useContext(MarkdownPreviewImageContext);
  const { src, alt, onLoad, onError, ...rest } = props;
  const accessToken = ctx?.accessToken ?? null;
  const resolveToLocal = ctx?.resolveImageSrc;
  const resolveSound = ctx?.resolveSoundIconFromPayload;
  const playUrlCache = ctx?.playUrlCache;
  const raw = String(src ?? "").trim();
  const isOrchestraImage = raw.startsWith("orchestra-image:");
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
  const orchSentinelRef = useRef<HTMLSpanElement | null>(null);
  /** Для orchestra-image с сетевым play-url ждём intersection; кэш / desktop — без ожидания. */
  const [orchInView, setOrchInView] = useState(() => !isOrchestraImage);

  useEffect(() => {
    setPlayUrlRetry(0);
    httpTriedLocalFallbackRef.current = false;
  }, [src]);

  useEffect(() => {
    const s = String(src ?? "").trim();
    setOrchInView(!s.startsWith("orchestra-image:"));
  }, [src]);

  useEffect(() => {
    if (!isOrchestraImage || orchInView) return;
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
        let key: string;
        try {
          key = decodeURIComponent(encoded);
        } catch {
          key = encoded;
        }
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

  const invalidatePlayUrlCacheAndRetry = () => {
    if (!raw.startsWith("orchestra-image:")) return;
    const encoded = raw.replace(/^orchestra-image:/i, "").trim();
    let key: string;
    try {
      key = decodeURIComponent(encoded);
    } catch {
      key = encoded;
    }
    setPlayUrlRetry((prev) => {
      if (prev >= 2) return prev;
      ctx.playUrlCache.current.delete(key);
      setResolved("");
      return prev + 1;
    });
  };

  const imgEl = resolved ? (
    <img
      {...rest}
      src={resolved}
      alt={altText}
      loading="lazy"
      decoding="async"
      onLoad={(e) => {
        setState("loaded");
        onLoad?.(e);
      }}
      onError={(e) => {
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
        setState("error");
        onError?.(e);
        invalidatePlayUrlCacheAndRetry();
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
        ctx.setLightbox({ src: resolved, alt: altText });
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
}: {
  projectName: string;
  sceneName?: string;
  onTrackLinkClick?: (trackId: number) => void;
  onSoundLinkClick?: (soundId: number) => void;
  onCreateAnnotation: (draft: NewAnnotationDraft) => Promise<void>;
  onUpdateAnnotation: (id: string, noteText: string) => Promise<void>;
  onDeleteAnnotation: (id: string) => Promise<void>;
  newAnnotation: NewAnnotationDraft | null;
  setNewAnnotation: React.Dispatch<React.SetStateAction<NewAnnotationDraft | null>>;
  activeAnnotationId: string | null;
  setActiveAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
}) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const ui = useAppSelector((s) => selectShowScriptMarkdownUi(s, projectName, sceneName));
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const roles = useAppSelector(selectProjectRoles);
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
  const markdownMode = ui.markdownMode;
  const playlistOptions = ui.playlistOptions;
  const soundsOptions = ui.soundsOptions;
  const soundsOptionsRef = useRef(soundsOptions);
  soundsOptionsRef.current = soundsOptions;
  const lightChannels = ui.lightChannels;

  const [lightbox, setLightbox] = useState<null | { src: string; alt: string }>(null);

  useEffect(() => {
    if (!lightbox) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightbox(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    void dispatch(fetchProjectRolesThunk({ accessToken, projectName }));
  }, [accessToken, projectName, dispatch]);

  const imageUrlCacheRef = useRef(new Map<string, string>());

  const { rootRef, popoverRef, position, setAnchorFromRect, requestClose } =
    useAnnotationsPopoverPosition({
      enabled: annotationsMode,
      activeAnnotationId,
      isOpen: Boolean(newAnnotation || activeAnnotationId),
    });

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
      setLightbox,
    }),
    [accessToken, resolveImageSrc, resolveSoundIconFromPayload],
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

  const isAudioLink = (href?: string) => {
    if (!href) return false;
    return /\.(mp3|wav|ogg|m4a|flac)$/i.test(href.trim());
  };

  const renderLightTokens = useMemo(
    () => createRenderLightTokens(lightChannels),
    [lightChannels],
  );
  const rehypeScriptTokens = useMemo(
    () => createRehypeScriptTokens(lightChannels),
    [lightChannels],
  );

  const kadrLayoutEnabled = markdownMode === "notes" || markdownMode === "explication";

  const rehypePlugins = useMemo(() => {
    const plugins: any[] = [];
    if (annotationsMode) {
      plugins.push(rehypeScriptTokens);
      plugins.push([rehypeActorAnnotations, { annotations, activeId: activeAnnotationId }]);
    }
    if (kadrLayoutEnabled) {
      plugins.push([rehypeKadrSections, { enabled: true, headingMaxLevel: 3 }]);
    }
    return plugins;
  }, [annotationsMode, rehypeScriptTokens, annotations, activeAnnotationId, kadrLayoutEnabled]);

  const hasRoleOrLightLabels = useMemo(
    () => markdownHasRoleLightOrPlayLineLabels(markdown || ""),
    [markdown],
  );

  useLayoutEffect(() => {
    if (!hasRoleOrLightLabels) {
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

    // Measure after paint to avoid 0-width in some cases.
    const raf = requestAnimationFrame(compute);
    const ro = new ResizeObserver(() => compute());
    ro.observe(root);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [hasRoleOrLightLabels, markdown]);

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
        kadrLayoutEnabled ? "markdown-preview--kadr" : "",
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
        onMouseUp={annotationsMode ? handleMarkdownMouseUp : undefined}
      >
        <div className="script-step-title">{currentStep?.title}</div>
        <MarkdownPreviewImageContext.Provider value={markdownPreviewImageCtx}>
        <ReactMarkdown
          urlTransform={urlTransform}
          rehypePlugins={rehypePlugins}
          components={{
            p: ({ children }: { children: React.ReactNode }) => {
              const rendered = renderLightTokens(children);
              const { label, rest, kind } = splitLeadingLineLabel(rendered);
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

                if (!hasRoleOrLightLabels) {
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
            },
            li: ({ children }: { children: React.ReactNode }) => (
              <li>{renderLightTokens(children)}</li>
            ),
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
                  <button
                    type="button"
                    className="markdown-track-link"
                    data-track-id={"id" in resolved ? String(resolved.id) : undefined}
                    data-track-name={"name" in resolved ? String(resolved.name) : undefined}
                    onClick={async () => {
                      if ("id" in resolved) {
                        onTrackLinkClick(Number(resolved.id));
                        return;
                      }
                      if ("name" in resolved) {
                        playFromPayload({ name: String(resolved.name) });
                      }
                    }}
                  >
                    {children}
                  </button>
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
            img: MarkdownPreviewImage,
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
          {markdown || "*Пусто*"}
        </ReactMarkdown>
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
            <button
              type="button"
              className="markdown-lightbox__close"
              onClick={() => setLightbox(null)}
              aria-label="Закрыть"
              title="Закрыть"
            >
              ×
            </button>
            <img
              className="markdown-lightbox__img"
              src={lightbox.src}
              alt={lightbox.alt || ""}
            />
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

