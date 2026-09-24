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
  buildTheaterSnapshotFromSet,
  writeTheaterSnapshotOntoKadr,
} from "../model/kadr-theater-snapshot";
import { buildSceneKadrTape, type SceneKadrTapeItem } from "../model/scene-kadr-tape";
import {
  getTheaterActiveKadrId,
  replaceTheaterKadrDraft,
  useTheaterKadrDraftModels,
} from "../model/theater-active-kadr";
import type { TheaterAdjacentSceneDirection } from "../model/theater-model-clone";
import { isTheaterPersonModel } from "../model/theater-model-builtin";
import {
  applyTheaterCopyToScene,
  buildCopiedTheaterScenePatch,
  buildCopiedTheaterSnapshot,
  formatTheaterCopyCategories,
  readTheaterSnapshotCopySource,
  resolveActiveCopyCategories,
  resolveTheaterCopySource,
  type TheaterCopySetOptions,
} from "../model/theater-copy-set";
import { readSceneTheaterModels } from "../model/theater-scene-models";

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

function pictureTitle(item: SceneKadrTapeItem): string {
  return item.isPlaceholder ? item.sceneTitle : item.headingTitle;
}

function findCurrentPictureIndex(
  tape: SceneKadrTapeItem[],
  currentPage: number,
): number {
  const activeId = getTheaterActiveKadrId();
  if (activeId) {
    const activeIndex = tape.findIndex((item) => item.kadrId === activeId);
    if (activeIndex >= 0) return activeIndex;
  }
  return tape.findIndex(
    (item) => item.sceneIndex === currentPage && item.isPlaceholder,
  );
}

function readPictureSet(
  scenes: ScriptScene[],
  item: SceneKadrTapeItem,
): { models: TheaterModel[]; spotlights: TheaterSpotlight[] } {
  const scene = scenes[item.sceneIndex];
  if (!scene) return { models: [], spotlights: [] };
  if (item.kadrId) {
    const kadr = findKadrById(readSceneLightKadrs(scene), item.kadrId);
    if (kadr?.theaterSnapshot) {
      return readTheaterSnapshotCopySource(kadr.theaterSnapshot);
    }
  }
  return {
    models: readSceneTheaterModels(scene),
    spotlights: scene.theaterSpotlights ?? [],
  };
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
  useTheaterKadrDraftModels();
  const tape = buildSceneKadrTape(scenes);
  const currentPictureIndex = findCurrentPictureIndex(tape, currentPage);
  const previousPicture =
    currentPictureIndex > 0 ? tape[currentPictureIndex - 1] : undefined;
  const nextPicture =
    currentPictureIndex >= 0 ? tape[currentPictureIndex + 1] : undefined;

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

  const writeOntoPicture = useCallback(
    (
      item: SceneKadrTapeItem,
      sourceModels: TheaterModel[],
      sourceSpotlights: TheaterSpotlight[],
      options: TheaterCopySetOptions,
      mode: "replace" | "append",
    ) => {
      const scene = scenes[item.sceneIndex];
      if (!scene) return [];
      const base = readPictureSet(scenes, item);
      const appliedCategories = resolveActiveCopyCategories({
        categories: options.categories,
        sourceModels,
        sourceSpotlights,
        skipEmptyCategories: true,
      });
      if (appliedCategories.length === 0) return [];
      const merged = applyTheaterCopyToScene({
        targetModels: base.models,
        targetSpotlights: base.spotlights,
        sourceModels,
        sourceSpotlights,
        categories: appliedCategories,
        mode,
      });
      if (item.kadrId) {
        const lightKadrs = writeTheaterSnapshotOntoKadr(
          scene,
          item.kadrId,
          buildTheaterSnapshotFromSet({
            models: merged.models,
            spotlights: merged.spotlights,
            smokeEnabled: scene.theaterSmokeMachine === true,
          }),
        );
        if (lightKadrs) updateScene(scene.id, { lightKadrs });
        return appliedCategories;
      }
      const { patch } = buildCopiedTheaterScenePatch({
        targetScene: scene,
        sourceModels,
        sourceSpotlights,
        categories: appliedCategories,
        mode,
        layout,
        skipEmptyCategories: false,
      });
      updateScene(scene.id, patch);
      return appliedCategories;
    },
    [layout, scenes, updateScene],
  );

  const copyTheaterSetToAdjacentPicture = useCallback(
    (direction: TheaterAdjacentSceneDirection, options: TheaterCopySetOptions) => {
      if (!currentScene) return;
      if (currentPictureIndex < 0) {
        setDecorActionMessage("Сначала выберите картину");
        return;
      }
      const target = direction === "previous" ? previousPicture : nextPicture;
      if (!target) {
        setDecorActionMessage(
          direction === "previous"
            ? "Нет предыдущей картины"
            : "Нет следующей картины",
        );
        return;
      }
      const source = resolveLiveSource(options);
      const mode = options.scope === "selected" ? "append" : "replace";
      const appliedCategories = writeOntoPicture(
        target,
        source.models,
        source.spotlights,
        options,
        mode,
      );
      if (appliedCategories.length === 0) {
        setDecorActionMessage(
          options.scope === "selected"
            ? "Нет выбранных объектов для копирования"
            : "Нечего копировать",
        );
        return;
      }
      const scopeLabel = formatTheaterCopyCategories(appliedCategories);
      setDecorActionMessage(
        `${scopeLabel} скопированы на «${pictureTitle(target)}»`,
      );
    },
    [
      currentPictureIndex,
      currentScene,
      nextPicture,
      previousPicture,
      resolveLiveSource,
      setDecorActionMessage,
      writeOntoPicture,
    ],
  );

  const applyTheaterSetFromAdjacentPicture = useCallback(
    (direction: TheaterAdjacentSceneDirection, options: TheaterCopySetOptions) => {
      if (!currentScene) return;
      if (currentPictureIndex < 0) {
        setDecorActionMessage("Сначала выберите картину");
        return;
      }
      const sourceItem = direction === "previous" ? previousPicture : nextPicture;
      if (!sourceItem) {
        setDecorActionMessage(
          direction === "previous"
            ? "Нет предыдущей картины"
            : "Нет следующей картины",
        );
        return;
      }
      const source = readPictureSet(scenes, sourceItem);
      const appliedCategories = resolveActiveCopyCategories({
        categories: options.categories,
        sourceModels: source.models,
        sourceSpotlights: source.spotlights,
        skipEmptyCategories: true,
      });
      if (appliedCategories.length === 0) {
        setDecorActionMessage("На соседней картине нечего брать");
        return;
      }
      const merged = applyTheaterCopyToScene({
        targetModels: models,
        targetSpotlights: displaySpotlights,
        sourceModels: source.models,
        sourceSpotlights: source.spotlights,
        categories: appliedCategories,
        mode: "replace",
      });
      const activeKadrId = getTheaterActiveKadrId();
      recordTheaterHistory();
      if (activeKadrId) {
        const lightKadrs = writeTheaterSnapshotOntoKadr(
          currentScene,
          activeKadrId,
          buildTheaterSnapshotFromSet({
            models: merged.models,
            spotlights: merged.spotlights,
            smokeEnabled: currentScene.theaterSmokeMachine === true,
          }),
        );
        replaceTheaterKadrDraft({
          models: merged.models,
          spotlights: merged.spotlights,
        });
        if (lightKadrs) updateCurrentScene({ lightKadrs });
      } else {
        const { patch } = buildCopiedTheaterScenePatch({
          targetScene: currentScene,
          sourceModels: source.models,
          sourceSpotlights: source.spotlights,
          categories: appliedCategories,
          mode: "replace",
          layout,
          skipEmptyCategories: false,
        });
        updateCurrentScene(patch);
      }
      const scopeLabel = formatTheaterCopyCategories(appliedCategories);
      setDecorActionMessage(
        `${scopeLabel} взяты с «${pictureTitle(sourceItem)}»`,
      );
    },
    [
      currentPictureIndex,
      currentScene,
      displaySpotlights,
      layout,
      models,
      nextPicture,
      previousPicture,
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
    copyHasPreviousPicture: Boolean(previousPicture),
    copyHasNextPicture: Boolean(nextPicture),
    copyTheaterSetToAdjacentPicture,
    applyTheaterSetFromAdjacentPicture,
    writeTheaterSetToKadr,
    applyTheaterSetFromKadr,
    clearTheaterFurniture,
    clearTheaterSpotlights,
  };
}
