import type { SceneLightFadersDataV1, SceneLightProgramsDataV1 } from "../../../features/scene/model/scene-slice";
import { LIGHT_CHANNEL_SLOT_COUNT } from "../../../features/theater/model/theater-light-channel-link";
import type { TheaterSpotlight } from "../../types/script";
import {
  formatFaderDefaultLabel,
  formatProgramDefaultLabel,
} from "./light-console-labels";

/** Минимум кнопок П… на пульте (как K1–K8). */
export const DEFAULT_LIGHT_PROGRAM_COUNT = LIGHT_CHANNEL_SLOT_COUNT;

/** ID программы из сцены/JSON (иногда приходит строкой). */
export function coerceProgramId(value: unknown): number | null {
  const id = Math.trunc(Number(value));
  if (!Number.isFinite(id) || id < 1) return null;
  return id;
}

export function createDefaultLightFaders(): SceneLightFadersDataV1 {
  return {
    v: 1,
    count: 8,
    faders: Array.from({ length: 8 }, (_, index) => ({
      id: index + 1,
      label: formatFaderDefaultLabel(index + 1),
      channel: index + 1,
      intensity: 1,
      enabled: true,
      links: [{ channel: index + 1 }],
    })),
  };
}

export function createDefaultLightPrograms(
  count = DEFAULT_LIGHT_PROGRAM_COUNT,
): SceneLightProgramsDataV1 {
  const n = Math.max(1, Math.trunc(count) || DEFAULT_LIGHT_PROGRAM_COUNT);
  return {
    v: 1,
    activeProgramId: 1,
    programs: Array.from({ length: n }, (_, index) => {
      const id = index + 1;
      return { id, label: formatProgramDefaultLabel(id), faders: [] };
    }),
  };
}

export function buildCompleteLightFaders(
  persisted: SceneLightFadersDataV1 | undefined,
): SceneLightFadersDataV1 {
  const countHint = Math.max(1, Math.trunc(Number(persisted?.count) || 8));
  const maxIdInList = (persisted?.faders ?? []).reduce(
    (max, f) => Math.max(max, Math.trunc(Number(f.id) || 0)),
    0,
  );
  const maxFaderId = Math.max(countHint, maxIdInList);
  const byId = new Map<number, SceneLightFadersDataV1["faders"][number]>();
  for (let id = 1; id <= maxFaderId; id += 1) {
    byId.set(id, {
      id,
      label: formatFaderDefaultLabel(id),
      channel: id,
      intensity: 1,
      enabled: true,
      links: [{ channel: id }],
    });
  }
  for (const fader of persisted?.faders ?? []) {
    const id = Math.trunc(Number(fader.id) || 0);
    if (id < 1 || id > maxFaderId) continue;
    byId.set(id, {
      ...byId.get(id),
      ...fader,
      id,
      label: formatFaderDefaultLabel(id, fader.label),
      channel: fader.channel ?? fader.links?.[0]?.channel ?? id,
      links: fader.links?.length
        ? fader.links
        : [{ channel: fader.channel ?? id, spotlightId: fader.spotlightId }],
    });
  }
  return {
    v: 1,
    count: maxFaderId,
    faders: Array.from(byId.values()).sort((a, b) => a.id - b.id),
  };
}

export function resolveLightPrograms(
  raw: SceneLightProgramsDataV1 | null | undefined,
  minCount = DEFAULT_LIGHT_PROGRAM_COUNT,
): SceneLightProgramsDataV1 {
  if (!raw || raw.v !== 1 || !Array.isArray(raw.programs) || raw.programs.length === 0) {
    return createDefaultLightPrograms(minCount);
  }

  const byId = new Map<number, SceneLightProgramsDataV1["programs"][number]>();
  for (const program of raw.programs) {
    const id = coerceProgramId(program.id);
    if (id == null) continue;
    byId.set(id, {
      ...program,
      id,
      label: formatProgramDefaultLabel(id, program.label),
      faders: Array.isArray(program.faders) ? program.faders : [],
    });
  }
  const maxId = Math.max(
    minCount,
    ...Array.from(byId.keys()),
    ...raw.programs.map((program) => coerceProgramId(program.id) ?? 0),
  );

  const programs = Array.from({ length: maxId }, (_, index) => {
    const id = index + 1;
    return byId.get(id) ?? { id, label: formatProgramDefaultLabel(id), faders: [] };
  });

  const activeId = coerceProgramId(raw.activeProgramId);
  const activeProgramId =
    activeId != null && programs.some((program) => program.id === activeId)
      ? activeId
      : (programs[0]?.id ?? 1);

  return { v: 1, activeProgramId, programs };
}

export function lightProgramsNeedNormalization(
  raw: SceneLightProgramsDataV1 | null | undefined,
  minCount = DEFAULT_LIGHT_PROGRAM_COUNT,
): boolean {
  if (!raw || raw.v !== 1 || !Array.isArray(raw.programs)) return true;
  if (raw.programs.length < minCount) return true;
  for (let id = 1; id <= minCount; id += 1) {
    if (!raw.programs.some((program) => coerceProgramId(program.id) === id)) return true;
  }
  return false;
}

export function resolveLightFaders(
  raw: SceneLightFadersDataV1 | null | undefined,
): SceneLightFadersDataV1 {
  if (raw && raw.v === 1) return buildCompleteLightFaders(raw);
  return createDefaultLightFaders();
}

export function snapshotFadersForProgram(
  faders: SceneLightFadersDataV1,
): SceneLightProgramsDataV1["programs"][number]["faders"] {
  return faders.faders.map((item) => ({
    faderId: item.id,
    intensity: item.intensity ?? 1,
    enabled: item.enabled ?? true,
    color: item.color,
  }));
}

function readFaderLevelForSnapshot(
  fader: SceneLightFadersDataV1["faders"][number],
): number {
  if (fader.enabled === false) return 0;
  const raw =
    typeof fader.intensity === "number" && Number.isFinite(fader.intensity)
      ? fader.intensity
      : 1;
  if (raw <= 0) return 0;
  return Math.min(1, raw);
}

/** Память П: все ненулевые F со всех K (память programs[1…N] + текущая доска). */
export function snapshotFadersForProgramFromAllChannels(
  programs: SceneLightProgramsDataV1,
  baseFaders: SceneLightFadersDataV1,
  channelCount: number,
  currentBoard: SceneLightFadersDataV1,
): SceneLightProgramsDataV1["programs"][number]["faders"] {
  const maxCh = Math.max(1, Math.trunc(channelCount) || 1);
  const byFader = new Map<
    number,
    SceneLightProgramsDataV1["programs"][number]["faders"][number]
  >();

  for (let channel = 1; channel <= maxCh; channel += 1) {
    const states = readProgramChannelFaderStates(programs, channel);
    const board =
      states.length > 0
        ? applyProgramFaderStatesToBoard(baseFaders, states)
        : baseFaders;
    for (const fader of board.faders) {
      const level = readFaderLevelForSnapshot(fader);
      if (level <= 0.02) continue;
      byFader.set(fader.id, {
        faderId: fader.id,
        intensity: level,
        enabled: (fader.enabled ?? true) && level > 0.02,
        color: fader.color,
      });
    }
  }

  for (const fader of currentBoard.faders) {
    const level = readFaderLevelForSnapshot(fader);
    byFader.set(fader.id, {
      faderId: fader.id,
      intensity: level,
      enabled: (fader.enabled ?? true) && level > 0.02,
      color: fader.color,
    });
  }

  return [...byFader.values()].sort((a, b) => a.faderId - b.faderId);
}

export function applyProgramFaderStatesToBoard(
  faders: SceneLightFadersDataV1,
  states: SceneLightProgramsDataV1["programs"][number]["faders"],
): SceneLightFadersDataV1 {
  if (!states.length) return faders;
  const stateByFader = new Map(states.map((state) => [state.faderId, state]));
  return {
    ...faders,
    faders: faders.faders.map((item) => {
      const state = stateByFader.get(item.id);
      if (!state) return item;
      return {
        ...item,
        intensity: state.intensity ?? item.intensity,
        enabled: state.enabled ?? item.enabled,
        color: state.color ?? item.color,
      };
    }),
  };
}

/** Снимок уровней всех F для канала K (хранится в program[id].faders). */
export function upsertProgramChannelSnapshot(
  programs: SceneLightProgramsDataV1,
  channelId: number,
  faders: SceneLightFadersDataV1,
): SceneLightProgramsDataV1 {
  const id = coerceProgramId(channelId);
  if (id == null) return programs;
  const snapshot = snapshotFadersForProgram(faders);
  return {
    ...programs,
    programs: programs.programs.map((program) =>
      program.id === id ? { ...program, faders: snapshot } : program,
    ),
  };
}

export function upsertActiveProgramSnapshotFromAllChannels(
  programs: SceneLightProgramsDataV1,
  activeProgramId: number,
  baseFaders: SceneLightFadersDataV1,
  channelCount: number,
  currentBoard: SceneLightFadersDataV1,
): SceneLightProgramsDataV1 {
  const id = coerceProgramId(activeProgramId);
  if (id == null) return programs;
  const snapshot = snapshotFadersForProgramFromAllChannels(
    programs,
    baseFaders,
    channelCount,
    currentBoard,
  );
  return {
    ...programs,
    programs: programs.programs.map((program) =>
      program.id === id ? { ...program, faders: snapshot } : program,
    ),
  };
}

export function readProgramChannelFaderStates(
  programs: SceneLightProgramsDataV1,
  channelId: number,
): SceneLightProgramsDataV1["programs"][number]["faders"] {
  const id = coerceProgramId(channelId);
  if (id == null) return [];
  return programs.programs.find((program) => program.id === id)?.faders ?? [];
}

export type LightConsoleMode = "live" | "kadr" | "compact";

export type LightConsoleViewProps = {
  mode?: LightConsoleMode;
  readOnly?: boolean;
  lightChannels: string[];
  selectedLightSlot: number;
  faders: SceneLightFadersDataV1;
  programs: SceneLightProgramsDataV1;
  spotlights?: TheaterSpotlight[];
  consoleChannel?: number;
  onSelectChannel?: (slot: number) => void;
  onSelectProgram?: (programId: number) => void;
  onFaderCountChange?: (count: number) => void;
  onPatchFader?: (
    faderId: number,
    patch: Partial<SceneLightFadersDataV1["faders"][number]>,
  ) => void;
  onSaveActiveProgram?: () => void;
  onAppendLightChannel?: () => void;
  onRemoveLightChannel?: () => void;
  className?: string;
};
