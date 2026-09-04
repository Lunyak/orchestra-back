import cn from "classnames";
import type { TheaterSpotlightsSectionId } from "../../model/theater-sidebar-nav";
import { TheaterControlsDecorTab } from "./TheaterControlsDecorTab";
import { TheaterControlsLayoutTab } from "./TheaterControlsLayoutTab";
import { TheaterControlsModelsTab } from "./TheaterControlsModelsTab";
import { TheaterControlsSpotlightsTab } from "./TheaterControlsSpotlightsTab";
import type { TheaterControlsTabProps } from "./types";

export type TheaterControlsSettingsProps = TheaterControlsTabProps & {
  spotlightsSection?: TheaterSpotlightsSectionId | null;
  onOpenSpotlightsSection?: (sectionId: TheaterSpotlightsSectionId) => void;
};

export function TheaterControlsSettings({
  vm,
  spotlightsSection = null,
  onOpenSpotlightsSection,
}: TheaterControlsSettingsProps) {
  const { activeTab } = vm;
  const isModelsTab = activeTab === "models";
  const isSpotlightsTab = activeTab === "spotlights";

  return (
    <div
      className={cn(
        "theater-controls-settings",
        "theater-controls--stage-brutal",
        isModelsTab && "theater-controls-settings--fill",
        isSpotlightsTab && "theater-controls-settings--nav",
      )}
    >
      {isSpotlightsTab ? (
        <TheaterControlsSpotlightsTab
          vm={vm}
          section={spotlightsSection}
          onOpenSection={onOpenSpotlightsSection ?? (() => undefined)}
        />
      ) : null}
      {isModelsTab ? <TheaterControlsModelsTab vm={vm} /> : null}
      {activeTab === "decor" ? <TheaterControlsDecorTab vm={vm} /> : null}
      {activeTab === "layout" ? <TheaterControlsLayoutTab vm={vm} /> : null}
    </div>
  );
}
