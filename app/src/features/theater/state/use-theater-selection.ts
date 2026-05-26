import { useCallback, useEffect, useState } from "react";
import type { ScriptStep } from "../../../shared/types/script";
import type { TheaterViewPrefs } from "../model/theater-view-prefs-storage";

export type TheaterEditMode = "spotlights" | "models" | "decor";

export type UseTheaterSelectionArgs = {
  currentStep: ScriptStep | undefined;
  updateCurrentStep: (patch: Partial<ScriptStep>) => void;
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
};

export function useTheaterSelection({
  currentStep,
  updateCurrentStep,
  setActiveTab,
}: UseTheaterSelectionArgs) {
  const [editMode, setEditMode] = useState<TheaterEditMode>("spotlights");
  const [dragMode, setDragMode] = useState<"target" | "source">("target");
  const [multiSelectedModelIds, setMultiSelectedModelIds] = useState<number[]>([]);
  const [multiSelectedSpotlightIds, setMultiSelectedSpotlightIds] = useState<number[]>([]);

  const activeSpotlightId = currentStep?.theaterActiveSpotlightId;
  const activeModelId = currentStep?.theaterActiveModelId;

  useEffect(() => {
    if (activeModelId != null) {
      setMultiSelectedModelIds([activeModelId]);
    } else {
      setMultiSelectedModelIds([]);
    }
  }, [activeModelId, currentStep?.id]);

  useEffect(() => {
    if (activeSpotlightId != null) {
      setMultiSelectedSpotlightIds([activeSpotlightId]);
    } else {
      setMultiSelectedSpotlightIds([]);
    }
  }, [activeSpotlightId, currentStep?.id]);

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
      updateCurrentStep({ theaterActiveModelId: id });
    },
    [updateCurrentStep],
  );

  const selectTheaterSpotlight = useCallback(
    (id: number, additive = false) => {
      if (additive) {
        setMultiSelectedSpotlightIds((prev) => {
          const has = prev.includes(id);
          const next = has ? prev.filter((item) => item !== id) : [...prev, id];
          return next.length > 0 ? next : [id];
        });
      } else {
        setMultiSelectedSpotlightIds([id]);
      }
      setActiveTab("spotlights");
      setEditMode("spotlights");
      updateCurrentStep({ theaterActiveSpotlightId: id });
    },
    [setActiveTab, updateCurrentStep],
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
