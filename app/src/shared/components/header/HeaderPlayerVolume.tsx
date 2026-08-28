import cn from "classnames";
import type { LoadedTrack } from "./header-player-types";
import { bindRangeFill, clampRangeFillPercent } from "./header-player-audio";

type HeaderPlayerVolumeProps = {
  track: LoadedTrack;
  onChange: (track: LoadedTrack, value: number) => void;
};

export function HeaderPlayerVolume({ track, onChange }: HeaderPlayerVolumeProps) {
  const fillPercent = clampRangeFillPercent(0, 1, Number(track.volume));
  const volumePercent = Math.round(track.volume * 100);

  return (
    <div
      className={cn("header-player-hover-slider", "header-player-hover-slider--left")}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={(el) => bindRangeFill(el, fillPercent)}
        className={cn("header-player-slider", "header-player-volume")}
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={track.volume}
        onChange={(event) => onChange(track, Number(event.target.value))}
        aria-label="Track volume"
        title={`Громкость: ${volumePercent}%`}
      />
    </div>
  );
}
