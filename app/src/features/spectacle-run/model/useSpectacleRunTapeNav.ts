import { useCallback, useEffect, useRef, type Dispatch, type MutableRefObject, type SetStateAction } from "react";
import { invokePlaylistPause } from "../../playbook/model/playbook-playback-bridge";
import {
  resolveKadrProjectorVideoOptions,
  type KadrProjectorCue,
} from "../../theater/model/kadr-projector";
import { findKadrById, readSceneLightKadrs } from "../../theater/model/light-kadrs";
import { applyKadrLook } from "../../theater/model/kadr-store";
import { pauseProjectorVideo } from "../../projector/model/projector-playback-bridge";
import type { ProjectorMediaContext } from "../../projector/model/projector-media";
import type { ScriptScene } from "../../../shared/types/script";
import type {
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import { applyKadrProjector } from "./apply-kadr-projector";
import { applyKadrSound } from "./apply-kadr-sound";
import { isKeyboardTypingTarget } from "./spectacle-run-helpers";
import {
  findTapeIndexForSceneKadr,
  isLastTapeItemInScene,
  type SpectacleTapeItem,
} from "./spectacle-kadr-tape";
import { persistProgRunPaused } from "./prog-run-prefs-storage";

type LiveConsoleLike = {
  faders: PlaybookLightFadersDataV1;
  programs: PlaybookLightProgramsDataV1;
  persistFaders: (next: PlaybookLightFadersDataV1) => void;
  persistPrograms: (next: PlaybookLightProgramsDataV1) => void;
};

type ProjectorApplyApi = {
  setProjectorDraft: (cue: KadrProjectorCue) => void;
  ensureProjectorOpen: () => Promise<boolean>;
  projectorMediaCtx: ProjectorMediaContext;
  resolveProjectorVideoMuted: (videoId: number) => boolean;
  resolveProjectorVideoVolume: (videoId: number) => number;
};

export type UseSpectacleRunTapeNavArgs = {
  projectName: string;
  scenes: ScriptScene[];
  tape: SpectacleTapeItem[];
  tapeIndex: number;
  setTapeIndex: Dispatch<SetStateAction<number>>;
  clampedIndex: number;
  currentItem: SpectacleTapeItem | null;
  currentScene: ScriptScene | null;
  currentPage: number;
  setCurrentPage: (page: number) => void;
  lightPlotMode: string;
  isProgRun: boolean;
  kadrModalOpen: boolean;
  liveConsole: LiveConsoleLike;
  projector: ProjectorApplyApi;
  progRunPausedRef: MutableRefObject<boolean>;
  setProgRunPaused: (paused: boolean) => void;
  persistPaused: (paused: boolean) => void;
  flushLiveSaveAtIndex: (
    index: number,
    snapshot?: {
      faders: PlaybookLightFadersDataV1;
      programs: PlaybookLightProgramsDataV1;
    },
  ) => void;
  liveSaveTimerRef: MutableRefObject<number | null>;
  applyingTapeRef: MutableRefObject<boolean>;
  tapeIndexRef: MutableRefObject<number>;
  scenesRef: MutableRefObject<ScriptScene[]>;
  tapeRef: MutableRefObject<SpectacleTapeItem[]>;
  pendingTapeKadrIdRef: MutableRefObject<string | null>;
  pendingTapeIndexAfterDeleteRef: MutableRefObject<number | null>;
};

export function useSpectacleRunTapeNav({
  projectName,
  scenes,
  tape,
  tapeIndex,
  setTapeIndex,
  clampedIndex,
  currentItem,
  currentScene,
  currentPage,
  setCurrentPage,
  lightPlotMode,
  isProgRun,
  kadrModalOpen,
  liveConsole,
  projector,
  progRunPausedRef,
  setProgRunPaused,
  persistPaused,
  flushLiveSaveAtIndex,
  liveSaveTimerRef,
  applyingTapeRef,
  tapeIndexRef,
  scenesRef,
  tapeRef,
  pendingTapeKadrIdRef,
  pendingTapeIndexAfterDeleteRef,
}: UseSpectacleRunTapeNavArgs) {
  const tapeInitRef = useRef(false);
  const skipTapeApplyEffectRef = useRef(false);
  const skipKadrFadersOnceRef = useRef(false);

  const nextKadrNo =
    !currentScene || !currentItem || currentItem.isPlaceholder ? 1 : currentItem.kadrNo + 1;

  tapeIndexRef.current = clampedIndex;

  const {
    setProjectorDraft,
    ensureProjectorOpen,
    projectorMediaCtx,
    resolveProjectorVideoMuted,
    resolveProjectorVideoVolume,
  } = projector;

  const applyTapeItem = useCallback(
    (item: SpectacleTapeItem, options?: { applyFaders?: boolean; applyPlayback?: boolean }) => {
      applyingTapeRef.current = true;
      setCurrentPage(item.sceneIndex);

      const scene = scenesRef.current[item.sceneIndex];
      if (!scene || item.isPlaceholder) {
        applyingTapeRef.current = false;
        return;
      }

      const applyPlayback =
        options?.applyPlayback ??
        (lightPlotMode === "prog-run" && !progRunPausedRef.current);

      const kadrs = readSceneLightKadrs(scene);
      const kadr = item.kadrId ? findKadrById(kadrs, item.kadrId) : undefined;
      const projectorCue = kadr?.projector ?? null;

      if (projectorCue) setProjectorDraft(projectorCue);
      if (applyPlayback) {
        applyKadrSound(kadr?.sound);
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

      const applyFaders = options?.applyFaders !== false;
      if (kadr && applyFaders) {
        const look = applyKadrLook(kadr, liveConsole.faders);
        liveConsole.persistFaders(look.faders);
        if (look.programId != null) {
          liveConsole.persistPrograms({
            ...liveConsole.programs,
            activeProgramId: look.programId,
          });
        }
      } else if (kadr && kadr.programId > 0) {
        liveConsole.persistPrograms({
          ...liveConsole.programs,
          activeProgramId: kadr.programId,
        });
      }

      applyingTapeRef.current = false;
    },
    [
      applyingTapeRef,
      ensureProjectorOpen,
      lightPlotMode,
      liveConsole,
      progRunPausedRef,
      projectorMediaCtx,
      resolveProjectorVideoMuted,
      resolveProjectorVideoVolume,
      scenesRef,
      setCurrentPage,
      setProjectorDraft,
    ],
  );

  const toggleProgRunPause = useCallback(() => {
    if (progRunPausedRef.current) {
      persistPaused(false);
      const item = tapeRef.current[tapeIndexRef.current];
      if (item) {
        applyTapeItem(item, { applyFaders: false, applyPlayback: true });
      }
      return;
    }

    persistPaused(true);
    invokePlaylistPause();
    pauseProjectorVideo();
  }, [applyTapeItem, persistPaused, progRunPausedRef, tapeRef]);

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
  }, [applyTapeItem, clampedIndex, lightPlotMode, progRunPausedRef, tape]);

  useEffect(() => {
    if (tape.length === 0) return;
    if (tapeIndex > tape.length - 1) {
      setTapeIndex(Math.max(0, tape.length - 1));
    }
  }, [tape.length, tapeIndex]);

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
      applyingTapeRef,
      flushLiveSaveAtIndex,
      isProgRun,
      liveConsole.faders,
      liveConsole.programs,
      liveSaveTimerRef,
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
  }, [tape, scenes, goToTapeIndex, pendingTapeKadrIdRef]);

  useEffect(() => {
    const pendingIndex = pendingTapeIndexAfterDeleteRef.current;
    if (pendingIndex == null || tape.length === 0) return;
    pendingTapeIndexAfterDeleteRef.current = null;
    const nextIndex = Math.min(pendingIndex, tape.length - 1);
    goToTapeIndex(Math.max(0, nextIndex));
  }, [tape, scenes, goToTapeIndex, pendingTapeIndexAfterDeleteRef]);

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
  }, [applyTapeItem, goToTapeIndex, progRunPausedRef, projectName, setProgRunPaused, tape]);

  const isLastInSpectacle = clampedIndex >= tape.length - 1;
  const isLastInScene = isLastTapeItemInScene(tape, clampedIndex);
  const canGoNext = !isLastInSpectacle;
  const nextLabel = isLastInScene ? "Следующая сцена" : "Далее";

  return {
    tapeIndex: clampedIndex,
    tapeIndexRef,
    currentItem,
    currentScene,
    nextKadrNo,
    applyTapeItem,
    toggleProgRunPause,
    goToTapeIndex,
    goPrev,
    goNext,
    goNextScene,
    startProgRun,
    canGoPrev: clampedIndex > 0,
    canGoNext,
    isLastInScene,
    isLastInSpectacle,
    nextLabel,
    applyingTapeRef,
  };
}
