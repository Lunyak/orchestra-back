import {
  useEffect,
  useMemo,
  useState,
} from "react";
import * as THREE from "three";
import type { TheaterModel } from "../../../shared/types/script";
import {
  formatTheaterModelWorldSize,
  resolveTheaterModelWorldSize,
  type TheaterModelWorldSize,
} from "../model/theater-model-world-size";
import { readSceneTheaterModels } from "../model/theater-scene-models";
import { cloneTheaterModels } from "../model/theater-model-clone";
import type { UseTheaterModelsArgs } from "./theater-models-types";
import { useTheaterModelsPersistence } from "./use-theater-models-persistence";
import { useTheaterModelsSelectionOps } from "./use-theater-models-selection-ops";
import { useTheaterModelsSpawn } from "./use-theater-models-spawn";
import { useTheaterModelsTransform } from "./use-theater-models-transform";

export { cloneTheaterModels } from "../model/theater-model-clone";
export type { UseTheaterModelsArgs } from "./theater-models-types";

export function useTheaterModels({
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
}: UseTheaterModelsArgs) {

  const [modelTransformMode, setModelTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");
  const [builtinModelKey, setBuiltinModelKey] = useState<TheaterModel["builtin"]>(
    "table",
  );
  const [hoveredModelId, setHoveredModelId] = useState<number | null>(null);
  const [pendingSnapModelId, setPendingSnapModelId] = useState<number | null>(
    null,
  );
  const [activeModelObject, setActiveModelObject] = useState<THREE.Object3D | null>(
    null,
  );
  const [activeModelObjectId, setActiveModelObjectId] = useState<number | null>(
    null,
  );
  const [activeModelSizeTick, setActiveModelSizeTick] = useState(0);

  const models = readSceneTheaterModels(currentScene);
  const visibleModels = useMemo(
    () => models.filter((model) => !model.hidden),
    [models],
  );
  const activeModel = activeModelId
    ? models.find((item) => item.id === activeModelId)
    : undefined;

  const activeModelWorldSize = useMemo((): TheaterModelWorldSize | null => {
    if (!activeModel) return null;
    void activeModelSizeTick;
    return resolveTheaterModelWorldSize(activeModel, activeModelObject);
  }, [activeModel, activeModelObject, activeModelSizeTick]);

  const activeModelSizeLabel = useMemo(() => {
    return activeModelWorldSize ? formatTheaterModelWorldSize(activeModelWorldSize) : null;
  }, [activeModelWorldSize]);

  useEffect(() => {
    if (!activeModelId || (editMode !== "models" && editMode !== "decor")) {
      setIsDragging(false);
    }
  }, [activeModelId, editMode, setIsDragging]);

  useEffect(() => {
    const resetDragging = () => setIsDragging(false);
    window.addEventListener("pointerup", resetDragging);
    window.addEventListener("blur", resetDragging);
    return () => {
      window.removeEventListener("pointerup", resetDragging);
      window.removeEventListener("blur", resetDragging);
    };
  }, [setIsDragging]);

  const {
    normalizeModels,
    updateModels,
    updateModel,
    syncSpotlightsForModels,
    resolveModelSrc,
    previewModel,
    copyModelsFromPreviousScene,
    copyModelsToAdjacentScene,
  } = useTheaterModelsPersistence({
    projectName,
    currentPage,
    currentScene,
    scenes,
    updateScene,
    updateCurrentScene,
    recordTheaterHistory,
    layout,
    displaySpotlights,
    models,
    setDecorActionMessage,
  });

  const {
    addModel,
    addBuiltinModel,
    addBuiltinModelAt,
    removeSelectedModels,
    cloneSelectedModels,
    removeModel,
    cloneModel,
  } = useTheaterModelsSpawn({
    projectName,
    currentScene,
    models,
    layout,
    updateModels,
    updateCurrentScene,
    activeModelId,
    multiSelectedModelIds,
    setMultiSelectedModelIds,
    setEditMode,
    setPendingSnapModelId,
    setDecorActionMessage,
    builtinModelKey,
    setBuiltinModelKey,
  });

  const {
    alignModelsByActive,
    distributeModelsByActive,
    alignSelectedModels,
    distributeSelectedModels,
    setSelectedModelsVisibility,
    seatActiveHumanOnFurniture,
  } = useTheaterModelsSelectionOps({
    currentScene,
    models,
    updateModels,
    activeModelId,
    multiSelectedModelIds,
    setDecorActionMessage,
    setPendingSnapModelId,
    setEditMode,
  });

  const {
    handleActiveObjectChange,
    handleObjectReady,
    applyActiveModelTransform,
    persistActiveModel,
    handleModelTransformChange,
    handleModelTransformEnd,
    handleModelTransformStart,
    syncActiveModel,
    placeActiveModel,
    rotateActiveModel,
    rotateActiveModelFine,
    nudgeActiveModel,
  } = useTheaterModelsTransform({
    models,
    activeModel,
    activeModelId,
    multiSelectedModelIds,
    layout,
    gridStep,
    snapToGrid,
    alignGuidesEnabled,
    setActiveAlignGuides,
    isDragging,
    setIsDragging,
    modelTransformMode,
    historyTransactionRef,
    beginTheaterHistoryTransaction,
    endTheaterHistoryTransaction,
    updateModel,
    updateModels,
    syncSpotlightsForModels,
    activeModelObject,
    activeModelObjectId,
    setActiveModelObject,
    setActiveModelObjectId,
    setActiveModelSizeTick,
    pendingSnapModelId,
    setPendingSnapModelId,
  });

  return {
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
    pendingSnapModelId,
    setPendingSnapModelId,
    normalizeModels,
    updateModels,
    updateModel,
    resolveModelSrc,
    copyModelsFromPreviousScene,
    copyModelsToAdjacentScene,
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
    seatActiveHumanOnFurniture,
    handleActiveObjectChange,
    handleObjectReady,
    applyActiveModelTransform,
    persistActiveModel,
    handleModelTransformChange,
    handleModelTransformEnd,
    handleModelTransformStart,
    syncActiveModel,
    previewModel,
    placeActiveModel,
    rotateActiveModel,
    rotateActiveModelFine,
    nudgeActiveModel,
  };
}
