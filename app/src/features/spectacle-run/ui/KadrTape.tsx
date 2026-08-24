import {
  SpectacleRunKadrStrip,
  type SpectacleRunKadrStripProps,
} from "./SpectacleRunKadrStrip";

export type KadrTapeProps = SpectacleRunKadrStripProps;

/** Переиспользуемая лента картин (JSON SoT). */
export function KadrTape(props: KadrTapeProps) {
  return <SpectacleRunKadrStrip {...props} />;
}

export type { SpectacleRunKadrStripLayout, SpectacleRunKadrStripVariant as KadrTapeVariant } from "./SpectacleRunKadrStrip";
