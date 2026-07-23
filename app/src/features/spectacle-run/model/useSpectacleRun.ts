import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { showScriptMarkdownActions } from "../../show-script-markdown/model/show-script-markdown-slice";
import { usePlaybook } from "../../playbook";
import { playbookActions, type PlaybookLightChannelRolesV1 } from "../../playbook/model/playbook-slice";
import {
  applyKadrToFaders,
  deleteKadrFromSceneMarkdown,
  findKadrById,
  formatDeleteKadrConfirmMessage,
  readSceneLightKadrs,
  resolveKadrSectionForTapeItem,
} from "../../theater/model/light-kadrs";
import { invokePlaylistPause } from "../../playbook/model/playbook-playback-bridge";
import { parseSoundLineInSection } from "../../theater/model/kadr-sound";
import { parseProjectorLineInSection, resolveKadrProjectorVideoOptions } from "../../theater/model/kadr-projector";
import { applyKadrProjector } from "./apply-kadr-projector";
import { pauseProjectorVideo } from "../../projector/model/projector-playback-bridge";
import { applyKadrSound } from "./apply-kadr-sound";
import { useSpectacleRunProjector } from "./useSpectacleRunProjector";
import { recordLightKadrForSection } from "../../../shared/components/light-console/light-kadr-record";
import {
  resolveLightFaders,
  resolveLightProgramMinCount,
  resolveLightPrograms,
} from "../../../shared/components/light-console/light-console-data";
import { useLightConsoleLayoutSettings } from "../../../shared/components/light-console/useLightConsoleLayoutSettings";
import { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import type { ScriptScene } from "../../../shared/types/script";
import {
  buildSpectacleKadrTape,
  findTapeIndexForSceneKadr,
  isLastTapeItemInScene,
  type SpectacleTapeItem,
} from "./spectacle-kadr-tape";
import {
  createKadrFromDraft,
  updateKadrFromDraft,
  type CreateKadrDraft,
  type KadrModalMode,
} from "./create-kadr-from-draft";
import { persistProgRunPaused, readProgRunPaused } from "./prog-run-prefs-storage";
import {
  buildCopySceneTheaterLayoutPatchFromScene,
  sceneHasTheaterLayoutContent,
} from "../../theater/model/copy-scene-theater-layout";

function isKeyboardTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export type UseSpectacleRunArgs = {
  projectName: string;
  scenes: ScriptScene[];
  lightChannels: string[];
};

export function useSpectacleRun({ projectName, scenes, lightChannels }: UseSpectacleRunArgs) {
  const dispatch = useAppDispatch();
  const { playbookData, setPlaybookData, updateScene, setCurrentPage, currentPage, saveScenesForLightPlot } =
    usePlaybook();
  const tape = useMemo(() => buildSpectacleKadrTape(scenes), [scenes]);
  const [tapeIndex, setTapeIndex] = useState(0);
  const [kadrModalOpen, setKadrModalOpen] = useState(false);
  const kadrModalOpenRef = useRef(false);
  const [kadrModalMode, setKadrModalMode] = useState<KadrModalMode>("create");
  const textHidden = useAppSelector((state) => state.scriptUi.spectacleRunTextHidden);
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);
  const isProgRun = lightPlotMode === "prog-run";
  const [progRunPaused, setProgRunPaused] = useState(() =>
    readProgRunPaused(projectName),
  );
  const progRunPausedRef = useRef(false);
  progRunPausedRef.current = progRunPaused;
  const progRunPlaybackEnabled = isProgRun && !progRunPaused;
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const projector = useSpectacleRunProjector({
    projectName,
    playbookData,
    dispatch,
    setLiveStatus,
  });
  const {
    projectorDraft,
    setProjectorDraft,
    projectorMediaCtx,
    videos,
    holdImages,
    isProjectorOpen,
    openProjector,
    closeProjector,
    ensureProjectorOpen,
    resolveProjectorVideoMuted,
    resolveProjectorVideoVolume,
    playProjectorCue,
    playProjectorVideo,
    toggleProjectorVideo,
    toggleProjectorVideoMute,
    setProjectorVideoVolumeLevel,
    seekProjectorVideoTime,
    removeProjectorVideo,
    removeProjectorHold,
    projectorPlayback,
  } = projector;
  const applyingTapeRef = useRef(false);
  const liveSaveTimerRef = useRef<number | null>(null);
  const tapeIndexRef = useRef(0);
  const tapeInitRef = useRef(false);
  const pendingTapeKadrIdRef = useRef<string | null>(null);
  const pendingTapeIndexAfterDeleteRef = useRef<number | null>(null);
  const skipTapeApplyEffectRef = useRef(false);
  const skipKadrFadersOnceRef = useRef(false);
  const scenesRef = useRef(scenes);
  const tapeRef = useRef(tape);
  scenesRef.current = scenes;
  tapeRef.current = tape;

  const lightFaders = useMemo(
    () => resolveLightFaders(playbookData?.lightFaders ?? undefined),
    [playbookData?.lightFaders],
  );
  const lightPrograms = useMemo(
    () =>
      resolveLightPrograms(
        playbookData?.lightPrograms,
        resolveLightProgramMinCount(lightChannels.length, playbookData?.lightPrograms),
      ),
    [lightChannels.length, playbookData?.lightPrograms],
  );

  const clampedIndex = tape.length === 0 ? 0 : Math.min(tapeIndex, tape.length - 1);
  const currentItem = tape[clampedIndex] ?? null;
  const currentScene = currentItem ? scenes[currentItem.sceneIndex] : null;
  const nextKadrNo =
    !currentScene || !currentItem || currentItem.isPlaceholder ? 1 : currentItem.kadrNo + 1;

  tapeIndexRef.current = clampedIndex;

  useEffect(() => {
    kadrModalOpenRef.current = kadrModalOpen;
  }, [kadrModalOpen]);

  const cancelPendingLiveSave = useCallback(() => {
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
    }
  }, []);

  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: currentScene?.theaterSpotlights ?? [],
  });
  const consoleLayoutSettings = useLightConsoleLayoutSettings(projectName);

  const flushLiveSaveAtIndex = useCallback(
    (
      index: number,
      snapshot?: {
        faders: typeof liveConsole.faders;
        programs: typeof liveConsole.programs;
      },
    ) => {
      if (kadrModalOpenRef.current) return;

      const item = tapeRef.current[index];
      const scene = item ? scenesRef.current[item.sceneIndex] : null;
      if (!item || !scene || item.isPlaceholder) return;

      const markdown = String(scene.markdown ?? "");
      const section = resolveKadrSectionForTapeItem(markdown, item);
      if (!section) {
        setLiveStatus(
          `Картина ${item.kadrNo}: блок не найден в тех. карте — откройте «Тех. карта» и проверьте ### Картина ${item.kadrNo}`,
        );
        return;
      }

      const faders = snapshot?.faders ?? liveConsole.faders;
      const programs = snapshot?.programs ?? liveConsole.programs;
      const kadrId = item.kadrId ?? section.id;

      const programId = Math.max(
        1,
        Math.trunc(programs.activeProgramId ?? programs.programs[0]?.id ?? 1) || 1,
      );

      const roles =
        playbookData?.lightChannelRoles && playbookData.lightChannelRoles.v === 1
          ? playbookData.lightChannelRoles
          : null;

      const result = recordLightKadrForSection({
        markdown,
        section,
        existingKadrId: kadrId,
        kadrs: readSceneLightKadrs(scene),
        lightChannels,
        lightFaders: faders,
        lightPrograms: programs,
        programId,
        spotlights: scene.theaterSpotlights ?? [],
        liveConsoleChannel: liveConsole.selectedLightSlot,
        lightChannelRoles: roles,
      });
      if (!result) {
        setLiveStatus(`Картина ${item.kadrNo}: не удалось записать свет`);
        return;
      }

      updateScene(scene.id, {
        lightKadrs: result.nextKadrs,
        markdown: result.nextMarkdown,
      } as Partial<ScriptScene>);
      setLiveStatus(result.summary);
      void saveScenesForLightPlot({ force: true });
    },
    [
      lightChannels,
      liveConsole.faders,
      liveConsole.programs,
      liveConsole.selectedLightSlot,
      playbookData?.lightChannelRoles,
      saveScenesForLightPlot,
      updateScene,
    ],
  );

  const flushLiveSave = useCallback(() => {
    flushLiveSaveAtIndex(tapeIndexRef.current);
  }, [flushLiveSaveAtIndex]);

  const scheduleLiveSave = useCallback(() => {
    if (applyingTapeRef.current) return;
    if (kadrModalOpenRef.current) return;
    const item = tapeRef.current[tapeIndexRef.current];
    if (!item || item.isPlaceholder) return;
    const scene = scenesRef.current[item.sceneIndex];
    if (!scene || !resolveKadrSectionForTapeItem(String(scene.markdown ?? ""), item)) {
      return;
    }
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
    }
    liveSaveTimerRef.current = window.setTimeout(() => {
      liveSaveTimerRef.current = null;
      flushLiveSave();
    }, 550);
  }, [flushLiveSave]);

  const applyTapeItem = useCallback(
    (item: SpectacleTapeItem, options?: { applyFaders?: boolean; applyPlayback?: boolean }) => {
      applyingTapeRef.current = true;
      setCurrentPage(item.sceneIndex);

      const scene = scenesRef.current[item.sceneIndex];
      if (!scene || item.isPlaceholder) {
        applyingTapeRef.current = false;
        return;
      }

      const markdown = String(scene.markdown ?? "");
      const section = resolveKadrSectionForTapeItem(markdown, item);
      const applyPlayback =
        options?.applyPlayback ??
        (lightPlotMode === "prog-run" && !progRunPausedRef.current);
      if (section) {
        const projectorCue = parseProjectorLineInSection(markdown, section);
        if (projectorCue) setProjectorDraft(projectorCue);
        if (applyPlayback) {
          const soundCue = parseSoundLineInSection(markdown, section);
          applyKadrSound(soundCue);
          void (async () => {
            if (projectorCue) {
              await ensureProjectorOpen();
            }
            await applyKadrProjector(
              projectorCue,
              projectorMediaCtx,
              projectorCue
                ? resolveKadrProjectorVideoOptions(projectorCue, {
                    resolveMuted: resolveProjectorVideoMuted,
                    resolveVolume: resolveProjectorVideoVolume,
                  })
                : undefined,
            );
          })();
        }
      }

      const kadrs = readSceneLightKadrs(scene);
      const kadrId = item.kadrId ?? section?.id ?? null;
      const kadr = kadrId ? findKadrById(kadrs, kadrId) : undefined;

      const applyFaders = options?.applyFaders !== false;
      if (kadr && applyFaders) {
        const nextFaders = applyKadrToFaders(kadr, liveConsole.faders);
        liveConsole.persistFaders(nextFaders);
      }

      if (kadr && kadr.programId > 0) {
        liveConsole.persistPrograms({
          ...liveConsole.programs,
          activeProgramId: kadr.programId,
        });
      }

      applyingTapeRef.current = false;
    },
    [
      ensureProjectorOpen,
      lightPlotMode,
      liveConsole,
      projectorMediaCtx,
      resolveProjectorVideoMuted,
      resolveProjectorVideoVolume,
      setCurrentPage,
    ],
  );

  useEffect(() => {
    setProgRunPaused(readProgRunPaused(projectName));
  }, [projectName]);

  useEffect(() => {
    if (!isProgRun) return;
    setProgRunPaused(readProgRunPaused(projectName));
  }, [isProgRun, projectName]);

  const toggleProgRunPause = useCallback(() => {
    if (progRunPausedRef.current) {
      setProgRunPaused(false);
      persistProgRunPaused(projectName, false);
      const item = tapeRef.current[tapeIndexRef.current];
      if (item) {
        applyTapeItem(item, { applyFaders: false, applyPlayback: true });
      }
      return;
    }

    setProgRunPaused(true);
    persistProgRunPaused(projectName, true);
    invokePlaylistPause();
    pauseProjectorVideo();
  }, [applyTapeItem, projectName]);

  useEffect(() => {
    if (tape.length === 0 || tapeInitRef.current) return;
    tapeInitRef.current = true;
    const tapeIndexForCurrentScene = tape.findIndex((item) => item.sceneIndex === currentPage);
    if (tapeIndexForCurrentScene >= 0) setTapeIndex(tapeIndexForCurrentScene);
  }, [currentPage, tape]);

  useEffect(() => {
    if (skipTapeApplyEffectRef.current) {
      skipTapeApplyEffectRef.current = false;
      return;
    }
    const item = tape[clampedIndex];
    if (!item) return;
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
      flushLiveSaveAtIndex(tapeIndexRef.current);
    }
    const skipFaders = skipKadrFadersOnceRef.current;
    if (skipKadrFadersOnceRef.current) {
      skipKadrFadersOnceRef.current = false;
    }
    applyTapeItem(item, { applyFaders: !skipFaders });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- только смена позиции в ленте
  }, [clampedIndex]);

  const prevLightPlotModeRef = useRef(lightPlotMode);
  useEffect(() => {
    const prevMode = prevLightPlotModeRef.current;
    prevLightPlotModeRef.current = lightPlotMode;
    if (prevMode === lightPlotMode || lightPlotMode !== "prog-run") return;
    if (progRunPausedRef.current) return;
    const item = tape[clampedIndex];
    if (!item) return;
    applyTapeItem(item, { applyFaders: false, applyPlayback: true });
  }, [applyTapeItem, clampedIndex, lightPlotMode, tape]);

  const consoleSnapshotKey = useMemo(
    () =>
      JSON.stringify({
        faders: liveConsole.faders.faders.map((f) => ({
          id: f.id,
          intensity: f.intensity,
          enabled: f.enabled,
          color: f.color,
        })),
        programId: liveConsole.programs.activeProgramId,
      }),
    [liveConsole.faders.faders, liveConsole.programs.activeProgramId],
  );

  const flushPendingLiveSave = useCallback(() => {
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
      flushLiveSaveAtIndex(tapeIndexRef.current);
    }
  }, [flushLiveSaveAtIndex]);

  useEffect(() => {
    if (applyingTapeRef.current) return;
    scheduleLiveSave();
    return () => {
      flushPendingLiveSave();
    };
  }, [consoleSnapshotKey, flushPendingLiveSave, scheduleLiveSave]);

  useEffect(() => {
    const onPageHide = () => {
      flushPendingLiveSave();
      void saveScenesForLightPlot({ force: true });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flushPendingLiveSave, saveScenesForLightPlot]);

  useEffect(() => {
    if (tape.length === 0) return;
    if (tapeIndex > tape.length - 1) {
      setTapeIndex(Math.max(0, tape.length - 1));
    }
  }, [tape.length, tapeIndex]);

  const previousScene =
    currentItem && currentItem.sceneIndex > 0 ? scenes[currentItem.sceneIndex - 1] : null;
  const currentSceneTheaterEmpty = currentScene ? !sceneHasTheaterLayoutContent(currentScene) : false;
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
  }, [currentScene, previousScene, saveScenesForLightPlot, updateScene]);

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
    updateScene,
  ]);

  const editCurrentKadr = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item || item.isPlaceholder || !currentScene) return;
    cancelPendingLiveSave();
    setKadrModalMode("edit");
    setKadrModalOpen(true);
  }, [cancelPendingLiveSave, clampedIndex, currentScene, tape]);

  const closeKadrModal = useCallback(() => {
    setKadrModalOpen(false);
  }, []);

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
        playlist: (playbookData?.playlist ?? []).map((track) => ({
          id: track.id,
          title: track.title ?? "",
        })),
        sounds: (playbookData?.sounds ?? []).map((sound) => ({
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
        markdown: result.nextMarkdown,
        lightKadrs: result.nextKadrs,
      } as Partial<ScriptScene>);

      const savedKadr = findKadrById(result.nextKadrs, result.kadrId);
      if (savedKadr && !savedKadr.blackout && savedKadr.programId > 0) {
        applyingTapeRef.current = true;
        try {
          liveConsole.persistFaders(applyKadrToFaders(savedKadr, liveConsole.faders));
          liveConsole.persistPrograms({
            ...liveConsole.programs,
            activeProgramId: savedKadr.programId,
          });
        } finally {
          applyingTapeRef.current = false;
        }
      }

      setKadrModalOpen(false);
      setLiveStatus(result.summary);
      void saveScenesForLightPlot({ force: true });
    },
    [
      clampedIndex,
      cancelPendingLiveSave,
      holdImages,
      kadrModalMode,
      lightChannels,
      liveConsole.faders,
      liveConsole.programs,
      liveConsole.selectedLightSlot,
      saveScenesForLightPlot,
      playbookData?.playlist,
      playbookData?.sounds,
      scenes,
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

    const { markdown, lightKadrs } = deleteKadrFromSceneMarkdown(scene, {
      id: item.kadrId ?? item.section?.id,
      kadrNo: item.kadrNo,
      headingStart: item.section?.headingStart,
    });

    pendingTapeIndexAfterDeleteRef.current = clampedIndex;
    updateScene(scene.id, { markdown, lightKadrs } as Partial<ScriptScene>);
    void saveScenesForLightPlot({ force: true });
    setLiveStatus(`«${item.headingTitle}» удалена`);
  }, [clampedIndex, saveScenesForLightPlot, scenes, tape, updateScene]);

  const goToTapeIndex = useCallback(
    (nextIndex: number) => {
      if (tape.length === 0) return;
      const clamped = Math.max(0, Math.min(tape.length - 1, nextIndex));
      if (clamped === tapeIndexRef.current) return;

      if (liveSaveTimerRef.current != null) {
        window.clearTimeout(liveSaveTimerRef.current);
        liveSaveTimerRef.current = null;
      }

      const leavingIndex = tapeIndexRef.current;
      const leavingSnapshot =
        leavingIndex !== clamped
          ? {
              faders: liveConsole.faders,
              programs: liveConsole.programs,
            }
          : null;

      if (leavingSnapshot) {
        flushLiveSaveAtIndex(leavingIndex, leavingSnapshot);
      }

      const target = tape[clamped];
      if (target) {
        applyingTapeRef.current = true;
        applyTapeItem(
          target,
          isProgRun ? { applyPlayback: true } : undefined,
        );
      }

      skipTapeApplyEffectRef.current = true;
      tapeIndexRef.current = clamped;
      setTapeIndex(clamped);
    },
    [
      applyTapeItem,
      flushLiveSaveAtIndex,
      isProgRun,
      liveConsole.faders,
      liveConsole.programs,
      tape,
    ],
  );

  useEffect(() => {
    const pendingId = pendingTapeKadrIdRef.current;
    if (!pendingId || tape.length === 0) return;
    const idx = findTapeIndexForSceneKadr(tape, -1, pendingId);
    if (idx < 0) return;
    pendingTapeKadrIdRef.current = null;
    goToTapeIndex(idx);
  }, [tape, scenes, goToTapeIndex]);

  useEffect(() => {
    const pendingIndex = pendingTapeIndexAfterDeleteRef.current;
    if (pendingIndex == null || tape.length === 0) return;
    pendingTapeIndexAfterDeleteRef.current = null;
    const nextIndex = Math.min(pendingIndex, tape.length - 1);
    goToTapeIndex(Math.max(0, nextIndex));
  }, [tape, scenes, goToTapeIndex]);

  const goPrev = useCallback(() => goToTapeIndex(clampedIndex - 1), [clampedIndex, goToTapeIndex]);
  const goNext = useCallback(() => goToTapeIndex(clampedIndex + 1), [clampedIndex, goToTapeIndex]);

  useEffect(() => {
    if (!isProgRun || tape.length === 0 || kadrModalOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (isKeyboardTypingTarget(event.target)) return;

      event.preventDefault();
      if (event.key === "ArrowLeft") {
        goToTapeIndex(tapeIndexRef.current - 1);
        return;
      }
      goToTapeIndex(tapeIndexRef.current + 1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [goToTapeIndex, isProgRun, kadrModalOpen, tape.length]);

  const goNextScene = useCallback(() => {
    if (!currentItem) return;
    const nextInTape = tape.findIndex(
      (item, index) => index > clampedIndex && item.sceneIndex > currentItem.sceneIndex,
    );
    if (nextInTape >= 0) goToTapeIndex(nextInTape);
  }, [clampedIndex, currentItem, goToTapeIndex, tape]);

  const startProgRun = useCallback(() => {
    if (tape.length === 0) return;

    if (progRunPausedRef.current) {
      setProgRunPaused(false);
      persistProgRunPaused(projectName, false);
    }

    const firstItem = tape[0];
    if (!firstItem) return;

    if (tapeIndexRef.current === 0) {
      applyTapeItem(firstItem, { applyPlayback: true });
      return;
    }

    goToTapeIndex(0);
  }, [applyTapeItem, goToTapeIndex, projectName, tape]);

  const isLastInSpectacle = clampedIndex >= tape.length - 1;
  const isLastInScene = isLastTapeItemInScene(tape, clampedIndex);
  const canGoNext = !isLastInSpectacle;
  const nextLabel = isLastInScene ? "Следующая сцена" : "Далее";

  return {
    tape,
    tapeIndex: clampedIndex,
    currentItem,
    currentScene,
    textHidden,
    liveStatus,
    setLiveStatus,
    liveConsole,
    lightFaders,
    lightPrograms,
    lightChannelRoles:
      playbookData?.lightChannelRoles && playbookData.lightChannelRoles.v === 1
        ? playbookData.lightChannelRoles
        : null,
    setLightChannelRoles: (next: PlaybookLightChannelRolesV1) => {
      setPlaybookData((prev) => ({ ...(prev ?? {}), lightChannelRoles: next }));
    },
    goPrev,
    goNext,
    goNextScene,
    goToTapeIndex,
    startProgRun,
    progRunPaused,
    progRunPlaybackEnabled,
    toggleProgRunPause,
    canGoPrev: clampedIndex > 0,
    canGoNext,
    isLastInScene,
    isLastInSpectacle,
    nextLabel,
    flushLiveSave,
    addKadrToCurrentScene,
    editCurrentKadr,
    deleteCurrentKadr,
    canEditKadr: Boolean(currentItem && !currentItem.isPlaceholder && currentScene),
    canDeleteKadr: Boolean(currentItem && !currentItem.isPlaceholder && currentScene),
    nextKadrNo,
    canAddKadr: Boolean(currentScene),
    canCopyTheaterFromPreviousScene,
    currentSceneTheaterEmpty,
    copyTheaterFromPreviousScene,
    kadrModalOpen,
    kadrModalMode,
    closeKadrModal,
    submitKadrModal,
    videos,
    holdImages,
    projectorMediaCtx,
    isProjectorOpen,
    openProjector,
    closeProjector,
    showProjectorHold: (holdId?: number) => {
      const hold = holdId != null ? holdImages.find((h) => Number(h.id) === holdId) : null;
      const label = hold?.title?.trim() || (holdId != null ? `заставка ${holdId}` : "заставка");
      void playProjectorCue(
        holdId != null ? { mode: "hold", holdId } : { mode: "hold" },
        `Проектор: ${label}`,
      );
    },
    playProjectorVideo,
    toggleProjectorVideo,
    isProjectorVideoMuted: resolveProjectorVideoMuted,
    toggleProjectorVideoMute,
    resolveProjectorVideoVolume,
    setProjectorVideoVolumeLevel,
    seekProjectorVideoTime,
    removeProjectorVideo,
    removeProjectorHold,
    projectorPlayback,
    projectName,
    consoleLayoutSettings,
  };
}
