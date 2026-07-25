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
import type { TheaterSmokePosition } from "../model/theater-smoke-settings";
import {
  clampSmokeSize,
  clampSmokeUnit,
  THEATER_SMOKE_INTENSITY_DEFAULT,
  THEATER_SMOKE_SATURATION_DEFAULT,
  THEATER_SMOKE_SIZE_DEFAULT,
} from "../model/theater-smoke-settings";

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
  setFloorPlanMaxSide: Dispatch<SetStateAction<number>>;
  setSpectaclePreviewMode: (value: boolean) => void;
  setAlignGuidesEnabled: (value: boolean) => void;
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
  setOutlineDrawMode: (value: boolean) => void;
  setSpotlightAimMode: (mode: TheaterViewPrefs["spotlightAimMode"]) => void;
  setDutyLightEnabled: (value: boolean) => void;
  setSmokeMachineEnabled: (value: boolean) => void;
  setSmokePanelOpen: (value: boolean) => void;
  setSmokePosition: (value: TheaterSmokePosition | null) => void;
  setSmokeIntensity: (value: number) => void;
  setSmokeSaturation: (value: number) => void;
  setSmokeSize: (value: number) => void;
  setSceneBackgroundColor: (value: string) => void;
  setShowSpotlightGuideLines: (value: boolean) => void;
  setLightConsoleExpanded: Dispatch<SetStateAction<boolean>>;
  setHallResizeKeepObjects: (value: boolean) => void;
  setHallQuickStartDone: (value: boolean) => void;
  showSpotlights: boolean;
  setShowSpotlights: (value: boolean) => void;
};

/**
 * Editor view preferences: persisted per project, independent of ScriptScene.
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
  const [floorPlanMaxSide, setFloorPlanMaxSide] = useState(
    () => readTheaterViewPrefs(projectName).floorPlanMaxSide,
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
  const [smokeMachineEnabled, setSmokeMachineEnabledState] = useState(
    () => readTheaterViewPrefs(projectName).smokeMachineEnabled,
  );
  const [smokePanelOpen, setSmokePanelOpen] = useState(
    () => readTheaterViewPrefs(projectName).smokePanelOpen,
  );
  const [smokePosition, setSmokePosition] = useState<TheaterSmokePosition | null>(
    () => readTheaterViewPrefs(projectName).smokePosition,
  );
  const [smokeIntensity, setSmokeIntensityState] = useState(
    () => readTheaterViewPrefs(projectName).smokeIntensity,
  );
  const [smokeSaturation, setSmokeSaturationState] = useState(
    () => readTheaterViewPrefs(projectName).smokeSaturation,
  );
  const [smokeSize, setSmokeSizeState] = useState(
    () => readTheaterViewPrefs(projectName).smokeSize,
  );
  const [sceneBackgroundColor, setSceneBackgroundColor] = useState(
    () => readTheaterViewPrefs(projectName).sceneBackgroundColor,
  );
  const [showSpotlightGuideLines, setShowSpotlightGuideLines] = useState(
    () => readTheaterViewPrefs(projectName).showSpotlightGuideLines,
  );
  const [lightConsoleExpanded, setLightConsoleExpanded] = useState(
    () => readTheaterViewPrefs(projectName).lightConsoleExpanded,
  );
  const [hallResizeKeepObjects, setHallResizeKeepObjects] = useState(
    () => readTheaterViewPrefs(projectName).hallResizeKeepObjects,
  );
  const [hallQuickStartDone, setHallQuickStartDone] = useState(
    () => readTheaterViewPrefs(projectName).hallQuickStartDone,
  );
  const [showSpotlights, setShowSpotlights] = useState(true);

  const setSmokeMachineEnabled = (value: boolean) => {
    setSmokeMachineEnabledState(value);
    if (value) setSmokePanelOpen(true);
  };
  const setSmokeIntensity = (value: number) => {
    setSmokeIntensityState(clampSmokeUnit(value, THEATER_SMOKE_INTENSITY_DEFAULT));
  };
  const setSmokeSaturation = (value: number) => {
    setSmokeSaturationState(clampSmokeUnit(value, THEATER_SMOKE_SATURATION_DEFAULT));
  };
  const setSmokeSize = (value: number) => {
    setSmokeSizeState(clampSmokeSize(value));
  };

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
    setFloorPlanMaxSide(prefs.floorPlanMaxSide);
    setSpectaclePreviewMode(prefs.spectaclePreviewMode);
    setAlignGuidesEnabled(prefs.alignGuidesEnabled);
    setActiveTab(prefs.activeTab);
    setOutlineDrawMode(prefs.outlineDrawMode);
    setSpotlightAimMode(prefs.spotlightAimMode);
    setDutyLightEnabled(prefs.dutyLightEnabled);
    setSmokeMachineEnabledState(prefs.smokeMachineEnabled);
    setSmokePanelOpen(prefs.smokePanelOpen);
    setSmokePosition(prefs.smokePosition);
    setSmokeIntensityState(prefs.smokeIntensity);
    setSmokeSaturationState(prefs.smokeSaturation);
    setSmokeSizeState(prefs.smokeSize);
    setSceneBackgroundColor(prefs.sceneBackgroundColor);
    setShowSpotlightGuideLines(prefs.showSpotlightGuideLines);
    setLightConsoleExpanded(prefs.lightConsoleExpanded);
    setHallResizeKeepObjects(prefs.hallResizeKeepObjects);
    setHallQuickStartDone(prefs.hallQuickStartDone);
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
      floorPlanMaxSide,
      spectaclePreviewMode,
      alignGuidesEnabled,
      activeTab,
      outlineDrawMode,
      swapTheaterPanels,
      showTheaterControls: showControls,
      spotlightAimMode,
      dutyLightEnabled,
      smokeMachineEnabled,
      smokePanelOpen,
      smokePosition,
      smokeIntensity,
      smokeSaturation,
      smokeSize,
      sceneBackgroundColor,
      showSpotlightGuideLines,
      lightConsoleExpanded,
      hallResizeKeepObjects,
      hallQuickStartDone,
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
    floorPlanMaxSide,
    spectaclePreviewMode,
    alignGuidesEnabled,
    activeTab,
    outlineDrawMode,
    swapTheaterPanels,
    showControls,
    spotlightAimMode,
    dutyLightEnabled,
    smokeMachineEnabled,
    smokePanelOpen,
    smokePosition,
    smokeIntensity,
    smokeSaturation,
    smokeSize,
    sceneBackgroundColor,
    showSpotlightGuideLines,
    lightConsoleExpanded,
    hallResizeKeepObjects,
    hallQuickStartDone,
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
    floorPlanMaxSide,
    spectaclePreviewMode,
    alignGuidesEnabled,
    activeTab,
    outlineDrawMode,
    swapTheaterPanels,
    showTheaterControls: showControls,
    spotlightAimMode,
    dutyLightEnabled,
    smokeMachineEnabled,
    smokePanelOpen,
    smokePosition,
    smokeIntensity,
    smokeSaturation,
    smokeSize,
    sceneBackgroundColor,
    showSpotlightGuideLines,
    lightConsoleExpanded,
    hallResizeKeepObjects,
    hallQuickStartDone,
    setShowGrid,
    setShowStageGrid,
    setSnapToGrid,
    setGridStep,
    setShowSeats,
    setWallsOpaque,
    setWallsHidden,
    setWallsHideFromCamera,
    setShowFloorPlan,
    setFloorPlanMaxSide,
    setSpectaclePreviewMode,
    setAlignGuidesEnabled,
    setActiveTab,
    setOutlineDrawMode,
    setSpotlightAimMode,
    setDutyLightEnabled,
    setSmokeMachineEnabled,
    setSmokePanelOpen,
    setSmokePosition,
    setSmokeIntensity,
    setSmokeSaturation,
    setSmokeSize,
    setSceneBackgroundColor,
    setShowSpotlightGuideLines,
    setLightConsoleExpanded,
    setHallResizeKeepObjects,
    setHallQuickStartDone,
    showSpotlights,
    setShowSpotlights,
  };
}
