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
  ScriptStep,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { normalizeDecorTextureFaces } from "../model/theater-decor-faces";
import {
  alignModelsByActiveBuiltin,
  alignModelsBySelection,
  distributeModelsByActiveBuiltin,
  distributeModelsBySelection,
  setModelsVisibilityBySelection,
} from "../model/theater-model-align";
import { snapTheaterHallPoint } from "../model/theater-hall-grid";
import {
  resolveModelPlacementPosition,
  resolveModelHalfDepth,
  rotateModelByQuarterTurn,
  type ModelPlacementPreset,
} from "../model/theater-model-placement";
import {
  canIgnoreSeatedHumanCollision,
  findSeatingTargetForHuman,
  isSittingHumanTheaterModel,
  seatHumanOnFurniture,
} from "../model/theater-model-seating";
import { snapModelZToAudienceLine } from "../model/theater-audience-snap";
import {
  applyAlignGuideSnap,
  type ActiveAlignGuide,
} from "../model/theater-align-guides";
import {
  readStepTheaterModels,
  writeStepTheaterModels,
} from "../model/theater-step-models";
import { cloneTheaterSpotlights } from "./use-theater-spotlights";
import type { TheaterEditMode } from "./use-theater-selection";

const MODEL_TRANSFORM_HISTORY_GRACE_MS = 400;

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
  currentStep: ScriptStep | undefined;
  steps: ScriptStep[];
  updateStep: (stepId: number, patch: Partial<ScriptStep>) => void;
  updateCurrentStep: (patch: Partial<ScriptStep>) => void;
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
  updateSpotlights: (next: TheaterSpotlight[]) => void;
};

export function useTheaterModels({
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
    "roundTable",
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

  const models = readStepTheaterModels(currentStep);
  const visibleModels = useMemo(
    () => models.filter((model) => !model.hidden),
    [models],
  );
  const activeModel = activeModelId
    ? models.find((item) => item.id === activeModelId)
    : undefined;

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
      (items: TheaterModel[]) =>
        items.map((item, index) => {
          const nextId = Number(item.id) || index + 1;
          return {
            id: nextId,
            name: item.name?.trim() || `Модель ${nextId}`,
            file: item.file,
            type: item.type ?? (item.file ? "file" : "builtin"),
            builtin: item.builtin,
            allowOutOfBounds: item.allowOutOfBounds ?? false,
            ignoreCollisions: item.ignoreCollisions ?? false,
            position: item.position ?? [0, 0, 0],
            rotation: item.rotation ?? [0, 0, 0],
            scale: item.scale ?? [1, 1, 1],
            decorSize: item.decorSize
              ? ([...item.decorSize] as [number, number, number])
              : undefined,
            decorColor: item.decorColor,
            decorTexture: item.decorTexture,
            decorTextureRepeat:
              typeof item.decorTextureRepeat === "number"
                ? item.decorTextureRepeat
                : undefined,
            decorTextureMode:
              item.decorTextureMode === "repeat" ||
              item.decorTextureMode === "cover" ||
              item.decorTextureMode === "contain" ||
              item.decorTextureMode === "once"
                ? item.decorTextureMode
                : undefined,
            decorTextureFaces: normalizeDecorTextureFaces(item.decorTextureFaces),
            decorOneSided: item.decorOneSided ?? false,
            decorOpacity:
              typeof item.decorOpacity === "number" ? item.decorOpacity : undefined,
            decorRoughness:
              typeof item.decorRoughness === "number" ? item.decorRoughness : undefined,
            decorMetalness:
              typeof item.decorMetalness === "number" ? item.decorMetalness : undefined,
            decorEmissiveColor: item.decorEmissiveColor,
            decorEmissiveIntensity:
              typeof item.decorEmissiveIntensity === "number"
                ? item.decorEmissiveIntensity
                : undefined,
            decorMaterialSide:
              item.decorMaterialSide === "front" ||
              item.decorMaterialSide === "back" ||
              item.decorMaterialSide === "double"
                ? item.decorMaterialSide
                : undefined,
            humanSkinColor: item.humanSkinColor,
            humanTopColor: item.humanTopColor,
            humanBottomColor: item.humanBottomColor,
            humanShoeColor: item.humanShoeColor,
            ...(item.hidden ? { hidden: true } : {}),
          };
        }),
      []
    );

    const updateModels = useCallback(
      (next: TheaterModel[]) => {
        recordTheaterHistory();
        updateCurrentStep(writeStepTheaterModels(normalizeModels(next)));
      },
      [normalizeModels, recordTheaterHistory, updateCurrentStep]
    );

    const updateModel = useCallback(
      (id: number, patch: Partial<TheaterModel>) => {
        updateModels(
          models.map((item) => (item.id === id ? { ...item, ...patch } : item))
        );
      },
      [models, updateModels]
    );

    const resolveModelSrc = useCallback(
      (file: string) => {
        const url = new URL(`project-models://${encodeURIComponent(projectName)}/`);
        url.pathname = `/${file}`;
        return url.toString();
      },
      [projectName]
    );

    const copyModelsFromPreviousStep = () => {
      if (!currentStep || currentPage <= 0) return;
      const previous = steps[currentPage - 1];
      const source = readStepTheaterModels(previous);
      const cloned = cloneTheaterModels(source);
      updateModels(cloned);
      if (cloned.length > 0) {
        updateCurrentStep({ theaterActiveModelId: cloned[0].id });
      }
    };

    const copyTheaterFromPreviousStep = useCallback(() => {
      if (!currentStep || currentPage <= 0) return;
      const previous = steps[currentPage - 1];
      if (!previous) return;
      const clonedSpotlights = cloneTheaterSpotlights(previous.theaterSpotlights ?? []);
      const clonedModels = cloneTheaterModels(readStepTheaterModels(previous));
      updateCurrentStep({
        theaterSpotlights: clonedSpotlights,
        ...writeStepTheaterModels(clonedModels),
        ...(previous.lightPlot
          ? { lightPlot: previous.lightPlot.map((fixture) => ({ ...fixture })) }
          : {}),
        ...(previous.lightCues
          ? { lightCues: previous.lightCues.map((cue) => ({ ...cue })) }
          : {}),
        theaterActiveSpotlightId: clonedSpotlights[0]?.id,
        theaterActiveModelId: clonedModels[0]?.id,
      });
      setDecorActionMessage("Сцена скопирована с предыдущего шага");
    }, [currentPage, currentStep, steps, updateCurrentStep]);

    const copyTheaterToNextStep = useCallback(() => {
      if (!currentStep || currentPage >= steps.length - 1) return;
      const nextStep = steps[currentPage + 1];
      if (!nextStep) return;
      const clonedSpotlights = cloneTheaterSpotlights(displaySpotlights);
      const clonedModels = cloneTheaterModels(models);
      updateStep(nextStep.id, {
        theaterSpotlights: clonedSpotlights,
        ...writeStepTheaterModels(clonedModels),
        ...(currentStep.lightPlot
          ? { lightPlot: currentStep.lightPlot.map((fixture) => ({ ...fixture })) }
          : {}),
        ...(currentStep.lightCues
          ? { lightCues: currentStep.lightCues.map((cue) => ({ ...cue })) }
          : {}),
        theaterActiveSpotlightId: clonedSpotlights[0]?.id,
        theaterActiveModelId: clonedModels[0]?.id,
      });
      setDecorActionMessage(`Сцена скопирована на шаг «${nextStep.title}»`);
    }, [currentPage, currentStep, displaySpotlights, models, steps, updateStep]);



    const addModel = async () => {
      if (!currentStep) return;
      try {
        const desktopApi = getDesktopApi();
        if (!desktopApi?.pickProjectModel) {
          console.error(
            "pickProjectModel is not available. Restart the Electron process to reload preload."
          );
          return;
        }
        const result = await desktopApi.pickProjectModel(projectName);
        if (!result?.ok) {
          if (result?.canceled) return;
          console.error("Failed to pick model:", result?.error);
          return;
        }
        const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
        const nextItem: TheaterModel = {
          id: nextId,
          name: result.name || `Модель ${nextId}`,
          file: result.file,
          type: "file",
          allowOutOfBounds: false,
          ignoreCollisions: false,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        };
        updateModels([...models, nextItem]);
        updateCurrentStep({ theaterActiveModelId: nextId });
        setPendingSnapModelId(nextId);
        setEditMode("models");
      } catch (err) {
        console.error("Failed to add model:", err);
      }
    };

    const addBuiltinModel = () => {
      const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
      const builtinNames: Record<string, string> = {
        roundTable: "Круглый стол",
        chair: "Стул",
        sofa: "Диван",
        bench: "Скамейка",
        cabinet: "Тумба",
        blackCube: "Черный куб",
        strawGrid: "Сетка + солома",
        actor: "Актер",
        hangingFabric: "Висящая ткань",
        humanStanding: "Человек — стоит",
        humanSitting: "Человек — сидит",
        humanSmoothStanding: "Человек сглаженный — стоит",
        humanSmoothSitting: "Человек сглаженный — сидит",
        fence: "Забор",
        dancer: "Танцор",
      };
      const isHumanModel =
        builtinModelKey === "humanStanding" ||
        builtinModelKey === "humanSitting" ||
        builtinModelKey === "humanSmoothStanding" ||
        builtinModelKey === "humanSmoothSitting";
      const nextItem: TheaterModel = {
        id: nextId,
        name: builtinNames[builtinModelKey ?? "roundTable"] || `Модель ${nextId}`,
        type: "builtin",
        builtin: builtinModelKey,
        allowOutOfBounds: false,
        ignoreCollisions: false,
        position: [0, isHumanModel ? 0.02 : 0, 0],
        rotation: [0, 0, 0],
        scale: isHumanModel ? [0.9, 0.9, 0.9] : [1, 1, 1],
        ...(isHumanModel
          ? {
              humanSkinColor: "#d7a77f",
              humanTopColor: "#334155",
              humanBottomColor: "#1e293b",
              humanShoeColor: "#111827",
            }
          : {}),
      };
      updateModels([...models, nextItem]);
      updateCurrentStep({ theaterActiveModelId: nextId });
      setPendingSnapModelId(nextId);
      setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
    };


    const mirrorModel = useCallback(
      (id: number, axis: "x" | "z") => {
        if (!currentStep) return;
        const source = models.find((item) => item.id === id);
        if (!source) return;
        const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
        const position: [number, number, number] = [...source.position];
        const rotation: [number, number, number] = [...source.rotation];
        if (axis === "x") {
          position[0] = -position[0];
          rotation[1] = -rotation[1];
        } else {
          position[2] = -position[2];
          rotation[1] = Math.PI - rotation[1];
        }
        const nextItem: TheaterModel = {
          ...source,
          id: nextId,
          name: `${source.name} (зеркало ${axis.toUpperCase()})`,
          position,
          rotation,
        };
        updateModels([...models, nextItem]);
        updateCurrentStep({ theaterActiveModelId: nextId });
        setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
      },
      [currentStep, models, updateCurrentStep, updateModels],
    );

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
      if (multiSelectedModelIds.length === 0 || !currentStep) return;
      const selected = new Set(multiSelectedModelIds);
      const next = models.filter((item) => !selected.has(item.id));
      updateModels(next);
      updateCurrentStep({ theaterActiveModelId: next[0]?.id });
      setMultiSelectedModelIds(next[0] ? [next[0].id] : []);
      setDecorActionMessage(`Удалено объектов: ${selected.size}`);
    }, [currentStep, models, multiSelectedModelIds, updateCurrentStep, updateModels]);

    const cloneSelectedModels = useCallback(() => {
      if (multiSelectedModelIds.length === 0 || !currentStep) return;
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
      updateCurrentStep({ theaterActiveModelId: copyIds[0] });
      setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
      setDecorActionMessage(`Скопировано объектов: ${copies.length}`);
    }, [currentStep, models, multiSelectedModelIds, updateCurrentStep, updateModels]);

    const removeModel = (id: number) => {
      if (!currentStep) return;
      const next = models.filter((item) => item.id !== id);
      updateModels(next);
      if (activeModelId === id) {
        updateCurrentStep({ theaterActiveModelId: next[0]?.id });
      }
    };

    const cloneModel = (id: number) => {
      if (!currentStep) return;
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
      updateCurrentStep({ theaterActiveModelId: nextId });
      setPendingSnapModelId(nextId);
      setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
    };

    const seatActiveHumanOnFurniture = useCallback(() => {
      if (!currentStep || !activeModelId) return;
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
      currentStep,
      models,
      multiSelectedModelIds,
      setDecorActionMessage,
      updateModels,
    ]);

    type ActiveModelPatch = Pick<TheaterModel, "position" | "rotation" | "scale">;

    const applyActiveModelTransform = useCallback((): ActiveModelPatch | null => {
      if (!activeModelObject || !activeModelId) return null;
      if (activeModelObjectId !== activeModelId) return null;
      const obj = activeModelObject;
      const prevModel = models.find((item) => item.id === activeModelId);
      const box = new THREE.Box3().setFromObject(obj);
      const allowBelowFloorAnchor = prevModel ? isSittingHumanTheaterModel(prevModel) : false;
      const lift = !allowBelowFloorAnchor && box.min.y < 0 ? -box.min.y : 0;
      let nextX = obj.position.x;
      let nextZ = obj.position.z;
      const allowOut = activeModel?.allowOutOfBounds ?? false;
      if (!allowOut) {
        const halfW = layout.hallWidth / 2;
        const halfD = layout.hallDepth / 2;
        if (box.min.x < -halfW) {
          nextX += -halfW - box.min.x;
        }
        if (box.max.x > halfW) {
          nextX -= box.max.x - halfW;
        }
        if (box.min.z < -halfD) {
          nextZ += -halfD - box.min.z;
        }
        if (box.max.z > halfD) {
          nextZ -= box.max.z - halfD;
        }
      }
      const clampedY = obj.position.y + lift;
      obj.position.set(nextX, clampedY, nextZ);

      if (
        snapToGrid &&
        gridStep > 0 &&
        modelTransformMode === "translate"
      ) {
        [nextX, nextZ] = snapTheaterHallPoint(
          nextX,
          nextZ,
          layout.hallWidth,
          layout.hallDepth,
          gridStep,
          true,
        );
        obj.position.set(nextX, clampedY, nextZ);
      }

      if (modelTransformMode === "translate" && alignGuidesEnabled) {
        const aligned = applyAlignGuideSnap(nextX, nextZ, layout, true);
        nextX = aligned.x;
        nextZ = aligned.z;
        setActiveAlignGuides(aligned.guides);
        obj.position.set(nextX, clampedY, nextZ);
      } else if (!isDragging) {
        setActiveAlignGuides([]);
      }

      if (prevModel && modelTransformMode === "translate") {
        nextZ = snapModelZToAudienceLine(
          nextZ,
          resolveModelHalfDepth(prevModel),
          layout.audienceStartZ,
        );
        obj.position.set(nextX, clampedY, nextZ);
      }

      const patch: ActiveModelPatch = {
        position: [nextX, clampedY, nextZ],
        rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
        scale: [obj.scale.x, obj.scale.y, obj.scale.z],
      };

      if (prevModel) {
        if (prevModel.ignoreCollisions) {
          if (historyTransactionRef.current) {
            modelDragLastValidRef.current = patch;
          }
          return patch;
        }
        if (prevModel.type === "builtin" && prevModel.builtin === "strawGrid") {
          if (historyTransactionRef.current) {
            modelDragLastValidRef.current = patch;
          }
          return patch;
        }
        const activeBox = new THREE.Box3().setFromObject(obj);
        const collision = models.some((item) => {
          if (item.id === activeModelId) return false;
          if (item.type === "builtin" && item.builtin === "strawGrid") return false;
          if (item.ignoreCollisions) return false;
          if (canIgnoreSeatedHumanCollision(prevModel, item)) return false;
          const otherObject = modelObjectMapRef.current.get(item.id);
          if (otherObject) {
            const otherBox = new THREE.Box3().setFromObject(otherObject);
            return activeBox.intersectsBox(otherBox);
          }
          const pos = new THREE.Vector3(...item.position);
          const size = new THREE.Vector3(
            Math.max(0.2, Math.abs(item.scale[0]) * 0.8),
            Math.max(0.2, Math.abs(item.scale[1]) * 0.6),
            Math.max(0.2, Math.abs(item.scale[2]) * 0.8),
          );
          const otherBox = new THREE.Box3().setFromCenterAndSize(pos, size);
          return activeBox.intersectsBox(otherBox);
        });
        if (collision) {
          const fallback =
            historyTransactionRef.current && modelDragLastValidRef.current
              ? modelDragLastValidRef.current
              : prevModel
                ? {
                    position: [...prevModel.position] as [number, number, number],
                    rotation: [...prevModel.rotation] as [number, number, number],
                    scale: [...prevModel.scale] as [number, number, number],
                  }
                : null;
          if (fallback) {
            obj.position.set(...fallback.position);
            obj.rotation.set(
              fallback.rotation[0],
              fallback.rotation[1],
              fallback.rotation[2],
            );
            obj.scale.set(fallback.scale[0], fallback.scale[1], fallback.scale[2]);
            return fallback;
          }
        }
      }
      if (historyTransactionRef.current) {
        modelDragLastValidRef.current = patch;
      }
      return patch;
    }, [
      activeModel,
      activeModelId,
      activeModelObject,
      activeModelObjectId,
      alignGuidesEnabled,
      isDragging,
      layout,
      layout.hallDepth,
      layout.hallWidth,
      gridStep,
      modelTransformMode,
      models,
      snapToGrid,
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
        updateModels(
          models.map((model) => {
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
          }),
        );
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
      applyActiveModelTransform();
    }, [
      activeModelId,
      applyActiveModelTransform,
      beginTheaterHistoryTransaction,
      models,
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
        const baseline = new Map<number, ActiveModelPatch>();
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

      const box = new THREE.Box3().setFromObject(activeModelObject);
      const lift = box.min.y < 0 ? -box.min.y : 0;
      if (lift <= 1e-6) return;

      activeModelObject.position.y += lift;
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
        if (!currentStep) return;
        updateCurrentStep(
          writeStepTheaterModels(
            normalizeModels(
              models.map((item) =>
                item.id === id ? { ...item, ...patch } : item,
              ),
            ),
          ),
        );
      },
      [currentStep, models, normalizeModels, updateCurrentStep],
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
            snapToGrid,
            gridStep,
          ),
        });
        setPendingSnapModelId(activeModelId);
      },
      [activeModelId, gridStep, layout, models, snapToGrid, updateModel],
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
        updateModels(
          models.map((model) => {
            if (!selected.has(model.id)) return model;
            let nextX = model.position[0] + deltaX;
            let nextZ = model.position[2] + deltaZ;
            if (snapToGrid && gridStep > 0) {
              [nextX, nextZ] = snapTheaterHallPoint(
                nextX,
                nextZ,
                layout.hallWidth,
                layout.hallDepth,
                gridStep,
                true,
              );
            }
            if (alignGuidesEnabled) {
              const aligned = applyAlignGuideSnap(nextX, nextZ, layout, true);
              nextX = aligned.x;
              nextZ = aligned.z;
              setActiveAlignGuides(aligned.guides);
            }
            nextZ = snapModelZToAudienceLine(
              nextZ,
              resolveModelHalfDepth(model),
              layout.audienceStartZ,
            );
            return {
              ...model,
              position: [nextX, model.position[1], nextZ] as [number, number, number],
            };
          }),
        );
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
