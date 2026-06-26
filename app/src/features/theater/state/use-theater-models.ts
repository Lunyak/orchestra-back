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
import { encodeOrchestraModelRef } from "../../../shared/project-assets/orchestraModelRef";
import { ensureProject } from "../../../sync/api/projects";
import { uploadProjectFile } from "../../../sync/api/files";
import type {
  ScriptScene,
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
  readSceneTheaterModels,
  writeSceneTheaterModels,
} from "../model/theater-scene-models";
import {
  buildCopySceneTheaterLayoutPatch,
  buildCopySceneTheaterLayoutPatchFromScene,
} from "../model/copy-scene-theater-layout";
import { cloneTheaterSpotlights } from "./use-theater-spotlights";
import type { TheaterEditMode } from "./use-theater-selection";
import { resolveTheaterModelFileUrlSync } from "../model/theater-model-asset-url";

const MODEL_TRANSFORM_HISTORY_GRACE_MS = 400;

const THEATER_MODEL_FILE_ACCEPT =
  ".glb,.gltf,model/gltf-binary,model/gltf+json";

function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

function modelDisplayNameFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, "").trim();
  return base.replace(/\.[^.]+$/, "") || base || "Модель";
}

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
  updateSpotlights: (next: TheaterSpotlight[]) => void;
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

  const models = readSceneTheaterModels(currentScene);
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
        updateCurrentScene(writeSceneTheaterModels(normalizeModels(next)));
      },
      [normalizeModels, recordTheaterHistory, updateCurrentScene]
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

    const copyTheaterFromPreviousScene = useCallback(() => {
      if (!currentScene || currentPage <= 0) return;
      const previous = scenes[currentPage - 1];
      if (!previous) return;
      updateCurrentScene(buildCopySceneTheaterLayoutPatchFromScene(previous));
      setDecorActionMessage("Сцена скопирована с предыдущей сцены");
    }, [currentPage, currentScene, scenes, updateCurrentScene]);

    const copyTheaterToNextScene = useCallback(() => {
      if (!currentScene || currentPage >= scenes.length - 1) return;
      const nextScene = scenes[currentPage + 1];
      if (!nextScene) return;
      updateScene(
        nextScene.id,
        buildCopySceneTheaterLayoutPatch({
          spotlights: displaySpotlights,
          models,
          lightPlot: currentScene.lightPlot,
          requisites: currentScene.requisites,
        }),
      );
      setDecorActionMessage(`Расстановка скопирована на сцену «${nextScene.title}»`);
    }, [currentPage, currentScene, displaySpotlights, models, scenes, updateScene]);



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
      const token = readAccessToken();
      if (!token) {
        setDecorActionMessage("Войдите в аккаунт, чтобы загрузить модель");
        return;
      }

      const input = document.createElement("input");
      input.type = "file";
      input.accept = THEATER_MODEL_FILE_ACCEPT;
      input.multiple = false;
      input.onchange = () => {
        const file = input.files?.[0] ?? null;
        if (!file) return;
        void (async () => {
          try {
            const project = await ensureProject(
              token,
              projectName,
              `Проект ${projectName}`,
            );
            const { key } = await uploadProjectFile(token, {
              projectId: project.id,
              type: "model",
              file,
            });
            appendFileModel(
              encodeOrchestraModelRef(key),
              modelDisplayNameFromFileName(file.name),
            );
            setDecorActionMessage(null);
          } catch (err) {
            console.error("Failed to upload model:", err);
            setDecorActionMessage("Не удалось загрузить модель");
          }
        })();
      };
      input.click();
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
      const nextId = models.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
      const builtinNames: Record<string, string> = {
        table: "Стол",
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
        name: builtinNames[builtinModelKey ?? "table"] || `Модель ${nextId}`,
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
      updateCurrentScene({ theaterActiveModelId: nextId });
      setPendingSnapModelId(nextId);
      setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
    };


    const mirrorModel = useCallback(
      (id: number, axis: "x" | "z") => {
        if (!currentScene) return;
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
        updateCurrentScene({ theaterActiveModelId: nextId });
        setEditMode((mode) => (mode === "decor" ? "decor" : "models"));
      },
      [currentScene, models, updateCurrentScene, updateModels],
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
      if (multiSelectedModelIds.length === 0 || !currentScene) return;
      const selected = new Set(multiSelectedModelIds);
      const next = models.filter((item) => !selected.has(item.id));
      updateModels(next);
      updateCurrentScene({ theaterActiveModelId: next[0]?.id });
      setMultiSelectedModelIds(next[0] ? [next[0].id] : []);
      setDecorActionMessage(`Удалено объектов: ${selected.size}`);
    }, [currentScene, models, multiSelectedModelIds, updateCurrentScene, updateModels]);

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
    copyModelsFromPreviousScene,
    copyTheaterFromPreviousScene,
    copyTheaterToNextScene,
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
