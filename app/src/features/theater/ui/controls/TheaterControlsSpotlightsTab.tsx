import type { TheaterSpotlightsSectionId } from "../../model/theater-sidebar-nav";
import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsSpotlightsTab } from "./use-theater-controls-spotlights-tab";
import { TheaterControlsSpotlightsLightplotSection } from "./spotlights/TheaterControlsSpotlightsLightplotSection";
import { TheaterControlsSpotlightsMultiSection } from "./spotlights/TheaterControlsSpotlightsMultiSection";
import { TheaterControlsSpotlightsRegularSection } from "./spotlights/TheaterControlsSpotlightsRegularSection";
import { TheaterControlsSpotlightsRgbSection } from "./spotlights/TheaterControlsSpotlightsRgbSection";
import { TheaterControlsSpotlightsTrussSection } from "./spotlights/TheaterControlsSpotlightsTrussSection";
import { TheaterSpotlightsHome } from "./spotlights/TheaterSpotlightsHome";

export type TheaterControlsSpotlightsTabProps = TheaterControlsTabProps & {
  section: TheaterSpotlightsSectionId | null;
  onOpenSection: (sectionId: TheaterSpotlightsSectionId) => void;
};

export function TheaterControlsSpotlightsTab({
  vm,
  section,
  onOpenSection,
}: TheaterControlsSpotlightsTabProps) {
  const spot = useTheaterControlsSpotlightsTab(vm);

  if (section == null) {
    return <TheaterSpotlightsHome vm={vm} spot={spot} onOpen={onOpenSection} />;
  }

  return (
    <div className="theater-layout-panel theater-layout-panel--spotlights">
      {section === "regular" ? (
        <>
          <TheaterControlsSpotlightsMultiSection vm={vm} spot={spot} />
          <TheaterControlsSpotlightsRegularSection vm={vm} spot={spot} />
        </>
      ) : null}
      {section === "rgb" ? (
        <>
          <TheaterControlsSpotlightsMultiSection vm={vm} spot={spot} />
          <TheaterControlsSpotlightsRgbSection vm={vm} spot={spot} />
        </>
      ) : null}
      {section === "trusses" ? (
        <TheaterControlsSpotlightsTrussSection vm={vm} spot={spot} />
      ) : null}
      {section === "control" ? (
        <TheaterControlsSpotlightsLightplotSection vm={vm} spot={spot} />
      ) : null}
    </div>
  );
}
