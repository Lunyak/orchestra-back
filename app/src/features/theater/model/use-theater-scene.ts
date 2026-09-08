import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import {
  resolveLightProgramMinCount,
  resolveLightPrograms,
} from "../../../shared/components/light-console/light-console-data";
import { usePlaybook } from "../../playbook";
import { useScriptUI } from "../../script-ui";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import type {
  ScriptScene,
  TheaterLayout,
} from "../../../shared/types/script";
import { resolveStageGrid } from "./theater-zone-grid";
import { THEATER_HALL_TEMPLATES } from "./theater-hall-templates";
import { useTheaterViewPrefs } from "../state/use-theater-view-prefs";
import { useTheaterHistory } from "../state/use-theater-history";
import { useTheaterSelection } from "../state/use-theater-selection";
import { useTheaterLayoutEditing } from "../state/use-theater-layout-editing";
import { useTheaterSpotlights } from "../state/use-theater-spotlights";
import { useTheaterModels } from "../state/use-theater-models";
import { useTheaterDecor } from "../state/use-theater-decor";
import { useTheaterSceneOutliner } from "../state/use-theater-scene-outliner";
import { useTheaterHallLayout } from "../state/use-theater-hall-layout";
import { useTheaterFloorPlan } from "../state/use-theater-floor-plan";
import { useTheaterKeyboardBindings } from "../state/use-theater-keyboard-bindings";
import { buildTheaterViewModelSlices } from "../state/build-theater-view-model-slices";
import { DEFAULT_THEATER_LAYOUT } from "./theater-defaults";
import type { ActiveAlignGuide } from "./theater-align-guides";
import { buildLightPlotFromSpotlights } from "./theater-light-channel-link";
import { syncMountedSpotlights } from "./theater-truss-mounts";
import {
  applyTheaterSmokeMachineToScene,
  readSceneSmokeMachineEnabled,
} from "./theater-smoke-scene";
export type UseTheaterSceneArgs = {
  projectName: string;
  theaterLayout?: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
};

export type TheaterSceneViewModel = ReturnType<typeof useTheaterScene>;

export type { TheaterSceneSlices } from "../types/theater-view-model-slices";


export function useTheaterScene({
  projectName,
  theaterLayout,
  onTheaterLayoutChange,
}: UseTheaterSceneArgs) {
  const { scenes, currentPage, updateScene, playbookData } = usePlaybook();
  const { selectedLightSlot, lightChannels } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName || "", "script"),
  );
  const currentScene = scenes[currentPage];
  const layout = theaterLayout ?? DEFAULT_THEATER_LAYOUT;
  const {
    swapTheaterPanels,
    setSwapTheaterPanels,
    showTheaterControls: showControls,
    setShowTheaterControls: setShowControls,
  } = useScriptUI();
  const prefs = useTheaterViewPrefs(projectName, { swapTheaterPanels, showControls });
  const {
    showGrid,
    setShowGrid,
    showStageGrid,
    setShowStageGrid,
    snapToGrid,
    setSnapToGrid,
    gridStep,
    setGridStep,
    showSeats,
    setShowSeats,
    wallsOpaque,
    setWallsOpaque,
    wallsHidden,
    setWallsHidden,
    wallsHideFromCamera,
    setWallsHideFromCamera,
    showFloorPlan,
    setShowFloorPlan,
    floorPlanMaxSide,
    setFloorPlanMaxSide,
    spectaclePreviewMode,
    setSpectaclePreviewMode,
    alignGuidesEnabled,
    setAlignGuidesEnabled,
    activeTab,
    setActiveTab,
    outlineDrawMode,
    setOutlineDrawMode,
    spotlightAimMode,
    setSpotlightAimMode,
    showSpotlights,
  } = prefs;
  const history = useTheaterHistory({
    projectName,
    currentPage,
    currentScene,
    layout,
    onTheaterLayoutChange,
    updateScene,
  });
  const {
    applyingHistoryRef,
    historyTransactionRef,
    recordTheaterHistory,
    beginTheaterHistoryTransaction,
    endTheaterHistoryTransaction,
    undoTheater,
    redoTheater,
    canUndoTheater,
    canRedoTheater,
  } = history;
  const layoutEditing = useTheaterLayoutEditing({
    layout,
    onTheaterLayoutChange,
    recordTheaterHistory,
    historyTransactionRef,
  });
  const {
    layoutDoors,
    layoutRecesses,
    activeDoorId,
    setActiveDoorId,
    activeRecessId,
    setActiveRecessId,
    layoutOutlineFocused,
    setLayoutOutlineFocused,
    audienceSeatsFocused,
    setAudienceSeatsFocused,
    stageGridFocused,
    setStageGridFocused,
    lightRigFocused,
    setLightRigFocused,
    activeOutlineVertexIndex,
    setActiveOutlineVertexIndex,
    updateLayout,
    previewLayout,
    addDoor,
    removeActiveDoor,
    updateActiveDoor,
    addWallRecess,
    removeActiveWallRecess,
    updateActiveWallRecess,
    removeLastOutlinePoint,
    removeActiveOutlineVertex,
    resetStageOutlineToRectangle,
    seedStageOutlineFromCurrentShape,
  } = layoutEditing;

  const updateCurrentScene = useCallback(
    (patch: Partial<ScriptScene>) => {
      if (!currentScene) return;
      updateScene(currentScene.id, patch);
    },
    [currentScene, updateScene],
  );

  const selection = useTheaterSelection({
    currentScene,
    updateCurrentScene,
    setActiveTab,
  });
  const {
    editMode,
    setEditMode,
    dragMode,
    setDragMode,
    activeSpotlightId,
    activeModelId,
    multiSelectedModelIds,
    setMultiSelectedModelIds,
    multiSelectedSpotlightIds,
    setMultiSelectedSpotlightIds,
    selectTheaterModel,
    selectTheaterSpotlight,
  } = selection;

  const [isDragging, setIsDragging] = useState(false);
  const [rgbBatchColor, setRgbBatchColor] = useState("#ffffff");
  const [audienceSeatsHighlight, setAudienceSeatsHighlight] = useState(false);
  const [activeAlignGuides, setActiveAlignGuides] = useState<ActiveAlignGuide[]>(
    [],
  );
  const [decorActionMessage, setDecorActionMessage] = useState<string | null>(null);

  useEffect(() => {
    if (activeTab !== "layout") setAudienceSeatsHighlight(false);
  }, [activeTab]);



  const resolvedLightPrograms = useMemo(
    () =>
      resolveLightPrograms(
        playbookData?.lightPrograms,
        resolveLightProgramMinCount(lightChannels.length, playbookData?.lightPrograms),
      ),
    [lightChannels.length, playbookData?.lightPrograms],
  );

  const spotlightsApi = useTheaterSpotlights({
    currentScene,
    updateCurrentScene,
    recordTheaterHistory,
    layout,
    activeSpotlightId,
    multiSelectedSpotlightIds,
    setMultiSelectedSpotlightIds,
    updateLayout,
    setEditMode,
    setDecorActionMessage,
    lightFaders: playbookData?.lightFaders,
    lightPrograms: resolvedLightPrograms,
    consoleChannel: selectedLightSlot > 0 ? selectedLightSlot : undefined,
    liveBlackoutEnabled: prefs.liveBlackoutEnabled,
  });
  const {
    spotlights,
    displaySpotlights,
    visibleSpotlights,
    spotlightsConfigured,
    activeSpotlight,
    stageGrid,
    updateSpotlight,
    aimSpotlightToGridCell,
    aimActiveSpotlightToGridCell,
    clearSpotlightGridBinding,
    updateLayoutZoneGrid,
    removeSpotlight,
    cloneSpotlight,
    addSpotlight,
    addRgbSpotlight,
    applyRgbColorToAll,
    enableSpotlightsByType,
    disableSpotlightsByType,
    blackoutAllSpotlights,
    fullLightAllSpotlights,
    setSelectedSpotlightsVisibility,
    aimSelectedSpotlightsAtStage,
    removeSelectedSpotlights,
    cloneSelectedSpotlights,
    assignSelectedSpotlightChannelsSequential,
    updateSpotlights,
    ensureSpotlights,
  } = spotlightsApi;

  const modelsApi = useTheaterModels({
    projectName,
    currentPage,
    currentScene,
    scenes,
    updateScene,
    updateCurrentScene,
    recordTheaterHistory,
    beginTheaterHistoryTransaction,
    endTheaterHistoryTransaction,
    historyTransactionRef,
    layout,
    gridStep,
    snapToGrid,
    alignGuidesEnabled,
    setActiveAlignGuides,
    activeModelId,
    multiSelectedModelIds,
    setMultiSelectedModelIds,
    setEditMode,
    editMode,
    isDragging,
    setIsDragging,
    setDecorActionMessage,
    displaySpotlights,
  });

  const decorApi = useTheaterDecor({
    projectName,
    currentPage,
    currentScene,
    scenes,
    updateScene,
    updateCurrentScene,
    layout,
    gridStep,
    snapToGrid,
    models: modelsApi.models,
    updateModels: modelsApi.updateModels,
    updateModel: modelsApi.updateModel,
    setPendingSnapModelId: modelsApi.setPendingSnapModelId,
    activeModelId,
    setEditMode,
    decorActionMessage,
    setDecorActionMessage,
  });

  const {
    models,
    visibleModels,
    activeModel,
    activeModelWorldSize,
    activeModelSizeLabel,
    activeModelObject,
    activeModelObjectId,
    modelTransformMode,
    setModelTransformMode,
    builtinModelKey,
    setBuiltinModelKey,
    hoveredModelId,
    setHoveredModelId,
    updateModel,
    updateModels,
    resolveModelSrc,
    copyModelsFromPreviousScene,
    addModel,
    addBuiltinModel,
    addBuiltinModelAt,
    alignModelsByActive,
    distributeModelsByActive,
    alignSelectedModels,
    distributeSelectedModels,
    setSelectedModelsVisibility,
    removeSelectedModels,
    cloneSelectedModels,
    removeModel,
    cloneModel,
    handleActiveObjectChange,
    handleObjectReady,
    handleModelTransformChange,
    handleModelTransformEnd,
    handleModelTransformStart,
    syncActiveModel,
    previewModel,
    placeActiveModel,
    rotateActiveModel,
    rotateActiveModelFine,
    nudgeActiveModel,
  } = modelsApi;

  useEffect(() => {
    if (isDragging) return;
    const syncedSpotlights = syncMountedSpotlights(spotlights, models);
    const hasChanges = syncedSpotlights.some(
      (spotlight, index) => spotlight !== spotlights[index],
    );
    if (!hasChanges) return;
    updateCurrentScene({
      theaterSpotlights: syncedSpotlights,
      lightPlot: buildLightPlotFromSpotlights(syncedSpotlights, layout),
    });
  }, [isDragging, layout, models, spotlights, updateCurrentScene]);

  const {
    decorCatalogKey,
    setDecorCatalogKey,
    decorDraftColor,
    decorDraftSize,
    decorDraftTexture,
    decorDraftTextureRepeat,
    decorDraftTextureMode,
    decorGridCols,
    decorGridRows,
    decorPlaceMode,
    setDecorPlaceMode,
    setDecorDraftColor,
    setDecorDraftSize,
    setDecorDraftTextureRepeat,
    setDecorGridCols,
    setDecorGridRows,
    activeDecorPreset,
    addDecorAt,
    enterDecorPlaceMode,
    exitDecorPlaceMode,
    applyDecorTexturePreset,
    clearDecorTexture,
    copyDecorInventoryToClipboard,
    copyDecorToNextScene,
    exportDecorInventoryCsv,
    syncDecorInventoryToRequisites,
    setDecorTextureModeForTarget,
    setDecorTextureRepeatForTarget,
    uploadDecorTextureFile,
  } = decorApi;

  const {
    normalizeSpotlights: _normalizeSpotlights,
    cloneTheaterSpotlights: _cloneTheaterSpotlightsFromApi,
    ...spotlightsVm
  } = spotlightsApi;
  const {
    setPendingSnapModelId,
    ...modelsVm
  } = modelsApi;

  const {
    applyHallTemplate,
    fitLayoutToSeatCount,
    applyTargetSeatCount,
    fitLayoutFromOutline,
  } = useTheaterHallLayout({
    layout,
    onTheaterLayoutChange,
    setDecorActionMessage,
  });

  const floorPlanApi = useTheaterFloorPlan({
    projectName,
    currentScene,
    layout,
    visibleModels,
    visibleSpotlights,
    showSeats,
    showSpotlights,
    showGrid,
    gridStep,
    setDecorActionMessage,
  });

  const {
    pulseTarget,
    sceneOutlinerGroups,
    selectAllVisibleInEditMode,
    revealAllHiddenInScene,
    isolateSceneSelection,
    focusSceneOutlinerItem,
    focusLayoutHall,
    focusAudienceSeats,
    focusStageGrid,
    focusLightRig,
    clearSceneSelection,
    toggleSceneOutlinerVisibility,
    setSceneOutlinerGroupVisibility,
    toggleActiveSceneVisibility,
  } = useTheaterSceneOutliner({
    layout,
    layoutDoors,
    displaySpotlights,
    models,
    visibleModels,
    visibleSpotlights,
    ensureSpotlights,
    updateSpotlights,
    updateSpotlight,
    updateModels,
    updateModel,
    updateCurrentScene,
    setDecorActionMessage,
    activeTab,
    editMode,
    setEditMode,
    setActiveTab,
    activeSpotlightId,
    activeModelId,
    multiSelectedSpotlightIds,
    multiSelectedModelIds,
    setMultiSelectedSpotlightIds,
    setMultiSelectedModelIds,
    selectTheaterSpotlight,
    selectTheaterModel,
    setActiveDoorId,
    setLayoutOutlineFocused,
    layoutOutlineFocused,
    setAudienceSeatsFocused,
    audienceSeatsFocused,
    setStageGridFocused,
    stageGridFocused,
    setLightRigFocused,
    lightRigFocused,
    decorPlaceMode,
    setDecorPlaceMode,
    exitDecorPlaceMode,
    setIsDragging,
    setActiveAlignGuides,
  });

  useTheaterKeyboardBindings({
    projectName,
    layout,
    models,
    spotlights,
    activeTab,
    editMode,
    activeModelId,
    activeSpotlightId,
    multiSelectedModelIds,
    multiSelectedSpotlightIds,
    activeOutlineVertexIndex,
    swapTheaterPanels,
    showControls,
    setSwapTheaterPanels,
    setShowControls,
    snapToGrid,
    gridStep,
    modelTransformMode,
    undoTheater,
    redoTheater,
    removeModel,
    removeSelectedModels,
    removeSpotlight,
    removeSelectedSpotlights,
    removeActiveOutlineVertex,
    cloneModel: (id?: number) => {
      if (id != null) cloneModel(id);
    },
    nudgeActiveModel,
    rotateActiveModelFine,
    beginTheaterHistoryTransaction,
    endTheaterHistoryTransaction,
    toggleActiveSceneVisibility,
    selectAllVisibleInEditMode,
    clearSceneSelection,
  });


  const sceneSmokeEnabled = readSceneSmokeMachineEnabled(currentScene);
  const setSceneSmokeMachineEnabled = useCallback(
    (enabled: boolean) => {
      if (!currentScene) return;
      updateCurrentScene(applyTheaterSmokeMachineToScene(currentScene, enabled));
      if (enabled) prefs.setSmokePanelOpen(true);
    },
    [currentScene, prefs, updateCurrentScene],
  );

  const slices = buildTheaterViewModelSlices({
    prefs,
    history: {
      undoTheater,
      redoTheater,
      canUndoTheater,
      canRedoTheater,
      beginTheaterHistoryTransaction,
      endTheaterHistoryTransaction,
    },
    document: {
      projectName,
      currentPage,
      currentScene,
      sceneCount: scenes.length,
      layout,
      updateLayout,
      previewLayout,
      updateCurrentScene,
    },
    selection: {
      activeTab,
      editMode,
      dragMode,
      isDragging,
      activeSpotlightId,
      activeModelId,
      multiSelectedSpotlightIds,
      multiSelectedModelIds,
    },
    spotlights: {
      spotlights,
      displaySpotlights,
      visibleSpotlights,
      spotlightsConfigured,
      activeSpotlight,
      spotlightAimMode,
      stageGrid,
    },
    models: {
      models,
      visibleModels,
      activeModel,
      activeModelId,
    },
    decor: {
      decorPlaceMode,
      decorCatalogKey,
    },
  });

  return {
    slices,
    projectName,
    currentPage,
    currentScene,
    sceneCount: scenes.length,
    layout,
    updateCurrentScene,
    showControls,
    setShowControls,
    setSwapTheaterPanels,
    hallTemplates: THEATER_HALL_TEMPLATES,
    decorActionMessage,
    ...prefs,
    smokeMachineEnabled: sceneSmokeEnabled,
    setSmokeMachineEnabled: setSceneSmokeMachineEnabled,
    undoTheater,
    redoTheater,
    canUndoTheater,
    canRedoTheater,
    beginTheaterHistoryTransaction,
    endTheaterHistoryTransaction,
    ...layoutEditing,
    ...selection,
    isDragging,
    setIsDragging,
    rgbBatchColor,
    setRgbBatchColor,
    audienceSeatsHighlight,
    setAudienceSeatsHighlight,
    activeAlignGuides,
    setActiveAlignGuides,
    ...spotlightsVm,
    ...modelsVm,
    setPendingSnapModelId,
    ...decorApi,
    ...floorPlanApi,
    applyHallTemplate,
    fitLayoutToSeatCount,
    fitLayoutFromOutline,
    applyTargetSeatCount,
    pulseTarget,
    sceneOutlinerGroups,
    selectAllVisibleInEditMode,
    revealAllHiddenInScene,
    isolateSceneSelection,
    focusSceneOutlinerItem,
    focusLayoutHall,
    focusAudienceSeats,
    focusStageGrid,
    focusLightRig,
    clearSceneSelection,
    toggleSceneOutlinerVisibility,
    setSceneOutlinerGroupVisibility,
    toggleActiveSceneVisibility,
  };
}
