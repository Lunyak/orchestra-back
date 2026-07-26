import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import {
  fetchProjectorImageBlobUrl,
  fetchProjectorVideoPreviewUrl,
  resolveProjectorHoldAsset,
  resolveProjectorVideoAsset,
  type ProjectorMediaContext,
} from "../model/projector-media";
import { isLocalProjectMediaUrl } from "../../../shared/platform/media-url";
import "./projector-media-preview.css";

export type ProjectorMediaPreviewProps = {
  ctx: ProjectorMediaContext;
  mode: "video" | "hold";
  videoId?: number | null;
  holdId?: number | null;
  title: string;
  className?: string;
  fallbackClassName?: string;
  /** Пустой fallback без текста (для обложки, где название уже есть ниже). */
  hideFallbackLabel?: boolean;
  interactive?: boolean;
  onActivate?: () => void;
};

type PreviewResolveResult = {
  src: string | null;
  blob: boolean;
  storageKey: string | null;
};

export async function resolveProjectorPreviewSrc(
  ctx: ProjectorMediaContext,
  mode: "video" | "hold",
  videoId: number | null,
  holdId: number | null,
  opts?: { preferRemote?: boolean },
): Promise<PreviewResolveResult> {
  const preferRemote = opts?.preferRemote === true;

  if (mode === "hold") {
    const asset = resolveProjectorHoldAsset(ctx, holdId);
    if (!asset) return { src: null, blob: false, storageKey: null };
    if (!preferRemote) {
      if (asset.fallbackSrc && isLocalProjectMediaUrl(asset.fallbackSrc)) {
        return { src: asset.fallbackSrc, blob: false, storageKey: asset.storageKey };
      }
      if (!asset.storageKey && asset.fallbackSrc) {
        return { src: asset.fallbackSrc, blob: false, storageKey: null };
      }
    }
    if (asset.storageKey) {
      const blobUrl = await fetchProjectorImageBlobUrl(asset.storageKey);
      if (blobUrl) return { src: blobUrl, blob: true, storageKey: asset.storageKey };
    }
    return { src: preferRemote ? null : asset.fallbackSrc, blob: false, storageKey: asset.storageKey };
  }

  if (videoId == null || videoId <= 0) return { src: null, blob: false, storageKey: null };
  const asset = resolveProjectorVideoAsset(ctx, videoId);
  if (!asset) return { src: null, blob: false, storageKey: null };

  if (!preferRemote) {
    if (asset.fallbackSrc && isLocalProjectMediaUrl(asset.fallbackSrc)) {
      return { src: asset.fallbackSrc, blob: false, storageKey: asset.storageKey };
    }
    if (!asset.storageKey && asset.fallbackSrc) {
      return { src: asset.fallbackSrc, blob: false, storageKey: null };
    }
  }

  if (asset.storageKey) {
    const remote = await fetchProjectorVideoPreviewUrl(asset.storageKey);
    if (remote) return { ...remote, storageKey: asset.storageKey };
  }

  return {
    src: preferRemote ? null : asset.fallbackSrc,
    blob: false,
    storageKey: asset.storageKey,
  };
}

function seekVideoPreviewFrame(video: HTMLVideoElement) {
  if (!Number.isFinite(video.duration) || video.duration <= 0) {
    if (video.currentTime < 0.05) video.currentTime = 0.1;
    return;
  }
  const target = Math.min(0.25, Math.max(0.05, video.duration * 0.02));
  if (Math.abs(video.currentTime - target) > 0.01) {
    video.currentTime = target;
  }
}

export function ProjectorMediaPreview({
  ctx,
  mode,
  videoId = null,
  holdId = null,
  title,
  className,
  fallbackClassName,
  hideFallbackLabel = false,
  interactive = false,
  onActivate,
}: ProjectorMediaPreviewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const blobRef = useRef<string | null>(null);
  const storageKeyRef = useRef<string | null>(null);
  const triedRemoteRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);
    storageKeyRef.current = null;
    triedRemoteRef.current = false;

    void resolveProjectorPreviewSrc(ctx, mode, videoId, holdId).then((result) => {
      if (cancelled) {
        if (result.blob && result.src) URL.revokeObjectURL(result.src);
        return;
      }
      storageKeyRef.current = result.storageKey;
      if (!result.src) {
        setFailed(true);
        return;
      }
      if (result.blob) blobRef.current = result.src;
      setSrc(result.src);
    });

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [ctx, mode, videoId, holdId]);

  const retryRemoteOrFail = () => {
    const key = storageKeyRef.current;
    if (!key || triedRemoteRef.current) {
      setFailed(true);
      return;
    }
    triedRemoteRef.current = true;
    void resolveProjectorPreviewSrc(ctx, mode, videoId, holdId, { preferRemote: true }).then(
      (result) => {
        if (!result.src) {
          setFailed(true);
          return;
        }
        if (blobRef.current) {
          URL.revokeObjectURL(blobRef.current);
          blobRef.current = null;
        }
        if (result.blob) blobRef.current = result.src;
        setFailed(false);
        setSrc(result.src);
      },
    );
  };

  const previewLabel = title.trim() || (mode === "hold" ? "Заставка" : "Видео");
  const fallbackClass = cn("projector-media-preview__fallback", fallbackClassName);
  const fallbackLabel = hideFallbackLabel ? null : previewLabel;

  if (failed || !src) {
    if (interactive && onActivate) {
      return (
        <button
          type="button"
          className={cn("projector-media-preview", className)}
          onClick={onActivate}
          title={previewLabel}
          aria-label={previewLabel}
        >
          <span className={fallbackClass}>{fallbackLabel}</span>
        </button>
      );
    }
    return <span className={fallbackClass}>{fallbackLabel}</span>;
  }

  const media =
    mode === "hold" ? (
      <img
        src={src}
        alt=""
        className="projector-media-preview__img"
        onError={retryRemoteOrFail}
      />
    ) : (
      <video
        src={src}
        className="projector-media-preview__video"
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={(event) => seekVideoPreviewFrame(event.currentTarget)}
        onLoadedData={(event) => seekVideoPreviewFrame(event.currentTarget)}
        onError={retryRemoteOrFail}
      />
    );

  if (interactive && onActivate) {
    return (
      <button
        type="button"
        className={cn("projector-media-preview", className)}
        onClick={onActivate}
        title={previewLabel}
        aria-label={previewLabel}
      >
        {media}
      </button>
    );
  }

  return (
    <span className={cn("projector-media-preview", "projector-media-preview--static", className)}>
      {media}
    </span>
  );
}
