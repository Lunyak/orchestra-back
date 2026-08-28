import cn from "classnames";
import type { LoadedTrack } from "./header-player-types";
import { bindRangeFill, clampRangeFillPercent } from "./header-player-audio";

const FADE_MAX_MS = 3000;

type HeaderPlayerTimelineProps = {
  track: LoadedTrack;
  onChange: (track: LoadedTrack, value: number) => void;
};

export function HeaderPlayerTimeline({ track, onChange }: HeaderPlayerTimelineProps) {
  const fillPercent = clampRangeFillPercent(0, FADE_MAX_MS, Number(track.fadeMs));

  return (
    <div
      className={cn("header-player-hover-slider", "header-player-hover-slider--right")}
      onClick={(event) => event.stopPropagation()}
    >
      <input
        ref={(el) => bindRangeFill(el, fillPercent)}
        className={cn("header-player-slider", "header-player-fade")}
        type="range"
        min={0}
        max={FADE_MAX_MS}
        step={100}
        value={track.fadeMs}
        onChange={(event) => onChange(track, Number(event.target.value))}
        aria-label="Fade duration"
        title={`Плавность: ${track.fadeMs}мс`}
      />
    </div>
  );
}
