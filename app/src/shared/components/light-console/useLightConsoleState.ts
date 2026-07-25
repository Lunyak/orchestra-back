import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePlaybook, type PlaybookLightFadersDataV1, type PlaybookLightProgramsDataV1 } from "../../../features/playbook";
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
  resolveLightProgramMinCount,
  resolveLightPrograms,
  upsertActiveProgramSnapshotFromAllChannels,
  upsertChannelMemorySnapshot,
} from "./light-console-data";

type UseLightConsoleStateArgs = {
  projectName: string;
  spotlights?: TheaterSpotlight[];
  /** Override faders (kadr snapshot preview). */
  fadersOverride?: PlaybookLightFadersDataV1 | null;
  /** Override active program id (kadr preview). */
  activeProgramIdOverride?: number | null;
  readOnly?: boolean;
  onFadersChange?: (next: PlaybookLightFadersDataV1) => void;
  onProgramsChange?: (next: PlaybookLightProgramsDataV1) => void;
};

export function useLightConsoleState({
  projectName,
  spotlights: _spotlights = [],
  fadersOverride,
  activeProgramIdOverride,
  readOnly = false,
  onFadersChange,
  onProgramsChange,
}: UseLightConsoleStateArgs) {
  const dispatch = useAppDispatch();
  const { playbookData, setPlaybookData } = usePlaybook();
  const channelSaveTimerRef = useRef<number | null>(null);
  const editingChannelRef = useRef(1);
  const programsBootstrappedRef = useRef(false);
  const { lightChannels, selectedLightSlot } = useAppSelector((state) =>
    selectShowScriptMarkdownUi(state, projectName ?? "", "script"),
  );

  const persistedFaders = useMemo(
    () =>
      buildCompleteLightFaders(
        playbookData?.lightFaders && playbookData.lightFaders.v === 1
          ? playbookData.lightFaders
          : createDefaultLightFaders(),
      ),
    [playbookData?.lightFaders],
  );
  const faders = fadersOverride ?? persistedFaders;
  const programs = useMemo(
    () =>
      resolveLightPrograms(
        playbookData?.lightPrograms,
        resolveLightProgramMinCount(lightChannels.length, playbookData?.lightPrograms),
        lightChannels.length,
      ),
    [lightChannels.length, playbookData?.lightPrograms],
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
    (next: PlaybookLightFadersDataV1, syncChannelSnapshot = false) => {
      if (readOnly || fadersOverride) {
        onFadersChange?.(next);
        return;
      }
      if (onFadersChange) {
        onFadersChange(next);
        return;
      }
      if (!syncChannelSnapshot) {
        setPlaybookData((prev) => ({
          ...(prev ?? {}),
          lightFaders: next,
        }));
        return;
      }
      setPlaybookData((prev) => {
        const channel = Math.max(1, editingChannelRef.current || selectedLightSlot || 1);
        const prevPrograms =
          prev?.lightPrograms && prev.lightPrograms.v === 1 ? prev.lightPrograms : programs;
        const resolvedPrograms = resolveLightPrograms(
          prevPrograms,
          resolveLightProgramMinCount(lightChannels.length, prevPrograms, channel),
          lightChannels.length,
        );
        return {
          ...(prev ?? {}),
          lightFaders: next,
          lightPrograms: upsertChannelMemorySnapshot(
            resolvedPrograms,
            channel,
            next,
            lightChannels.length,
          ),
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
      setPlaybookData,
    ],
  );

  const persistPrograms = useCallback(
    (next: PlaybookLightProgramsDataV1) => {
      if (readOnly) return;
      const normalized = resolveLightPrograms(next, undefined, lightChannels.length);
      if (onProgramsChange) {
        onProgramsChange(normalized);
        return;
      }
      setPlaybookData((prev) => ({
        ...(prev ?? {}),
        lightPrograms: normalized,
      }));
    },
    [lightChannels.length, onProgramsChange, readOnly, setPlaybookData],
  );

  useEffect(() => {
    if (readOnly || fadersOverride || programsBootstrappedRef.current) return;
    const raw = playbookData?.lightPrograms;
    if (!lightProgramsNeedNormalization(raw, lightChannels.length)) {
      programsBootstrappedRef.current = true;
      return;
    }
    programsBootstrappedRef.current = true;
    persistPrograms(resolveLightPrograms(raw, undefined, lightChannels.length));
  }, [
    fadersOverride,
    lightChannels.length,
    persistPrograms,
    readOnly,
    playbookData?.lightPrograms,
  ]);

  const patchFader = (
    faderId: number,
    patch: Partial<PlaybookLightFadersDataV1["faders"][number]>,
  ) => {
    const nextFaders = faders.faders.map((item) =>
      item.id === faderId ? { ...item, ...patch } : item,
    );
    persistFaders({ ...faders, faders: nextFaders }, true);
  };

  const applyProgram = (program = activeProgram) => {
    if (!program || readOnly) return;
    const nextFaders = applyProgramFaderStatesToBoard(faders, program.faders ?? []);
    const channel = Math.max(1, editingChannelRef.current || selectedLightSlot || 1);
    if (onFadersChange) {
      onFadersChange(nextFaders);
      persistPrograms(
        upsertChannelMemorySnapshot(programs, channel, nextFaders, lightChannels.length),
      );
      return;
    }
    setPlaybookData((prev) => {
      const prevPrograms =
        prev?.lightPrograms && prev.lightPrograms.v === 1 ? prev.lightPrograms : programs;
      const resolved = resolveLightPrograms(
        prevPrograms,
        resolveLightProgramMinCount(lightChannels.length, prevPrograms),
        lightChannels.length,
      );
      return {
        ...(prev ?? {}),
        lightFaders: nextFaders,
        lightPrograms: upsertChannelMemorySnapshot(
          resolved,
          channel,
          nextFaders,
          lightChannels.length,
        ),
      };
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
      persistPrograms(upsertChannelMemorySnapshot(programs, id, faders, lightChannels.length));
    },
    [faders, fadersOverride, lightChannels.length, persistPrograms, programs, readOnly],
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
      const programsAfterSave = upsertChannelMemorySnapshot(
        programs,
        prev,
        faders,
        lightChannels.length,
      );
      const resolvedPrograms = resolveLightPrograms(
        programsAfterSave,
        resolveLightProgramMinCount(lightChannels.length, programsAfterSave, next),
        lightChannels.length,
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

    const channel = Math.max(1, editingChannelRef.current || selectedLightSlot || 1);
    if (channelSaveTimerRef.current != null) {
      window.clearTimeout(channelSaveTimerRef.current);
      channelSaveTimerRef.current = null;
    }

    const programsAfterChannelSave = upsertChannelMemorySnapshot(
      programs,
      channel,
      faders,
      lightChannels.length,
    );
    const nextFaders = applyProgramFaderStatesToBoard(faders, program.faders ?? []);
    const nextPrograms: PlaybookLightProgramsDataV1 = {
      ...programsAfterChannelSave,
      activeProgramId: id,
      channels: upsertChannelMemorySnapshot(
        programsAfterChannelSave,
        channel,
        nextFaders,
        lightChannels.length,
      ).channels,
    };

    if (onProgramsChange) {
      onProgramsChange(resolveLightPrograms(nextPrograms, undefined, lightChannels.length));
      onFadersChange?.(nextFaders);
      return;
    }
    if (onFadersChange) {
      persistPrograms(nextPrograms);
      onFadersChange(nextFaders);
      return;
    }

    setPlaybookData((prev) => ({
      ...(prev ?? {}),
      lightPrograms: resolveLightPrograms(nextPrograms, undefined, lightChannels.length),
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
