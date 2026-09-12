import { useCallback } from "react";
import type {
  ScriptScene,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { syncSubscribedTheaterRequisites } from "../model/theater-decor-inventory";
import { buildLightPlotFromSpotlights } from "../model/theater-light-channel-link";
import { resolveTheaterModelFileUrlSync } from "../model/theater-model-asset-url";
import { normalizeTheaterModels } from "../model/theater-model-normalize";
import {
  readSceneTheaterModels,
  writeSceneTheaterModels,
} from "../model/theater-scene-models";
import { isLightTrussModel, syncMountedSpotlights } from "../model/theater-truss-mounts";
import { setLightTrussHeight } from "../model/theater-light-rig";
import {
  appendClonedTheaterModels,
  cloneTheaterModels,
  resolveAdjacentSceneIndex,
  type TheaterAdjacentSceneDirection,
} from "../model/theater-model-clone";

type UseTheaterModelsPersistenceArgs = {
  projectName: string;
  currentPage: number;
  currentScene: ScriptScene | undefined;
  scenes: ScriptScene[];
  updateScene: (sceneId: number, patch: Partial<ScriptScene>) => void;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  recordTheaterHistory: () => void;
  layout: TheaterLayout;
  displaySpotlights: TheaterSpotlight[];
  models: TheaterModel[];
  setDecorActionMessage: (message: string | null) => void;
};

export function useTheaterModelsPersistence({
  projectName,
  currentPage,
  currentScene,
  scenes,
  updateScene,
  updateCurrentScene,
  recordTheaterHistory,
  layout,
  displaySpotlights,
  models,
  setDecorActionMessage,
}: UseTheaterModelsPersistenceArgs) {
  const normalizeModels = useCallback(
    (items: TheaterModel[]) => normalizeTheaterModels(items),
    [],
  );

  const updateModels = useCallback(
    (next: TheaterModel[]) => {
      recordTheaterHistory();
      const normalizedModels = normalizeModels(next);
      const sourceSpotlights =
        currentScene?.theaterSpotlights ?? displaySpotlights;
      const nextSpotlights = syncMountedSpotlights(
        sourceSpotlights,
        normalizedModels,
      );
      const spotlightsChanged = nextSpotlights.some(
        (spotlight, index) => spotlight !== sourceSpotlights[index],
      );
      const prevRequisites = currentScene?.requisites ?? [];
      const nextRequisites = syncSubscribedTheaterRequisites(
        prevRequisites,
        normalizedModels,
      );
      const requisitesChanged = nextRequisites !== prevRequisites;
      updateCurrentScene({
        ...writeSceneTheaterModels(normalizedModels),
        ...(spotlightsChanged
          ? {
              theaterSpotlights: nextSpotlights,
              lightPlot: buildLightPlotFromSpotlights(nextSpotlights, layout),
            }
          : {}),
        ...(requisitesChanged ? { requisites: nextRequisites } : {}),
      });
    },
    [
      currentScene?.requisites,
      currentScene?.theaterSpotlights,
      displaySpotlights,
      layout,
      normalizeModels,
      recordTheaterHistory,
      updateCurrentScene,
    ],
  );

  const syncSpotlightsForModels = useCallback(
    (nextModels: TheaterModel[], mountModelId?: number) => {
      const sourceSpotlights =
        currentScene?.theaterSpotlights ?? displaySpotlights;
      const nextSpotlights = syncMountedSpotlights(
        sourceSpotlights,
        nextModels,
        mountModelId,
      );
      const hasChanges = nextSpotlights.some(
        (spotlight, index) => spotlight !== sourceSpotlights[index],
      );
      if (!hasChanges) return;
      updateCurrentScene({
        theaterSpotlights: nextSpotlights,
        lightPlot: buildLightPlotFromSpotlights(nextSpotlights, layout),
      });
    },
    [
      currentScene?.theaterSpotlights,
      displaySpotlights,
      layout,
      updateCurrentScene,
    ],
  );

  const updateModel = useCallback(
    (id: number, patch: Partial<TheaterModel>) => {
      const current = models.find((item) => item.id === id);
      const nextY = patch.position?.[1];
      const shouldSyncRigHeight =
        current != null &&
        isLightTrussModel(current) &&
        nextY != null &&
        Math.abs(nextY - current.position[1]) > 1e-4;
      if (shouldSyncRigHeight) {
        const withPatch = models.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        );
        updateModels(setLightTrussHeight(withPatch, nextY));
        return;
      }
      const nextModels = models.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      );
      updateModels(nextModels);
    },
    [models, updateModels],
  );

  const resolveModelSrc = useCallback(
    (file: string) => resolveTheaterModelFileUrlSync(projectName, file) ?? "",
    [projectName],
  );

  const previewModel = useCallback(
    (id: number, patch: Partial<TheaterModel>) => {
      if (!currentScene) return;
      updateCurrentScene(
        writeSceneTheaterModels(
          normalizeModels(
            models.map((item) =>
              item.id === id ? { ...item, ...patch } : item,
            ),
          ),
        ),
      );
    },
    [currentScene, models, normalizeModels, updateCurrentScene],
  );

  const copyModelsFromPreviousScene = () => {
    if (!currentScene || currentPage <= 0) return;
    const previous = scenes[currentPage - 1];
    const source = readSceneTheaterModels(previous);
    const cloned = cloneTheaterModels(source);
    updateModels(cloned);
    if (cloned.length > 0) {
      updateCurrentScene({ theaterActiveModelId: cloned[0].id });
    }
  };

  const copyModelsToAdjacentScene = (
    direction: TheaterAdjacentSceneDirection,
    modelIds?: number[],
  ) => {
    if (!currentScene) return;
    const targetIndex = resolveAdjacentSceneIndex(
      currentPage,
      scenes.length,
      direction,
    );
    if (targetIndex == null) {
      setDecorActionMessage(
        direction === "previous" ? "Нет предыдущей сцены" : "Нет следующей сцены",
      );
      return;
    }
    const targetScene = scenes[targetIndex];
    if (!targetScene) {
      setDecorActionMessage(
        direction === "previous" ? "Нет предыдущей сцены" : "Нет следующей сцены",
      );
      return;
    }
    const source =
      modelIds == null
        ? models
        : models.filter((item) => modelIds.includes(item.id));
    if (source.length === 0) {
      setDecorActionMessage("Нет моделей для копирования");
      return;
    }
    const existing = readSceneTheaterModels(targetScene);
    const nextModels = appendClonedTheaterModels(existing, source);
    const copiedCount = nextModels.length - existing.length;
    updateScene(targetScene.id, writeSceneTheaterModels(nextModels));
    const scope = modelIds == null ? "Все модели" : "Модели";
    const targetTitle = targetScene.title?.trim() || `сцена ${targetIndex + 1}`;
    setDecorActionMessage(
      `${scope} скопированы на «${targetTitle}» (${copiedCount})`,
    );
  };

  return {
    normalizeModels,
    updateModels,
    updateModel,
    syncSpotlightsForModels,
    resolveModelSrc,
    previewModel,
    copyModelsFromPreviousScene,
    copyModelsToAdjacentScene,
  };
}
