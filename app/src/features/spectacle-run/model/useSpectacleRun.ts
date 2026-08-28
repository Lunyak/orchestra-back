import { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { usePlaybook } from "../../playbook";
import { type PlaybookLightChannelRolesV1 } from "../../playbook/model/playbook-slice";
import {
  resolveLightFaders,
  resolveLightProgramMinCount,
  resolveLightPrograms,
} from "../../../shared/components/light-console/light-console-data";
import { useLightConsoleLayoutSettings } from "../../../shared/components/light-console/useLightConsoleLayoutSettings";
import { useLightConsoleState } from "../../../shared/components/light-console/useLightConsoleState";
import { migrateSceneLightKadrsFromMarkdown } from "./migrate-kadrs-from-markdown";
import { buildSpectacleKadrTape } from "./spectacle-kadr-tape";
import { type KadrModalMode } from "./create-kadr-from-draft";
import { useSpectacleRunProjector } from "./useSpectacleRunProjector";
import { useSpectacleRunProgPrefs } from "./useSpectacleRunProgPrefs";
import { useSpectacleRunLiveSave } from "./useSpectacleRunLiveSave";
import { useSpectacleRunTapeNav } from "./useSpectacleRunTapeNav";
import { useSpectacleRunKadrActions } from "./useSpectacleRunKadrActions";
import type { UseSpectacleRunArgs } from "./spectacle-run-types";

export type { UseSpectacleRunArgs } from "./spectacle-run-types";

export function useSpectacleRun({ projectName, scenes, lightChannels }: UseSpectacleRunArgs) {
  const dispatch = useAppDispatch();
  const { playbookData, setPlaybookData, updateScene, setCurrentPage, currentPage, saveScenesForLightPlot } =
    usePlaybook();

  const tape = useMemo(() => {
    const scenesForTape = scenes.map((scene) => ({
      ...scene,
      lightKadrs: migrateSceneLightKadrsFromMarkdown(scene),
    }));
    return buildSpectacleKadrTape(scenesForTape);
  }, [scenes]);

  const [tapeIndex, setTapeIndex] = useState(0);
  const [kadrModalOpen, setKadrModalOpen] = useState(false);
  const [kadrModalMode, setKadrModalMode] = useState<KadrModalMode>("create");
  const [liveStatus, setLiveStatus] = useState<string | null>(null);

  const textHidden = useAppSelector((state) => state.scriptUi.spectacleRunTextHidden);
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);
  const isProgRun = lightPlotMode === "prog-run";

  const kadrModalOpenRef = useRef(false);
  const isProgRunRef = useRef(isProgRun);
  isProgRunRef.current = isProgRun;
  const applyingTapeRef = useRef(false);
  const liveSaveTimerRef = useRef<number | null>(null);
  const tapeIndexRef = useRef(0);
  const pendingTapeKadrIdRef = useRef<string | null>(null);
  const pendingTapeIndexAfterDeleteRef = useRef<number | null>(null);
  const scenesRef = useRef(scenes);
  const tapeRef = useRef(tape);
  scenesRef.current = scenes;
  tapeRef.current = tape;

  const clampedIndex = tape.length === 0 ? 0 : Math.min(tapeIndex, tape.length - 1);
  const currentItem = tape[clampedIndex] ?? null;
  const currentScene = currentItem ? scenes[currentItem.sceneIndex] : null;
  tapeIndexRef.current = clampedIndex;

  useEffect(() => {
    kadrModalOpenRef.current = kadrModalOpen;
  }, [kadrModalOpen]);

  const progPrefs = useSpectacleRunProgPrefs({ projectName, isProgRun });

  const projector = useSpectacleRunProjector({
    projectName,
    playbookData,
    dispatch,
    setLiveStatus,
  });

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

  const liveConsole = useLightConsoleState({
    projectName,
    spotlights: currentScene?.theaterSpotlights ?? [],
  });
  const consoleLayoutSettings = useLightConsoleLayoutSettings(projectName);

  const liveSave = useSpectacleRunLiveSave({
    lightChannels,
    liveConsole: {
      faders: liveConsole.faders,
      programs: liveConsole.programs,
      selectedLightSlot: liveConsole.selectedLightSlot,
    },
    lightChannelRoles: playbookData?.lightChannelRoles,
    updateScene,
    saveScenesForLightPlot,
    setLiveStatus,
    isProgRun,
    applyingTapeRef,
    kadrModalOpenRef,
    isProgRunRef,
    tapeIndexRef,
    liveSaveTimerRef,
    tapeRef,
    scenesRef,
  });

  const tapeNav = useSpectacleRunTapeNav({
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
    projector: {
      setProjectorDraft: projector.setProjectorDraft,
      ensureProjectorOpen: projector.ensureProjectorOpen,
      projectorMediaCtx: projector.projectorMediaCtx,
      resolveProjectorVideoMuted: projector.resolveProjectorVideoMuted,
      resolveProjectorVideoVolume: projector.resolveProjectorVideoVolume,
    },
    progRunPausedRef: progPrefs.progRunPausedRef,
    setProgRunPaused: progPrefs.setProgRunPaused,
    persistPaused: progPrefs.persistPaused,
    flushLiveSaveAtIndex: liveSave.flushLiveSaveAtIndex,
    liveSaveTimerRef,
    applyingTapeRef,
    tapeIndexRef,
    scenesRef,
    tapeRef,
    pendingTapeKadrIdRef,
    pendingTapeIndexAfterDeleteRef,
  });

  const kadrActions = useSpectacleRunKadrActions({
    scenes,
    tape,
    clampedIndex,
    currentScene,
    currentItem,
    lightChannels,
    liveConsole,
    playlist: playbookData?.playlist,
    sounds: playbookData?.sounds,
    videos: projector.videos,
    holdImages: projector.holdImages,
    kadrModalMode,
    setKadrModalMode,
    setKadrModalOpen,
    cancelPendingLiveSave: liveSave.cancelPendingLiveSave,
    flushLiveSave: liveSave.flushLiveSave,
    updateScene,
    saveScenesForLightPlot,
    setLiveStatus,
    applyingTapeRef,
    liveSaveTimerRef,
    pendingTapeKadrIdRef,
    pendingTapeIndexAfterDeleteRef,
  });

  const lightChannelRoles =
    playbookData?.lightChannelRoles && playbookData.lightChannelRoles.v === 1
      ? playbookData.lightChannelRoles
      : null;

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
    lightChannelRoles,
    setLightChannelRoles: (next: PlaybookLightChannelRolesV1) => {
      setPlaybookData((prev) => ({ ...(prev ?? {}), lightChannelRoles: next }));
    },
    goPrev: tapeNav.goPrev,
    goNext: tapeNav.goNext,
    goNextScene: tapeNav.goNextScene,
    goToTapeIndex: tapeNav.goToTapeIndex,
    startProgRun: tapeNav.startProgRun,
    progRunPaused: progPrefs.progRunPaused,
    progRunPlaybackEnabled: progPrefs.progRunPlaybackEnabled,
    toggleProgRunPause: tapeNav.toggleProgRunPause,
    progRunKadrStripLayout: progPrefs.progRunKadrStripLayout,
    setProgRunKadrStripLayout: progPrefs.setProgRunKadrStripLayout,
    progRunKadrStripNotesOverlay: progPrefs.progRunKadrStripNotesOverlay,
    setProgRunKadrStripNotesOverlay: progPrefs.setProgRunKadrStripNotesOverlay,
    toggleProgRunKadrStripNotesOverlay: progPrefs.toggleProgRunKadrStripNotesOverlay,
    progRunLightConsoleOpen: progPrefs.progRunLightConsoleOpen,
    setProgRunLightConsoleOpen: progPrefs.setProgRunLightConsoleOpen,
    toggleProgRunLightConsoleOpen: progPrefs.toggleProgRunLightConsoleOpen,
    progRunKadrStripPlainCover: progPrefs.progRunKadrStripPlainCover,
    setProgRunKadrStripPlainCover: progPrefs.setProgRunKadrStripPlainCover,
    toggleProgRunKadrStripPlainCover: progPrefs.toggleProgRunKadrStripPlainCover,
    progRunWideLayout: progPrefs.progRunWideLayout,
    setProgRunWideLayout: progPrefs.setProgRunWideLayout,
    toggleProgRunWideLayout: progPrefs.toggleProgRunWideLayout,
    canGoPrev: tapeNav.canGoPrev,
    canGoNext: tapeNav.canGoNext,
    isLastInScene: tapeNav.isLastInScene,
    isLastInSpectacle: tapeNav.isLastInSpectacle,
    nextLabel: tapeNav.nextLabel,
    flushLiveSave: liveSave.flushLiveSave,
    addKadrToCurrentScene: kadrActions.addKadrToCurrentScene,
    editCurrentKadr: kadrActions.editCurrentKadr,
    deleteCurrentKadr: kadrActions.deleteCurrentKadr,
    canEditKadr: kadrActions.canEditKadr,
    canDeleteKadr: kadrActions.canDeleteKadr,
    nextKadrNo: tapeNav.nextKadrNo,
    canAddKadr: kadrActions.canAddKadr,
    canCopyTheaterFromPreviousScene: kadrActions.canCopyTheaterFromPreviousScene,
    currentSceneTheaterEmpty: kadrActions.currentSceneTheaterEmpty,
    copyTheaterFromPreviousScene: kadrActions.copyTheaterFromPreviousScene,
    canCopyKadrToNext: kadrActions.canCopyKadrToNext,
    copyCurrentKadrToNext: kadrActions.copyCurrentKadrToNext,
    kadrModalOpen,
    kadrModalMode,
    closeKadrModal: kadrActions.closeKadrModal,
    submitKadrModal: kadrActions.submitKadrModal,
    videos: projector.videos,
    holdImages: projector.holdImages,
    projectorMediaCtx: projector.projectorMediaCtx,
    isProjectorOpen: projector.isProjectorOpen,
    openProjector: projector.openProjector,
    closeProjector: projector.closeProjector,
    showProjectorHold: (holdId?: number) => {
      const hold = holdId != null ? projector.holdImages.find((h) => Number(h.id) === holdId) : null;
      const label = hold?.title?.trim() || (holdId != null ? `заставка ${holdId}` : "заставка");
      void projector.playProjectorCue(
        holdId != null ? { mode: "hold", holdId } : { mode: "hold" },
        `Проектор: ${label}`,
      );
    },
    playProjectorVideo: projector.playProjectorVideo,
    toggleProjectorVideo: projector.toggleProjectorVideo,
    isProjectorVideoMuted: projector.resolveProjectorVideoMuted,
    toggleProjectorVideoMute: projector.toggleProjectorVideoMute,
    resolveProjectorVideoVolume: projector.resolveProjectorVideoVolume,
    setProjectorVideoVolumeLevel: projector.setProjectorVideoVolumeLevel,
    seekProjectorVideoTime: projector.seekProjectorVideoTime,
    removeProjectorVideo: projector.removeProjectorVideo,
    removeProjectorHold: projector.removeProjectorHold,
    projectorPlayback: projector.projectorPlayback,
    projectName,
    consoleLayoutSettings,
  };
}
