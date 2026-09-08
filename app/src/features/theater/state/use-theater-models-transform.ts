import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import * as THREE from "three";
import type {
  TheaterLayout,
  TheaterModel,
} from "../../../shared/types/script";
import type { ActiveAlignGuide } from "../model/theater-align-guides";
import {
  resolveModelPlacementPosition,
  rotateModelByQuarterTurn,
  type ModelPlacementPreset,
} from "../model/theater-model-placement";
import { resolveFloorYAt } from "../model/theater-stage-floor";
import {
  applyActiveModelTransform as computeActiveModelTransform,
  liftModelObjectAboveFloor,
  nudgeModelPosition,
  type TheaterModelTransformPatch,
} from "../model/theater-model-transform";
import { MODEL_TRANSFORM_HISTORY_GRACE_MS } from "../model/theater-model-helpers";
import { isLightTrussModel } from "../model/theater-truss-mounts";
import { setLightTrussHeight } from "../model/theater-light-rig";

type ModelTransformMode = "translate" | "rotate" | "scale";

type UseTheaterModelsTransformArgs = {
  models: TheaterModel[];
  activeModel: TheaterModel | undefined;
  activeModelId: number | undefined;
  multiSelectedModelIds: number[];
  layout: TheaterLayout;
  gridStep: number;
  snapToGrid: boolean;
  alignGuidesEnabled: boolean;
  setActiveAlignGuides: Dispatch<SetStateAction<ActiveAlignGuide[]>>;
  isDragging: boolean;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  modelTransformMode: ModelTransformMode;
  historyTransactionRef: MutableRefObject<boolean>;
  beginTheaterHistoryTransaction: () => void;
  endTheaterHistoryTransaction: () => void;
  updateModel: (id: number, patch: Partial<TheaterModel>) => void;
  updateModels: (next: TheaterModel[]) => void;
  syncSpotlightsForModels: (
    nextModels: TheaterModel[],
    mountModelId?: number,
  ) => void;
  activeModelObject: THREE.Object3D | null;
  activeModelObjectId: number | null;
  setActiveModelObject: Dispatch<SetStateAction<THREE.Object3D | null>>;
  setActiveModelObjectId: Dispatch<SetStateAction<number | null>>;
  setActiveModelSizeTick: Dispatch<SetStateAction<number>>;
  pendingSnapModelId: number | null;
  setPendingSnapModelId: Dispatch<SetStateAction<number | null>>;
};

export function useTheaterModelsTransform({
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
}: UseTheaterModelsTransformArgs) {
  const modelTransformEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const modelDragLastValidRef = useRef<{
    position: [number, number, number];
    rotation: [number, number, number];
    scale: [number, number, number];
  } | null>(null);
  const groupDragBaselineRef = useRef<
    Map<
      number,
      {
        position: [number, number, number];
        rotation: [number, number, number];
        scale: [number, number, number];
      }
    > | null
  >(null);
  const modelObjectMapRef = useRef<Map<number, THREE.Object3D>>(new Map());

  const clearModelTransformEndTimer = useCallback(() => {
    if (modelTransformEndTimerRef.current == null) return;
    clearTimeout(modelTransformEndTimerRef.current);
    modelTransformEndTimerRef.current = null;
  }, []);

  const handleActiveObjectChange = useCallback(
    (node: THREE.Object3D | null, id: number) => {
      setActiveModelObject(node);
      setActiveModelObjectId(node ? id : null);
    },
    [],
  );

  const handleObjectReady = useCallback((node: THREE.Object3D | null, id: number) => {
    if (node) {
      modelObjectMapRef.current.set(id, node);
    } else {
      modelObjectMapRef.current.delete(id);
    }
  }, []);

  const applyActiveModelTransform = useCallback((): TheaterModelTransformPatch | null => {
    if (!activeModelObject || !activeModelId) return null;

    const result = computeActiveModelTransform({
      obj: activeModelObject,
      activeModelId,
      activeModelObjectId,
      models,
      activeModel,
      layout,
      snapToGrid,
      gridStep,
      modelTransformMode,
      alignGuidesEnabled,
      isDragging,
      modelObjectMap: modelObjectMapRef.current,
      historyTransactionActive: historyTransactionRef.current,
      dragLastValid: modelDragLastValidRef.current,
    });

    if (result.alignGuides !== null) {
      setActiveAlignGuides(result.alignGuides);
    }
    modelDragLastValidRef.current = result.dragLastValid;
    return result.patch;
  }, [
    activeModel,
    activeModelId,
    activeModelObject,
    activeModelObjectId,
    alignGuidesEnabled,
    isDragging,
    layout,
    gridStep,
    modelTransformMode,
    models,
    snapToGrid,
    setActiveAlignGuides,
  ]);

  const persistActiveModel = useCallback(() => {
    const patch = applyActiveModelTransform();
    if (!patch || !activeModelId) return;

    const baseline = groupDragBaselineRef.current;
    if (
      baseline &&
      modelTransformMode === "translate" &&
      baseline.size > 1 &&
      baseline.has(activeModelId)
    ) {
      const origin = baseline.get(activeModelId)!.position;
      const dx = patch.position[0] - origin[0];
      const dy = patch.position[1] - origin[1];
      const dz = patch.position[2] - origin[2];
      const nextModels = models.map((model) => {
        const base = baseline.get(model.id);
        if (!base) return model;
        if (model.id === activeModelId) {
          return { ...model, ...patch };
        }
        return {
          ...model,
          position: [
            base.position[0] + dx,
            base.position[1] + dy,
            base.position[2] + dz,
          ] as [number, number, number],
        };
      });
      const synced =
        activeModel && isLightTrussModel(activeModel)
          ? setLightTrussHeight(nextModels, patch.position[1])
          : nextModels;
      updateModels(synced);
      return;
    }

    if (activeModel && isLightTrussModel(activeModel)) {
      const withPatch = models.map((model) =>
        model.id === activeModelId ? { ...model, ...patch } : model,
      );
      updateModels(setLightTrussHeight(withPatch, patch.position[1]));
      return;
    }

    updateModel(activeModelId, patch);
  }, [
    activeModelId,
    applyActiveModelTransform,
    modelTransformMode,
    models,
    updateModel,
    updateModels,
    activeModel,
  ]);

  const handleModelTransformChange = useCallback(() => {
    if (!historyTransactionRef.current) {
      beginTheaterHistoryTransaction();
      const prevModel = activeModelId
        ? models.find((item) => item.id === activeModelId)
        : undefined;
      if (prevModel) {
        modelDragLastValidRef.current = {
          position: [...prevModel.position] as [number, number, number],
          rotation: [...prevModel.rotation] as [number, number, number],
          scale: [...prevModel.scale] as [number, number, number],
        };
      }
    }
    const patch = applyActiveModelTransform();
    const transformActiveModel = models.find((item) => item.id === activeModelId);
    if (patch && activeModelId && isLightTrussModel(transformActiveModel)) {
      const nextModels = models.map((item) =>
        item.id === activeModelId ? { ...item, ...patch } : item,
      );
      syncSpotlightsForModels(nextModels, activeModelId);
    }
    setActiveModelSizeTick((tick) => tick + 1);
  }, [
    activeModelId,
    applyActiveModelTransform,
    beginTheaterHistoryTransaction,
    models,
    syncSpotlightsForModels,
  ]);

  const handleModelTransformEnd = useCallback(() => {
    clearModelTransformEndTimer();
    if (historyTransactionRef.current) {
      persistActiveModel();
    }
    modelDragLastValidRef.current = null;
    groupDragBaselineRef.current = null;
    setActiveAlignGuides([]);
    setIsDragging(false);
    modelTransformEndTimerRef.current = setTimeout(() => {
      endTheaterHistoryTransaction();
      modelTransformEndTimerRef.current = null;
    }, MODEL_TRANSFORM_HISTORY_GRACE_MS);
  }, [clearModelTransformEndTimer, endTheaterHistoryTransaction, persistActiveModel]);

  const handleModelTransformStart = useCallback(() => {
    clearModelTransformEndTimer();
    if (!historyTransactionRef.current) {
      beginTheaterHistoryTransaction();
    }
    const prevModel = activeModelId
      ? models.find((item) => item.id === activeModelId)
      : undefined;
    if (prevModel) {
      modelDragLastValidRef.current = {
        position: [...prevModel.position] as [number, number, number],
        rotation: [...prevModel.rotation] as [number, number, number],
        scale: [...prevModel.scale] as [number, number, number],
      };
    } else if (activeModelObject) {
      modelDragLastValidRef.current = {
        position: [
          activeModelObject.position.x,
          activeModelObject.position.y,
          activeModelObject.position.z,
        ],
        rotation: [
          activeModelObject.rotation.x,
          activeModelObject.rotation.y,
          activeModelObject.rotation.z,
        ],
        scale: [
          activeModelObject.scale.x,
          activeModelObject.scale.y,
          activeModelObject.scale.z,
        ],
      };
    }
    if (
      modelTransformMode === "translate" &&
      activeModelId != null &&
      multiSelectedModelIds.length > 1 &&
      multiSelectedModelIds.includes(activeModelId)
    ) {
      const baseline = new Map<number, TheaterModelTransformPatch>();
      multiSelectedModelIds.forEach((id) => {
        const model = models.find((item) => item.id === id);
        if (!model) return;
        baseline.set(id, {
          position: [...model.position] as [number, number, number],
          rotation: [...model.rotation] as [number, number, number],
          scale: [...model.scale] as [number, number, number],
        });
      });
      groupDragBaselineRef.current = baseline.size > 1 ? baseline : null;
    } else {
      groupDragBaselineRef.current = null;
    }
    setIsDragging(true);
  }, [
    activeModelId,
    activeModelObject,
    beginTheaterHistoryTransaction,
    clearModelTransformEndTimer,
    modelTransformMode,
    models,
    multiSelectedModelIds,
  ]);

  useEffect(() => () => clearModelTransformEndTimer(), [clearModelTransformEndTimer]);

  useEffect(() => {
    if (!pendingSnapModelId) return;
    if (!activeModelObject || activeModelId !== pendingSnapModelId) return;
    if (activeModelObjectId !== pendingSnapModelId) return;

    const snapId = pendingSnapModelId;
    setPendingSnapModelId(null);

    if (isLightTrussModel(models.find((item) => item.id === snapId))) return;

    const floorY = resolveFloorYAt(
      layout,
      activeModelObject.position.x,
      activeModelObject.position.z,
    );
    const lifted = liftModelObjectAboveFloor(activeModelObject, floorY);
    if (lifted <= 0) return;

    updateModel(snapId, {
      position: [
        activeModelObject.position.x,
        activeModelObject.position.y,
        activeModelObject.position.z,
      ],
    });
  }, [
    activeModelId,
    activeModelObject,
    activeModelObjectId,
    layout,
    models,
    pendingSnapModelId,
    setPendingSnapModelId,
    updateModel,
  ]);

  const placeActiveModel = useCallback(
    (preset: ModelPlacementPreset) => {
      if (!activeModelId) return;
      const model = models.find((item) => item.id === activeModelId);
      if (!model) return;
      updateModel(activeModelId, {
        position: resolveModelPlacementPosition(preset, model, layout),
      });
      if (!isLightTrussModel(model)) setPendingSnapModelId(activeModelId);
    },
    [activeModelId, layout, models, setPendingSnapModelId, updateModel],
  );

  const rotateActiveModel = useCallback(
    (direction: "cw" | "ccw") => {
      if (!activeModelId) return;
      const model = models.find((item) => item.id === activeModelId);
      if (!model) return;
      updateModel(activeModelId, {
        rotation: rotateModelByQuarterTurn(model, direction),
      });
    },
    [activeModelId, models, updateModel],
  );

  const rotateActiveModelFine = useCallback(
    (deltaY: number) => {
      if (!activeModelId) return;
      const model = models.find((item) => item.id === activeModelId);
      if (!model) return;
      updateModel(activeModelId, {
        rotation: [
          model.rotation[0],
          model.rotation[1] + deltaY,
          model.rotation[2],
        ],
      });
    },
    [activeModelId, models, updateModel],
  );

  const nudgeActiveModel = useCallback(
    (deltaX: number, deltaZ: number) => {
      const targetIds =
        multiSelectedModelIds.length > 1
          ? multiSelectedModelIds
          : activeModelId != null
            ? [activeModelId]
            : [];
      if (targetIds.length === 0) return;

      const selected = new Set(targetIds);
      let nextAlignGuides: ActiveAlignGuide[] = [];
      updateModels(
        models.map((model) => {
          if (!selected.has(model.id)) return model;
          const nudged = nudgeModelPosition({
            model,
            deltaX,
            deltaZ,
            layout,
            snapToGrid,
            gridStep,
            alignGuidesEnabled,
          });
          nextAlignGuides = nudged.alignGuides;
          return { ...model, position: nudged.position };
        }),
      );
      if (alignGuidesEnabled) {
        setActiveAlignGuides(nextAlignGuides);
      }
    },
    [
      activeModelId,
      alignGuidesEnabled,
      gridStep,
      layout,
      models,
      multiSelectedModelIds,
      setActiveAlignGuides,
      snapToGrid,
      updateModels,
    ],
  );

  const syncActiveModel = persistActiveModel;

  return {
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
  };
}
