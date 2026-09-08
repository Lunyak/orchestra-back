import cn from "classnames";
import type {
  TheaterLayoutSectionId,
  TheaterRoomSectionId,
  TheaterSpotlightsSectionId,
} from "../../model/theater-sidebar-nav";
import { TheaterControlsDecorTab } from "./TheaterControlsDecorTab";
import { TheaterControlsLayoutTab } from "./TheaterControlsLayoutTab";
import { TheaterControlsModelsTab } from "./TheaterControlsModelsTab";
import { TheaterControlsSpotlightsTab } from "./TheaterControlsSpotlightsTab";
import type { TheaterControlsTabProps } from "./types";

export type TheaterControlsSettingsProps = TheaterControlsTabProps & {
  spotlightsSection?: TheaterSpotlightsSectionId | null;
  onOpenSpotlightsSection?: (sectionId: TheaterSpotlightsSectionId) => void;
  layoutSection?: TheaterLayoutSectionId;
  roomSection?: TheaterRoomSectionId | null;
  onOpenRoomSection?: (sectionId: TheaterRoomSectionId) => void;
};

export function TheaterControlsSettings({
  vm,
  spotlightsSection = null,
  onOpenSpotlightsSection,
  layoutSection = "room",
  roomSection = null,
  onOpenRoomSection,
}: TheaterControlsSettingsProps) {
  const { activeTab } = vm;
  const isModelsTab = activeTab === "models";
  const isSpotlightsTab = activeTab === "spotlights";
  const isRoomNav = activeTab === "layout" && layoutSection === "room" && roomSection == null;

  return (
    <div
      className={cn(
        "theater-controls-settings",
        "theater-controls--stage-brutal",
        isModelsTab && "theater-controls-settings--fill",
        (isSpotlightsTab || isRoomNav) && "theater-controls-settings--nav",
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
      {activeTab === "layout" ? (
        <TheaterControlsLayoutTab
          vm={vm}
          section={layoutSection}
          roomSection={roomSection}
          onOpenRoomSection={onOpenRoomSection}
        />
      ) : null}
    </div>
  );
}
