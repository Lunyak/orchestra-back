import { useCallback, useEffect, useRef, useState } from "react";
import type { ScriptScene } from "../../../shared/types/script";
import type { TheaterViewPrefs } from "../model/theater-view-prefs-storage";

export type TheaterEditMode = "spotlights" | "models" | "decor";

export type UseTheaterSelectionArgs = {
  currentScene: ScriptScene | undefined;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
};

export function useTheaterSelection({
  currentScene,
  updateCurrentScene,
  setActiveTab,
}: UseTheaterSelectionArgs) {
  const [editMode, setEditMode] = useState<TheaterEditMode>("spotlights");
  const [dragMode, setDragMode] = useState<"target" | "source" | null>("target");
  const [multiSelectedModelIds, setMultiSelectedModelIds] = useState<number[]>([]);
  const [multiSelectedSpotlightIds, setMultiSelectedSpotlightIds] = useState<number[]>([]);

  const activeSpotlightId = currentScene?.theaterActiveSpotlightId;
  const activeModelId = currentScene?.theaterActiveModelId;
  const selectionSceneIdRef = useRef(currentScene?.id);

  useEffect(() => {
    const sceneChanged = selectionSceneIdRef.current !== currentScene?.id;
    selectionSceneIdRef.current = currentScene?.id;
    if (activeModelId == null) {
      setMultiSelectedModelIds([]);
      return;
    }
    if (sceneChanged) {
      setMultiSelectedModelIds([activeModelId]);
      return;
    }
    setMultiSelectedModelIds((prev) =>
      prev.includes(activeModelId) ? prev : [activeModelId],
    );
  }, [activeModelId, currentScene?.id]);

  useEffect(() => {
    if (activeSpotlightId != null) {
      setMultiSelectedSpotlightIds([activeSpotlightId]);
    } else {
      setMultiSelectedSpotlightIds([]);
    }
  }, [activeSpotlightId, currentScene?.id]);

  const selectTheaterModel = useCallback(
    (id: number, additive = false) => {
      if (additive) {
        setMultiSelectedModelIds((prev) => {
          const has = prev.includes(id);
          const next = has ? prev.filter((item) => item !== id) : [...prev, id];
          return next.length > 0 ? next : [id];
        });
      } else {
        setMultiSelectedModelIds([id]);
      }
      updateCurrentScene({ theaterActiveModelId: id });
    },
    [updateCurrentScene],
  );

  const selectTheaterSpotlight = useCallback(
    (id: number, additive = false, options?: { switchTab?: boolean }) => {
      const shouldSwitchTab = options?.switchTab !== false;
      if (additive) {
        setMultiSelectedSpotlightIds((prev) => {
          const has = prev.includes(id);
          const next = has ? prev.filter((item) => item !== id) : [...prev, id];
          return next.length > 0 ? next : [id];
        });
      } else {
        setMultiSelectedSpotlightIds([id]);
      }
      if (shouldSwitchTab) {
        setActiveTab("spotlights");
      }
      setEditMode("spotlights");
      updateCurrentScene({ theaterActiveSpotlightId: id });
    },
    [setActiveTab, updateCurrentScene],
  );

  return {
    editMode,
    setEditMode,
    dragMode,
    setDragMode,
    activeSpotlightId,
    activeModelId,
    multiSelectedModelIds,
    setMultiSelectedModelIds,
    multiSelectedSpotlightIds,
    setMultiSelectedSpotlightIds,
    selectTheaterModel,
    selectTheaterSpotlight,
  };
}
