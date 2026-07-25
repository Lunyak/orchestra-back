import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsSpotlightsTab } from "./use-theater-controls-spotlights-tab";
import { TheaterControlsSpotlightsLightplotSection } from "./spotlights/TheaterControlsSpotlightsLightplotSection";
import { TheaterControlsSpotlightsMultiSection } from "./spotlights/TheaterControlsSpotlightsMultiSection";
import { TheaterControlsSpotlightsRegularSection } from "./spotlights/TheaterControlsSpotlightsRegularSection";
import { TheaterControlsSpotlightsRgbSection } from "./spotlights/TheaterControlsSpotlightsRgbSection";
import { TheaterControlsSpotlightsTrussSection } from "./spotlights/TheaterControlsSpotlightsTrussSection";

export function TheaterControlsSpotlightsTab({ vm }: TheaterControlsTabProps) {
  const spot = useTheaterControlsSpotlightsTab(vm);
  return (
    <div className="theater-layout-panel">
      <TheaterControlsSpotlightsMultiSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsRegularSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsRgbSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsTrussSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsLightplotSection vm={vm} spot={spot} />
    </div>
  );
}
