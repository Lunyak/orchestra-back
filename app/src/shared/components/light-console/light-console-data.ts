import type {
  PlaybookLightChannelBankV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../../features/playbook/model/playbook-slice";
import { LIGHT_CHANNEL_SLOT_COUNT } from "../../../features/theater/model/theater-light-channel-link";
import type { TheaterSpotlight } from "../../types/script";
import {
  formatFaderDefaultLabel,
  formatProgramDefaultLabel,
} from "./light-console-labels";

/** Минимум кнопок П… на пульте (как K1–K8). */
export const DEFAULT_LIGHT_PROGRAM_COUNT = LIGHT_CHANNEL_SLOT_COUNT;

type FaderStateRow = PlaybookLightProgramsDataV1["programs"][number]["faders"][number];

/** ID программы из сцены/JSON (иногда приходит строкой). */
export function coerceProgramId(value: unknown): number | null {
  const id = Math.trunc(Number(value));
  if (!Number.isFinite(id) || id < 1) return null;
  return id;
}

export function createDefaultLightFaders(): PlaybookLightFadersDataV1 {
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

function emptyChannelBanks(count: number): PlaybookLightChannelBankV1[] {
  const n = Math.max(1, Math.trunc(count) || 1);
  return Array.from({ length: n }, (_, index) => ({
    channel: index + 1,
    faders: [],
  }));
}

/** Миграция: старые сцены хранили память K в programs[id].faders. */
function migrateChannelBanksFromPrograms(
  programs: PlaybookLightProgramsDataV1["programs"],
  channelCount: number,
): PlaybookLightChannelBankV1[] {
  const n = Math.max(1, Math.trunc(channelCount) || 1);
  const byChannel = new Map<number, FaderStateRow[]>();
  for (const program of programs) {
    const channel = coerceProgramId(program.id);
    if (channel == null || channel > n) continue;
    if (!Array.isArray(program.faders) || program.faders.length === 0) continue;
    byChannel.set(channel, program.faders);
  }
  return Array.from({ length: n }, (_, index) => {
    const channel = index + 1;
    return { channel, faders: byChannel.get(channel) ?? [] };
  });
}

export function resolveLightChannelBanks(
  raw: PlaybookLightProgramsDataV1 | null | undefined,
  channelCount: number,
): PlaybookLightChannelBankV1[] {
  const n = Math.max(1, Math.trunc(channelCount) || 1);
  const stored = Array.isArray(raw?.channels) ? raw.channels : [];
  if (stored.length === 0) {
    if (Array.isArray(raw?.programs) && raw.programs.some((p) => (p.faders?.length ?? 0) > 0)) {
      return migrateChannelBanksFromPrograms(raw.programs, n);
    }
    return emptyChannelBanks(n);
  }
  const byChannel = new Map<number, FaderStateRow[]>();
  for (const bank of stored) {
    const channel = coerceProgramId(bank.channel);
    if (channel == null || channel > n) continue;
    byChannel.set(channel, Array.isArray(bank.faders) ? bank.faders : []);
  }
  return Array.from({ length: n }, (_, index) => {
    const channel = index + 1;
    return { channel, faders: byChannel.get(channel) ?? [] };
  });
}

export function createDefaultLightPrograms(
  count = DEFAULT_LIGHT_PROGRAM_COUNT,
  channelCount = count,
): PlaybookLightProgramsDataV1 {
  const n = Math.max(1, Math.trunc(count) || DEFAULT_LIGHT_PROGRAM_COUNT);
  const channelsN = Math.max(1, Math.trunc(channelCount) || n);
  return {
    v: 1,
    count: n,
    activeProgramId: 1,
    programs: Array.from({ length: n }, (_, index) => {
      const id = index + 1;
      return { id, label: formatProgramDefaultLabel(id), faders: [] };
    }),
    channels: emptyChannelBanks(channelsN),
  };
}

export function buildCompleteLightFaders(
  persisted: PlaybookLightFadersDataV1 | undefined,
  minFaderCount = 1,
): PlaybookLightFadersDataV1 {
  const storedCount = Math.trunc(Number(persisted?.count) || 0);
  const baseCount = storedCount > 0 ? storedCount : 8;
  const countHint = Math.max(minFaderCount, baseCount);
  const maxIdInList = (persisted?.faders ?? []).reduce(
    (max, f) => Math.max(max, Math.trunc(Number(f.id) || 0)),
    0,
  );
  const maxFaderId = Math.max(countHint, maxIdInList);
  const byId = new Map<number, PlaybookLightFadersDataV1["faders"][number]>();
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
  return { v: 1, count: maxFaderId, faders: Array.from(byId.values()).sort((a, b) => a.id - b.id) };
}

export function readLightProgramSlotCount(
  raw: PlaybookLightProgramsDataV1 | null | undefined,
): number {
  const explicit = Math.trunc(Number(raw?.count) || 0);
  const storedLen = Array.isArray(raw?.programs) ? raw.programs.length : 0;
  if (explicit > 0) return explicit;
  return storedLen;
}

export function resolveLightPrograms(
  raw: PlaybookLightProgramsDataV1 | null | undefined,
  minCount?: number,
  channelCount?: number,
): PlaybookLightProgramsDataV1 {
  const slotCount = readLightProgramSlotCount(raw);
  const effectiveMin = minCount ?? (slotCount > 0 ? slotCount : DEFAULT_LIGHT_PROGRAM_COUNT);
  const channelsN = Math.max(
    1,
    Math.trunc(channelCount ?? effectiveMin) || effectiveMin,
    Array.isArray(raw?.channels) ? raw.channels.length : 0,
  );

  if (!raw || raw.v !== 1 || !Array.isArray(raw.programs) || raw.programs.length === 0) {
    return createDefaultLightPrograms(effectiveMin, channelsN);
  }

  const maxId = Math.max(effectiveMin, slotCount);
  const byId = new Map<number, PlaybookLightProgramsDataV1["programs"][number]>();
  for (const program of raw.programs) {
    const id = coerceProgramId(program.id);
    if (id == null || id > maxId) continue;
    byId.set(id, {
      ...program,
      id,
      label: formatProgramDefaultLabel(id, program.label),
      faders: Array.isArray(program.faders) ? program.faders : [],
    });
  }

  const programs = Array.from({ length: maxId }, (_, index) => {
    const id = index + 1;
    return byId.get(id) ?? { id, label: formatProgramDefaultLabel(id), faders: [] };
  });

  const activeId = coerceProgramId(raw.activeProgramId);
  const activeProgramId =
    activeId != null && activeId <= maxId
      ? activeId
      : (programs[0]?.id ?? 1);

  return {
    v: 1,
    count: maxId,
    activeProgramId,
    programs,
    channels: resolveLightChannelBanks({ ...raw, programs }, channelsN),
  };
}

export function resizeLightPrograms(
  raw: PlaybookLightProgramsDataV1 | null | undefined,
  count: number,
  channelCount?: number,
): PlaybookLightProgramsDataV1 {
  const nextCount = Math.max(1, Math.min(64, Math.trunc(Number(count)) || 1));
  const resolved = resolveLightPrograms(raw, nextCount, channelCount);
  const byId = new Map(resolved.programs.map((program) => [program.id, program]));
  const programs = Array.from({ length: nextCount }, (_, index) => {
    const id = index + 1;
    return byId.get(id) ?? { id, label: formatProgramDefaultLabel(id), faders: [] };
  });
  const activeId = coerceProgramId(resolved.activeProgramId);
  const activeProgramId =
    activeId != null && activeId <= nextCount
      ? activeId
      : (programs[0]?.id ?? 1);
  const channelsN = Math.max(
    1,
    Math.trunc(channelCount ?? resolved.channels?.length ?? nextCount) || nextCount,
  );
  return {
    v: 1,
    count: nextCount,
    activeProgramId,
    programs,
    channels: resolveLightChannelBanks(resolved, channelsN),
  };
}

export function lightProgramsNeedNormalization(
  raw: PlaybookLightProgramsDataV1 | null | undefined,
  channelCount?: number,
): boolean {
  if (!raw || raw.v !== 1 || !Array.isArray(raw.programs)) return true;
  const slotCount = readLightProgramSlotCount(raw);
  if (slotCount === 0) return true;
  if (raw.programs.length !== slotCount) return true;
  for (let id = 1; id <= slotCount; id += 1) {
    if (!raw.programs.some((program) => coerceProgramId(program.id) === id)) return true;
  }
  const channelsN = Math.max(1, Math.trunc(channelCount ?? slotCount) || slotCount);
  if (!Array.isArray(raw.channels) || raw.channels.length === 0) return true;
  if (raw.channels.length !== channelsN) return true;
  for (let channel = 1; channel <= channelsN; channel += 1) {
    if (!raw.channels.some((bank) => coerceProgramId(bank.channel) === channel)) return true;
  }
  return false;
}

export function resolveLightFaders(
  raw: PlaybookLightFadersDataV1 | null | undefined,
): PlaybookLightFadersDataV1 {
  if (raw && raw.v === 1) return buildCompleteLightFaders(raw);
  return createDefaultLightFaders();
}

export function snapshotFadersForProgram(
  faders: PlaybookLightFadersDataV1,
): FaderStateRow[] {
  return faders.faders.map((item) => ({
    faderId: item.id,
    intensity: item.intensity ?? 1,
    enabled: item.enabled ?? true,
    color: item.color,
  }));
}

function readFaderLevelForSnapshot(
  fader: PlaybookLightFadersDataV1["faders"][number],
): number {
  if (fader.enabled === false) return 0;
  const raw =
    typeof fader.intensity === "number" && Number.isFinite(fader.intensity)
      ? fader.intensity
      : 1;
  if (raw <= 0) return 0;
  return Math.min(1, raw);
}

/** Память П: ненулевые F со всех K (channel banks + текущая доска). */
export function snapshotFadersForProgramFromAllChannels(
  programs: PlaybookLightProgramsDataV1,
  baseFaders: PlaybookLightFadersDataV1,
  channelCount: number,
  currentBoard: PlaybookLightFadersDataV1,
): FaderStateRow[] {
  const maxCh = Math.max(1, Math.trunc(channelCount) || 1);
  const byFader = new Map<number, FaderStateRow>();

  for (let channel = 1; channel <= maxCh; channel += 1) {
    const board = buildFaderBoardForConsoleChannel(baseFaders, programs, channel);
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
  faders: PlaybookLightFadersDataV1,
  states: FaderStateRow[],
): PlaybookLightFadersDataV1 {
  const stateByFader = new Map(states.map((state) => [state.faderId, state]));
  return {
    ...faders,
    faders: faders.faders.map((item) => {
      const state = stateByFader.get(item.id);
      if (!state) {
        return {
          ...item,
          intensity: 0,
          enabled: false,
        };
      }
      return {
        ...item,
        intensity: state.intensity ?? 0,
        enabled: state.enabled ?? false,
        color: state.color ?? item.color,
      };
    }),
  };
}

/** Снимок уровней всех F для канала K → lightPrograms.channels. */
export function upsertChannelMemorySnapshot(
  programs: PlaybookLightProgramsDataV1,
  channelId: number,
  faders: PlaybookLightFadersDataV1,
  channelCount?: number,
): PlaybookLightProgramsDataV1 {
  const id = coerceProgramId(channelId);
  if (id == null) return programs;
  const channelsN = Math.max(
    id,
    Math.trunc(channelCount ?? programs.channels?.length ?? 1) || 1,
  );
  const channels = resolveLightChannelBanks(programs, channelsN);
  const snapshot = snapshotFadersForProgram(faders);
  return {
    ...programs,
    channels: channels.map((bank) =>
      bank.channel === id ? { ...bank, faders: snapshot } : bank,
    ),
  };
}

export function upsertActiveProgramSnapshotFromAllChannels(
  programs: PlaybookLightProgramsDataV1,
  activeProgramId: number,
  baseFaders: PlaybookLightFadersDataV1,
  channelCount: number,
  currentBoard: PlaybookLightFadersDataV1,
): PlaybookLightProgramsDataV1 {
  const id = coerceProgramId(activeProgramId);
  if (id == null) return programs;
  const withBanks = {
    ...programs,
    channels: resolveLightChannelBanks(programs, channelCount),
  };
  const snapshot = snapshotFadersForProgramFromAllChannels(
    withBanks,
    baseFaders,
    channelCount,
    currentBoard,
  );
  return {
    ...withBanks,
    programs: withBanks.programs.map((program) =>
      program.id === id ? { ...program, faders: snapshot } : program,
    ),
  };
}

export function readChannelMemoryFaderStates(
  programs: PlaybookLightProgramsDataV1,
  channelId: number,
): FaderStateRow[] {
  const id = coerceProgramId(channelId);
  if (id == null) return [];
  const channels = resolveLightChannelBanks(
    programs,
    Math.max(id, programs.channels?.length ?? 1),
  );
  return channels.find((bank) => bank.channel === id)?.faders ?? [];
}

export function resolveLightProgramMinCount(
  lightChannelsCount: number,
  programs?: PlaybookLightProgramsDataV1 | null,
  minChannel = 0,
): number {
  const channelCount = Math.max(
    1,
    Math.trunc(lightChannelsCount) || 1,
    Math.trunc(minChannel) || 0,
  );
  const stored = readLightProgramSlotCount(programs);
  return Math.max(channelCount, stored, DEFAULT_LIGHT_PROGRAM_COUNT);
}

function zeroFaderBoardStates(faders: PlaybookLightFadersDataV1): FaderStateRow[] {
  return faders.faders.map((fader) => ({
    faderId: fader.id,
    intensity: 0,
    enabled: false,
    color: fader.color,
  }));
}

/** Перед save: снимок активного K из live-доски → channels[K]. */
export function prepareLightProgramsForPersist(args: {
  lightFaders: PlaybookLightFadersDataV1;
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined;
  lightChannelsCount: number;
  activeChannel: number;
}): PlaybookLightProgramsDataV1 {
  const channelCount = Math.max(1, Math.trunc(args.lightChannelsCount) || 1);
  const activeChannel = Math.max(0, Math.trunc(args.activeChannel) || 0);
  let programs = resolveLightPrograms(
    args.lightPrograms,
    resolveLightProgramMinCount(channelCount, args.lightPrograms, activeChannel),
    channelCount,
  );
  if (activeChannel > 0) {
    programs = upsertChannelMemorySnapshot(
      programs,
      activeChannel,
      args.lightFaders,
      channelCount,
    );
  }
  return programs;
}

/** Доска F для канала K: живая доска, память channels[K] или нули. */
export function buildFaderBoardForConsoleChannel(
  liveFaders: PlaybookLightFadersDataV1,
  programs: PlaybookLightProgramsDataV1,
  channel: number,
  options?: { useLiveBoard?: boolean },
): PlaybookLightFadersDataV1 {
  if (options?.useLiveBoard) return liveFaders;
  const channelStates = readChannelMemoryFaderStates(programs, channel);
  if (channelStates.length > 0) {
    return applyProgramFaderStatesToBoard(liveFaders, channelStates);
  }
  return applyProgramFaderStatesToBoard(liveFaders, zeroFaderBoardStates(liveFaders));
}

export type LightConsoleMode = "live" | "kadr" | "compact";

export type LightConsoleViewProps = {
  mode?: LightConsoleMode;
  readOnly?: boolean;
  lightChannels: string[];
  selectedLightSlot: number;
  faders: PlaybookLightFadersDataV1;
  programs: PlaybookLightProgramsDataV1;
  spotlights?: TheaterSpotlight[];
  consoleChannel?: number;
  channelColumns?: number;
  onSelectChannel?: (slot: number) => void;
  onSelectProgram?: (programId: number) => void;
  onPatchFader?: (
    faderId: number,
    patch: Partial<PlaybookLightFadersDataV1["faders"][number]>,
  ) => void;
  onSaveActiveProgram?: () => void;
  onOpenSettings?: () => void;
  className?: string;
};
