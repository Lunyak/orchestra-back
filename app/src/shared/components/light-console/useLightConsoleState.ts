import { useCallback, useEffect, useMemo, useRef } from "react";
import { useScene, type SceneLightFadersDataV1, type SceneLightProgramsDataV1 } from "../../../features/scene";
import {
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
} from "../../../features/show-script-markdown/model/show-script-markdown-slice";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import type { TheaterSpotlight } from "../../../shared/types/script";
import {
  applyProgramFaderStatesToBoard,
  buildCompleteLightFaders,
  buildFaderBoardForConsoleChannel,
  coerceProgramId,
  createDefaultLightFaders,
  lightProgramsNeedNormalization,
  readProgramChannelFaderStates,
  resolveLightProgramMinCount,
  resolveLightPrograms,
  upsertActiveProgramSnapshotFromAllChannels,
  upsertProgramChannelSnapshot,
} from "./light-console-data";

type UseLightConsoleStateArgs = {
  projectName: string;
  spotlights?: TheaterSpotlight[];
  /** Override faders (kadr snapshot preview). */
  fadersOverride?: SceneLightFadersDataV1 | null;
  /** Override active program id (kadr preview). */
  activeProgramIdOverride?: number | null;
  readOnly?: boolean;
  onFadersChange?: (next: SceneLightFadersDataV1) => void;
  onProgramsChange?: (next: SceneLightProgramsDataV1) => void;
};

export function useLightConsoleState({
  projectName,
  spotlights = [],
  fadersOverride,
  activeProgramIdOverride,
  readOnly = false,
  onFadersChange,
  onProgramsChange,
}: UseLightConsoleStateArgs) {
  const dispatch = useAppDispatch();
  const { sceneData, setSceneData } = useScene();
  const programSaveTimerRef = useRef<number | null>(null);
  const channelSaveTimerRef = useRef<number | null>(null);
  const activeProgramIdRef = useRef<number | null>(null);
  const editingChannelRef = useRef(1);
  const programsBootstrappedRef = useRef(false);
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );

  const persistedFaders = useMemo(
    () =>
      buildCompleteLightFaders(
        sceneData?.lightFaders && sceneData.lightFaders.v === 1
          ? sceneData.lightFaders
          : createDefaultLightFaders(),
      ),
    [sceneData?.lightFaders],
  );
  const faders = fadersOverride ?? persistedFaders;
  const programs = useMemo(
    () =>
      resolveLightPrograms(
        sceneData?.lightPrograms,
        resolveLightProgramMinCount(lightChannels.length, sceneData?.lightPrograms),
      ),
    [lightChannels.length, sceneData?.lightPrograms],
  );
  const displayPrograms =
    activeProgramIdOverride != null
      ? { ...programs, activeProgramId: activeProgramIdOverride }
      : programs;
  const activeProgram =
    displayPrograms.programs.find((program) => program.id === displayPrograms.activeProgramId) ??
    displayPrograms.programs[0];

  const fadersSnapshotKey = useMemo(
    () =>
      JSON.stringify(
        faders.faders.map((item) => ({
          faderId: item.id,
          intensity: item.intensity ?? 1,
          enabled: item.enabled ?? true,
          color: item.color,
        })),
      ),
    [faders.faders],
  );

  const persistFaders = useCallback(
    (next: SceneLightFadersDataV1, syncChannelSnapshot = false) => {
      if (readOnly || fadersOverride) {
        onFadersChange?.(next);
        return;
      }
      if (onFadersChange) {
        onFadersChange(next);
        return;
      }
      if (!syncChannelSnapshot) {
        setSceneData((prev) => ({
          ...(prev ?? {}),
          lightFaders: next,
        }));
        return;
      }
      setSceneData((prev) => {
        const channel = Math.max(1, editingChannelRef.current || selectedLightSlot || 1);
        const prevPrograms =
          prev?.lightPrograms && prev.lightPrograms.v === 1 ? prev.lightPrograms : programs;
        const resolvedPrograms = resolveLightPrograms(
          prevPrograms,
          resolveLightProgramMinCount(lightChannels.length, prevPrograms, channel),
        );
        return {
          ...(prev ?? {}),
          lightFaders: next,
          lightPrograms: upsertProgramChannelSnapshot(resolvedPrograms, channel, next),
        };
      });
    },
    [
      fadersOverride,
      lightChannels.length,
      onFadersChange,
      programs,
      readOnly,
      selectedLightSlot,
      setSceneData,
    ],
  );

  const persistPrograms = useCallback(
    (next: SceneLightProgramsDataV1) => {
      if (readOnly) return;
      const normalized = resolveLightPrograms(next);
      if (onProgramsChange) {
        onProgramsChange(normalized);
        return;
      }
      setSceneData((prev) => ({
        ...(prev ?? {}),
        lightPrograms: normalized,
      }));
    },
    [onProgramsChange, readOnly, setSceneData],
  );

  useEffect(() => {
    if (readOnly || fadersOverride || programsBootstrappedRef.current) return;
    const raw = sceneData?.lightPrograms;
    if (!lightProgramsNeedNormalization(raw)) {
      programsBootstrappedRef.current = true;
      return;
    }
    programsBootstrappedRef.current = true;
    persistPrograms(resolveLightPrograms(raw));
  }, [fadersOverride, persistPrograms, readOnly, sceneData?.lightPrograms]);

  const patchFader = (
    faderId: number,
    patch: Partial<SceneLightFadersDataV1["faders"][number]>,
  ) => {
    const nextFaders = faders.faders.map((item) =>
      item.id === faderId ? { ...item, ...patch } : item,
    );
    persistFaders({ ...faders, faders: nextFaders }, true);
  };

  const applyProgram = (program = activeProgram) => {
    if (!program || readOnly) return;
    const stateByFader = new Map(program.faders.map((state) => [state.faderId, state]));
    persistFaders({
      v: 1,
      count: faders.count,
      faders: faders.faders.map((item) => {
        const state = stateByFader.get(item.id);
        return state
          ? {
              ...item,
              intensity: state.intensity ?? item.intensity,
              enabled: state.enabled ?? item.enabled,
              color: state.color ?? item.color,
            }
          : item;
      }),
    });
  };

  const saveProgramSnapshot = useCallback(() => {
    if (!activeProgram || readOnly) return;
    const channelCount = Math.max(1, lightChannels.length);
    persistPrograms(
      upsertActiveProgramSnapshotFromAllChannels(
        programs,
        activeProgram.id,
        persistedFaders,
        channelCount,
        faders,
      ),
    );
  }, [
    activeProgram,
    faders,
    lightChannels.length,
    persistPrograms,
    persistedFaders,
    programs,
    readOnly,
  ]);

  const saveChannelSnapshot = useCallback(
    (channelId: number) => {
      if (readOnly || fadersOverride) return;
      const id = coerceProgramId(channelId);
      if (id == null) return;
      persistPrograms(upsertProgramChannelSnapshot(programs, id, faders));
    },
    [faders, fadersOverride, persistPrograms, programs, readOnly],
  );

  useEffect(() => {
    if (readOnly || fadersOverride) return;
    const channel = Math.max(1, editingChannelRef.current || selectedLightSlot || 1);
    if (channelSaveTimerRef.current != null) {
      window.clearTimeout(channelSaveTimerRef.current);
    }
    channelSaveTimerRef.current = window.setTimeout(() => {
      saveChannelSnapshot(channel);
      channelSaveTimerRef.current = null;
    }, 550);
    return () => {
      if (channelSaveTimerRef.current != null) {
        window.clearTimeout(channelSaveTimerRef.current);
      }
    };
  }, [fadersOverride, fadersSnapshotKey, readOnly, saveChannelSnapshot, selectedLightSlot]);

  useEffect(() => {
    if (!activeProgram || readOnly || fadersOverride) return;
    if (activeProgramIdRef.current !== activeProgram.id) {
      activeProgramIdRef.current = activeProgram.id;
      return;
    }
    if (programSaveTimerRef.current != null) {
      window.clearTimeout(programSaveTimerRef.current);
    }
    programSaveTimerRef.current = window.setTimeout(() => {
      saveProgramSnapshot();
      programSaveTimerRef.current = null;
    }, 550);
    return () => {
      if (programSaveTimerRef.current != null) {
        window.clearTimeout(programSaveTimerRef.current);
      }
    };
  }, [activeProgram?.id, fadersOverride, fadersSnapshotKey, readOnly, saveProgramSnapshot]);

  useEffect(() => {
    editingChannelRef.current = Math.max(1, selectedLightSlot || 1);
  }, [selectedLightSlot]);

  const selectChannel = (slot: number) => {
    const max = Math.max(1, lightChannels.length);
    const next = Math.max(1, Math.min(max, Math.trunc(slot) || 1));
    const prev = editingChannelRef.current;

    if (!readOnly && !fadersOverride && prev !== next) {
      if (channelSaveTimerRef.current != null) {
        window.clearTimeout(channelSaveTimerRef.current);
        channelSaveTimerRef.current = null;
      }
      const programsAfterSave = upsertProgramChannelSnapshot(programs, prev, faders);
      const resolvedPrograms = resolveLightPrograms(
        programsAfterSave,
        resolveLightProgramMinCount(lightChannels.length, programsAfterSave, next),
      );
      const nextFaders = buildFaderBoardForConsoleChannel(faders, resolvedPrograms, next);
      editingChannelRef.current = next;
      persistPrograms(resolvedPrograms);
      persistFaders(nextFaders);
    } else {
      editingChannelRef.current = next;
    }

    dispatch(
      showScriptMarkdownActions.setSelectedLightSlot({
        projectSlug: projectName,
        sceneName: "script",
        slot: next,
      }),
    );
  };

  const selectProgram = (programId: number) => {
    if (readOnly) return;
    const id = coerceProgramId(programId);
    if (id == null) return;
    const program = programs.programs.find((item) => item.id === id);
    if (!program) return;
    activeProgramIdRef.current = id;

    if (channelSaveTimerRef.current != null) {
      window.clearTimeout(channelSaveTimerRef.current);
      channelSaveTimerRef.current = null;
    }
    const programsAfterChannelSave = upsertProgramChannelSnapshot(
      programs,
      editingChannelRef.current,
      faders,
    );
    const resolvedPrograms = resolveLightPrograms(
      programsAfterChannelSave,
      resolveLightProgramMinCount(lightChannels.length, programsAfterChannelSave, id),
    );
    const nextFaders = buildFaderBoardForConsoleChannel(faders, resolvedPrograms, id);
    editingChannelRef.current = id;
    const nextPrograms = {
      ...resolvedPrograms,
      activeProgramId: id,
    };

    if (onProgramsChange) {
      onProgramsChange(nextPrograms);
      onFadersChange?.(nextFaders);
      return;
    }
    if (onFadersChange) {
      persistPrograms(nextPrograms);
      onFadersChange(nextFaders);
      return;
    }

    setSceneData((prev) => ({
      ...(prev ?? {}),
      lightPrograms: resolveLightPrograms({
        ...(prev?.lightPrograms && prev.lightPrograms.v === 1 ? prev.lightPrograms : programs),
        activeProgramId: id,
      }),
      lightFaders: nextFaders,
    }));
  };

  return {
    lightChannels,
    selectedLightSlot,
    faders,
    programs: displayPrograms,
    activeProgram,
    selectChannel,
    selectProgram,
    patchFader,
    applyProgram,
    saveProgramSnapshot,
    persistFaders,
    persistPrograms,
  };
}
