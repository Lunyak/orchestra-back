import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import * as THREE from "three";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import type {
  ScriptScene,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import {
  alignModelsByActiveBuiltin,
  alignModelsBySelection,
  distributeModelsByActiveBuiltin,
  distributeModelsBySelection,
  setModelsVisibilityBySelection,
} from "../model/theater-model-align";
import {
  resolveModelPlacementPosition,
  rotateModelByQuarterTurn,
  type ModelPlacementPreset,
} from "../model/theater-model-placement";
import {
  findSeatingTargetForHuman,
  seatHumanOnFurniture,
} from "../model/theater-model-seating";
import type { ActiveAlignGuide } from "../model/theater-align-guides";
import {
  applyActiveModelTransform as computeActiveModelTransform,
  liftModelObjectAboveFloor,
  nudgeModelPosition,
  type TheaterModelTransformPatch,
} from "../model/theater-model-transform";
import {
  formatTheaterModelWorldSize,
  resolveTheaterModelWorldSize,
  type TheaterModelWorldSize,
} from "../model/theater-model-world-size";
import {
  readSceneTheaterModels,
  writeSceneTheaterModels,
} from "../model/theater-scene-models";
import { buildLightPlotFromSpotlights } from "../model/theater-light-channel-link";
import type { TheaterEditMode } from "./use-theater-selection";
import { resolveTheaterModelFileUrlSync } from "../model/theater-model-asset-url";
import {
  createBuiltinTheaterModel,
  isTheaterBuiltinTemplateKey,
} from "../model/theater-model-builtin";
import {
  MODEL_TRANSFORM_HISTORY_GRACE_MS,
} from "../model/theater-model-helpers";
import { openTheaterModelWebUploadPicker } from "../model/theater-model-import";
import { normalizeTheaterModels } from "../model/theater-model-normalize";
import {
  isLightTrussModel,
  syncMountedSpotlights,
} from "../model/theater-truss-mounts";

export function cloneTheaterModels(source: TheaterModel[]): TheaterModel[] {
  return source.map((item) => ({
    ...item,
    position: [...item.position] as [number, number, number],
    rotation: [...item.rotation] as [number, number, number],
    scale: [...item.scale] as [number, number, number],
    ...(item.decorSize
      ? { decorSize: [...item.decorSize] as [number, number, number] }
      : {}),
  }));
}

export type UseTheaterModelsArgs = {
  projectName: string;
  currentPage: number;
  currentScene: ScriptScene | undefined;
  scenes: ScriptScene[];
  updateScene: (sceneId: number, patch: Partial<ScriptScene>) => void;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  recordTheaterHistory: () => void;
  beginTheaterHistoryTransaction: () => void;
  endTheaterHistoryTransaction: () => void;
  historyTransactionRef: MutableRefObject<boolean>;
  layout: TheaterLayout;
  gridStep: number;
  snapToGrid: boolean;
  alignGuidesEnabled: boolean;
  setActiveAlignGuides: Dispatch<SetStateAction<ActiveAlignGuide[]>>;
  activeModelId: number | undefined;
  multiSelectedModelIds: number[];
  setMultiSelectedModelIds: Dispatch<SetStateAction<number[]>>;
  setEditMode: Dispatch<SetStateAction<TheaterEditMode>>;
  editMode: TheaterEditMode;
  isDragging: boolean;
  setIsDragging: Dispatch<SetStateAction<boolean>>;
  setDecorActionMessage: (message: string | null) => void;
  displaySpotlights: TheaterSpotlight[];
};

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

    const normalizeModels = useCallback(
      (items: TheaterModel[]) => normalizeTheaterModels(items),
      [],
    );

    const updateModels = useCallback(
      (next: TheaterModel[]) => {
        recordTheaterHistory();
        const normalizedModels = normalizeModels(next);
        const sourceSpotlights =
          currentScene?.theaterSpotlights ?? displaySpotlights;
        const nextSpotlights = syncMountedSpotlights(
          sourceSpotlights,
          normalizedModels,
        );
        const spotlightsChanged = nextSpotlights.some(
          (spotlight, index) => spotlight !== sourceSpotlights[index],
        );
        updateCurrentScene({
          ...writeSceneTheaterModels(normalizedModels),
          ...(spotlightsChanged
            ? {
                theaterSpotlights: nextSpotlights,
                lightPlot: buildLightPlotFromSpotlights(nextSpotlights, layout),
              }
            : {}),
        });
      },
      [
        currentScene?.theaterSpotlights,
        displaySpotlights,
        layout,
        normalizeModels,
        recordTheaterHistory,
        updateCurrentScene,
      ],
    );

    const syncSpotlightsForModels = useCallback(
      (nextModels: TheaterModel[], mountModelId?: number) => {
        const sourceSpotlights =
          currentScene?.theaterSpotlights ?? displaySpotlights;
        const nextSpotlights = syncMountedSpotlights(
          sourceSpotlights,
          nextModels,
          mountModelId,
        );
        const hasChanges = nextSpotlights.some(
          (spotlight, index) => spotlight !== sourceSpotlights[index],
        );
        if (!hasChanges) return;
        updateCurrentScene({
          theaterSpotlights: nextSpotlights,
          lightPlot: buildLightPlotFromSpotlights(nextSpotlights, layout),
        });
      },
      [
        currentScene?.theaterSpotlights,
        displaySpotlights,
        layout,
        updateCurrentScene,
      ],
    );

    const updateModel = useCallback(
      (id: number, patch: Partial<TheaterModel>) => {
        const nextModels = models.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        );
        updateModels(nextModels);
      },
      [models, updateModels],
    );

    const resolveModelSrc = useCallback(
      (file: string) => resolveTheaterModelFileUrlSync(projectName, file) ?? "",
      [projectName],
    );

    const copyModelsFromPreviousScene = () => {
      if (!currentScene || currentPage <= 0) return;
      const previous = scenes[currentPage - 1];
      const source = readSceneTheaterModels(previous);
      const cloned = cloneTheaterModels(source);
      updateModels(cloned);
      if (cloned.length > 0) {
        updateCurrentScene({ theaterActiveModelId: cloned[0].id });
      }
    };

    const appendFileModel = useCallback(
      (fileRef: string, displayName: string) => {
        const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
        const nextItem: TheaterModel = {
          id: nextId,
          name: displayName || `Модель ${nextId}`,
          file: fileRef,
          type: "file",
          allowOutOfBounds: false,
          ignoreCollisions: false,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        };
        updateModels([...models, nextItem]);
        updateCurrentScene({ theaterActiveModelId: nextId });
        setPendingSnapModelId(nextId);
        setEditMode("models");
      },
      [models, updateCurrentScene, updateModels],
    );

    const addModelFromWebUpload = useCallback(() => {
      if (!currentScene) return;
      openTheaterModelWebUploadPicker({
        projectName,
        onAuthRequired: () => {
          setDecorActionMessage("Войдите в аккаунт, чтобы загрузить модель");
        },
        onError: () => {
          setDecorActionMessage("Не удалось загрузить модель");
        },
        onUploaded: (fileRef, displayName) => {
          appendFileModel(fileRef, displayName);
          setDecorActionMessage(null);
        },
      });
    }, [appendFileModel, currentScene, projectName, setDecorActionMessage]);

    const addModel = async () => {
      if (!currentScene) return;
      const desktopApi = getDesktopApi();
      if (desktopApi?.pickProjectModel) {
        try {
          const result = await desktopApi.pickProjectModel(projectName);
          if (!result?.ok) {
            if (result?.canceled) return;
            console.error("Failed to pick model:", result?.error);
            return;
          }
          appendFileModel(
            String(result.file ?? "").trim(),
            String(result.name ?? "").trim() || `Модель`,
          );
        } catch (err) {
          console.error("Failed to add model:", err);
        }
        return;
      }

      addModelFromWebUpload();
    };

    const addBuiltinModel = () => {
      addBuiltinModelAt(builtinModelKey);
    };

    const addBuiltinModelAt = (
      key: TheaterModel["builtin"] = builtinModelKey,
      position?: [number, number, number],
    ) => {
      if (!key) return;
      const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
      const nextItem = createBuiltinTheaterModel(nextId, key);
      if (position) {
        nextItem.position = [
          position[0],
          nextItem.position[1],
          position[2],
        ];
      }
      updateModels([...models, nextItem]);
      updateCurrentScene({ theaterActiveModelId: nextId });
      setPendingSnapModelId(nextId);
      if (isTheaterBuiltinTemplateKey(key)) setBuiltinModelKey(key);
      setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
    };


    const alignModelsByActive = useCallback(
      (axis: "x" | "z") => {
        if (!activeModelId) return;
        updateModels(alignModelsByActiveBuiltin(models, activeModelId, axis));
      },
      [activeModelId, models, updateModels],
    );

    const distributeModelsByActive = useCallback(
      (axis: "x" | "z") => {
        if (!activeModelId) return;
        updateModels(distributeModelsByActiveBuiltin(models, activeModelId, axis));
      },
      [activeModelId, models, updateModels],
    );

    const alignSelectedModels = useCallback(
      (axis: "x" | "z") => {
        if (multiSelectedModelIds.length < 2) return;
        updateModels(alignModelsBySelection(models, multiSelectedModelIds, axis));
        setDecorActionMessage(`Выбранные выровнены по ${axis.toUpperCase()}`);
      },
      [models, multiSelectedModelIds, updateModels],
    );

    const distributeSelectedModels = useCallback(
      (axis: "x" | "z") => {
        if (multiSelectedModelIds.length < 3) return;
        updateModels(distributeModelsBySelection(models, multiSelectedModelIds, axis));
        setDecorActionMessage(`Выбранные разнесены по ${axis.toUpperCase()}`);
      },
      [models, multiSelectedModelIds, updateModels],
    );

    const setSelectedModelsVisibility = useCallback(
      (hidden: boolean) => {
        if (multiSelectedModelIds.length === 0) return;
        updateModels(
          setModelsVisibilityBySelection(models, multiSelectedModelIds, hidden),
        );
        setDecorActionMessage(hidden ? "Выбранные скрыты в 3D" : "Выбранные показаны в 3D");
      },
      [models, multiSelectedModelIds, updateModels],
    );

    const removeSelectedModels = useCallback(() => {
      if (multiSelectedModelIds.length === 0 || !currentScene) return;
      const selected = new Set(multiSelectedModelIds);
      const next = models.filter((item) => !selected.has(item.id));
      updateModels(next);
      updateCurrentScene({ theaterActiveModelId: next[0]?.id });
      setMultiSelectedModelIds(next[0] ? [next[0].id] : []);
      setDecorActionMessage(`Удалено объектов: ${selected.size}`);
    }, [
      currentScene,
      models,
      multiSelectedModelIds,
      updateCurrentScene,
      updateModels,
    ]);

    const cloneSelectedModels = useCallback(() => {
      if (multiSelectedModelIds.length === 0 || !currentScene) return;
      let nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0);
      const copies: TheaterModel[] = [];
      multiSelectedModelIds.forEach((sourceId, index) => {
        const source = models.find((item) => item.id === sourceId);
        if (!source) return;
        nextId += 1;
        const offset = 0.25 * (index + 1);
        copies.push({
          ...source,
          id: nextId,
          name: `${source.name} (копия)`,
          position: [
            source.position[0] + offset,
            source.position[1],
            source.position[2] + offset,
          ] as [number, number, number],
          hidden: false,
        });
      });
      if (copies.length === 0) return;
      updateModels([...models, ...copies]);
      const copyIds = copies.map((item) => item.id);
      setMultiSelectedModelIds(copyIds);
      updateCurrentScene({ theaterActiveModelId: copyIds[0] });
      setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
      setDecorActionMessage(`Скопировано объектов: ${copies.length}`);
    }, [currentScene, models, multiSelectedModelIds, updateCurrentScene, updateModels]);

    const removeModel = (id: number) => {
      if (!currentScene) return;
      const next = models.filter((item) => item.id !== id);
      updateModels(next);
      if (activeModelId === id) {
        updateCurrentScene({ theaterActiveModelId: next[0]?.id });
      }
    };

    const cloneModel = (id: number) => {
      if (!currentScene) return;
      const source = models.find((item) => item.id === id);
      if (!source) return;
      const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
      const offsetX = 0.3;
      const offsetZ = 0.3;
      const nextItem: TheaterModel = {
        ...source,
        id: nextId,
        name: `${source.name} (копия)`,
        position: [source.position[0] + offsetX, source.position[1], source.position[2] + offsetZ],
      };
      updateModels([...models, nextItem]);
      updateCurrentScene({ theaterActiveModelId: nextId });
      setPendingSnapModelId(nextId);
      setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
    };

    const seatActiveHumanOnFurniture = useCallback(() => {
      if (!currentScene || !activeModelId) return;
      const human = models.find((item) => item.id === activeModelId);
      if (!human) return;
      const furniture = findSeatingTargetForHuman(
        human,
        models,
        multiSelectedModelIds,
      );
      if (!furniture) {
        setDecorActionMessage("Выберите человека и стул/скамейку для посадки");
        return;
      }
      const seated = seatHumanOnFurniture(human, furniture);
      if (!seated) {
        setDecorActionMessage("Этот объект нельзя усадить на выбранную мебель");
        return;
      }
      updateModels(models.map((item) => (item.id === human.id ? seated : item)));
      setDecorActionMessage(`«${human.name}» посажен на «${furniture.name}»`);
      setPendingSnapModelId(human.id);
      setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
    }, [
      activeModelId,
      currentScene,
      models,
      multiSelectedModelIds,
      setDecorActionMessage,
      updateModels,
    ]);

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
        updateModels(nextModels);
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
      const activeModel = models.find((item) => item.id === activeModelId);
      if (patch && activeModelId && isLightTrussModel(activeModel)) {
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

    const syncActiveModel = persistActiveModel;

    useEffect(() => {
      if (!pendingSnapModelId) return;
      if (!activeModelObject || activeModelId !== pendingSnapModelId) return;
      if (activeModelObjectId !== pendingSnapModelId) return;

      const snapId = pendingSnapModelId;
      setPendingSnapModelId(null);

      const lifted = liftModelObjectAboveFloor(activeModelObject);
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
      pendingSnapModelId,
      updateModel,
    ]);

    const previewModel = useCallback(
      (id: number, patch: Partial<TheaterModel>) => {
        if (!currentScene) return;
        updateCurrentScene(
          writeSceneTheaterModels(
            normalizeModels(
              models.map((item) =>
                item.id === id ? { ...item, ...patch } : item,
              ),
            ),
          ),
        );
      },
      [currentScene, models, normalizeModels, updateCurrentScene],
    );

    const placeActiveModel = useCallback(
      (preset: ModelPlacementPreset) => {
        if (!activeModelId) return;
        const model = models.find((item) => item.id === activeModelId);
        if (!model) return;
        updateModel(activeModelId, {
          position: resolveModelPlacementPosition(
            preset,
            model,
            layout,
          ),
        });
        setPendingSnapModelId(activeModelId);
      },
      [activeModelId, layout, models, updateModel],
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
        snapToGrid,
        updateModels,
      ],
    );
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
