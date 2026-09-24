import { useEffect, useRef, useState } from "react";
import { isTheaterBuiltinTemplateKey } from "../model/theater-model-builtin";
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
import { TheaterModelCatalog } from "./TheaterModelCatalog";
import { TheaterNavigationPanel } from "./TheaterNavigationPanel";
import { TheaterSidebarHome, TheaterSidebarPanelHeader } from "./TheaterSidebarNav";

export type TheaterRightSidebarProps = {
  vm: TheaterSceneViewModel;
};

export function TheaterRightSidebar({ vm }: TheaterRightSidebarProps) {
  const [panelId, setPanelId] = useState<TheaterSidebarPanelId | null>(null);
  const [spotlightsSection, setSpotlightsSection] =
    useState<TheaterSpotlightsSectionId | null>(null);
  const [roomSection, setRoomSection] = useState<TheaterRoomSectionId | null>(null);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  const openPanel = (nextId: TheaterSidebarPanelId) => {
    applyTheaterSidebarPanel(vm, nextId);
    setPanelId(nextId);
    setSpotlightsSection(null);
    setRoomSection(null);
    setCategoriesOpen(false);
  };

  useEffect(() => {
    if (vm.activeTab !== "models") return;
    setPanelId("models");
  }, [vm.activeTab]);

  const closePanel = () => {
    if (panelId === "models") vm.setActiveTab("navigate");
    setPanelId(null);
    setSpotlightsSection(null);
    setRoomSection(null);
    setCategoriesOpen(false);
  };

  const selectedBuiltin = isTheaterBuiltinTemplateKey(vm.builtinModelKey)
    ? vm.builtinModelKey
    : undefined;
  const addDisabled = !vm.currentScene;

  if (panelId == null) {
    return (
      <div className="theater-right-sidebar">
        <TheaterSidebarHome onOpen={openPanel} />
      </div>
    );
  }

  const isSpotlights = panelId === "spotlights";
  const isRoom = panelId === "room";
  const isModels = panelId === "models";
  const nestedSectionLabel = isSpotlights && spotlightsSection
    ? getTheaterSpotlightsSectionLabel(spotlightsSection)
    : isRoom && roomSection
      ? getTheaterRoomSectionLabel(roomSection)
      : null;
  const panelLabel = nestedSectionLabel ?? getTheaterSidebarPanelLabel(panelId);
  const onBack = nestedSectionLabel
    ? () => {
        setSpotlightsSection(null);
        setRoomSection(null);
      }
    : closePanel;

  return (
    <div className="theater-right-sidebar" ref={sidebarRef}>
      <TheaterSidebarPanelHeader
        onBack={onBack}
        extraPanel={
          isModels
            ? {
                open: categoriesOpen,
                onToggle: () => setCategoriesOpen((open) => !open),
                label: "Категории",
              }
            : undefined
        }
      />
      {isModels ? (
        <TheaterModelCatalog
          anchorRef={sidebarRef}
          categoriesOpen={categoriesOpen}
          value={selectedBuiltin}
          onChange={(nextKey) => vm.setBuiltinModelKey(nextKey)}
          onClose={closePanel}
          onAdd={vm.addBuiltinModel}
          onAddFile={() => {
            void vm.addModel();
          }}
          addDisabled={addDisabled}
          dragEnabled={!addDisabled}
        />
      ) : (
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
      )}
    </div>
  );
}
