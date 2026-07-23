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
  TheaterSpotlight,
} from "../../../shared/types/script";
import { resolveStageGrid } from "./theater-zone-grid";
import { THEATER_HALL_TEMPLATES } from "./theater-hall-templates";
import { useTheaterViewPrefs } from "../state/use-theater-view-prefs";
import { useTheaterHistory } from "../state/use-theater-history";
import { useTheaterSelection } from "../state/use-theater-selection";
import { useTheaterLayoutEditing } from "../state/use-theater-layout-editing";
import { useTheaterSpotlights, cloneTheaterSpotlights } from "../state/use-theater-spotlights";
import { useTheaterModels } from "../state/use-theater-models";
import { useTheaterDecor } from "../state/use-theater-decor";
import { useTheaterSceneOutliner } from "../state/use-theater-scene-outliner";
import { useTheaterRehearsal } from "../state/use-theater-rehearsal";
import { useTheaterHallLayout } from "../state/use-theater-hall-layout";
import { useTheaterFloorPlan } from "../state/use-theater-floor-plan";
import { useTheaterCameraBookmarks } from "../state/use-theater-camera-bookmarks";
import { useTheaterKeyboardBindings } from "../state/use-theater-keyboard-bindings";
import { buildTheaterViewModelSlices } from "../state/build-theater-view-model-slices";
import { DEFAULT_THEATER_LAYOUT } from "./theater-defaults";
import { formatLightCuesMarkdown } from "./theater-light-cues";
import type { ActiveAlignGuide } from "./theater-align-guides";
import { syncMountedSpotlights } from "./theater-truss-mounts";

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
    setShowSpotlights,
    showOnlyActiveSpotlight,
    setShowOnlyActiveSpotlight,
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
  const [rehearsalSpotlights, setRehearsalSpotlights] = useState<
    TheaterSpotlight[] | null
  >(null);
  const [showHiddenInOutliner, setShowHiddenInOutliner] = useState(true);
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
    gridStep,
    activeSpotlightId,
    multiSelectedSpotlightIds,
    setMultiSelectedSpotlightIds,
    updateLayout,
    setEditMode,
    setDecorActionMessage,
    rehearsalSpotlights,
    lightFaders: playbookData?.lightFaders,
    lightPrograms: resolvedLightPrograms,
    consoleChannel: selectedLightSlot > 0 ? selectedLightSlot : undefined,
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
    aimSpotlightAtStage,
    addSpotlight,
    addRgbSpotlight,
    addSpotlightsBatch,
    layoutSpotlightsInHallGrid,
    layoutSpotlightsBeforeAudience,
    applySpotlightLayoutPreset,
    assignSpotlightChannelsSequential,
    spawnSpotlightsFromLayoutPreset,
    aimSpotlightsAtStage,
    alignSpotlightsSourceHeight,
    snapAllSpotlightsToGrid,
    applyRgbColorToAll,
    enableSpotlightsByType,
    disableSpotlightsByType,
    blackoutAllSpotlights,
    fullLightAllSpotlights,
    applySpotlightPreset,
    syncSpotlightsFromLightPlot,
    applyLightPlotChannelLabels,
    syncLightPlotFromSpotlights,
    setSelectedSpotlightsVisibility,
    aimSelectedSpotlightsAtStage,
    removeSelectedSpotlights,
    cloneSelectedSpotlights,
    assignSelectedSpotlightChannelsSequential,
    updateSpotlights,
    ensureSpotlights,
  } = spotlightsApi;

  useEffect(() => {
    if (!showOnlyActiveSpotlight) return;
    const hasActiveVisibleSpotlight =
      activeSpotlightId != null &&
      visibleSpotlights.some((item) => item.id === activeSpotlightId);
    if (!hasActiveVisibleSpotlight) {
      setShowOnlyActiveSpotlight(false);
    }
  }, [
    activeSpotlightId,
    setShowOnlyActiveSpotlight,
    showOnlyActiveSpotlight,
    visibleSpotlights,
  ]);

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
    setActiveTab,
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
    copyTheaterFromPreviousScene,
    copyTheaterToNextScene,
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
    updateCurrentScene({ theaterSpotlights: syncedSpotlights });
  }, [isDragging, models, spotlights, updateCurrentScene]);

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
    applyDecorSceneTemplate,
    applyDecorSketchTemplate,
    applyDecorTemplateByListId,
    applyDecorTemplateJson,
    applyDecorTexturePreset,
    clearDecorTexture,
    copyDecorInventoryToClipboard,
    copyDecorToNextScene,
    exportDecorInventoryCsv,
    syncDecorInventoryToRequisites,
    importDecorTemplateFromJson,
    exportCurrentDecorAsJsonTemplate,
    decorTemplateList,
    replaceDecorSceneTemplate,
    saveDecorTemplatesToProject,
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
    updateModels: _updateModels,
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
    cameraBookmarks,
    saveCameraBookmark,
    applyCameraBookmark,
    deleteCameraBookmark,
  } = useTheaterCameraBookmarks({ projectName, setDecorActionMessage });

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
    decorPlaceMode,
    setDecorPlaceMode,
    exitDecorPlaceMode,
    setIsDragging,
    setActiveAlignGuides,
  });

  const { sceneRehearsalMode, setSceneRehearsalMode } = useTheaterRehearsal({
    currentPage,
    currentScene,
    displaySpotlights,
    setRehearsalSpotlights,
    setSpectaclePreviewMode,
  });

  const copyFromPreviousScene = () => {
    if (!currentScene || currentPage <= 0) return;
    const previous = scenes[currentPage - 1];
    const source = previous?.theaterSpotlights ?? [];
    const cloned = cloneTheaterSpotlights(source);
    updateSpotlights(cloned);
    if (cloned.length > 0) {
      updateCurrentScene({ theaterActiveSpotlightId: cloned[0].id });
    }
  };

  const copyLightCuesToClipboard = useCallback(
    async (lightChannels?: string[]) => {
      const text = formatLightCuesMarkdown(currentScene?.lightCues ?? [], {
        sceneTitle: currentScene?.title?.trim() || undefined,
        durationMin: currentScene?.durationMin,
        lightChannels,
      });
      try {
        await navigator.clipboard.writeText(text);
        setDecorActionMessage("Таймлайн cue скопирован");
      } catch {
        setDecorActionMessage("Не удалось скопировать cue");
      }
    },
    [currentScene?.durationMin, currentScene?.lightCues, currentScene?.title],
  );

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
    showHiddenInOutliner,
    setShowHiddenInOutliner,
    hallTemplates: THEATER_HALL_TEMPLATES,
    decorActionMessage,
    copyFromPreviousScene,
    copyLightCuesToClipboard,
    ...prefs,
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
    cameraBookmarks,
    saveCameraBookmark,
    applyCameraBookmark,
    deleteCameraBookmark,
    pulseTarget,
    sceneOutlinerGroups,
    selectAllVisibleInEditMode,
    revealAllHiddenInScene,
    isolateSceneSelection,
    focusSceneOutlinerItem,
    focusLayoutHall,
    focusAudienceSeats,
    focusStageGrid,
    clearSceneSelection,
    toggleSceneOutlinerVisibility,
    setSceneOutlinerGroupVisibility,
    toggleActiveSceneVisibility,
    sceneRehearsalMode,
    setSceneRehearsalMode,
  };
}
