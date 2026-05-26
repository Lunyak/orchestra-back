import { useEffect, useMemo, useState } from "react";
import {
  createDecorPresetCanvas,
  getDecorTexturePresetId,
  resolveDecorTextureSrc,
} from "../model/theater-decor-textures";

export type DecorTexturePreviewProps = {
  projectName: string;
  textureRef?: string;
  fallbackColor?: string;
  label?: string;
};

export function DecorTexturePreview({
  projectName,
  textureRef,
  fallbackColor,
  label,
}: DecorTexturePreviewProps) {
  const presetId = getDecorTexturePresetId(textureRef);
  const presetSrc = useMemo(() => {
    if (!presetId) return null;
    const canvas = createDecorPresetCanvas(presetId);
    return canvas.toDataURL("image/png");
  }, [presetId]);

  const fileSrc = useMemo(() => {
    if (!textureRef || presetId) return null;
    return resolveDecorTextureSrc(projectName, textureRef);
  }, [presetId, projectName, textureRef]);

  const [loadedFileSrc, setLoadedFileSrc] = useState<string | null>(null);

  useEffect(() => {
    setLoadedFileSrc(null);
    if (!fileSrc) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => {
      if (!cancelled) setLoadedFileSrc(fileSrc);
    };
    img.onerror = () => {
      if (!cancelled) setLoadedFileSrc(null);
    };
    img.src = fileSrc;
    return () => {
      cancelled = true;
    };
  }, [fileSrc]);

  const src = presetSrc ?? loadedFileSrc;
  if (!src && !fallbackColor) return null;

  return (
    <div className="theater-decor-texture-preview" title={label}>
      {src ? (
        <img src={src} alt={label ?? "Текстура декора"} />
      ) : (
        <div
          className="theater-decor-texture-preview-fallback"
          style={{ backgroundColor: fallbackColor }}
        />
      )}
      {label ? <span className="theater-decor-texture-preview-label">{label}</span> : null}
    </div>
  );
}
