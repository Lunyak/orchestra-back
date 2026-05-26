import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsSpotlightsTab } from "./use-theater-controls-spotlights-tab";
import { TheaterControlsSpotlightsLightplotSection } from "./spotlights/TheaterControlsSpotlightsLightplotSection";
import { TheaterControlsSpotlightsMultiSection } from "./spotlights/TheaterControlsSpotlightsMultiSection";
import { TheaterControlsSpotlightsRegularSection } from "./spotlights/TheaterControlsSpotlightsRegularSection";
import { TheaterControlsSpotlightsRgbSection } from "./spotlights/TheaterControlsSpotlightsRgbSection";
import { TheaterControlsSpotlightsSceneSection } from "./spotlights/TheaterControlsSpotlightsSceneSection";
import { TheaterControlsSpotlightsLayoutSection } from "./spotlights/TheaterControlsSpotlightsLayoutSection";

export function TheaterControlsSpotlightsTab({ vm }: TheaterControlsTabProps) {
  const spot = useTheaterControlsSpotlightsTab(vm);
  return (
    <div className="theater-layout-panel">
      <TheaterControlsSpotlightsLightplotSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsMultiSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsRegularSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsRgbSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsSceneSection vm={vm} spot={spot} />
      <TheaterControlsSpotlightsLayoutSection vm={vm} spot={spot} />
    </div>
  );
}
