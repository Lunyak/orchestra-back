import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import * as THREE from "three";
import { useScene } from "../../scene";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import type {
  ScriptStep,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { DEFAULT_SPOTLIGHTS, DEFAULT_THEATER_LAYOUT } from "./theater-defaults";

export type UseTheaterSceneArgs = {
  projectName: string;
  theaterLayout?: TheaterLayout;
  onTheaterLayoutChange?: Dispatch<SetStateAction<TheaterLayout>>;
};

export type TheaterSceneViewModel = ReturnType<typeof useTheaterScene>;

export function useTheaterScene({
  projectName,
  theaterLayout,
  onTheaterLayoutChange,
}: UseTheaterSceneArgs) {
  const { steps, currentPage, updateStep } = useScene();
  const layout = theaterLayout ?? DEFAULT_THEATER_LAYOUT;
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<"target" | "source">("target");
  const [editMode, setEditMode] = useState<"spotlights" | "models">("spotlights");
  const [modelTransformMode, setModelTransformMode] = useState<
    "translate" | "rotate" | "scale"
  >("translate");
  const [showControls, setShowControls] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridStep, setGridStep] = useState(0.5);
  const [rgbBatchColor, setRgbBatchColor] = useState("#ffffff");
  const [showSpotlights, setShowSpotlights] = useState(true);
  const [showOnlyActiveSpotlight, setShowOnlyActiveSpotlight] = useState(false);
  const [builtinModelKey, setBuiltinModelKey] = useState<TheaterModel["builtin"]>(
    "roundTable"
  );
  const [hoveredModelId, setHoveredModelId] = useState<number | null>(null);
  const [pendingSnapModelId, setPendingSnapModelId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"spotlights" | "models" | "layout">(
    "spotlights"
  );
  const currentStep = steps[currentPage];
  const spotlights = currentStep?.theaterSpotlights ?? [];
  const effectiveSpotlights = spotlights.length > 0 ? spotlights : DEFAULT_SPOTLIGHTS;
  const activeSpotlightId =
    currentStep?.theaterActiveSpotlightId ?? effectiveSpotlights[0]?.id;
  const activeSpotlight =
    effectiveSpotlights.find((item) => item.id === activeSpotlightId) ??
    effectiveSpotlights[0];
  const models = currentStep?.theaterModels ?? [];
  const activeModelId = currentStep?.theaterActiveModelId;
  const activeModel = activeModelId
    ? models.find((item) => item.id === activeModelId)
    : undefined;
  const [activeModelObject, setActiveModelObject] = useState<THREE.Group | null>(
    null
  );
  const [activeModelObjectId, setActiveModelObjectId] = useState<number | null>(null);
  const modelObjectMapRef = useRef<Map<number, THREE.Group>>(new Map());
  const handleActiveObjectChange = useCallback(
    (node: THREE.Group | null, id: number) => {
      setActiveModelObject(node);
      setActiveModelObjectId(node ? id : null);
    },
    []
  );
  const handleObjectReady = useCallback((node: THREE.Group | null, id: number) => {
    if (node) {
      modelObjectMapRef.current.set(id, node);
    } else {
      modelObjectMapRef.current.delete(id);
    }
  }, []);

  useEffect(() => {
    if (!activeModelId || editMode !== "models") {
      setIsDragging(false);
    }
  }, [activeModelId, editMode]);

  useEffect(() => {
    const resetDragging = () => setIsDragging(false);
    window.addEventListener("pointerup", resetDragging);
    window.addEventListener("blur", resetDragging);
    return () => {
      window.removeEventListener("pointerup", resetDragging);
      window.removeEventListener("blur", resetDragging);
    };
  }, []);

  const normalizeSpotlights = useCallback(
    (items: TheaterSpotlight[]) =>
      items.map((item, index) => {
        const nextId = Number(item.id) || index + 1;
        return {
          id: nextId,
          label: item.label?.trim() || `Софит ${nextId}`,
          position: item.position ?? [0, 6, 6],
          target: item.target ?? [0, 1, 2],
          angleDeg: Number.isFinite(item.angleDeg) ? item.angleDeg : 20,
          intensity: Number.isFinite(item.intensity) ? item.intensity : 1.2,
          color: item.color,
          enabled: item.enabled ?? true,
          channel: Number.isFinite(item.channel) ? item.channel : nextId,
          isRgb: item.isRgb ?? false,
        };
      }),
    []
  );

  const updateCurrentStep = useCallback(
    (patch: Partial<ScriptStep>) => {
      if (!currentStep) return;
      updateStep(currentStep.id, patch);
    },
    [currentStep, updateStep]
  );

  const updateSpotlights = useCallback(
    (next: TheaterSpotlight[]) => {
      updateCurrentStep({ theaterSpotlights: normalizeSpotlights(next) });
    },
    [normalizeSpotlights, updateCurrentStep]
  );

  const cloneSpotlights = useCallback(
    (items: TheaterSpotlight[]) =>
      items.map((item) => ({
        ...item,
        position: [...item.position] as [number, number, number],
        target: [...item.target] as [number, number, number],
      })),
    []
  );

  const ensureSpotlights = useCallback(() => {
    if (spotlights.length > 0) return spotlights;
    const cloned = cloneSpotlights(DEFAULT_SPOTLIGHTS);
    updateSpotlights(cloned);
    return cloned;
  }, [cloneSpotlights, spotlights, updateSpotlights]);

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
          position: item.position ?? [0, 0, 0],
          rotation: item.rotation ?? [0, 0, 0],
          scale: item.scale ?? [1, 1, 1],
        };
      }),
    []
  );

  const updateModels = useCallback(
    (next: TheaterModel[]) => {
      updateCurrentStep({ theaterModels: normalizeModels(next) });
    },
    [normalizeModels, updateCurrentStep]
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

  const copyFromPreviousStep = () => {
    if (!currentStep || currentPage <= 0) return;
    const previous = steps[currentPage - 1];
    const source = previous?.theaterSpotlights ?? [];
    const cloned = source.map((item) => ({ ...item }));
    updateSpotlights(cloned);
    if (cloned.length > 0) {
      updateCurrentStep({ theaterActiveSpotlightId: cloned[0].id });
    }
  };

  const copyModelsFromPreviousStep = () => {
    if (!currentStep || currentPage <= 0) return;
    const previous = steps[currentPage - 1];
    const source = previous?.theaterModels ?? [];
    const cloned = source.map((item) => ({
      ...item,
      position: [...item.position] as [number, number, number],
      rotation: [...item.rotation] as [number, number, number],
      scale: [...item.scale] as [number, number, number],
    }));
    updateModels(cloned);
    if (cloned.length > 0) {
      updateCurrentStep({ theaterActiveModelId: cloned[0].id });
    }
  };

  const updateSpotlight = useCallback(
    (id: number, patch: Partial<TheaterSpotlight>) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) => (item.id === id ? { ...item, ...patch } : item))
      );
    },
    [ensureSpotlights, updateSpotlights]
  );

  const addSpotlight = () => {
    const base = ensureSpotlights();
    const nextId = base.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: TheaterSpotlight = {
      id: nextId,
      label: `Софит ${nextId}`,
      position: [0, 6, 6],
      target: [0, 1, 2],
      angleDeg: 20,
      intensity: 1.2,
      color: "#fbbf24",
      enabled: true,
      channel: nextId,
      isRgb: false,
    };
    updateSpotlights([...base, nextItem]);
    updateCurrentStep({ theaterActiveSpotlightId: nextId });
  };

  const addRgbSpotlight = () => {
    const base = ensureSpotlights();
    const nextId = base.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const rgbIndex =
      base.filter((item) => item.isRgb).reduce((acc, item) => Math.max(acc, item.id), 0) +
      1;
    const nextItem: TheaterSpotlight = {
      id: nextId,
      label: `RGB ${rgbIndex}`,
      position: [0, 6, 6],
      target: [0, 1, 2],
      angleDeg: 20,
      intensity: 1.2,
      color: "#ffffff",
      enabled: true,
      channel: nextId,
      isRgb: true,
    };
    updateSpotlights([...base, nextItem]);
    updateCurrentStep({ theaterActiveSpotlightId: nextId });
  };

  const applyRgbColorToAll = useCallback(
    (nextColor: string) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) => (item.isRgb ? { ...item, color: nextColor } : item))
      );
    },
    [ensureSpotlights, updateSpotlights]
  );

  const enableSpotlightsByType = useCallback(
    (isRgb: boolean) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) =>
          item.isRgb === isRgb ? { ...item, enabled: true } : item
        )
      );
    },
    [ensureSpotlights, updateSpotlights]
  );

  const disableSpotlightsByType = useCallback(
    (isRgb: boolean) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) =>
          item.isRgb === isRgb ? { ...item, enabled: false } : item
        )
      );
    },
    [ensureSpotlights, updateSpotlights]
  );

  const blackoutAllSpotlights = useCallback(() => {
    const base = ensureSpotlights();
    updateSpotlights(base.map((item) => ({ ...item, enabled: false })));
  }, [ensureSpotlights, updateSpotlights]);

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
      bench: "Скамейка",
      cabinet: "Тумба",
      blackCube: "Черный куб",
      strawGrid: "Сетка + солома",
      actor: "Актер",
      fence: "Забор",
      dancer: "Танцор",
    };
    const nextItem: TheaterModel = {
      id: nextId,
      name: builtinNames[builtinModelKey ?? "roundTable"] || `Модель ${nextId}`,
      type: "builtin",
      builtin: builtinModelKey,
      allowOutOfBounds: false,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
    };
    updateModels([...models, nextItem]);
    updateCurrentStep({ theaterActiveModelId: nextId });
    setPendingSnapModelId(nextId);
    setEditMode("models");
  };

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
    setEditMode("models");
  };

  const syncActiveModel = useCallback(() => {
    if (!activeModelObject || !activeModelId) return;
    if (activeModelObjectId !== activeModelId) return;
    const obj = activeModelObject;
    const prevModel = models.find((item) => item.id === activeModelId);
    const box = new THREE.Box3().setFromObject(obj);
    const lift = box.min.y < 0 ? -box.min.y : 0;
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

    if (prevModel) {
      if (prevModel.type === "builtin" && prevModel.builtin === "strawGrid") {
        updateModel(activeModelId, {
          position: [nextX, clampedY, nextZ],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        });
        return;
      }
      const activeBox = new THREE.Box3().setFromObject(obj);
      const collision = models.some((item) => {
        if (item.id === activeModelId) return false;
        if (item.type === "builtin" && item.builtin === "strawGrid") return false;
        const otherObject = modelObjectMapRef.current.get(item.id);
        if (otherObject) {
          const otherBox = new THREE.Box3().setFromObject(otherObject);
          return activeBox.intersectsBox(otherBox);
        }
        const pos = new THREE.Vector3(...item.position);
        const size = new THREE.Vector3(
          Math.max(0.2, Math.abs(item.scale[0]) * 0.8),
          Math.max(0.2, Math.abs(item.scale[1]) * 0.6),
          Math.max(0.2, Math.abs(item.scale[2]) * 0.8)
        );
        const otherBox = new THREE.Box3().setFromCenterAndSize(pos, size);
        return activeBox.intersectsBox(otherBox);
      });
      if (collision) {
        obj.position.set(prevModel.position[0], prevModel.position[1], prevModel.position[2]);
        updateModel(activeModelId, {
          position: [
            prevModel.position[0],
            prevModel.position[1],
            prevModel.position[2],
          ],
          rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
          scale: [obj.scale.x, obj.scale.y, obj.scale.z],
        });
        return;
      }
    }
    updateModel(activeModelId, {
      position: [nextX, clampedY, nextZ],
      rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
      scale: [obj.scale.x, obj.scale.y, obj.scale.z],
    });
  }, [
    activeModel,
    activeModelId,
    activeModelObject,
    activeModelObjectId,
    layout.hallDepth,
    layout.hallWidth,
    models,
    updateModel,
  ]);

  useEffect(() => {
    if (!pendingSnapModelId) return;
    if (!activeModelObject || activeModelId !== pendingSnapModelId) return;
    if (activeModelObjectId !== pendingSnapModelId) return;
    const box = new THREE.Box3().setFromObject(activeModelObject);
    const lift = box.min.y < 0 ? -box.min.y : 0;
    if (lift !== 0) {
      activeModelObject.position.y += lift;
    }
    updateModel(pendingSnapModelId, {
      position: [
        activeModelObject.position.x,
        activeModelObject.position.y,
        activeModelObject.position.z,
      ],
    });
    setPendingSnapModelId(null);
  }, [
    activeModelId,
    activeModelObject,
    activeModelObjectId,
    pendingSnapModelId,
    updateModel,
  ]);

  const updateLayout = useCallback(
    (patch: Partial<TheaterLayout>) => {
      if (!onTheaterLayoutChange) return;
      onTheaterLayoutChange((prev) => ({ ...prev, ...patch }));
    },
    [onTheaterLayoutChange]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (event.key.toLowerCase() !== "e") return;
      event.preventDefault();
      setShowControls((prev) => !prev);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    const handleDelete = (event: KeyboardEvent) => {
      if (editMode !== "models") return;
      if (!activeModelId) return;
      const key = event.key.toLowerCase();
      if (key !== "delete" && key !== "backspace") return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.closest("input, textarea, [contenteditable='true']") != null;
      if (isEditable) return;
      event.preventDefault();
      removeModel(activeModelId);
    };

    window.addEventListener("keydown", handleDelete);
    return () => window.removeEventListener("keydown", handleDelete);
  }, [activeModelId, editMode, removeModel]);

  useEffect(() => {
    const handleClear = (event: KeyboardEvent) => {
      if (editMode !== "models") return;
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      const isEditable =
        target?.closest("input, textarea, [contenteditable='true']") != null;
      if (isEditable) return;
      event.preventDefault();
      updateCurrentStep({ theaterActiveModelId: undefined });
    };

    window.addEventListener("keydown", handleClear);
    return () => window.removeEventListener("keydown", handleClear);
  }, [editMode, updateCurrentStep]);
  return {
    activeModel,
    activeModelId,
    activeModelObject,
    activeModelObjectId,
    activeSpotlight,
    activeSpotlightId,
    activeTab,
    addBuiltinModel,
    addModel,
    addRgbSpotlight,
    addSpotlight,
    applyRgbColorToAll,
    blackoutAllSpotlights,
    builtinModelKey,
    cloneModel,
    copyFromPreviousStep,
    copyModelsFromPreviousStep,
    currentPage,
    currentStep,
    disableSpotlightsByType,
    dragMode,
    editMode,
    effectiveSpotlights,
    enableSpotlightsByType,
    ensureSpotlights,
    gridStep,
    handleActiveObjectChange,
    handleObjectReady,
    hoveredModelId,
    isDragging,
    layout,
    modelTransformMode,
    models,
    removeModel,
    resolveModelSrc,
    rgbBatchColor,
    setActiveTab,
    setBuiltinModelKey,
    setDragMode,
    setEditMode,
    setGridStep,
    setHoveredModelId,
    setIsDragging,
    setModelTransformMode,
    setRgbBatchColor,
    setShowControls,
    setShowGrid,
    setShowOnlyActiveSpotlight,
    setShowSpotlights,
    setSnapToGrid,
    showControls,
    showGrid,
    showOnlyActiveSpotlight,
    showSpotlights,
    snapToGrid,
    spotlights,
    syncActiveModel,
    updateCurrentStep,
    updateLayout,
    updateSpotlight,
    updateModel,
  };
}
