import { useState } from "react";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import {
  applyTheaterSidebarPanel,
  getTheaterRoomSectionLabel,
  getTheaterSidebarPanelLabel,
  getTheaterSpotlightsSectionLabel,
  isTheaterSidebarOverviewPanel,
  type TheaterRoomSectionId,
  type TheaterSidebarPanelId,
  type TheaterSpotlightsSectionId,
} from "../model/theater-sidebar-nav";
import { TheaterControlsSettings } from "./controls/TheaterControlsSettings";
import { TheaterNavigationPanel } from "./TheaterNavigationPanel";
import {
  TheaterSidebarHome,
  TheaterSidebarPanelHeader,
} from "./TheaterSidebarNav";

export type TheaterRightSidebarProps = {
  vm: TheaterSceneViewModel;
};

export function TheaterRightSidebar({ vm }: TheaterRightSidebarProps) {
  const [panelId, setPanelId] = useState<TheaterSidebarPanelId | null>(null);
  const [spotlightsSection, setSpotlightsSection] =
    useState<TheaterSpotlightsSectionId | null>(null);
  const [roomSection, setRoomSection] = useState<TheaterRoomSectionId | null>(null);

  const openPanel = (nextId: TheaterSidebarPanelId) => {
    applyTheaterSidebarPanel(vm, nextId);
    setPanelId(nextId);
    setSpotlightsSection(null);
    setRoomSection(null);
  };

  if (panelId == null) {
    return (
      <div className="theater-right-sidebar">
        <TheaterSidebarHome onOpen={openPanel} />
      </div>
    );
  }

  const isSpotlights = panelId === "spotlights";
  const isRoom = panelId === "room";
  const nestedSectionLabel = isSpotlights && spotlightsSection
    ? getTheaterSpotlightsSectionLabel(spotlightsSection)
    : isRoom && roomSection
      ? getTheaterRoomSectionLabel(roomSection)
      : null;
  const panelLabel = nestedSectionLabel ?? getTheaterSidebarPanelLabel(panelId);
  const onBack =
    nestedSectionLabel
      ? () => {
          setSpotlightsSection(null);
          setRoomSection(null);
        }
      : () => {
          setPanelId(null);
          setSpotlightsSection(null);
          setRoomSection(null);
        };

  return (
    <div className="theater-right-sidebar">
      <TheaterSidebarPanelHeader title={panelLabel} onBack={onBack} />
      <div className="theater-right-sidebar-panels" aria-label={panelLabel}>
        {isTheaterSidebarOverviewPanel(panelId) ? (
          <TheaterNavigationPanel vm={vm} embedded section={panelId} />
        ) : (
          <TheaterControlsSettings
            vm={vm}
            spotlightsSection={spotlightsSection}
            onOpenSpotlightsSection={setSpotlightsSection}
            layoutSection={panelId === "layout" ? "openings" : "room"}
            roomSection={roomSection}
            onOpenRoomSection={setRoomSection}
          />
        )}
      </div>
    </div>
  );
}
