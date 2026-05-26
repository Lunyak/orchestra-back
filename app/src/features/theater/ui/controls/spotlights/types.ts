import type { TheaterControlsTabProps } from "../types";
import type { useTheaterControlsSpotlightsTab } from "../use-theater-controls-spotlights-tab";

export type SpotlightsSectionProps = TheaterControlsTabProps & {
  spot: ReturnType<typeof useTheaterControlsSpotlightsTab>;
};
