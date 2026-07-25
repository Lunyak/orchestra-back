import fs from "fs";
import path from "path";

const root = path.resolve("app/src/features/theater");
const scenePath = path.join(root, "model/use-theater-scene.ts");
const lines = fs.readFileSync(scenePath, "utf8").split(/\r?\n/);

function slice(start, end, excludeRanges = []) {
  return lines.slice(start - 1, end).filter((_, i) => {
    const n = start + i;
    return !excludeRanges.some(([a, b]) => n >= a && n <= b);
  });
}

const models1 = slice(560, 860, [
  [641, 650],
  [705, 731],
  [733, 794],
]);
const models2 = lines.slice(1311, 1955);

const modelsHeader = `import {
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
import { snapModelZToAudienceLine } from "../model/theater-audience-snap";
import {
  applyAlignGuideSnap,
  type ActiveAlignGuide,
} from "../model/theater-align-guides";
import {
  readSceneTheaterModels,
  writeSceneTheaterModels,
} from "../model/theater-scene-models";
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
  const modelObjectMapRef = useRef<Map<number, THREE.Group>>(new Map());
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
  const [activeModelObject, setActiveModelObject] = useState<THREE.Group | null>(
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
    (node: THREE.Group | null, id: number) => {
      setActiveModelObject(node);
      setActiveModelObjectId(node ? id : null);
    },
    [],
  );
  const handleObjectReady = useCallback((node: THREE.Group | null, id: number) => {
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

`;

const modelsFooter = `
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
`;

const modelsBody = [...models1, "", ...models2]
  .map((line) => (line.length ? `  ${line}` : ""))
  .join("\n");

fs.writeFileSync(
  path.join(root, "state/use-theater-models.ts"),
  modelsHeader + modelsBody + modelsFooter,
  "utf8",
);

console.log(
  "Wrote use-theater-models.ts",
  (modelsHeader + modelsBody + modelsFooter).split("\n").length,
  "lines",
);
console.log("Skipped use-theater-decor.ts (maintained manually)");
