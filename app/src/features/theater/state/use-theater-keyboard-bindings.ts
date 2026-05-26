import { useEffect } from "react";
import type { TheaterLayout } from "../../../shared/types/script";
import { patchTheaterViewPrefs } from "../model/theater-view-prefs-storage";
import {
  isTheaterPageActive,
  isTheaterEditableTarget,
  isInsideTheaterUi,
  isTheaterPhysicalKey,
} from "../model/theater-keyboard-shortcuts";
import { resolveStageShape } from "../model/theater-stage-geometry";
import type { TheaterEditMode } from "./use-theater-selection";
import type { TheaterViewPrefs } from "../model/theater-view-prefs-storage";

export type UseTheaterKeyboardBindingsArgs = {
  projectName: string;
  layout: TheaterLayout;
  activeTab: TheaterViewPrefs["activeTab"];
  editMode: TheaterEditMode;
  activeModelId: number | undefined;
  activeSpotlightId: number | undefined;
  multiSelectedModelIds: number[];
  multiSelectedSpotlightIds: number[];
  activeOutlineVertexIndex: number | null;
  swapTheaterPanels: boolean;
  showControls: boolean;
  setSwapTheaterPanels: (value: boolean) => void;
  setShowControls: (value: boolean) => void;
  snapToGrid: boolean;
  gridStep: number;
  modelTransformMode: "translate" | "rotate" | "scale";
  undoTheater: () => void;
  redoTheater: () => void;
  removeModel: (id: number) => void;
  removeSelectedModels: () => void;
  removeSpotlight: (id: number) => void;
  removeSelectedSpotlights: () => void;
  removeActiveOutlineVertex: () => void;
  cloneModel: (id: number | undefined) => void;
  nudgeActiveModel: (dx: number, dz: number) => void;
  rotateActiveModelFine: (dy: number) => void;
  beginTheaterHistoryTransaction: () => void;
  endTheaterHistoryTransaction: () => void;
  toggleActiveSceneVisibility: () => void;
  selectAllVisibleInEditMode: () => void;
  clearSceneSelection: () => void;
};

export function useTheaterKeyboardBindings(args: UseTheaterKeyboardBindingsArgs) {
  const {
    projectName,
    layout,
    activeTab,
    editMode,
    activeModelId,
    activeSpotlightId,
    multiSelectedModelIds,
    multiSelectedSpotlightIds,
    activeOutlineVertexIndex,
    swapTheaterPanels,
    showControls,
    setSwapTheaterPanels,
    setShowControls,
    snapToGrid,
    gridStep,
    modelTransformMode,
    undoTheater,
    redoTheater,
    removeModel,
    removeSelectedModels,
    removeSpotlight,
    removeSelectedSpotlights,
    removeActiveOutlineVertex,
    cloneModel,
    nudgeActiveModel,
    rotateActiveModelFine,
    beginTheaterHistoryTransaction,
    endTheaterHistoryTransaction,
    toggleActiveSceneVisibility,
    selectAllVisibleInEditMode,
    clearSceneSelection,
  } = args;

  useEffect(() => {
    const handleHideToggle = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (!isTheaterPhysicalKey(event, "KeyH", "h")) return;
      if (isTheaterEditableTarget(event.target)) return;
      if (!isTheaterPageActive()) return;
      event.preventDefault();
      toggleActiveSceneVisibility();
    };
    window.addEventListener("keydown", handleHideToggle, true);
    return () => window.removeEventListener("keydown", handleHideToggle, true);
  }, [toggleActiveSceneVisibility]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      if (!isTheaterPhysicalKey(event, "KeyE", "e")) return;
      if (isTheaterEditableTarget(event.target)) return;
      if (!isTheaterPageActive()) return;
      event.preventDefault();
      event.stopPropagation();
      if (!swapTheaterPanels) {
        setSwapTheaterPanels(true);
        setShowControls(true);
        patchTheaterViewPrefs(projectName, {
          swapTheaterPanels: true,
          showTheaterControls: true,
        });
        return;
      }
      const nextShowControls = !showControls;
      setShowControls(nextShowControls);
      patchTheaterViewPrefs(projectName, { showTheaterControls: nextShowControls });
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [projectName, setShowControls, setSwapTheaterPanels, showControls, swapTheaterPanels]);

  useEffect(() => {
    const handleUndoRedo = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (isTheaterEditableTarget(event.target)) return;
      if (!isInsideTheaterUi(event.target)) return;
      if (isTheaterPhysicalKey(event, "KeyZ", "z") && !event.shiftKey) {
        event.preventDefault();
        undoTheater();
        return;
      }
      if (
        isTheaterPhysicalKey(event, "KeyY", "y") ||
        (isTheaterPhysicalKey(event, "KeyZ", "z") && event.shiftKey)
      ) {
        event.preventDefault();
        redoTheater();
      }
    };
    window.addEventListener("keydown", handleUndoRedo, true);
    return () => window.removeEventListener("keydown", handleUndoRedo, true);
  }, [redoTheater, undoTheater]);

  useEffect(() => {
    const handleDelete = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key !== "delete" && key !== "backspace") return;
      if (isTheaterEditableTarget(event.target)) return;
      if (!isInsideTheaterUi(event.target)) return;

      if (
        (editMode === "models" || editMode === "decor") &&
        (multiSelectedModelIds.length > 1 || activeModelId)
      ) {
        event.preventDefault();
        if (multiSelectedModelIds.length > 1) {
          removeSelectedModels();
        } else if (activeModelId) {
          removeModel(activeModelId);
        }
        return;
      }
      if (editMode === "spotlights") {
        if (multiSelectedSpotlightIds.length > 1 || activeSpotlightId) {
          event.preventDefault();
          if (multiSelectedSpotlightIds.length > 1) {
            removeSelectedSpotlights();
          } else if (activeSpotlightId) {
            removeSpotlight(activeSpotlightId);
          }
        }
        return;
      }
      if (
        activeTab === "layout" &&
        resolveStageShape(layout) === "custom" &&
        activeOutlineVertexIndex != null
      ) {
        event.preventDefault();
        removeActiveOutlineVertex();
      }
    };

    window.addEventListener("keydown", handleDelete, true);
    return () => window.removeEventListener("keydown", handleDelete, true);
  }, [
    activeModelId,
    activeSpotlightId,
    editMode,
    multiSelectedModelIds,
    multiSelectedSpotlightIds,
    removeModel,
    removeSelectedModels,
    removeSelectedSpotlights,
    removeSpotlight,
    activeTab,
    layout,
    activeOutlineVertexIndex,
    removeActiveOutlineVertex,
  ]);

  useEffect(() => {
    const handleDuplicate = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "d") return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (editMode !== "models" && editMode !== "decor") return;
      if (!activeModelId && multiSelectedModelIds.length === 0) return;
      event.preventDefault();
      cloneModel(activeModelId);
    };
    window.addEventListener("keydown", handleDuplicate, true);
    return () => window.removeEventListener("keydown", handleDuplicate, true);
  }, [activeModelId, cloneModel, editMode, multiSelectedModelIds.length]);

  useEffect(() => {
    const arrowKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    const handleNudge = (event: KeyboardEvent) => {
      if (!arrowKeys.includes(event.key)) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (editMode !== "models" && editMode !== "decor") return;
      if (!activeModelId) return;
      if (modelTransformMode !== "translate") return;
      event.preventDefault();
      const coarse = snapToGrid && gridStep > 0 ? gridStep : 0.1;
      const step = event.shiftKey ? 0.05 : coarse;
      let dx = 0;
      let dz = 0;
      switch (event.key) {
        case "ArrowLeft":
          dx = -step;
          break;
        case "ArrowRight":
          dx = step;
          break;
        case "ArrowUp":
          dz = -step;
          break;
        case "ArrowDown":
          dz = step;
          break;
      }
      beginTheaterHistoryTransaction();
      nudgeActiveModel(dx, dz);
      endTheaterHistoryTransaction();
    };
    window.addEventListener("keydown", handleNudge);
    return () => window.removeEventListener("keydown", handleNudge);
  }, [
    activeModelId,
    beginTheaterHistoryTransaction,
    editMode,
    endTheaterHistoryTransaction,
    gridStep,
    modelTransformMode,
    nudgeActiveModel,
    snapToGrid,
  ]);

  useEffect(() => {
    const arrowKeys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"];
    const handleRotateFine = (event: KeyboardEvent) => {
      if (!arrowKeys.includes(event.key)) return;
      if (!event.ctrlKey && !event.metaKey) return;
      if (!event.shiftKey) return;
      if (event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, [contenteditable='true']")) return;
      if (editMode !== "models" && editMode !== "decor") return;
      if (!activeModelId) return;
      event.preventDefault();
      const delta = (Math.PI / 180) * 15;
      let dy = 0;
      switch (event.key) {
        case "ArrowLeft":
          dy = delta;
          break;
        case "ArrowRight":
          dy = -delta;
          break;
        default:
          return;
      }
      beginTheaterHistoryTransaction();
      rotateActiveModelFine(dy);
      endTheaterHistoryTransaction();
    };
    window.addEventListener("keydown", handleRotateFine);
    return () => window.removeEventListener("keydown", handleRotateFine);
  }, [
    activeModelId,
    beginTheaterHistoryTransaction,
    editMode,
    endTheaterHistoryTransaction,
    rotateActiveModelFine,
  ]);

  useEffect(() => {
    const handleSelectAll = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (!isTheaterPhysicalKey(event, "KeyA", "a")) return;
      if (isTheaterEditableTarget(event.target)) return;
      if (!isInsideTheaterUi(event.target)) return;
      event.preventDefault();
      event.stopPropagation();
      selectAllVisibleInEditMode();
    };
    window.addEventListener("keydown", handleSelectAll, true);
    return () => window.removeEventListener("keydown", handleSelectAll, true);
  }, [selectAllVisibleInEditMode]);

  useEffect(() => {
    const handleClear = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isTheaterEditableTarget(event.target)) return;
      if (!isTheaterPageActive()) return;
      event.preventDefault();
      clearSceneSelection();
    };

    window.addEventListener("keydown", handleClear, true);
    return () => window.removeEventListener("keydown", handleClear, true);
  }, [clearSceneSelection]);
}
