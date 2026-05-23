import fs from "fs";
import path from "path";

const src = path.resolve("app/src/features/theater/ui/TheaterScene.tsx");
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);

const hookBody = lines.slice(33, 575).join("\n"); // inside component, lines 34-575
const controlsBody = lines.slice(576, 1235).join("\n"); // controlsNode block 577-1236

const hookFile = `import { useCallback, useEffect, useRef, useState } from "react";
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
  onTheaterLayoutChange?: React.Dispatch<React.SetStateAction<TheaterLayout>>;
};

export type TheaterSceneViewModel = ReturnType<typeof useTheaterScene>;

export function useTheaterScene({
  projectName,
  theaterLayout,
  onTheaterLayoutChange,
}: UseTheaterSceneArgs) {
  const { steps, currentPage, updateStep } = useScene();
  const layout = theaterLayout ?? DEFAULT_THEATER_LAYOUT;
${hookBody.replace(/^  /gm, "  ")}
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
`;

// Fix hook: remove duplicate layout/DEFAULT and useScene at start of hookBody
let fixedHook = hookFile
  .replace(
    /  const DEFAULT_LAYOUT = DEFAULT_THEATER_LAYOUT;\n  const layout = theaterLayout \?\? DEFAULT_LAYOUT;\n/,
    "",
  );

const controlsFile = `import type { TheaterSceneViewModel } from "../model/use-theater-scene";

export type TheaterControlsProps = {
  vm: TheaterSceneViewModel;
  controlsInPanel?: boolean;
};

export function TheaterControls({ vm, controlsInPanel }: TheaterControlsProps) {
  const {
    activeModel,
    activeModelId,
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
    currentStep,
    disableSpotlightsByType,
    dragMode,
    editMode,
    effectiveSpotlights,
    enableSpotlightsByType,
    ensureSpotlights,
    gridStep,
    layout,
    modelTransformMode,
    models,
    removeModel,
    rgbBatchColor,
    setActiveTab,
    setBuiltinModelKey,
    setDragMode,
    setEditMode,
    setGridStep,
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
    updateCurrentStep,
    updateLayout,
    updateSpotlight,
    updateModel,
  } = vm;

  if (!showControls) return null;

${controlsBody
  .replace(/^  const controlsNode = showControls \? \(/, "  return (")
  .replace(/\) : null;$/, ");")}
`;

fs.writeFileSync(
  path.resolve("app/src/features/theater/model/use-theater-scene.ts"),
  fixedHook,
  "utf8",
);
fs.writeFileSync(
  path.resolve("app/src/features/theater/ui/TheaterControls.tsx"),
  controlsFile,
  "utf8",
);
console.log("extracted hook + controls");
