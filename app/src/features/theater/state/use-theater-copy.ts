import { useCallback } from "react";
import type {
  ScriptScene,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { isTheaterDecorModel } from "../model/theater-decor-catalog";
import { findKadrById, readSceneLightKadrs, upsertKadrInScene } from "../model/light-kadrs";
import { kadrDisplayTitle } from "../model/kadr-store";
import {
  resolveAdjacentSceneIndex,
  type TheaterAdjacentSceneDirection,
} from "../model/theater-model-clone";
import { isTheaterPersonModel } from "../model/theater-model-builtin";
import {
  buildCopiedTheaterScenePatch,
  buildCopiedTheaterSnapshot,
  formatTheaterCopyCategories,
  readTheaterSnapshotCopySource,
  resolveTheaterCopySource,
  type TheaterCopySetOptions,
} from "../model/theater-copy-set";
import { readSceneTheaterModels } from "../model/theater-scene-models";
import { DEFAULT_SPOTLIGHTS } from "../model/theater-defaults";

type UseTheaterCopyArgs = {
  currentPage: number;
  currentScene: ScriptScene | undefined;
  scenes: ScriptScene[];
  updateScene: (sceneId: number, patch: Partial<ScriptScene>) => void;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  recordTheaterHistory: () => void;
  layout: TheaterLayout;
  models: TheaterModel[];
  displaySpotlights: TheaterSpotlight[];
  activeModelId: number | undefined;
  activeSpotlightId: number | undefined;
  multiSelectedModelIds: number[];
  multiSelectedSpotlightIds: number[];
  updateModels: (next: TheaterModel[]) => void;
  updateSpotlights: (next: TheaterSpotlight[]) => void;
  setMultiSelectedModelIds: (ids: number[]) => void;
  setMultiSelectedSpotlightIds: (ids: number[]) => void;
  setDecorActionMessage: (message: string | null) => void;
  saveScenes: (options?: { force?: boolean }) => Promise<void>;
};

function sceneTitle(scene: ScriptScene | undefined, index: number): string {
  return scene?.title?.trim() || `сцена ${index + 1}`;
}

export function useTheaterCopy({
  currentPage,
  currentScene,
  scenes,
  updateScene,
  updateCurrentScene,
  recordTheaterHistory,
  layout,
  models,
  displaySpotlights,
  activeModelId,
  activeSpotlightId,
  multiSelectedModelIds,
  multiSelectedSpotlightIds,
  updateModels,
  updateSpotlights,
  setMultiSelectedModelIds,
  setMultiSelectedSpotlightIds,
  setDecorActionMessage,
  saveScenes,
}: UseTheaterCopyArgs) {
  const resolveLiveSource = useCallback(
    (options: TheaterCopySetOptions) => {
      const selectedModelIds =
        multiSelectedModelIds.length > 0
          ? multiSelectedModelIds
          : activeModelId != null
            ? [activeModelId]
            : [];
      const selectedSpotlightIds =
        multiSelectedSpotlightIds.length > 0
          ? multiSelectedSpotlightIds
          : activeSpotlightId != null
            ? [activeSpotlightId]
            : [];
      return resolveTheaterCopySource({
        models,
        spotlights: displaySpotlights,
        categories: options.categories,
        scope: options.scope,
        selectedModelIds,
        selectedSpotlightIds,
      });
    },
    [
      activeModelId,
      activeSpotlightId,
      displaySpotlights,
      models,
      multiSelectedModelIds,
      multiSelectedSpotlightIds,
    ],
  );

  const copyTheaterSetToAdjacentScene = useCallback(
    (direction: TheaterAdjacentSceneDirection, options: TheaterCopySetOptions) => {
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
      const source = resolveLiveSource(options);
      const mode = options.scope === "selected" ? "append" : "replace";
      const { patch, appliedCategories } = buildCopiedTheaterScenePatch({
        targetScene,
        sourceModels: source.models,
        sourceSpotlights: source.spotlights,
        categories: options.categories,
        mode,
        layout,
        skipEmptyCategories: true,
      });
      if (appliedCategories.length === 0) {
        setDecorActionMessage(
          options.scope === "selected"
            ? "Нет выбранных объектов для копирования"
            : "Нечего копировать",
        );
        return;
      }
      updateScene(targetScene.id, patch);
      const scopeLabel = formatTheaterCopyCategories(appliedCategories);
      const targetTitle = sceneTitle(targetScene, targetIndex);
      setDecorActionMessage(`${scopeLabel} скопированы на «${targetTitle}»`);
    },
    [
      currentPage,
      currentScene,
      layout,
      resolveLiveSource,
      scenes,
      setDecorActionMessage,
      updateScene,
    ],
  );

  const applyTheaterSetFromAdjacentScene = useCallback(
    (direction: TheaterAdjacentSceneDirection, options: TheaterCopySetOptions) => {
      if (!currentScene) return;
      const sourceIndex = resolveAdjacentSceneIndex(
        currentPage,
        scenes.length,
        direction,
      );
      if (sourceIndex == null) {
        setDecorActionMessage(
          direction === "previous" ? "Нет предыдущей сцены" : "Нет следующей сцены",
        );
        return;
      }
      const sourceScene = scenes[sourceIndex];
      if (!sourceScene) {
        setDecorActionMessage(
          direction === "previous" ? "Нет предыдущей сцены" : "Нет следующей сцены",
        );
        return;
      }
      const { patch, appliedCategories } = buildCopiedTheaterScenePatch({
        targetScene: currentScene,
        sourceModels: readSceneTheaterModels(sourceScene),
        sourceSpotlights: sourceScene.theaterSpotlights ?? DEFAULT_SPOTLIGHTS,
        categories: options.categories,
        mode: "replace",
        layout,
        skipEmptyCategories: true,
      });
      if (appliedCategories.length === 0) {
        setDecorActionMessage("На соседней сцене нечего брать");
        return;
      }
      recordTheaterHistory();
      updateCurrentScene(patch);
      const scopeLabel = formatTheaterCopyCategories(appliedCategories);
      const sourceTitle = sceneTitle(sourceScene, sourceIndex);
      setDecorActionMessage(`${scopeLabel} взяты с «${sourceTitle}»`);
    },
    [
      currentPage,
      currentScene,
      layout,
      recordTheaterHistory,
      scenes,
      setDecorActionMessage,
      updateCurrentScene,
    ],
  );

  const writeTheaterSetToKadr = useCallback(
    (kadrId: string, options: TheaterCopySetOptions) => {
      if (!currentScene) return;
      const kadrs = readSceneLightKadrs(currentScene);
      const kadr = findKadrById(kadrs, kadrId);
      if (!kadr) {
        setDecorActionMessage("Картина не найдена");
        return;
      }
      const source = resolveLiveSource(options);
      const mode = options.scope === "selected" ? "append" : "replace";
      const { snapshot, appliedCategories } = buildCopiedTheaterSnapshot({
        snapshot: kadr.theaterSnapshot,
        sourceModels: source.models,
        sourceSpotlights: source.spotlights,
        categories: options.categories,
        mode,
        skipEmptyCategories: true,
      });
      if (appliedCategories.length === 0) {
        setDecorActionMessage(
          options.scope === "selected"
            ? "Нет выбранных объектов для записи"
            : "Нечего записать на картину",
        );
        return;
      }
      const nextKadrs = upsertKadrInScene({
        kadrs,
        kadr: {
          ...kadr,
          theaterSnapshot: snapshot,
          updatedAt: new Date().toISOString(),
        },
      });
      updateScene(currentScene.id, { lightKadrs: nextKadrs });
      const scopeLabel = formatTheaterCopyCategories(appliedCategories);
      setDecorActionMessage(
        `${scopeLabel} записаны в «${kadrDisplayTitle(kadr)}»`,
      );
    },
    [
      currentScene,
      resolveLiveSource,
      setDecorActionMessage,
      updateScene,
    ],
  );

  const applyTheaterSetFromKadr = useCallback(
    (kadrId: string, options: TheaterCopySetOptions) => {
      if (!currentScene) return;
      const kadrs = readSceneLightKadrs(currentScene);
      const kadr = findKadrById(kadrs, kadrId);
      if (!kadr) {
        setDecorActionMessage("Картина не найдена");
        return;
      }
      const snapshotSource = readTheaterSnapshotCopySource(kadr.theaterSnapshot);
      const { patch, appliedCategories } = buildCopiedTheaterScenePatch({
        targetScene: currentScene,
        sourceModels: snapshotSource.models,
        sourceSpotlights: snapshotSource.spotlights,
        categories: options.categories,
        mode: "replace",
        layout,
        skipEmptyCategories: true,
      });
      if (appliedCategories.length === 0) {
        setDecorActionMessage("У картины нет мизансцены для выбранных категорий");
        return;
      }
      recordTheaterHistory();
      updateCurrentScene(patch);
      const scopeLabel = formatTheaterCopyCategories(appliedCategories);
      setDecorActionMessage(
        `${scopeLabel} взяты с «${kadrDisplayTitle(kadr)}»`,
      );
    },
    [
      currentScene,
      layout,
      recordTheaterHistory,
      setDecorActionMessage,
      updateCurrentScene,
    ],
  );

  const clearTheaterFurniture = useCallback(() => {
    if (!currentScene) return;
    const furniture = models.filter(
      (item) => !isTheaterDecorModel(item) && !isTheaterPersonModel(item),
    );
    if (furniture.length === 0) {
      setDecorActionMessage("Мебели нет");
      return;
    }
    const nextModels = models.filter(
      (item) => isTheaterDecorModel(item) || isTheaterPersonModel(item),
    );
    updateModels(nextModels);
    const nextActiveId = nextModels[0]?.id;
    updateCurrentScene({ theaterActiveModelId: nextActiveId });
    setMultiSelectedModelIds(nextActiveId != null ? [nextActiveId] : []);
    setDecorActionMessage(`Мебель удалена (${furniture.length})`);
    void saveScenes({ force: true });
  }, [
    currentScene,
    models,
    saveScenes,
    setDecorActionMessage,
    setMultiSelectedModelIds,
    updateCurrentScene,
    updateModels,
  ]);

  const clearTheaterSpotlights = useCallback(() => {
    if (!currentScene) return;
    if (displaySpotlights.length === 0) {
      setDecorActionMessage("Софитов нет");
      return;
    }
    const removedCount = displaySpotlights.length;
    updateSpotlights([]);
    updateCurrentScene({ theaterActiveSpotlightId: undefined });
    setMultiSelectedSpotlightIds([]);
    setDecorActionMessage(`Софиты удалены (${removedCount})`);
  }, [
    currentScene,
    displaySpotlights.length,
    setDecorActionMessage,
    setMultiSelectedSpotlightIds,
    updateCurrentScene,
    updateSpotlights,
  ]);

  return {
    copyTheaterSetToAdjacentScene,
    applyTheaterSetFromAdjacentScene,
    writeTheaterSetToKadr,
    applyTheaterSetFromKadr,
    clearTheaterFurniture,
    clearTheaterSpotlights,
  };
}
