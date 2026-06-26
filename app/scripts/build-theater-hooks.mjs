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
const decorBody = lines.slice(860, 1310);

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
  steps,
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

const decorHeader = `import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopAddProjectImage } from "../../../shared/platform/desktop-methods";
import type { ScriptScene, TheaterLayout, TheaterModel } from "../../../shared/types/script";
import {
  getDecorCatalogEntry,
  isTheaterDecorModel,
  type DecorCatalogKey,
} from "../model/theater-decor-catalog";
import {
  buildDecorSceneTemplate,
  DECOR_SCENE_TEMPLATES,
  type DecorSceneTemplateId,
} from "../model/theater-decor-scene-templates";
import {
  buildModelsFromDecorTemplateJson,
  downloadDecorTemplateJson,
  exportDecorModelsToTemplateJson,
  loadProjectDecorTemplateManifest,
  persistStoredDecorTemplatesToProject,
  parseDecorTemplateJson,
  readStoredDecorTemplates,
  type DecorTemplateJson,
  type DecorTemplateListItem,
  upsertStoredDecorTemplate,
} from "../model/theater-decor-template-json";
import {
  decorInventoryToRequisiteLabels,
  downloadDecorInventoryCsv,
  formatDecorInventoryMarkdown,
  mergeDecorIntoRequisites,
} from "../model/theater-decor-inventory";
import {
  toDecorTextureFileRef,
  toDecorTexturePresetRef,
  type DecorTextureMode,
  type DecorTexturePresetId,
} from "../model/theater-decor-textures";
import { buildDecorGridPositions } from "../model/theater-decor-grid";
import {
  readSceneTheaterModels,
  writeSceneTheaterModels,
} from "../model/theater-scene-models";
import type { TheaterViewPrefs } from "../model/theater-view-prefs-storage";
import type { TheaterEditMode } from "./use-theater-selection";

export type UseTheaterDecorArgs = {
  projectName: string;
  currentPage: number;
  currentScene: ScriptScene | undefined;
  scenes: ScriptScene[];
  updateScene: (sceneId: number, patch: Partial<ScriptScene>) => void;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  layout: TheaterLayout;
  gridStep: number;
  snapToGrid: boolean;
  models: TheaterModel[];
  updateModels: (next: TheaterModel[]) => void;
  updateModel: (id: number, patch: Partial<TheaterModel>) => void;
  setPendingSnapModelId: Dispatch<SetStateAction<number | null>>;
  activeModelId: number | undefined;
  setEditMode: Dispatch<SetStateAction<TheaterEditMode>>;
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
};

export function useTheaterDecor({
  projectName,
  currentPage,
  currentScene,
  steps,
  updateScene,
  updateCurrentScene,
  layout,
  gridStep,
  snapToGrid,
  models,
  updateModels,
  updateModel,
  setPendingSnapModelId,
  activeModelId,
  setEditMode,
  setActiveTab,
}: UseTheaterDecorArgs) {
  const [decorCatalogKey, setDecorCatalogKey] =
    useState<DecorCatalogKey>("flat");
  const [decorDraftSize, setDecorDraftSize] = useState<
    [number, number, number] | null
  >(null);
  const [decorDraftColor, setDecorDraftColor] = useState<string | null>(null);
  const [decorDraftTexture, setDecorDraftTexture] = useState<string | null>(null);
  const [decorDraftTextureRepeat, setDecorDraftTextureRepeat] = useState(1);
  const [decorDraftTextureMode, setDecorDraftTextureMode] =
    useState<DecorTextureMode>("once");
  const [decorPlaceMode, setDecorPlaceMode] = useState(false);
  const [decorGridCols, setDecorGridCols] = useState(1);
  const [decorGridRows, setDecorGridRows] = useState(1);
  const [customDecorTemplates, setCustomDecorTemplates] = useState<
    DecorTemplateJson[]
  >(() => readStoredDecorTemplates(projectName));
  const [projectDecorTemplates, setProjectDecorTemplates] = useState<
    DecorTemplateJson[]
  >([]);
  const [decorActionMessage, setDecorActionMessage] = useState<string | null>(
    null,
  );

`;

const decorFooter = `
  return {
    decorCatalogKey,
    setDecorCatalogKey,
    decorDraftSize,
    setDecorDraftSize,
    decorDraftColor,
    setDecorDraftColor,
    decorDraftTexture,
    decorDraftTextureRepeat,
    decorDraftTextureMode,
    decorPlaceMode,
    setDecorPlaceMode,
    decorGridCols,
    setDecorGridCols,
    decorGridRows,
    setDecorGridRows,
    decorActionMessage,
    setDecorActionMessage,
    activeDecorPreset,
    resolveDecorDraftSize,
    resolveDecorDraftColor,
    addDecorAt,
    enterDecorPlaceMode,
    exitDecorPlaceMode,
    applyDecorTexture,
    applyDecorTexturePreset,
    clearDecorTexture,
    uploadDecorTextureFile,
    setDecorTextureRepeatForTarget,
    setDecorTextureModeForTarget,
    applyDecorSceneTemplate,
    replaceDecorSceneTemplate,
    applyDecorTemplateJson,
    copyDecorInventoryToClipboard,
    exportDecorInventoryCsv,
    syncDecorInventoryToRequisites,
    importDecorTemplateFromJson,
    exportCurrentDecorAsJsonTemplate,
    decorTemplateList,
    applyDecorTemplateByListId,
    applyDecorSketchTemplate,
    copyDecorToNextStep,
    saveDecorTemplatesToProject,
    setDecorDraftTextureRepeat,
  };
}
`;

// Fix applyDecorTemplateByListId deps in decor body
let decorText = decorBody.map((line) => (line.length ? `  ${line}` : "")).join("\n");
decorText = decorText.replace(
  /applyDecorTemplateByListId = useCallback\([\s\S]*?\],\s*\n\s*\);/,
  (block) => {
    if (!block.includes("applyLightPlotChannelLabels")) return block;
    return block.replace(
      /\[\s*\n\s*applyLightPlotChannelLabels,\s*\n\s*applyDecorSceneTemplate,/,
      `[
      replaceDecorSceneTemplate,
      applyDecorSceneTemplate,`,
    );
  },
);
// Fix addDecorAt deps - remove decorActionMessage
decorText = decorText.replace(
  /(\[)\s*\n\s*currentScene,\s*\n\s*decorActionMessage,\s*\n\s*decorCatalogKey,/,
  "$1\n      currentScene,\n      decorCatalogKey,",
);

fs.writeFileSync(
  path.join(root, "state/use-theater-decor.ts"),
  decorHeader + decorText + decorFooter,
  "utf8",
);

console.log(
  "Wrote use-theater-models.ts",
  (modelsHeader + modelsBody + modelsFooter).split("\n").length,
  "lines",
);
console.log(
  "Wrote use-theater-decor.ts",
  (decorHeader + decorText + decorFooter).split("\n").length,
  "lines",
);
