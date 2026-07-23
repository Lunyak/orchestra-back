import { useCallback, useMemo, useRef, useState } from "react";
import type { ScriptScene, TheaterLayout, TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import { isTheaterDecorModel } from "../model/theater-decor-catalog";
import {
  buildSceneOutlinerGroups,
  type SceneOutlinerItem,
} from "../model/theater-scene-outliner";
import {
  requestTheaterCameraFocus,
  requestTheaterScenePulse,
  resolveOutlinerCameraFocus,
} from "../model/theater-camera-focus";
import { setModelsVisibilityBySelection } from "../model/theater-model-align";
import { setSpotlightsVisibilityByIds } from "../model/theater-spotlight-selection";
import type { TheaterEditMode } from "./use-theater-selection";
import type { TheaterViewPrefs } from "../model/theater-view-prefs-storage";

export type UseTheaterSceneOutlinerArgs = {
  layout: TheaterLayout;
  layoutDoors: ReturnType<typeof import("../model/theater-doors").resolveLayoutDoors>;
  displaySpotlights: TheaterSpotlight[];
  models: TheaterModel[];
  visibleModels: TheaterModel[];
  visibleSpotlights: TheaterSpotlight[];
  ensureSpotlights: () => TheaterSpotlight[];
  updateSpotlights: (next: TheaterSpotlight[]) => void;
  updateSpotlight: (id: number, patch: Partial<TheaterSpotlight>) => void;
  updateModels: (next: TheaterModel[]) => void;
  updateModel: (id: number, patch: Partial<TheaterModel>) => void;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  setDecorActionMessage: (message: string | null) => void;
  activeTab: TheaterViewPrefs["activeTab"];
  editMode: TheaterEditMode;
  setEditMode: (mode: TheaterEditMode) => void;
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
  activeSpotlightId: number | undefined;
  activeModelId: number | undefined;
  multiSelectedSpotlightIds: number[];
  multiSelectedModelIds: number[];
  setMultiSelectedSpotlightIds: (ids: number[]) => void;
  setMultiSelectedModelIds: (ids: number[]) => void;
  selectTheaterSpotlight: (id: number, additive?: boolean) => void;
  selectTheaterModel: (id: number, additive?: boolean) => void;
  setActiveDoorId: (id: number | undefined) => void;
  setLayoutOutlineFocused: (value: boolean) => void;
  layoutOutlineFocused: boolean;
  setAudienceSeatsFocused: (value: boolean) => void;
  audienceSeatsFocused: boolean;
  setStageGridFocused: (value: boolean) => void;
  stageGridFocused: boolean;
  decorPlaceMode: boolean;
  setDecorPlaceMode: (value: boolean) => void;
  exitDecorPlaceMode: () => void;
  setIsDragging: (value: boolean) => void;
  setActiveAlignGuides: (guides: import("../model/theater-align-guides").ActiveAlignGuide[]) => void;
};

export function useTheaterSceneOutliner({
  layout,
  layoutDoors,
  displaySpotlights,
  models,
  visibleModels,
  visibleSpotlights,
  ensureSpotlights,
  updateSpotlights,
  updateSpotlight,
  updateModels,
  updateModel,
  updateCurrentScene,
  setDecorActionMessage,
  activeTab,
  editMode,
  setEditMode,
  setActiveTab,
  activeSpotlightId,
  activeModelId,
  multiSelectedSpotlightIds,
  multiSelectedModelIds,
  setMultiSelectedSpotlightIds,
  setMultiSelectedModelIds,
  selectTheaterSpotlight,
  selectTheaterModel,
  setActiveDoorId,
  setLayoutOutlineFocused,
  layoutOutlineFocused,
  setAudienceSeatsFocused,
  audienceSeatsFocused,
  setStageGridFocused,
  stageGridFocused,
  decorPlaceMode,
  setDecorPlaceMode,
  exitDecorPlaceMode,
  setIsDragging,
  setActiveAlignGuides,
}: UseTheaterSceneOutlinerArgs) {
  const [pulseTarget, setPulseTarget] = useState<{
    kind: SceneOutlinerItem["kind"];
    id: number;
  } | null>(null);
  const pulseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sceneOutlinerGroups = useMemo(
    () =>
      buildSceneOutlinerGroups({
        spotlights: displaySpotlights,
        models,
        doors: layoutDoors,
        layout,
      }),
    [displaySpotlights, layout, layoutDoors, models],
  );

  const selectAllVisibleInEditMode = useCallback(() => {
    const tab =
      activeTab === "navigate"
        ? editMode
        : activeTab === "view" || activeTab === "layout"
          ? null
          : activeTab;
    if (tab === "spotlights") {
      const ids = visibleSpotlights.map((item) => item.id);
      if (ids.length === 0) return;
      setMultiSelectedSpotlightIds(ids);
      updateCurrentScene({ theaterActiveSpotlightId: ids[0] });
      setDecorActionMessage(`Выбрано софитов: ${ids.length}`);
      return;
    }
    if (tab === "models") {
      const ids = visibleModels
        .filter((item) => !isTheaterDecorModel(item))
        .map((item) => item.id);
      if (ids.length === 0) return;
      setMultiSelectedModelIds(ids);
      updateCurrentScene({ theaterActiveModelId: ids[0] });
      setEditMode("models");
      setDecorActionMessage(`Выбрано объектов: ${ids.length}`);
      return;
    }
    if (tab === "decor") {
      const ids = visibleModels
        .filter((item) => isTheaterDecorModel(item))
        .map((item) => item.id);
      if (ids.length === 0) return;
      setMultiSelectedModelIds(ids);
      updateCurrentScene({ theaterActiveModelId: ids[0] });
      setEditMode("decor");
      setDecorActionMessage(`Выбрано объектов: ${ids.length}`);
    }
  }, [
    activeTab,
    editMode,
    setEditMode,
    setDecorActionMessage,
    setMultiSelectedModelIds,
    setMultiSelectedSpotlightIds,
    updateCurrentScene,
    visibleModels,
    visibleSpotlights,
  ]);

  const revealAllHiddenInScene = useCallback(() => {
    const hiddenModels = models.some((item) => item.hidden);
    const base = ensureSpotlights();
    const hiddenSpotlights = base.some((item) => item.hidden);
    if (!hiddenModels && !hiddenSpotlights) {
      setDecorActionMessage("Скрытых объектов нет");
      return;
    }
    if (hiddenModels) {
      updateModels(
        models.map((item) => (item.hidden ? { ...item, hidden: false } : item)),
      );
    }
    if (hiddenSpotlights) {
      updateSpotlights(
        base.map((item) => (item.hidden ? { ...item, hidden: false } : item)),
      );
    }
    setDecorActionMessage("Все скрытые объекты показаны");
  }, [ensureSpotlights, models, setDecorActionMessage, updateModels, updateSpotlights]);

  const isolateSceneSelection = useCallback(() => {
    if (editMode === "spotlights") {
      const keepIds =
        multiSelectedSpotlightIds.length > 0
          ? multiSelectedSpotlightIds
          : activeSpotlightId != null
            ? [activeSpotlightId]
            : [];
      if (keepIds.length === 0) return;
      const keep = new Set(keepIds);
      updateSpotlights(
        ensureSpotlights().map((item) => ({ ...item, hidden: !keep.has(item.id) })),
      );
      setDecorActionMessage(`Изолировано софитов: ${keep.size}`);
      return;
    }
    if (editMode === "models" || editMode === "decor") {
      const keepIds =
        multiSelectedModelIds.length > 0
          ? multiSelectedModelIds
          : activeModelId != null
            ? [activeModelId]
            : [];
      if (keepIds.length === 0) return;
      const keep = new Set(keepIds);
      updateModels(
        models.map((item) => ({ ...item, hidden: !keep.has(item.id) })),
      );
      setDecorActionMessage(`Изолировано объектов: ${keep.size}`);
    }
  }, [
    activeModelId,
    activeSpotlightId,
    editMode,
    ensureSpotlights,
    models,
    multiSelectedModelIds,
    multiSelectedSpotlightIds,
    setDecorActionMessage,
    updateModels,
    updateSpotlights,
  ]);

  const focusLayoutHall = useCallback(() => {
    setMultiSelectedSpotlightIds([]);
    setMultiSelectedModelIds([]);
    updateCurrentScene({
      theaterActiveSpotlightId: undefined,
      theaterActiveModelId: undefined,
    });
    if (decorPlaceMode) setDecorPlaceMode(false);
    setActiveDoorId(undefined);
    setAudienceSeatsFocused(false);
    setStageGridFocused(false);
    setLayoutOutlineFocused(true);
    setActiveTab("layout");
  }, [
    decorPlaceMode,
    setActiveDoorId,
    setActiveTab,
    setAudienceSeatsFocused,
    setDecorPlaceMode,
    setLayoutOutlineFocused,
    setMultiSelectedModelIds,
    setMultiSelectedSpotlightIds,
    setStageGridFocused,
    updateCurrentScene,
  ]);

  const focusAudienceSeats = useCallback(() => {
    setMultiSelectedSpotlightIds([]);
    setMultiSelectedModelIds([]);
    updateCurrentScene({
      theaterActiveSpotlightId: undefined,
      theaterActiveModelId: undefined,
    });
    if (decorPlaceMode) setDecorPlaceMode(false);
    setActiveDoorId(undefined);
    setLayoutOutlineFocused(false);
    setStageGridFocused(false);
    setAudienceSeatsFocused(true);
    setActiveTab("layout");
  }, [
    decorPlaceMode,
    setActiveDoorId,
    setActiveTab,
    setAudienceSeatsFocused,
    setDecorPlaceMode,
    setLayoutOutlineFocused,
    setMultiSelectedModelIds,
    setMultiSelectedSpotlightIds,
    setStageGridFocused,
    updateCurrentScene,
  ]);

  const focusStageGrid = useCallback(() => {
    setMultiSelectedSpotlightIds([]);
    setMultiSelectedModelIds([]);
    updateCurrentScene({
      theaterActiveSpotlightId: undefined,
      theaterActiveModelId: undefined,
    });
    if (decorPlaceMode) setDecorPlaceMode(false);
    setActiveDoorId(undefined);
    setLayoutOutlineFocused(false);
    setAudienceSeatsFocused(false);
    setStageGridFocused(true);
    setActiveTab("layout");
  }, [
    decorPlaceMode,
    setActiveDoorId,
    setActiveTab,
    setAudienceSeatsFocused,
    setDecorPlaceMode,
    setLayoutOutlineFocused,
    setMultiSelectedModelIds,
    setMultiSelectedSpotlightIds,
    setStageGridFocused,
    updateCurrentScene,
  ]);

  const focusSceneOutlinerItem = useCallback(
    (item: SceneOutlinerItem, additive = false) => {
      const cameraFocus = resolveOutlinerCameraFocus(item, {
        spotlights: displaySpotlights,
        models,
        doors: layoutDoors,
        layout,
      });
      if (cameraFocus) {
        requestTheaterCameraFocus(cameraFocus);
      }
      requestTheaterScenePulse({ kind: item.kind, id: item.id });
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
      setPulseTarget({ kind: item.kind, id: item.id });
      pulseTimerRef.current = setTimeout(() => {
        setPulseTarget(null);
        pulseTimerRef.current = null;
      }, 1400);

      switch (item.kind) {
        case "spotlight":
          setLayoutOutlineFocused(false);
          setAudienceSeatsFocused(false);
          setStageGridFocused(false);
          selectTheaterSpotlight(item.id, additive);
          return;
        case "model":
          setLayoutOutlineFocused(false);
          setAudienceSeatsFocused(false);
          setStageGridFocused(false);
          setActiveTab("models");
          setEditMode("models");
          selectTheaterModel(item.id, additive);
          return;
        case "decor":
          setLayoutOutlineFocused(false);
          setAudienceSeatsFocused(false);
          setStageGridFocused(false);
          setActiveTab("decor");
          setEditMode("decor");
          exitDecorPlaceMode();
          selectTheaterModel(item.id, additive);
          return;
        case "door":
          setLayoutOutlineFocused(false);
          setAudienceSeatsFocused(false);
          setStageGridFocused(false);
          setActiveTab("layout");
          setActiveDoorId(item.id);
          return;
        case "layout":
          if (item.id === 1) focusAudienceSeats();
          else if (item.id === 2) focusStageGrid();
          else focusLayoutHall();
          return;
        default:
          return;
      }
    },
    [
      displaySpotlights,
      exitDecorPlaceMode,
      focusAudienceSeats,
      focusLayoutHall,
      focusStageGrid,
      layout,
      layoutDoors,
      models,
      selectTheaterModel,
      selectTheaterSpotlight,
      setActiveDoorId,
      setActiveTab,
      setAudienceSeatsFocused,
      setEditMode,
      setLayoutOutlineFocused,
      setStageGridFocused,
    ],
  );

  const clearSceneSelection = useCallback(() => {
    setIsDragging(false);
    setActiveAlignGuides([]);

    if (activeSpotlightId != null || multiSelectedSpotlightIds.length > 0) {
      setMultiSelectedSpotlightIds([]);
      updateCurrentScene({ theaterActiveSpotlightId: undefined });
    }

    if (activeModelId != null || multiSelectedModelIds.length > 0) {
      setMultiSelectedModelIds([]);
      updateCurrentScene({ theaterActiveModelId: undefined });
    }

    if (decorPlaceMode) setDecorPlaceMode(false);
    if (layoutOutlineFocused) setLayoutOutlineFocused(false);
    if (audienceSeatsFocused) setAudienceSeatsFocused(false);
    if (stageGridFocused) setStageGridFocused(false);
  }, [
    activeModelId,
    activeSpotlightId,
    audienceSeatsFocused,
    decorPlaceMode,
    layoutOutlineFocused,
    multiSelectedModelIds.length,
    multiSelectedSpotlightIds.length,
    setActiveAlignGuides,
    setAudienceSeatsFocused,
    setDecorPlaceMode,
    setIsDragging,
    setLayoutOutlineFocused,
    setMultiSelectedModelIds,
    setMultiSelectedSpotlightIds,
    setStageGridFocused,
    stageGridFocused,
    updateCurrentScene,
  ]);

  const toggleSceneOutlinerVisibility = useCallback(
    (item: SceneOutlinerItem) => {
      if (item.kind === "spotlight") {
        updateSpotlight(item.id, { hidden: item.hidden !== true });
        return;
      }
      if (item.kind === "model" || item.kind === "decor") {
        updateModel(item.id, { hidden: item.hidden !== true });
      }
    },
    [updateModel, updateSpotlight],
  );

  const setSceneOutlinerGroupVisibility = useCallback(
    (groupId: string, visible: boolean) => {
      const group = sceneOutlinerGroups.find((item) => item.id === groupId);
      if (!group) return;
      const hideableIds = new Set(
        group.items.filter((item) => item.canHide).map((item) => item.id),
      );
      if (hideableIds.size === 0) return;

      if (groupId === "spotlights") {
        const base = ensureSpotlights();
        updateSpotlights(
          base.map((item) =>
            hideableIds.has(item.id)
              ? { ...item, hidden: visible ? false : true }
              : item,
          ),
        );
      } else {
        updateModels(
          models.map((item) =>
            hideableIds.has(item.id)
              ? { ...item, hidden: visible ? false : true }
              : item,
          ),
        );
      }
      setDecorActionMessage(visible ? "Группа показана в 3D" : "Группа скрыта в 3D");
    },
    [
      ensureSpotlights,
      models,
      sceneOutlinerGroups,
      setDecorActionMessage,
      updateModels,
      updateSpotlights,
    ],
  );

  const toggleActiveSceneVisibility = useCallback(() => {
    if (editMode === "spotlights") {
      if (multiSelectedSpotlightIds.length > 1) {
        const anyVisible = multiSelectedSpotlightIds.some((id) => {
          const item = displaySpotlights.find((spotlight) => spotlight.id === id);
          return item?.hidden !== true;
        });
        updateSpotlights(
          setSpotlightsVisibilityByIds(
            ensureSpotlights(),
            multiSelectedSpotlightIds,
            anyVisible,
          ),
        );
        return;
      }
      if (activeSpotlightId != null) {
        const item = displaySpotlights.find((spotlight) => spotlight.id === activeSpotlightId);
        updateSpotlight(activeSpotlightId, { hidden: item?.hidden !== true });
      }
      return;
    }
    if (editMode === "models" || editMode === "decor") {
      if (multiSelectedModelIds.length > 1) {
        const anyVisible = multiSelectedModelIds.some((id) => {
          const item = models.find((model) => model.id === id);
          return item?.hidden !== true;
        });
        updateModels(
          setModelsVisibilityBySelection(
            models,
            multiSelectedModelIds,
            anyVisible,
          ),
        );
        return;
      }
      if (activeModelId != null) {
        const item = models.find((model) => model.id === activeModelId);
        updateModel(activeModelId, { hidden: item?.hidden !== true });
      }
    }
  }, [
    activeModelId,
    activeSpotlightId,
    displaySpotlights,
    editMode,
    ensureSpotlights,
    models,
    multiSelectedModelIds,
    multiSelectedSpotlightIds,
    updateModel,
    updateSpotlight,
    updateModels,
    updateSpotlights,
  ]);

  return {
    pulseTarget,
    sceneOutlinerGroups,
    selectAllVisibleInEditMode,
    revealAllHiddenInScene,
    isolateSceneSelection,
    focusSceneOutlinerItem,
    focusLayoutHall,
    focusAudienceSeats,
    focusStageGrid,
    clearSceneSelection,
    toggleSceneOutlinerVisibility,
    setSceneOutlinerGroupVisibility,
    toggleActiveSceneVisibility,
  };
}
