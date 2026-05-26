import fs from "fs";
import path from "path";

const scenePath = path.resolve("app/src/features/theater/model/use-theater-scene.ts");
let lines = fs.readFileSync(scenePath, "utf8").split(/\r?\n/);

const removeRanges = [
  [215, 222],
  [363, 389],
  [404, 408],
  [410, 410],
  [471, 474],
  [520, 558],
  [560, 1955],
];
removeRanges.sort((a, b) => b[0] - a[0]);
for (const [start, end] of removeRanges) {
  lines.splice(start - 1, end - start + 1);
}

let text = lines.join("\n");

if (!text.includes("use-theater-models")) {
  text = text.replace(
    'import { useTheaterSpotlights } from "../state/use-theater-spotlights";',
    `import { useTheaterSpotlights } from "../state/use-theater-spotlights";
import { useTheaterModels } from "../state/use-theater-models";
import { useTheaterDecor } from "../state/use-theater-decor";`,
  );
}

if (!text.includes('from "./theater-defaults"')) {
  text = text.replace(
    'import { buildTheaterViewModelSlices } from "../state/build-theater-view-model-slices";',
    `import { buildTheaterViewModelSlices } from "../state/build-theater-view-model-slices";
import { DEFAULT_THEATER_LAYOUT } from "./theater-defaults";`,
  );
}

const insertBlock = `  const [decorActionMessage, setDecorActionMessage] = useState<string | null>(null);

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

`;

if (!text.includes("const modelsApi = useTheaterModels")) {
  text = text.replace(
    /  const sceneOutlinerGroups = useMemo\(/,
    insertBlock + "  const sceneOutlinerGroups = useMemo(",
  );
}

// Remove unused imports - do minimal cleanup
const unusedImportPatterns = [
  /import \{[^}]*getDecorCatalogEntry[^}]*\} from "\.\/theater-decor-catalog";\n/,
  /import \{[^}]*buildDecorSceneTemplate[^}]*\} from "\.\/theater-decor-scene-templates";\n/,
  /import \{[^}]*buildModelsFromDecorTemplateJson[^}]*\} from "\.\/theater-decor-template-json";\n/,
  /import \{[^}]*decorInventoryToRequisiteLabels[^}]*\} from "\.\/theater-decor-inventory";\n/,
  /import \{[^}]*toDecorTextureFileRef[^}]*\} from "\.\/theater-decor-textures";\n/,
  /import \{[^}]*buildDecorGridPositions[^}]*\} from "\.\/theater-decor-grid";\n/,
  /import \{ normalizeDecorTextureFaces \}[^\n]+\n/,
  /import \{[^}]*alignModelsByActiveBuiltin[^}]*\} from "\.\/theater-model-align";\n/,
  /import \{ snapTheaterHallPoint \}[^\n]+\n/,
  /import \{[^}]*resolveModelPlacementPosition[^}]*\} from "\.\/theater-model-placement";\n/,
  /import \{ snapModelZToAudienceLine \}[^\n]+\n/,
  /import \{[^}]*applyAlignGuideSnap[^}]*\} from "\.\/theater-align-guides";\n/,
  /import \{[^}]*readStepTheaterModels[^}]*\} from "\.\/theater-step-models";\n/,
];
for (const pat of unusedImportPatterns) {
  text = text.replace(pat, "");
}

// Remove MODEL_TRANSFORM constant if unused in scene
text = text.replace(/\nconst MODEL_TRANSFORM_HISTORY_GRACE_MS = 400;\n/, "\n");

fs.writeFileSync(scenePath, text, "utf8");
console.log("Patched scene, lines:", text.split("\n").length);
