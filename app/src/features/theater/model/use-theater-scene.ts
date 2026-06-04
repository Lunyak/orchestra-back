import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { useScene } from "../../scene";
import { useScriptUI } from "../../script-ui";
import { useAppSelector } from "../../../shared/store/hooks";
import { selectShowScriptMarkdownUi } from "../../show-script-markdown/model/show-script-markdown-slice";
import type {
  ScriptStep,
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
  const { steps, currentPage, updateStep, sceneData } = useScene();
  const selectedLightSlot = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName || "", "script"),
  ).selectedLightSlot;
  const currentStep = steps[currentPage];
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
    floorPlanExpanded,
    setFloorPlanExpanded,
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
    currentStep,
    layout,
    onTheaterLayoutChange,
    updateStep,
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

  const updateCurrentStep = useCallback(
    (patch: Partial<ScriptStep>) => {
      if (!currentStep) return;
      updateStep(currentStep.id, patch);
    },
    [currentStep, updateStep],
  );

  const selection = useTheaterSelection({
    currentStep,
    updateCurrentStep,
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



  const spotlightsApi = useTheaterSpotlights({
    currentStep,
    updateCurrentStep,
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
    lightFaders: sceneData?.lightFaders,
    lightPrograms: sceneData?.lightPrograms,
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
    currentStep,
    steps,
    updateStep,
    updateCurrentStep,
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
    updateSpotlights,
  });

  const decorApi = useTheaterDecor({
    projectName,
    currentPage,
    currentStep,
    steps,
    updateStep,
    updateCurrentStep,
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
    copyModelsFromPreviousStep,
    copyTheaterFromPreviousStep,
    copyTheaterToNextStep,
    addModel,
    addBuiltinModel,
    mirrorModel,
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
    copyDecorToNextStep,
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
    setPendingSnapModelId: _setPendingSnapModelId,
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
    currentStep,
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
    updateCurrentStep,
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
    decorPlaceMode,
    setDecorPlaceMode,
    exitDecorPlaceMode,
    setIsDragging,
    setActiveAlignGuides,
  });

  const { stepRehearsalMode, setStepRehearsalMode } = useTheaterRehearsal({
    currentPage,
    currentStep,
    displaySpotlights,
    setRehearsalSpotlights,
    setSpectaclePreviewMode,
  });

  const copyFromPreviousStep = () => {
    if (!currentStep || currentPage <= 0) return;
    const previous = steps[currentPage - 1];
    const source = previous?.theaterSpotlights ?? [];
    const cloned = cloneTheaterSpotlights(source);
    updateSpotlights(cloned);
    if (cloned.length > 0) {
      updateCurrentStep({ theaterActiveSpotlightId: cloned[0].id });
    }
  };

  const copyLightCuesToClipboard = useCallback(
    async (lightChannels?: string[]) => {
      const text = formatLightCuesMarkdown(currentStep?.lightCues ?? [], {
        stepTitle: currentStep?.title?.trim() || undefined,
        durationMin: currentStep?.durationMin,
        lightChannels,
      });
      try {
        await navigator.clipboard.writeText(text);
        setDecorActionMessage("Таймлайн cue скопирован");
      } catch {
        setDecorActionMessage("Не удалось скопировать cue");
      }
    },
    [currentStep?.durationMin, currentStep?.lightCues, currentStep?.title],
  );

  useTheaterKeyboardBindings({
    projectName,
    layout,
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
      currentStep,
      stepCount: steps.length,
      layout,
      updateLayout,
      previewLayout,
      updateCurrentStep,
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
    currentStep,
    stepCount: steps.length,
    layout,
    updateCurrentStep,
    showControls,
    setShowControls,
    setSwapTheaterPanels,
    showHiddenInOutliner,
    setShowHiddenInOutliner,
    hallTemplates: THEATER_HALL_TEMPLATES,
    decorActionMessage,
    copyFromPreviousStep,
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
    clearSceneSelection,
    toggleSceneOutlinerVisibility,
    setSceneOutlinerGroupVisibility,
    toggleActiveSceneVisibility,
    stepRehearsalMode,
    setStepRehearsalMode,
  };
}
