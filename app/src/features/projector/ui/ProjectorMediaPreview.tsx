import cn from "classnames";
import { useEffect, useRef, useState } from "react";
import {
  fetchProjectorImageBlobUrl,
  fetchProjectorVideoBlobUrl,
  resolveProjectorHoldAsset,
  resolveProjectorVideoAsset,
  type ProjectorMediaContext,
} from "../model/projector-media";
import "./projector-media-preview.css";

export type ProjectorMediaPreviewProps = {
  ctx: ProjectorMediaContext;
  mode: "video" | "hold";
  videoId?: number | null;
  holdId?: number | null;
  title: string;
  className?: string;
  fallbackClassName?: string;
  interactive?: boolean;
  onActivate?: () => void;
};

export async function resolveProjectorPreviewSrc(
  ctx: ProjectorMediaContext,
  mode: "video" | "hold",
  videoId: number | null,
  holdId: number | null,
): Promise<{ src: string | null; blob: boolean }> {
  if (mode === "hold") {
    const asset = resolveProjectorHoldAsset(ctx, holdId);
    if (!asset) return { src: null, blob: false };
    if (asset.storageKey) {
      const blobUrl = await fetchProjectorImageBlobUrl(asset.storageKey);
      if (blobUrl) return { src: blobUrl, blob: true };
    }
    return { src: asset.fallbackSrc, blob: false };
  }

  if (videoId == null || videoId <= 0) return { src: null, blob: false };
  const asset = resolveProjectorVideoAsset(ctx, videoId);
  if (!asset) return { src: null, blob: false };
  if (asset.storageKey) {
    const blobUrl = await fetchProjectorVideoBlobUrl(asset.storageKey);
    if (blobUrl) return { src: blobUrl, blob: true };
  }
  return { src: asset.fallbackSrc, blob: false };
}

export function ProjectorMediaPreview({
  ctx,
  mode,
  videoId = null,
  holdId = null,
  title,
  className,
  fallbackClassName,
  interactive = false,
  onActivate,
}: ProjectorMediaPreviewProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSrc(null);
    setFailed(false);

    void resolveProjectorPreviewSrc(ctx, mode, videoId, holdId).then((result) => {
      if (cancelled) {
        if (result.blob && result.src) URL.revokeObjectURL(result.src);
        return;
      }
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

  const previewLabel = title.trim() || (mode === "hold" ? "Заставка" : "Видео");
  const fallbackClass = cn("projector-media-preview__fallback", fallbackClassName);

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
          <span className={fallbackClass}>{previewLabel}</span>
        </button>
      );
    }
    return <span className={fallbackClass}>{previewLabel}</span>;
  }

  const media =
    mode === "hold" ? (
      <img
        src={src}
        alt=""
        className="projector-media-preview__img"
        onError={() => setFailed(true)}
      />
    ) : (
      <video
        src={src}
        className="projector-media-preview__video"
        muted
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
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

  return <span className={cn("projector-media-preview", "projector-media-preview--static", className)}>{media}</span>;
}
