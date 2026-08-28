import type { CSSProperties } from "react";

import { useKadrStripImageSrc } from "./useKadrStripImageSrc";

export function useKadrStripChipImage(
  projectName: string,
  imageHref: string | null,
  programColor: string | null,
) {
  const { src: imageSrc, onImageError } = useKadrStripImageSrc(projectName, imageHref);
  const hasThumb = Boolean(imageSrc);
  const fallbackColor = !hasThumb ? programColor : null;
  const chipAccentStyle = fallbackColor
    ? ({ "--spectacle-run-kadr-strip-chip-accent": fallbackColor } as CSSProperties)
    : undefined;

  return { imageSrc, onImageError, hasThumb, fallbackColor, chipAccentStyle };
}
