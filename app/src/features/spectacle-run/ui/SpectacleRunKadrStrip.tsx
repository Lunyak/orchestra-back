import type { SpectacleRunKadrStripProps } from "../model/spectacle-run-kadr-strip-types";
import { useSpectacleRunKadrStrip } from "../model/useSpectacleRunKadrStrip";
import { SpectacleRunKadrStripTrack } from "./SpectacleRunKadrStripTrack";

export type {
  SpectacleRunKadrStripLayout,
  SpectacleRunKadrStripVariant,
  ProgRunChipLiveConsoleProps,
  SpectacleRunKadrStripProps,
} from "../model/spectacle-run-kadr-strip-types";

export function SpectacleRunKadrStrip(props: SpectacleRunKadrStripProps) {
  const {
    stripRef,
    trackRef,
    stripClassName,
    stripAriaLabel,
    isEmpty,
    isFlatTapeLayout,
    tape,
    groups,
    buildChipModel,
  } = useSpectacleRunKadrStrip(props);

  if (isEmpty) return null;

  return (
    <footer ref={stripRef} className={stripClassName} aria-label={stripAriaLabel}>
      <SpectacleRunKadrStripTrack
        trackRef={trackRef}
        isFlatTapeLayout={isFlatTapeLayout}
        tape={tape}
        groups={groups}
        buildChipModel={buildChipModel}
      />
    </footer>
  );
}
