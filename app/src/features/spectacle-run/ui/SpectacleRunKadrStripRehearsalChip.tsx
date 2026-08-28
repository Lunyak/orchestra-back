import type { Ref } from "react";

import type { SpectacleRunKadrStripRehearsalChipProps } from "../model/spectacle-run-kadr-strip-types";
import { useKadrStripChipImage } from "../model/useKadrStripChipImage";

export type { SpectacleRunKadrStripRehearsalChipProps };

export function SpectacleRunKadrStripRehearsalChip({
  projectName,
  item,
  imageHref,
  active,
  programColor,
  title,
  label,
  onSelect,
  chipRef,
  tapeIndex,
}: SpectacleRunKadrStripRehearsalChipProps) {
  const { imageSrc, onImageError, hasThumb, fallbackColor, chipAccentStyle } =
    useKadrStripChipImage(projectName, imageHref, programColor);

  return (
    <button
      ref={chipRef as Ref<HTMLButtonElement> | undefined}
      type="button"
      className="spectacle-run-kadr-strip__chip"
      data-active={active}
      data-tape-index={tapeIndex}
      data-placeholder={item.isPlaceholder ? "true" : undefined}
      data-has-thumb={hasThumb ? "true" : undefined}
      data-has-fallback-color={fallbackColor ? "true" : undefined}
      style={chipAccentStyle}
      title={title}
      onClick={onSelect}
    >
      <span className="spectacle-run-kadr-strip__chip-media" aria-hidden>
        {hasThumb ? (
          <img
            src={imageSrc ?? undefined}
            alt=""
            className="spectacle-run-kadr-strip__chip-thumb"
            onError={onImageError}
          />
        ) : null}
      </span>
      <span className="spectacle-run-kadr-strip__chip-label">{label}</span>
    </button>
  );
}
