import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { showScriptMarkdownActions } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScene } from "../../scene";
import { sceneActions, type SceneLightChannelRolesV1 } from "../../scene/model/scene-slice";
import {
  applyKadrToFaders,
  deleteKadrFromStepMarkdown,
  findKadrById,
  formatDeleteKadrConfirmMessage,
  readStepLightKadrs,
  resolveKadrSectionForTapeItem,
} from "../../theater/model/light-kadrs";
import { invokePlaylistPause } from "../../scene/model/scene-playback-bridge";
import { parseSoundLineInSection } from "../../theater/model/kadr-sound";
import { parseProjectorLineInSection, resolveKadrProjectorVideoOptions, type KadrProjectorCue } from "../../theater/model/kadr-projector";
import { applyKadrSound } from "./apply-kadr-sound";
import { applyKadrProjector, showProjectorHold } from "./apply-kadr-projector";
import {
  closeProjectorWindow,
  ensureProjectorOutputOpen,
  isProjectorWindowOpen,
  notifyProjectorReady,
  openProjectorWindow,
  pauseProjectorVideo,
  pingProjectorOutput,
  resumeProjectorVideo,
  seekProjectorVideo,
  sendProjectorVideoMuted,
  sendProjectorVideoVolume,
  subscribeProjectorOutputErrors,
  subscribeProjectorPlayback,
} from "../../projector/model/projector-playback-bridge";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import { normalizeHoldImages } from "../../projector/model/scene-projector-persist";
import { recordLightKadrForSection } from "../../../shared/components/light-console/light-kadr-record";
import {
  resolveLightFaders,
  resolveLightProgramMinCount,
  resolveLightPrograms,
} from "../../../shared/components/light-console/light-console-data";
import { useLightConsoleLayoutSettings } from "../../../shared/components/light-console/useLightConsoleLayoutSettings";
import { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import type { ScriptStep } from "../../../shared/types/script";
import {
  buildSpectacleKadrTape,
  findTapeIndexForStepKadr,
  isLastTapeItemInStep,
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
  buildCopyStepTheaterScenePatchFromStep,
  stepHasTheaterSceneContent,
} from "../../theater/model/copy-step-theater-scene";

function isKeyboardTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return Boolean(target.closest("input, textarea, select, [contenteditable='true']"));
}

export type UseSpectacleRunArgs = {
  projectName: string;
  steps: ScriptStep[];
  lightChannels: string[];
};

export function useSpectacleRun({ projectName, steps, lightChannels }: UseSpectacleRunArgs) {
  const dispatch = useAppDispatch();
  const { sceneData, setSceneData, updateStep, setCurrentPage, currentPage, saveStepsForLightPlot } =
    useScene();
  const tape = useMemo(() => buildSpectacleKadrTape(steps), [steps]);
  const [tapeIndex, setTapeIndex] = useState(0);
  const [kadrModalOpen, setKadrModalOpen] = useState(false);
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
  const [isProjectorOpen, setIsProjectorOpen] = useState(() => isProjectorWindowOpen());
  const [projectorDraft, setProjectorDraft] = useState<KadrProjectorCue>({ mode: "hold" });
  const [projectorPlayback, setProjectorPlayback] = useState<{
    videoId: number | null;
    holdId: number | null;
    playing: boolean;
    mode: "video" | "hold" | "black";
    currentTime: number;
    duration: number;
    volume: number;
  }>({
    videoId: null,
    holdId: null,
    playing: false,
    mode: "black",
    currentTime: 0,
    duration: 0,
    volume: 1,
  });
  const [projectorVideoMuted, setProjectorVideoMuted] = useState<Record<number, boolean>>({});
  const [projectorVideoVolume, setProjectorVideoVolume] = useState<Record<number, number>>({});
  const applyingTapeRef = useRef(false);
  const liveSaveTimerRef = useRef<number | null>(null);
  const tapeIndexRef = useRef(0);
  const tapeInitRef = useRef(false);
  const pendingTapeKadrIdRef = useRef<string | null>(null);
  const pendingTapeIndexAfterDeleteRef = useRef<number | null>(null);
  const skipTapeApplyEffectRef = useRef(false);
  const skipKadrFadersOnceRef = useRef(false);
  const stepsRef = useRef(steps);
  const tapeRef = useRef(tape);
  stepsRef.current = steps;
  tapeRef.current = tape;

  const lightFaders = useMemo(
    () => resolveLightFaders(sceneData?.lightFaders ?? undefined),
    [sceneData?.lightFaders],
  );
  const lightPrograms = useMemo(
    () =>
      resolveLightPrograms(
        sceneData?.lightPrograms,
        resolveLightProgramMinCount(lightChannels.length, sceneData?.lightPrograms),
      ),
    [lightChannels.length, sceneData?.lightPrograms],
  );

  const clampedIndex = tape.length === 0 ? 0 : Math.min(tapeIndex, tape.length - 1);
  const currentItem = tape[clampedIndex] ?? null;
  const currentStep = currentItem ? steps[currentItem.stepIndex] : null;
  const nextKadrNo =
    !currentStep || !currentItem || currentItem.isPlaceholder ? 1 : currentItem.kadrNo + 1;

  tapeIndexRef.current = clampedIndex;

  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: currentStep?.theaterSpotlights ?? [],
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
      const item = tapeRef.current[index];
      const step = item ? stepsRef.current[item.stepIndex] : null;
      if (!item || !step || item.isPlaceholder) return;

      const markdown = String(step.markdown ?? "");
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
        sceneData?.lightChannelRoles && sceneData.lightChannelRoles.v === 1
          ? sceneData.lightChannelRoles
          : null;

      const result = recordLightKadrForSection({
        markdown,
        section,
        existingKadrId: kadrId,
        kadrs: readStepLightKadrs(step),
        lightChannels,
        lightFaders: faders,
        lightPrograms: programs,
        programId,
        spotlights: step.theaterSpotlights ?? [],
        liveConsoleChannel: liveConsole.selectedLightSlot,
        lightChannelRoles: roles,
      });
      if (!result) {
        setLiveStatus(`Картина ${item.kadrNo}: не удалось записать свет`);
        return;
      }

      updateStep(step.id, {
        lightKadrs: result.nextKadrs,
        markdown: result.nextMarkdown,
      } as Partial<ScriptStep>);
      setLiveStatus(result.summary);
      void saveStepsForLightPlot({ force: true });
    },
    [
      lightChannels,
      liveConsole.faders,
      liveConsole.programs,
      liveConsole.selectedLightSlot,
      sceneData?.lightChannelRoles,
      saveStepsForLightPlot,
      updateStep,
    ],
  );

  const flushLiveSave = useCallback(() => {
    flushLiveSaveAtIndex(tapeIndexRef.current);
  }, [flushLiveSaveAtIndex]);

  const scheduleLiveSave = useCallback(() => {
    if (applyingTapeRef.current) return;
    const item = tapeRef.current[tapeIndexRef.current];
    if (!item || item.isPlaceholder) return;
    const step = stepsRef.current[item.stepIndex];
    if (!step || !resolveKadrSectionForTapeItem(String(step.markdown ?? ""), item)) {
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

  const projectorMediaCtx = useMemo<ProjectorMediaContext>(
    () => ({
      projectSlug: projectName,
      videos: sceneData?.videos ?? [],
      holdImages: sceneData?.holdImages ?? [],
      projector: sceneData?.projector ?? null,
    }),
    [projectName, sceneData?.holdImages, sceneData?.projector, sceneData?.videos],
  );

  const videos = projectorMediaCtx.videos ?? [];
  const holdImages = useMemo(
    () =>
      normalizeHoldImages(
        sceneData?.holdImages,
        sceneData?.projector ?? undefined,
      ),
    [sceneData?.holdImages, sceneData?.projector],
  );

  useEffect(() => {
    const unsubReady = notifyProjectorReady();
    const unsubPlayback = subscribeProjectorPlayback((state) => {
      setProjectorPlayback({
        videoId: state.videoId,
        holdId: state.holdId,
        playing: state.playing,
        mode: state.mode,
        currentTime: state.currentTime ?? 0,
        duration: state.duration ?? 0,
        volume: state.volume ?? 1,
      });
    });
    const unsubErrors = subscribeProjectorOutputErrors((error) => {
      const label = error.scope === "hold" ? "заставку" : "видео";
      setLiveStatus(`Проектор: не удалось показать ${label} — ${error.message}`);
    });
    void pingProjectorOutput().then((alive) => {
      if (alive) setIsProjectorOpen(true);
    });
    return () => {
      unsubReady();
      unsubPlayback();
      unsubErrors();
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsProjectorOpen(isProjectorWindowOpen());
    }, 800);
    return () => window.clearInterval(timer);
  }, []);

  const openProjector = useCallback(() => {
    const win = openProjectorWindow();
    if (!win) {
      setLiveStatus("Браузер заблокировал окно — разрешите всплывающие окна");
      return;
    }
    setIsProjectorOpen(true);
    void showProjectorHold(projectorMediaCtx);
    setLiveStatus("Проектор открыт — перенесите окно на второй экран и нажмите F11");
  }, [projectorMediaCtx]);

  const closeProjector = useCallback(() => {
    closeProjectorWindow();
    setIsProjectorOpen(false);
    setProjectorPlayback({
      videoId: null,
      holdId: null,
      playing: false,
      mode: "black",
      currentTime: 0,
      duration: 0,
      volume: 1,
    });
    setLiveStatus("Проектор закрыт");
  }, []);

  const ensureProjectorOpen = useCallback(async (): Promise<boolean> => {
    const open = await ensureProjectorOutputOpen({ focus: false });
    if (open) {
      setIsProjectorOpen(true);
      return true;
    }
    setLiveStatus("Браузер заблокировал окно — разрешите всплывающие окна");
    return false;
  }, []);

  const resolveProjectorVideoMuted = useCallback(
    (videoId: number) => projectorVideoMuted[Number(videoId)] ?? false,
    [projectorVideoMuted],
  );

  const resolveProjectorVideoVolume = useCallback(
    (videoId: number) => {
      const stored = projectorVideoVolume[Number(videoId)];
      if (stored != null && Number.isFinite(stored)) return Math.max(0, Math.min(1, stored));
      return resolveProjectorVideoMuted(videoId) ? 0 : 1;
    },
    [projectorVideoMuted, projectorVideoVolume],
  );

  const playProjectorCue = useCallback(
    async (cue: KadrProjectorCue, statusLabel?: string) => {
      setProjectorDraft(cue);
      if (!(await ensureProjectorOpen())) return;
      await applyKadrProjector(
        cue,
        projectorMediaCtx,
        resolveKadrProjectorVideoOptions(cue, {
          resolveMuted: resolveProjectorVideoMuted,
          resolveVolume: resolveProjectorVideoVolume,
        }),
      );
      const holdLabel =
        cue.mode === "hold" && cue.holdId != null
          ? holdImages.find((h) => Number(h.id) === cue.holdId)?.title?.trim() ||
            `заставка ${cue.holdId}`
          : "заставка";
      setLiveStatus(
        statusLabel ??
          (cue.mode === "hold"
            ? `Проектор: ${holdLabel} — окно на втором экране, F11 для полного экрана`
            : "Проектор: видео — окно на втором экране, F11 для полного экрана"),
      );
    },
    [ensureProjectorOpen, holdImages, projectorMediaCtx, resolveProjectorVideoMuted, resolveProjectorVideoVolume],
  );

  const playProjectorVideo = useCallback(
    (videoId: number) => {
      const video = videos.find((v) => Number(v.id) === Number(videoId));
      const label = video?.title?.trim() || `видео ${videoId}`;
      void playProjectorCue(
        { mode: "video", videoId },
        `▶ ${label} — на проекторе. Перенесите окно на 2-й экран, F11`,
      );
    },
    [playProjectorCue, videos],
  );

  const toggleProjectorVideo = useCallback(
    (videoId: number) => {
      const id = Number(videoId);
      if (
        projectorPlayback.videoId === id &&
        projectorPlayback.playing &&
        isProjectorWindowOpen()
      ) {
        pauseProjectorVideo();
        const video = videos.find((v) => Number(v.id) === id);
        const label = video?.title?.trim() || `видео ${id}`;
        setLiveStatus(`⏸ ${label} — пауза на проекторе`);
        return;
      }
      if (
        projectorPlayback.videoId === id &&
        !projectorPlayback.playing &&
        isProjectorWindowOpen()
      ) {
        resumeProjectorVideo();
        const video = videos.find((v) => Number(v.id) === id);
        const label = video?.title?.trim() || `видео ${id}`;
        setLiveStatus(`▶ ${label} — продолжение на проекторе`);
        return;
      }
      playProjectorVideo(id);
    },
    [playProjectorVideo, projectorPlayback.playing, projectorPlayback.videoId, videos],
  );

  const toggleProjectorVideoMute = useCallback(
    (videoId: number) => {
      const id = Number(videoId);
      const nextMuted = !resolveProjectorVideoMuted(id);
      const nextVolume = nextMuted ? 0 : resolveProjectorVideoVolume(id) || 1;
      setProjectorVideoMuted((prev) => ({ ...prev, [id]: nextMuted }));
      setProjectorVideoVolume((prev) => ({ ...prev, [id]: nextVolume }));
      if (projectorPlayback.videoId === id && isProjectorWindowOpen()) {
        sendProjectorVideoMuted(nextMuted);
        sendProjectorVideoVolume(nextVolume);
      }
      const video = videos.find((v) => Number(v.id) === id);
      const label = video?.title?.trim() || `видео ${id}`;
      setLiveStatus(nextMuted ? `🔇 ${label} — звук выключен` : `🔊 ${label} — звук включён`);
    },
    [projectorPlayback.videoId, resolveProjectorVideoMuted, resolveProjectorVideoVolume, videos],
  );

  const setProjectorVideoVolumeLevel = useCallback(
    (videoId: number, volume: number) => {
      const id = Number(videoId);
      const nextVolume = Math.max(0, Math.min(1, volume));
      const nextMuted = nextVolume === 0;
      setProjectorVideoVolume((prev) => ({ ...prev, [id]: nextVolume }));
      setProjectorVideoMuted((prev) => ({ ...prev, [id]: nextMuted }));
      if (projectorPlayback.videoId === id && isProjectorWindowOpen()) {
        sendProjectorVideoVolume(nextVolume);
        if (nextMuted) sendProjectorVideoMuted(true);
      }
    },
    [projectorPlayback.videoId],
  );

  const seekProjectorVideoTime = useCallback((time: number) => {
    if (!isProjectorWindowOpen()) return;
    seekProjectorVideo(Math.max(0, time));
  }, []);

  const resetProjectorDraftAfterRemoval = useCallback(
    (removed: { kind: "video"; id: number } | { kind: "hold"; id: number }) => {
      if (removed.kind === "video") {
        if (projectorDraft.mode === "video" && Number(projectorDraft.videoId) === removed.id) {
          const nextHold = holdImages[0];
          setProjectorDraft(
            nextHold ? { mode: "hold", holdId: nextHold.id } : { mode: "hold" },
          );
        }
        if (
          projectorPlayback.videoId === removed.id &&
          isProjectorWindowOpen()
        ) {
          void showProjectorHold(projectorMediaCtx);
        }
        return;
      }
      if (
        projectorDraft.mode === "hold" &&
        (projectorDraft.holdId == null || Number(projectorDraft.holdId) === removed.id)
      ) {
        const nextHold = holdImages.find((h) => Number(h.id) !== removed.id);
        setProjectorDraft(
          nextHold ? { mode: "hold", holdId: nextHold.id } : { mode: "hold" },
        );
      }
      if (
        projectorPlayback.mode === "hold" &&
        projectorPlayback.holdId === removed.id &&
        isProjectorWindowOpen()
      ) {
        const nextHold = holdImages.find((h) => Number(h.id) !== removed.id);
        if (nextHold) {
          void showProjectorHold(projectorMediaCtx, nextHold.id);
        } else {
          closeProjector();
        }
      }
    },
    [
      closeProjector,
      holdImages,
      projectorDraft,
      projectorMediaCtx,
      projectorPlayback.holdId,
      projectorPlayback.mode,
      projectorPlayback.videoId,
    ],
  );

  const removeProjectorVideo = useCallback(
    (videoId: number) => {
      dispatch(sceneActions.removeSceneVideo(videoId));
      resetProjectorDraftAfterRemoval({ kind: "video", id: videoId });
    },
    [dispatch, resetProjectorDraftAfterRemoval],
  );

  const removeProjectorHold = useCallback(
    (holdId: number) => {
      dispatch(sceneActions.removeSceneHoldImage(holdId));
      resetProjectorDraftAfterRemoval({ kind: "hold", id: holdId });
    },
    [dispatch, resetProjectorDraftAfterRemoval],
  );

  const applyTapeItem = useCallback(
    (item: SpectacleTapeItem, options?: { applyFaders?: boolean; applyPlayback?: boolean }) => {
      applyingTapeRef.current = true;
      setCurrentPage(item.stepIndex);

      const step = stepsRef.current[item.stepIndex];
      if (!step || item.isPlaceholder) {
        applyingTapeRef.current = false;
        return;
      }

      const markdown = String(step.markdown ?? "");
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

      const kadrs = readStepLightKadrs(step);
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
    const onStep = tape.findIndex((item) => item.stepIndex === currentPage);
    if (onStep >= 0) setTapeIndex(onStep);
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
      void saveStepsForLightPlot({ force: true });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flushPendingLiveSave, saveStepsForLightPlot]);

  useEffect(() => {
    if (tape.length === 0) return;
    if (tapeIndex > tape.length - 1) {
      setTapeIndex(Math.max(0, tape.length - 1));
    }
  }, [tape.length, tapeIndex]);

  const previousStep =
    currentItem && currentItem.stepIndex > 0 ? steps[currentItem.stepIndex - 1] : null;
  const currentStepTheaterEmpty = currentStep ? !stepHasTheaterSceneContent(currentStep) : false;
  const canCopyTheaterFromPreviousStep = Boolean(
    previousStep && stepHasTheaterSceneContent(previousStep),
  );

  const copyTheaterFromPreviousStep = useCallback(() => {
    if (!currentStep || !previousStep) return;
    if (!stepHasTheaterSceneContent(previousStep)) {
      setLiveStatus("На предыдущем шаге нет сцены для копирования");
      return;
    }
    updateStep(currentStep.id, buildCopyStepTheaterScenePatchFromStep(previousStep));
    setLiveStatus(`Сцена скопирована с шага «${previousStep.title}»`);
    void saveStepsForLightPlot({ force: true });
  }, [currentStep, previousStep, saveStepsForLightPlot, updateStep]);

  const addKadrToCurrentStep = useCallback(() => {
    if (!currentStep) return;

    if (currentStepTheaterEmpty && previousStep && stepHasTheaterSceneContent(previousStep)) {
      const shouldCopy = window.confirm(
        `Сцена в шаге «${currentStep.title}» пуста.\n\nСкопировать расстановку (мебель, декор, софиты, реквизит) с шага «${previousStep.title}»?`,
      );
      if (shouldCopy) {
        updateStep(currentStep.id, buildCopyStepTheaterScenePatchFromStep(previousStep));
        void saveStepsForLightPlot({ force: true });
        setLiveStatus(`Сцена скопирована с шага «${previousStep.title}»`);
      }
    }

    setKadrModalMode("create");
    setKadrModalOpen(true);
  }, [
    currentStep,
    currentStepTheaterEmpty,
    previousStep,
    saveStepsForLightPlot,
    updateStep,
  ]);

  const editCurrentKadr = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item || item.isPlaceholder || !currentStep) return;
    setKadrModalMode("edit");
    setKadrModalOpen(true);
  }, [clampedIndex, currentStep, tape]);

  const closeKadrModal = useCallback(() => {
    setKadrModalOpen(false);
  }, []);

  const submitKadrModal = useCallback(
    (draft: CreateKadrDraft) => {
      const item = tape[clampedIndex];
      if (!item) return;
      const step = steps[item.stepIndex];
      if (!step) return;

      const mediaArgs = {
        lightChannels,
        lightFaders: liveConsole.faders,
        lightPrograms: liveConsole.programs,
        spotlights: step.theaterSpotlights ?? [],
        liveConsoleChannel: liveConsole.selectedLightSlot,
        liveFaders: liveConsole.faders,
        playlist: (sceneData?.playlist ?? []).map((track) => ({
          id: track.id,
          title: track.title ?? "",
        })),
        sounds: (sceneData?.sounds ?? []).map((sound) => ({
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
          ? updateKadrFromDraft({ step, item, draft, ...mediaArgs })
          : createKadrFromDraft({ step, draft, insertAfter, ...mediaArgs });

      if (!result) {
        setLiveStatus(
          kadrModalMode === "edit" ? "Не удалось обновить картину" : "Не удалось создать картину",
        );
        return;
      }

      if (kadrModalMode === "create") {
        pendingTapeKadrIdRef.current = result.kadrId;
      }
      updateStep(step.id, {
        markdown: result.nextMarkdown,
        lightKadrs: result.nextKadrs,
      } as Partial<ScriptStep>);
      setKadrModalOpen(false);
      setLiveStatus(result.summary);
      void saveStepsForLightPlot({ force: true });
    },
    [
      clampedIndex,
      holdImages,
      kadrModalMode,
      lightChannels,
      liveConsole.faders,
      liveConsole.programs,
      liveConsole.selectedLightSlot,
      saveStepsForLightPlot,
      sceneData?.playlist,
      sceneData?.sounds,
      steps,
      tape,
      updateStep,
      videos,
    ],
  );

  const deleteCurrentKadr = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item || item.isPlaceholder) return;
    const step = steps[item.stepIndex];
    if (!step) return;

    const confirmMessage = formatDeleteKadrConfirmMessage(item.headingTitle);
    if (!window.confirm(confirmMessage)) return;

    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
    }

    const { markdown, lightKadrs } = deleteKadrFromStepMarkdown(step, {
      id: item.kadrId ?? item.section?.id,
      kadrNo: item.kadrNo,
      headingStart: item.section?.headingStart,
    });

    pendingTapeIndexAfterDeleteRef.current = clampedIndex;
    updateStep(step.id, { markdown, lightKadrs } as Partial<ScriptStep>);
    void saveStepsForLightPlot({ force: true });
    setLiveStatus(`«${item.headingTitle}» удалена`);
  }, [clampedIndex, saveStepsForLightPlot, steps, tape, updateStep]);

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
    const idx = findTapeIndexForStepKadr(tape, -1, pendingId);
    if (idx < 0) return;
    pendingTapeKadrIdRef.current = null;
    goToTapeIndex(idx);
  }, [tape, steps, goToTapeIndex]);

  useEffect(() => {
    const pendingIndex = pendingTapeIndexAfterDeleteRef.current;
    if (pendingIndex == null || tape.length === 0) return;
    pendingTapeIndexAfterDeleteRef.current = null;
    const nextIndex = Math.min(pendingIndex, tape.length - 1);
    goToTapeIndex(Math.max(0, nextIndex));
  }, [tape, steps, goToTapeIndex]);

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

  const goNextStep = useCallback(() => {
    if (!currentItem) return;
    const nextInTape = tape.findIndex(
      (item, index) => index > clampedIndex && item.stepIndex > currentItem.stepIndex,
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
  const isLastInStep = isLastTapeItemInStep(tape, clampedIndex);
  const canGoNext = !isLastInSpectacle;
  const nextLabel = isLastInStep ? "Следующий шаг" : "Далее";

  return {
    tape,
    tapeIndex: clampedIndex,
    currentItem,
    currentStep,
    textHidden,
    liveStatus,
    setLiveStatus,
    liveConsole,
    lightFaders,
    lightPrograms,
    lightChannelRoles:
      sceneData?.lightChannelRoles && sceneData.lightChannelRoles.v === 1
        ? sceneData.lightChannelRoles
        : null,
    setLightChannelRoles: (next: SceneLightChannelRolesV1) => {
      setSceneData((prev) => ({ ...(prev ?? {}), lightChannelRoles: next }));
    },
    goPrev,
    goNext,
    goNextStep,
    goToTapeIndex,
    startProgRun,
    progRunPaused,
    progRunPlaybackEnabled,
    toggleProgRunPause,
    canGoPrev: clampedIndex > 0,
    canGoNext,
    isLastInStep,
    isLastInSpectacle,
    nextLabel,
    flushLiveSave,
    addKadrToCurrentStep,
    editCurrentKadr,
    deleteCurrentKadr,
    canEditKadr: Boolean(currentItem && !currentItem.isPlaceholder && currentStep),
    canDeleteKadr: Boolean(currentItem && !currentItem.isPlaceholder && currentStep),
    nextKadrNo,
    canAddKadr: Boolean(currentStep),
    canCopyTheaterFromPreviousStep,
    currentStepTheaterEmpty,
    copyTheaterFromPreviousStep,
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
