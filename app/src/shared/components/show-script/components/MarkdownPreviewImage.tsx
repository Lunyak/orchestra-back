import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { fetchImageStreamBlobUrl, getPlayUrl } from "../../../../sync/api/files";
import { getDesktopApi } from "../../../platform/desktop-api";
import { decodeOrchestraImageStorageKey } from "../../../utils/markdownImages";
import { desktopOfflineImageFromCache } from "./markdown-preview-normalize";
import { MarkdownKadrPictureColumnContext } from "./markdown-preview-context";
import type {
  MarkdownLightboxSlide,
  MarkdownPreviewImageContextValue,
  MarkdownPreviewImageProps,
  SoundLinkPayload,
} from "./markdown-preview-types";
export function collectLightboxSlidesFromPreviewRoot(root: HTMLElement | null): MarkdownLightboxSlide[] {
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

export const MarkdownPreviewImageContext = createContext<MarkdownPreviewImageContextValue | null>(null);

/** Параллельные MarkdownPreviewImage с одним storage key — один HTTP-запрос play-url. */
const playUrlInflight = new Map<string, Promise<string | undefined>>();

/** Presigned URL не запрашиваем, пока превью не близко к видимой области (как lazy-loading у нормальных CDN-клиентов). */
const ORCH_IMAGE_IO_ROOT_MARGIN = "420px 0px 280px 0px";

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

export function MarkdownPreviewImage(props: MarkdownPreviewImageProps) {
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

