import { useCallback, type Dispatch, type SetStateAction } from "react";
import type { ScriptScene, TheaterModel } from "../../../shared/types/script";
import {
  alignModelsByActiveBuiltin,
  alignModelsBySelection,
  distributeModelsByActiveBuiltin,
  distributeModelsBySelection,
  setModelsVisibilityBySelection,
} from "../model/theater-model-align";
import {
  findSeatingTargetForHuman,
  seatHumanOnFurniture,
} from "../model/theater-model-seating";
import type { TheaterEditMode } from "./use-theater-selection";

type UseTheaterModelsSelectionOpsArgs = {
  currentScene: ScriptScene | undefined;
  models: TheaterModel[];
  updateModels: (next: TheaterModel[]) => void;
  activeModelId: number | undefined;
  multiSelectedModelIds: number[];
  setDecorActionMessage: (message: string | null) => void;
  setPendingSnapModelId: Dispatch<SetStateAction<number | null>>;
  setEditMode: Dispatch<SetStateAction<TheaterEditMode>>;
};

export function useTheaterModelsSelectionOps({
  currentScene,
  models,
  updateModels,
  activeModelId,
  multiSelectedModelIds,
  setDecorActionMessage,
  setPendingSnapModelId,
  setEditMode,
}: UseTheaterModelsSelectionOpsArgs) {
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
    [models, multiSelectedModelIds, setDecorActionMessage, updateModels],
  );

  const distributeSelectedModels = useCallback(
    (axis: "x" | "z") => {
      if (multiSelectedModelIds.length < 3) return;
      updateModels(distributeModelsBySelection(models, multiSelectedModelIds, axis));
      setDecorActionMessage(`Выбранные разнесены по ${axis.toUpperCase()}`);
    },
    [models, multiSelectedModelIds, setDecorActionMessage, updateModels],
  );

  const setSelectedModelsVisibility = useCallback(
    (hidden: boolean) => {
      if (multiSelectedModelIds.length === 0) return;
      updateModels(
        setModelsVisibilityBySelection(models, multiSelectedModelIds, hidden),
      );
      setDecorActionMessage(
        hidden ? "Выбранные скрыты в 3D" : "Выбранные показаны в 3D",
      );
    },
    [models, multiSelectedModelIds, setDecorActionMessage, updateModels],
  );

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
    setEditMode,
    setPendingSnapModelId,
    updateModels,
  ]);

  return {
    alignModelsByActive,
    distributeModelsByActive,
    alignSelectedModels,
    distributeSelectedModels,
    setSelectedModelsVisibility,
    seatActiveHumanOnFurniture,
  };
}
