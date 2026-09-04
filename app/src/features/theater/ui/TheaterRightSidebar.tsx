import { useState } from "react";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import {
  applyTheaterSidebarPanel,
  getTheaterSidebarPanelLabel,
  getTheaterSpotlightsSectionLabel,
  isTheaterSidebarOverviewPanel,
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

  const openPanel = (nextId: TheaterSidebarPanelId) => {
    applyTheaterSidebarPanel(vm, nextId);
    setPanelId(nextId);
    setSpotlightsSection(null);
  };

  if (panelId == null) {
    return (
      <div className="theater-right-sidebar">
        <TheaterSidebarHome onOpen={openPanel} />
      </div>
    );
  }

  const isSpotlights = panelId === "spotlights";
  const panelLabel =
    isSpotlights && spotlightsSection
      ? getTheaterSpotlightsSectionLabel(spotlightsSection)
      : getTheaterSidebarPanelLabel(panelId);
  const onBack =
    isSpotlights && spotlightsSection
      ? () => setSpotlightsSection(null)
      : () => {
          setPanelId(null);
          setSpotlightsSection(null);
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
          />
        )}
      </div>
    </div>
  );
}
