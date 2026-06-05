import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { showScriptMarkdownActions } from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScene } from "../../scene";
import { sceneActions, type SceneLightChannelRolesV1 } from "../../scene/model/scene-slice";
import {
  applyKadrToFaders,
  findKadrById,
  readStepLightKadrs,
  resolveKadrSectionForTapeItem,
} from "../../theater/model/light-kadrs";
import { parseSoundLineInSection } from "../../theater/model/kadr-sound";
import { parseProjectorLineInSection, type KadrProjectorCue } from "../../theater/model/kadr-projector";
import { applyKadrSound } from "./apply-kadr-sound";
import { applyKadrProjector, showProjectorHold } from "./apply-kadr-projector";
import { recordSoundKadrForSection } from "./record-kadr-sound";
import { recordProjectorKadrForSection } from "./record-kadr-projector";
import {
  closeProjectorWindow,
  isProjectorWindowOpen,
  notifyProjectorReady,
  openProjectorWindow,
  pauseProjectorVideo,
  resumeProjectorVideo,
  subscribeProjectorOutputErrors,
  subscribeProjectorPlayback,
} from "../../projector/model/projector-playback-bridge";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import { normalizeHoldImages } from "../../projector/model/scene-projector-persist";
import { getPlaylistPlaybackSnapshot } from "../../scene/model/scene-playback-bridge";
import { recordLightKadrForSection } from "../../../shared/components/light-console/light-kadr-record";
import { formatChannelShort } from "../../../shared/components/light-console/light-console-labels";
import {
  appendLightChannel,
  patchSceneDataForLightChannelCount,
  removeLastLightChannel,
} from "../../../shared/components/light-console/light-channels-mutate";
import { resolveLightFaders, resolveLightPrograms } from "../../../shared/components/light-console/light-console-data";
import { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import type { ScriptStep } from "../../../shared/types/script";
import {
  appendKadrToStep,
  buildSpectacleKadrTape,
  findTapeIndexForStepKadr,
  isLastTapeItemInStep,
  nextKadrNumberForStep,
  type SpectacleTapeItem,
} from "./spectacle-kadr-tape";

export type UseSpectacleRunArgs = {
  projectName: string;
  steps: ScriptStep[];
  lightChannels: string[];
};

export function useSpectacleRun({ projectName, steps, lightChannels }: UseSpectacleRunArgs) {
  const dispatch = useAppDispatch();
  const { sceneData, setSceneData, updateStep, setCurrentPage, currentPage } = useScene();
  const tape = useMemo(() => buildSpectacleKadrTape(steps), [steps]);
  const [tapeIndex, setTapeIndex] = useState(0);
  const textHidden = useAppSelector((state) => state.scriptUi.spectacleRunTextHidden);
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [isProjectorOpen, setIsProjectorOpen] = useState(() => isProjectorWindowOpen());
  const [projectorDraft, setProjectorDraft] = useState<KadrProjectorCue>({ mode: "hold" });
  const [projectorPlayback, setProjectorPlayback] = useState<{
    videoId: number | null;
    holdId: number | null;
    playing: boolean;
    mode: "video" | "hold" | "black";
  }>({ videoId: null, holdId: null, playing: false, mode: "black" });
  const applyingTapeRef = useRef(false);
  const liveSaveTimerRef = useRef<number | null>(null);
  const tapeIndexRef = useRef(0);
  const tapeInitRef = useRef(false);
  const pendingTapeKadrIdRef = useRef<string | null>(null);
  const skipTapeApplyEffectRef = useRef(false);
  /** Первый заход в репетицию: не затирать общий пульт снимком картины (правки из 3D театра). */
  const skipKadrFadersOnceRef = useRef(true);
  const stepsRef = useRef(steps);
  const tapeRef = useRef(tape);
  stepsRef.current = steps;
  tapeRef.current = tape;

  const lightFaders = useMemo(
    () => resolveLightFaders(sceneData?.lightFaders ?? undefined),
    [sceneData?.lightFaders],
  );
  const lightPrograms = useMemo(
    () => resolveLightPrograms(sceneData?.lightPrograms),
    [sceneData?.lightPrograms],
  );

  const clampedIndex = tape.length === 0 ? 0 : Math.min(tapeIndex, tape.length - 1);
  const currentItem = tape[clampedIndex] ?? null;
  const currentStep = currentItem ? steps[currentItem.stepIndex] : null;

  tapeIndexRef.current = clampedIndex;

  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: currentStep?.theaterSpotlights ?? [],
  });

  const appendLightChannelSlot = useCallback(() => {
    const next = appendLightChannel(lightChannels);
    if (next.length === lightChannels.length) return;
    dispatch(
      showScriptMarkdownActions.setLightChannels({
        projectSlug: projectName,
        sceneName: "script",
        lightChannels: next,
      }),
    );
    setSceneData((prev) => ({
      ...(prev ?? {}),
      ...patchSceneDataForLightChannelCount(prev, next, lightChannels.length),
    }));
    liveConsole.selectChannel(next.length);
    setLiveStatus(
      `Добавлен ${formatChannelShort(next.length)} · каналов на пульте: ${next.length}`,
    );
  }, [dispatch, lightChannels, liveConsole, projectName, setSceneData]);

  const removeLightChannelSlot = useCallback(() => {
    const next = removeLastLightChannel(lightChannels);
    if (!next) return;
    dispatch(
      showScriptMarkdownActions.setLightChannels({
        projectSlug: projectName,
        sceneName: "script",
        lightChannels: next,
      }),
    );
    setSceneData((prev) => ({
      ...(prev ?? {}),
      ...patchSceneDataForLightChannelCount(prev, next, lightChannels.length),
    }));
    const slot = Math.min(
      Math.max(1, liveConsole.selectedLightSlot || 1),
      next.length,
    );
    if (slot !== liveConsole.selectedLightSlot) {
      liveConsole.selectChannel(slot);
    }
    setLiveStatus(`Удалён последний канал · осталось ${next.length}`);
  }, [
    dispatch,
    lightChannels,
    liveConsole,
    liveConsole.selectedLightSlot,
    projectName,
    setSceneData,
  ]);

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
    },
    [
      lightChannels,
      liveConsole.faders,
      liveConsole.programs,
      liveConsole.selectedLightSlot,
      sceneData?.lightChannelRoles,
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
      });
    });
    const unsubErrors = subscribeProjectorOutputErrors((error) => {
      const label = error.scope === "hold" ? "заставку" : "видео";
      setLiveStatus(`Проектор: не удалось показать ${label} — ${error.message}`);
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
    setProjectorPlayback({ videoId: null, holdId: null, playing: false, mode: "black" });
    setLiveStatus("Проектор закрыт");
  }, []);

  const ensureProjectorOpen = useCallback((): boolean => {
    if (isProjectorWindowOpen()) {
      setIsProjectorOpen(true);
      return true;
    }
    const win = openProjectorWindow();
    if (!win) {
      setLiveStatus("Браузер заблокировал окно — разрешите всплывающие окна");
      return false;
    }
    setIsProjectorOpen(true);
    return true;
  }, []);

  const playProjectorCue = useCallback(
    async (cue: KadrProjectorCue, statusLabel?: string) => {
      setProjectorDraft(cue);
      if (!ensureProjectorOpen()) return;
      await applyKadrProjector(cue, projectorMediaCtx);
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
    [ensureProjectorOpen, holdImages, projectorMediaCtx],
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

  const previewProjectorDraft = useCallback(() => {
    void playProjectorCue(projectorDraft);
  }, [playProjectorCue, projectorDraft]);

  const applyTapeItem = useCallback(
    (item: SpectacleTapeItem, options?: { applyFaders?: boolean }) => {
      applyingTapeRef.current = true;
      setCurrentPage(item.stepIndex);

      const step = stepsRef.current[item.stepIndex];
      if (!step || item.isPlaceholder) {
        applyingTapeRef.current = false;
        return;
      }

      const markdown = String(step.markdown ?? "");
      const section = resolveKadrSectionForTapeItem(markdown, item);
      if (section) {
        const soundCue = parseSoundLineInSection(markdown, section);
        applyKadrSound(soundCue);
        const projectorCue = parseProjectorLineInSection(markdown, section);
        void applyKadrProjector(projectorCue, projectorMediaCtx);
        if (projectorCue) setProjectorDraft(projectorCue);
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
    [liveConsole, projectorMediaCtx, setCurrentPage],
  );

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

  useEffect(() => {
    if (applyingTapeRef.current) return;
    scheduleLiveSave();
    return () => {
      if (liveSaveTimerRef.current != null) {
        window.clearTimeout(liveSaveTimerRef.current);
      }
    };
  }, [consoleSnapshotKey, scheduleLiveSave]);

  useEffect(() => {
    if (tape.length === 0) return;
    if (tapeIndex > tape.length - 1) {
      setTapeIndex(Math.max(0, tape.length - 1));
    }
  }, [tape.length, tapeIndex]);

  const recordSoundToCurrentKadr = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item?.section || item.isPlaceholder) return;
    const step = steps[item.stepIndex];
    if (!step) return;

    const result = recordSoundKadrForSection({
      markdown: String(step.markdown ?? ""),
      section: item.section,
      playlist: (sceneData?.playlist ?? []).map((t) => ({
        id: Number(t.id),
        title: String(t.title ?? ""),
      })),
      sounds: (sceneData?.sounds ?? []).map((s) => ({
        id: Number(s.id),
        title: String(s.title ?? ""),
      })),
    });

    if (!result) {
      const snap = getPlaylistPlaybackSnapshot();
      if (!snap.trackId) {
        setLiveStatus("Включите трек в плейлисте, затем «Записать звук»");
        return;
      }
      return;
    }

    updateStep(step.id, { markdown: result.nextMarkdown } as Partial<ScriptStep>);
    setLiveStatus(result.summary);
  }, [clampedIndex, sceneData?.playlist, sceneData?.sounds, steps, tape, updateStep]);

  const recordProjectorToCurrentKadr = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item?.section || item.isPlaceholder) return;
    const step = steps[item.stepIndex];
    if (!step) return;

    const result = recordProjectorKadrForSection({
      markdown: String(step.markdown ?? ""),
      section: item.section,
      videos: videos.map((v) => ({ id: v.id, title: v.title })),
      holdImages: holdImages.map((h) => ({ id: h.id, title: h.title })),
      cue: projectorDraft,
    });

    if (!result) return;

    updateStep(step.id, { markdown: result.nextMarkdown } as Partial<ScriptStep>);
    setLiveStatus(result.summary);
    if (isProjectorWindowOpen()) {
      void applyKadrProjector(projectorDraft, projectorMediaCtx);
    }
  }, [
    clampedIndex,
    holdImages,
    projectorDraft,
    projectorMediaCtx,
    steps,
    tape,
    updateStep,
    videos,
  ]);

  const addKadrToCurrentStep = useCallback(() => {
    const item = tape[clampedIndex];
    if (!item) return;
    const step = steps[item.stepIndex];
    if (!step) return;

    const { nextMarkdown, nextKadrs, kadrId, kadrNo } = appendKadrToStep({ step });
    pendingTapeKadrIdRef.current = kadrId;
    updateStep(step.id, {
      markdown: nextMarkdown,
      lightKadrs: nextKadrs,
    } as Partial<ScriptStep>);
    setLiveStatus(
      `Картина ${kadrNo}: настройте пульт ниже → «Записать свет» или сдвиньте любой фейдер`,
    );
  }, [clampedIndex, steps, tape, updateStep]);

  const canRecordLight = useMemo(() => {
    if (!currentItem || currentItem.isPlaceholder || !currentStep) return false;
    return Boolean(
      resolveKadrSectionForTapeItem(String(currentStep.markdown ?? ""), currentItem),
    );
  }, [currentItem, currentStep]);

  const recordLightToCurrentKadr = useCallback(() => {
    flushLiveSave();
  }, [flushLiveSave]);

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
        applyTapeItem(target);
      }

      skipTapeApplyEffectRef.current = true;
      tapeIndexRef.current = clamped;
      setTapeIndex(clamped);
    },
    [
      applyTapeItem,
      flushLiveSaveAtIndex,
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

  const goPrev = useCallback(() => goToTapeIndex(clampedIndex - 1), [clampedIndex, goToTapeIndex]);
  const goNext = useCallback(() => goToTapeIndex(clampedIndex + 1), [clampedIndex, goToTapeIndex]);

  const goNextStep = useCallback(() => {
    if (!currentItem) return;
    const nextInTape = tape.findIndex(
      (item, index) => index > clampedIndex && item.stepIndex > currentItem.stepIndex,
    );
    if (nextInTape >= 0) goToTapeIndex(nextInTape);
  }, [clampedIndex, currentItem, goToTapeIndex, tape]);

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
    canGoPrev: clampedIndex > 0,
    canGoNext,
    isLastInStep,
    isLastInSpectacle,
    nextLabel,
    flushLiveSave,
    recordLightToCurrentKadr,
    canRecordLight,
    addKadrToCurrentStep,
    nextKadrNo: currentStep ? nextKadrNumberForStep(currentStep) : 1,
    canAddKadr: Boolean(currentStep),
    recordSoundToCurrentKadr,
    canRecordSound: Boolean(currentItem?.section && !currentItem?.isPlaceholder),
    recordProjectorToCurrentKadr,
    canRecordProjector: Boolean(currentItem?.section && !currentItem?.isPlaceholder),
    canPreviewProjector: true,
    projectorDraft,
    setProjectorDraft,
    videos,
    holdImages,
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
    removeProjectorVideo,
    removeProjectorHold,
    projectorPlayback,
    previewProjectorDraft,
    projectName,
    appendLightChannelSlot,
    removeLightChannelSlot,
  };
}
