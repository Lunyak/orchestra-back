import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  readTheaterViewPrefs,
  writeTheaterViewPrefs,
  type TheaterViewPrefs,
} from "../model/theater-view-prefs-storage";

export type TheaterPanelPrefsBridge = {
  swapTheaterPanels: boolean;
  showControls: boolean;
};

export type UseTheaterViewPrefsResult = TheaterViewPrefs & {
  setShowGrid: (value: boolean) => void;
  setShowStageGrid: (value: boolean) => void;
  setSnapToGrid: (value: boolean) => void;
  setGridStep: (value: number) => void;
  setShowSeats: (value: boolean) => void;
  setWallsOpaque: (value: boolean) => void;
  setWallsHidden: (value: boolean) => void;
  setWallsHideFromCamera: (value: boolean) => void;
  setShowFloorPlan: (value: boolean) => void;
  setFloorPlanExpanded: Dispatch<SetStateAction<boolean>>;
  setSpectaclePreviewMode: (value: boolean) => void;
  setAlignGuidesEnabled: (value: boolean) => void;
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
  setOutlineDrawMode: (value: boolean) => void;
  setSpotlightAimMode: (mode: TheaterViewPrefs["spotlightAimMode"]) => void;
  setDutyLightEnabled: (value: boolean) => void;
  setSceneBackgroundColor: (value: string) => void;
  setShowSpotlightGuideLines: (value: boolean) => void;
  showSpotlights: boolean;
  setShowSpotlights: (value: boolean) => void;
  showOnlyActiveSpotlight: boolean;
  setShowOnlyActiveSpotlight: (value: boolean) => void;
};

/**
 * Editor view preferences: persisted per project, independent of ScriptStep.
 */
export function useTheaterViewPrefs(
  projectName: string,
  panelPrefs: TheaterPanelPrefsBridge,
): UseTheaterViewPrefsResult {
  const { swapTheaterPanels, showControls } = panelPrefs;
  const skipPersistRef = useRef(true);

  const [showGrid, setShowGrid] = useState(
    () => readTheaterViewPrefs(projectName).showGrid,
  );
  const [showStageGrid, setShowStageGrid] = useState(
    () => readTheaterViewPrefs(projectName).showStageGrid,
  );
  const [snapToGrid, setSnapToGrid] = useState(
    () => readTheaterViewPrefs(projectName).snapToGrid,
  );
  const [gridStep, setGridStep] = useState(
    () => readTheaterViewPrefs(projectName).gridStep,
  );
  const [showSeats, setShowSeats] = useState(
    () => readTheaterViewPrefs(projectName).showSeats,
  );
  const [wallsOpaque, setWallsOpaque] = useState(
    () => readTheaterViewPrefs(projectName).wallsOpaque,
  );
  const [wallsHidden, setWallsHidden] = useState(
    () => readTheaterViewPrefs(projectName).wallsHidden,
  );
  const [wallsHideFromCamera, setWallsHideFromCamera] = useState(
    () => readTheaterViewPrefs(projectName).wallsHideFromCamera,
  );
  const [showFloorPlan, setShowFloorPlan] = useState(
    () => readTheaterViewPrefs(projectName).showFloorPlan,
  );
  const [floorPlanExpanded, setFloorPlanExpanded] = useState(
    () => readTheaterViewPrefs(projectName).floorPlanExpanded,
  );
  const [spectaclePreviewMode, setSpectaclePreviewMode] = useState(
    () => readTheaterViewPrefs(projectName).spectaclePreviewMode,
  );
  const [alignGuidesEnabled, setAlignGuidesEnabled] = useState(
    () => readTheaterViewPrefs(projectName).alignGuidesEnabled,
  );
  const [activeTab, setActiveTab] = useState<TheaterViewPrefs["activeTab"]>(
    () => readTheaterViewPrefs(projectName).activeTab,
  );
  const [outlineDrawMode, setOutlineDrawMode] = useState(
    () => readTheaterViewPrefs(projectName).outlineDrawMode,
  );
  const [spotlightAimMode, setSpotlightAimMode] = useState<
    TheaterViewPrefs["spotlightAimMode"]
  >(() => readTheaterViewPrefs(projectName).spotlightAimMode);
  const [dutyLightEnabled, setDutyLightEnabled] = useState(
    () => readTheaterViewPrefs(projectName).dutyLightEnabled,
  );
  const [sceneBackgroundColor, setSceneBackgroundColor] = useState(
    () => readTheaterViewPrefs(projectName).sceneBackgroundColor,
  );
  const [showSpotlightGuideLines, setShowSpotlightGuideLines] = useState(
    () => readTheaterViewPrefs(projectName).showSpotlightGuideLines,
  );
  const [showSpotlights, setShowSpotlights] = useState(true);
  const [showOnlyActiveSpotlight, setShowOnlyActiveSpotlight] = useState(false);

  const hydrateFromStorage = useCallback(() => {
    const prefs = readTheaterViewPrefs(projectName);
    setShowGrid(prefs.showGrid);
    setShowStageGrid(prefs.showStageGrid);
    setSnapToGrid(prefs.snapToGrid);
    setGridStep(prefs.gridStep);
    setShowSeats(prefs.showSeats);
    setWallsOpaque(prefs.wallsOpaque);
    setWallsHidden(prefs.wallsHidden);
    setWallsHideFromCamera(prefs.wallsHideFromCamera);
    setShowFloorPlan(prefs.showFloorPlan);
    setFloorPlanExpanded(prefs.floorPlanExpanded);
    setSpectaclePreviewMode(prefs.spectaclePreviewMode);
    setAlignGuidesEnabled(prefs.alignGuidesEnabled);
    setActiveTab(prefs.activeTab);
    setOutlineDrawMode(prefs.outlineDrawMode);
    setSpotlightAimMode(prefs.spotlightAimMode);
    setDutyLightEnabled(prefs.dutyLightEnabled);
    setSceneBackgroundColor(prefs.sceneBackgroundColor);
    setShowSpotlightGuideLines(prefs.showSpotlightGuideLines);
    skipPersistRef.current = true;
  }, [projectName]);

  useEffect(() => {
    hydrateFromStorage();
  }, [hydrateFromStorage]);

  useEffect(() => {
    if (skipPersistRef.current) {
      skipPersistRef.current = false;
      return;
    }
    writeTheaterViewPrefs(projectName, {
      showGrid,
      showStageGrid,
      snapToGrid,
      gridStep,
      showSeats,
      wallsOpaque,
      wallsHidden,
      wallsHideFromCamera,
      showFloorPlan,
      floorPlanExpanded,
      spectaclePreviewMode,
      alignGuidesEnabled,
      activeTab,
      outlineDrawMode,
      swapTheaterPanels,
      showTheaterControls: showControls,
      spotlightAimMode,
      dutyLightEnabled,
      sceneBackgroundColor,
      showSpotlightGuideLines,
    });
  }, [
    projectName,
    showGrid,
    showStageGrid,
    snapToGrid,
    gridStep,
    showSeats,
    wallsOpaque,
    wallsHidden,
    wallsHideFromCamera,
    showFloorPlan,
    floorPlanExpanded,
    spectaclePreviewMode,
    alignGuidesEnabled,
    activeTab,
    outlineDrawMode,
    swapTheaterPanels,
    showControls,
    spotlightAimMode,
    dutyLightEnabled,
    sceneBackgroundColor,
    showSpotlightGuideLines,
  ]);

  return {
    showGrid,
    showStageGrid,
    snapToGrid,
    gridStep,
    showSeats,
    wallsOpaque,
    wallsHidden,
    wallsHideFromCamera,
    showFloorPlan,
    floorPlanExpanded,
    spectaclePreviewMode,
    alignGuidesEnabled,
    activeTab,
    outlineDrawMode,
    swapTheaterPanels,
    showTheaterControls: showControls,
    spotlightAimMode,
    dutyLightEnabled,
    sceneBackgroundColor,
    showSpotlightGuideLines,
    setShowGrid,
    setShowStageGrid,
    setSnapToGrid,
    setGridStep,
    setShowSeats,
    setWallsOpaque,
    setWallsHidden,
    setWallsHideFromCamera,
    setShowFloorPlan,
    setFloorPlanExpanded,
    setSpectaclePreviewMode,
    setAlignGuidesEnabled,
    setActiveTab,
    setOutlineDrawMode,
    setSpotlightAimMode,
    setDutyLightEnabled,
    setSceneBackgroundColor,
    setShowSpotlightGuideLines,
    showSpotlights,
    setShowSpotlights,
    showOnlyActiveSpotlight,
    setShowOnlyActiveSpotlight,
  };
}
