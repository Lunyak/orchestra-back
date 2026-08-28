import { useCallback, useEffect, useMemo, type MutableRefObject } from "react";
import type {
  PlaybookLightChannelRolesV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import type { ScriptScene } from "../../../shared/types/script";
import { findKadrById, readSceneLightKadrs } from "../../theater/model/light-kadrs";
import { recordLightKadrForSection } from "../../../shared/components/light-console/light-kadr-record";
import type { SpectacleTapeItem } from "./spectacle-kadr-tape";

type LiveConsoleSnapshot = {
  faders: PlaybookLightFadersDataV1;
  programs: PlaybookLightProgramsDataV1;
  selectedLightSlot: number;
};

export type UseSpectacleRunLiveSaveArgs = {
  lightChannels: string[];
  liveConsole: LiveConsoleSnapshot;
  lightChannelRoles: PlaybookLightChannelRolesV1 | null | undefined;
  updateScene: (sceneId: number, patch: Partial<ScriptScene>) => void;
  saveScenesForLightPlot: (opts: { force: boolean }) => Promise<unknown> | void;
  setLiveStatus: (message: string | null) => void;
  isProgRun: boolean;
  applyingTapeRef: MutableRefObject<boolean>;
  kadrModalOpenRef: MutableRefObject<boolean>;
  isProgRunRef: MutableRefObject<boolean>;
  tapeIndexRef: MutableRefObject<number>;
  liveSaveTimerRef: MutableRefObject<number | null>;
  tapeRef: MutableRefObject<SpectacleTapeItem[]>;
  scenesRef: MutableRefObject<ScriptScene[]>;
};

export function useSpectacleRunLiveSave({
  lightChannels,
  liveConsole,
  lightChannelRoles,
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
}: UseSpectacleRunLiveSaveArgs) {

  const cancelPendingLiveSave = useCallback(() => {
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
    }
  }, []);

  const flushLiveSaveAtIndex = useCallback(
    (
      index: number,
      snapshot?: {
        faders: PlaybookLightFadersDataV1;
        programs: PlaybookLightProgramsDataV1;
      },
    ) => {
      if (kadrModalOpenRef.current) return;
      // Прогон только применяет look с ленты — пульт туда не пишет.
      if (isProgRunRef.current) return;

      const item = tapeRef.current[index];
      const scene = item ? scenesRef.current[item.sceneIndex] : null;
      if (!item || !scene || item.isPlaceholder || !item.kadrId) return;

      const kadrs = readSceneLightKadrs(scene);
      const existingKadr = findKadrById(kadrs, item.kadrId);
      const isBlackoutKadr =
        existingKadr?.blackout === true ||
        (existingKadr != null && existingKadr.programId <= 0);
      if (isBlackoutKadr) return;

      const faders = snapshot?.faders ?? liveConsole.faders;
      const programs = snapshot?.programs ?? liveConsole.programs;

      const programId = Math.max(
        1,
        Math.trunc(programs.activeProgramId ?? programs.programs[0]?.id ?? 1) || 1,
      );

      const roles =
        lightChannelRoles && lightChannelRoles.v === 1 ? lightChannelRoles : null;

      const result = recordLightKadrForSection({
        kadrId: item.kadrId,
        kadrNo: item.kadrNo,
        title: item.headingTitle,
        kadrs,
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
      } as Partial<ScriptScene>);
      setLiveStatus(result.summary);
      void saveScenesForLightPlot({ force: true });
    },
    [
      kadrModalOpenRef,
      isProgRunRef,
      tapeRef,
      scenesRef,
      lightChannels,
      liveConsole.faders,
      liveConsole.programs,
      liveConsole.selectedLightSlot,
      lightChannelRoles,
      saveScenesForLightPlot,
      setLiveStatus,
      updateScene,
    ],
  );

  const flushLiveSave = useCallback(() => {
    flushLiveSaveAtIndex(tapeIndexRef.current);
  }, [flushLiveSaveAtIndex, tapeIndexRef]);

  const scheduleLiveSave = useCallback(() => {
    if (applyingTapeRef.current) return;
    if (kadrModalOpenRef.current) return;
    if (isProgRunRef.current) return;
    const item = tapeRef.current[tapeIndexRef.current];
    if (!item || item.isPlaceholder || !item.kadrId) return;
    const scene = scenesRef.current[item.sceneIndex];
    if (!scene) {
      return;
    }
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
    }
    liveSaveTimerRef.current = window.setTimeout(() => {
      liveSaveTimerRef.current = null;
      flushLiveSave();
    }, 550);
  }, [
    applyingTapeRef,
    flushLiveSave,
    isProgRunRef,
    kadrModalOpenRef,
    scenesRef,
    tapeIndexRef,
    tapeRef,
  ]);

  const flushPendingLiveSave = useCallback(() => {
    if (liveSaveTimerRef.current != null) {
      window.clearTimeout(liveSaveTimerRef.current);
      liveSaveTimerRef.current = null;
      flushLiveSaveAtIndex(tapeIndexRef.current);
    }
  }, [flushLiveSaveAtIndex, tapeIndexRef]);

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
    if (isProgRun) {
      cancelPendingLiveSave();
      return;
    }
    if (applyingTapeRef.current) return;
    scheduleLiveSave();
    return () => {
      flushPendingLiveSave();
    };
  }, [
    applyingTapeRef,
    cancelPendingLiveSave,
    consoleSnapshotKey,
    flushPendingLiveSave,
    isProgRun,
    scheduleLiveSave,
  ]);

  useEffect(() => {
    const onPageHide = () => {
      flushPendingLiveSave();
      void saveScenesForLightPlot({ force: true });
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [flushPendingLiveSave, saveScenesForLightPlot]);

  return {
    liveSaveTimerRef,
    cancelPendingLiveSave,
    flushLiveSaveAtIndex,
    flushLiveSave,
    scheduleLiveSave,
    flushPendingLiveSave,
  };
}
