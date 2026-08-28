import { useCallback, type MutableRefObject } from "react";
import type { ScriptScene } from "../../../shared/types/script";
import {
  deleteKadrFromSceneData,
  findKadrById,
  formatDeleteKadrConfirmMessage,
  readSceneLightKadrs,
} from "../../theater/model/light-kadrs";
import { applyKadrLook, copyKadrLookToTarget } from "../../theater/model/kadr-store";
import {
  buildCopySceneTheaterLayoutPatchFromScene,
  sceneHasTheaterLayoutContent,
} from "../../theater/model/copy-scene-theater-layout";
import type {
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import {
  createKadrFromDraft,
  updateKadrFromDraft,
  type CreateKadrDraft,
  type KadrModalMode,
} from "./create-kadr-from-draft";
import type { SpectacleTapeItem } from "./spectacle-kadr-tape";

type LiveConsoleLike = {
  faders: PlaybookLightFadersDataV1;
  programs: PlaybookLightProgramsDataV1;
  selectedLightSlot: number;
  persistFaders: (next: PlaybookLightFadersDataV1) => void;
  persistPrograms: (next: PlaybookLightProgramsDataV1) => void;
};

type MediaListItem = { id: number; title?: string };

export type UseSpectacleRunKadrActionsArgs = {
  scenes: ScriptScene[];
  tape: SpectacleTapeItem[];
  clampedIndex: number;
  currentScene: ScriptScene | null;
  currentItem: SpectacleTapeItem | null;
  lightChannels: string[];
  liveConsole: LiveConsoleLike;
  playlist: MediaListItem[] | undefined;
  sounds: MediaListItem[] | undefined;
  videos: MediaListItem[];
  holdImages: MediaListItem[];
  kadrModalMode: KadrModalMode;
  setKadrModalMode: (mode: KadrModalMode) => void;
  setKadrModalOpen: (open: boolean) => void;
  cancelPendingLiveSave: () => void;
  flushLiveSave: () => void;
  updateScene: (sceneId: number, patch: Partial<ScriptScene>) => void;
  saveScenesForLightPlot: (opts: { force: boolean }) => Promise<unknown> | void;
  setLiveStatus: (message: string | null) => void;
  applyingTapeRef: MutableRefObject<boolean>;
  liveSaveTimerRef: MutableRefObject<number | null>;
  pendingTapeKadrIdRef: MutableRefObject<string | null>;
  pendingTapeIndexAfterDeleteRef: MutableRefObject<number | null>;
};

export function useSpectacleRunKadrActions({
  scenes,
  tape,
  clampedIndex,
  currentScene,
  currentItem,
  lightChannels,
  liveConsole,
  playlist,
  sounds,
  videos,
  holdImages,
  kadrModalMode,
  setKadrModalMode,
  setKadrModalOpen,
  cancelPendingLiveSave,
  flushLiveSave,
  updateScene,
  saveScenesForLightPlot,
  setLiveStatus,
  applyingTapeRef,
  liveSaveTimerRef,
  pendingTapeKadrIdRef,
  pendingTapeIndexAfterDeleteRef,
}: UseSpectacleRunKadrActionsArgs) {
  const previousScene =
    currentItem && currentItem.sceneIndex > 0 ? scenes[currentItem.sceneIndex - 1] : null;
  const currentSceneTheaterEmpty = currentScene
    ? !sceneHasTheaterLayoutContent(currentScene)
    : false;
  const canCopyTheaterFromPreviousScene = Boolean(
    previousScene && sceneHasTheaterLayoutContent(previousScene),
  );

  const copyTheaterFromPreviousScene = useCallback(() => {
    if (!currentScene || !previousScene) return;
    if (!sceneHasTheaterLayoutContent(previousScene)) {
      setLiveStatus("На предыдущей сцене нет расстановки для копирования");
      return;
    }
    updateScene(currentScene.id, buildCopySceneTheaterLayoutPatchFromScene(previousScene));
    setLiveStatus(`Расстановка скопирована со сцены «${previousScene.title}»`);
    void saveScenesForLightPlot({ force: true });
  }, [currentScene, previousScene, saveScenesForLightPlot, setLiveStatus, updateScene]);

  const nextTapeItem = tape[clampedIndex + 1] ?? null;
  const canCopyKadrToNext = Boolean(
    currentItem &&
      !currentItem.isPlaceholder &&
      currentItem.kadrId &&
      nextTapeItem &&
      !nextTapeItem.isPlaceholder &&
      nextTapeItem.kadrId &&
      nextTapeItem.sceneIndex === currentItem.sceneIndex,
  );

  const copyCurrentKadrToNext = useCallback(() => {
    flushLiveSave();
    const sourceItem = tape[clampedIndex];
    const targetItem = tape[clampedIndex + 1];
    if (
      !sourceItem ||
      !targetItem ||
      sourceItem.isPlaceholder ||
      targetItem.isPlaceholder ||
      !sourceItem.kadrId ||
      !targetItem.kadrId ||
      sourceItem.sceneIndex !== targetItem.sceneIndex
    ) {
      setLiveStatus(
        targetItem && sourceItem && targetItem.sceneIndex !== sourceItem.sceneIndex
          ? "Следующая карточка — другая сцена. Добавьте картину в этой сцене"
          : "Нет следующей картины в этой сцене",
      );
      return;
    }
    const scene = scenes[sourceItem.sceneIndex];
    if (!scene) return;
    const nextKadrs = copyKadrLookToTarget({
      kadrs: readSceneLightKadrs(scene),
      sourceKadrId: sourceItem.kadrId,
      targetKadrId: targetItem.kadrId,
    });
    if (!nextKadrs) {
      setLiveStatus("У текущей картины ещё нет записанного света");
      return;
    }
    updateScene(scene.id, { lightKadrs: nextKadrs });
    setLiveStatus(`Свет скопирован на картину ${targetItem.kadrNo}`);
    void saveScenesForLightPlot({ force: true });
  }, [
    clampedIndex,
    flushLiveSave,
    saveScenesForLightPlot,
    scenes,
    setLiveStatus,
    tape,
    updateScene,
  ]);

  const addKadrToCurrentScene = useCallback(() => {
    if (!currentScene) return;

    if (currentSceneTheaterEmpty && previousScene && sceneHasTheaterLayoutContent(previousScene)) {
      const shouldCopy = window.confirm(
        `Расстановка в сцене «${currentScene.title}» пуста.\n\nСкопировать расстановку (мебель, декор, софиты, реквизит) со сцены «${previousScene.title}»?`,
      );
      if (shouldCopy) {
        updateScene(currentScene.id, buildCopySceneTheaterLayoutPatchFromScene(previousScene));
        void saveScenesForLightPlot({ force: true });
        setLiveStatus(`Расстановка скопирована со сцены «${previousScene.title}»`);
      }
    }

    setKadrModalMode("create");
    cancelPendingLiveSave();
    setKadrModalOpen(true);
  }, [
    currentScene,
    currentSceneTheaterEmpty,
    previousScene,
    cancelPendingLiveSave,
    saveScenesForLightPlot,
    setKadrModalMode,
    setKadrModalOpen,
    setLiveStatus,
    updateScene,
  ]);

  const editCurrentKadr = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item || item.isPlaceholder || !currentScene) return;
    cancelPendingLiveSave();
    setKadrModalMode("edit");
    setKadrModalOpen(true);
  }, [
    cancelPendingLiveSave,
    clampedIndex,
    currentScene,
    setKadrModalMode,
    setKadrModalOpen,
    tape,
  ]);

  const closeKadrModal = useCallback(() => {
    setKadrModalOpen(false);
  }, [setKadrModalOpen]);

  const submitKadrModal = useCallback(
    (draft: CreateKadrDraft) => {
      cancelPendingLiveSave();

      const item = tape[clampedIndex];
      if (!item) return;
      const scene = scenes[item.sceneIndex];
      if (!scene) return;

      const mediaArgs = {
        lightChannels,
        lightFaders: liveConsole.faders,
        lightPrograms: liveConsole.programs,
        spotlights: scene.theaterSpotlights ?? [],
        liveConsoleChannel: liveConsole.selectedLightSlot,
        liveFaders: liveConsole.faders,
        playlist: (playlist ?? []).map((track) => ({
          id: track.id,
          title: track.title ?? "",
        })),
        sounds: (sounds ?? []).map((sound) => ({
          id: sound.id,
          title: sound.title ?? "",
        })),
        videos: videos.map((video) => ({ id: video.id, title: video.title ?? "" })),
        holdImages: holdImages.map((hold) => ({ id: hold.id, title: hold.title ?? "" })),
      };

      const insertAfter =
        kadrModalMode === "create" && !item.isPlaceholder
          ? { id: item.kadrId, kadrNo: item.kadrNo }
          : null;

      const result =
        kadrModalMode === "edit"
          ? updateKadrFromDraft({ scene, item, draft, ...mediaArgs })
          : createKadrFromDraft({ scene, draft, insertAfter, ...mediaArgs });

      if (!result) {
        setLiveStatus(
          kadrModalMode === "edit" ? "Не удалось обновить картину" : "Не удалось создать картину",
        );
        return;
      }

      if (kadrModalMode === "create") {
        pendingTapeKadrIdRef.current = result.kadrId;
      }
      updateScene(scene.id, {
        lightKadrs: result.nextKadrs,
      } as Partial<ScriptScene>);

      const savedKadr = findKadrById(result.nextKadrs, result.kadrId);
      if (savedKadr && !savedKadr.blackout && savedKadr.programId > 0) {
        applyingTapeRef.current = true;
        try {
          const look = applyKadrLook(savedKadr, liveConsole.faders);
          liveConsole.persistFaders(look.faders);
          if (look.programId != null) {
            liveConsole.persistPrograms({
              ...liveConsole.programs,
              activeProgramId: look.programId,
            });
          }
        } finally {
          applyingTapeRef.current = false;
        }
      }

      setKadrModalOpen(false);
      setLiveStatus(result.summary);
      void saveScenesForLightPlot({ force: true });
    },
    [
      applyingTapeRef,
      clampedIndex,
      cancelPendingLiveSave,
      holdImages,
      kadrModalMode,
      lightChannels,
      liveConsole,
      pendingTapeKadrIdRef,
      playlist,
      saveScenesForLightPlot,
      scenes,
      setKadrModalOpen,
      setLiveStatus,
      sounds,
      tape,
      updateScene,
      videos,
    ],
  );

  const deleteCurrentKadr = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item || item.isPlaceholder) return;
    const scene = scenes[item.sceneIndex];
    if (!scene) return;

    const confirmMessage = formatDeleteKadrConfirmMessage(item.headingTitle);
    if (!window.confirm(confirmMessage)) return;

    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
    }

    const lightKadrs = deleteKadrFromSceneData(scene, {
      id: item.kadrId,
      kadrNo: item.kadrNo,
    });

    pendingTapeIndexAfterDeleteRef.current = clampedIndex;
    updateScene(scene.id, { lightKadrs } as Partial<ScriptScene>);
    void saveScenesForLightPlot({ force: true });
    setLiveStatus(`«${item.headingTitle}» удалена`);
  }, [
    clampedIndex,
    liveSaveTimerRef,
    pendingTapeIndexAfterDeleteRef,
    saveScenesForLightPlot,
    scenes,
    setLiveStatus,
    tape,
    updateScene,
  ]);

  return {
    previousScene,
    currentSceneTheaterEmpty,
    canCopyTheaterFromPreviousScene,
    copyTheaterFromPreviousScene,
    canCopyKadrToNext,
    copyCurrentKadrToNext,
    addKadrToCurrentScene,
    editCurrentKadr,
    closeKadrModal,
    submitKadrModal,
    deleteCurrentKadr,
    canEditKadr: Boolean(currentItem && !currentItem.isPlaceholder && currentScene),
    canDeleteKadr: Boolean(currentItem && !currentItem.isPlaceholder && currentScene),
    canAddKadr: Boolean(currentScene),
  };
}
