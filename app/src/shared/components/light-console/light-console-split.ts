import type { SceneLightFaderV1, SceneLightFadersDataV1 } from "../../../features/scene/model/scene-slice";
import type { StepLightKadrFaderStateV1 } from "../../types/script";
import { resolveKadrFaderChannel } from "../../../features/theater/model/theater-light-fader-bindings";
import { parseLightChannel } from "../show-script/utils/lightTokens";
import { normalizeSelectedRecordChannels, normalizeSofitChannels } from "./light-channel-roles";
import {
  formatChannelShort,
  formatFaderDefaultLabel,
  formatFaderShort,
  formatProgramDefaultLabel,
} from "./light-console-labels";

export { DEFAULT_SOFIT_CHANNELS, normalizeSofitChannels } from "./light-channel-roles";
export type LightFaderBoardRow = {
  faderId: number;
  label: string;
  channel: number;
  intensity: number;
  enabled: boolean;
  color?: string;
};

export type LightConsoleSplitModel = {
  programId: number;
  programLabel: string;
  programColor: string | null;
  sofitChannels: number[];
  sofitFaders: LightFaderBoardRow[];
  washChannel: number;
  washLabel: string;
  washColor: string | null;
  washFaders: LightFaderBoardRow[];
};

function readFaderChannel(fader: SceneLightFaderV1): number {
  return fader.channel ?? fader.links?.[0]?.channel ?? fader.id;
}

function readKadrFaderState(
  faderId: number,
  kadrStates: StepLightKadrFaderStateV1[] | undefined,
  fallback: SceneLightFaderV1,
): { intensity: number; enabled: boolean } {
  const state = kadrStates?.find((item) => item.faderId === faderId);
  const intensity =
    typeof state?.intensity === "number"
      ? state.intensity
      : typeof fallback.intensity === "number"
        ? fallback.intensity
        : 1;
  const enabled = state?.enabled ?? fallback.enabled ?? true;
  return { intensity, enabled };
}

function toBoardRow(
  fader: SceneLightFaderV1,
  kadrStates: StepLightKadrFaderStateV1[] | undefined,
): LightFaderBoardRow {
  const channel = readFaderChannel(fader);
  const { intensity, enabled } = readKadrFaderState(fader.id, kadrStates, fader);
  const level = enabled && intensity > 0 ? Math.min(1, Math.max(0, intensity)) : 0;
  return {
    faderId: fader.id,
    label: formatFaderDefaultLabel(fader.id, fader.label),
    channel,
    intensity: level,
    enabled: level > 0,
    color: fader.color,
  };
}

/** Строки для техкарты: только K из toggles, подпись K{n} F{m}. */
export function buildKadrRecordFaderRows(args: {
  kadrFaderStates: StepLightKadrFaderStateV1[];
  faders: SceneLightFadersDataV1;
  selectedChannels: number[];
  lightChannelsCount?: number;
}): LightFaderBoardRow[] {
  const allow = new Set(
    normalizeSelectedRecordChannels(args.selectedChannels, args.lightChannelsCount ?? 64),
  );
  const byKey = new Map<string, LightFaderBoardRow>();

  for (const state of args.kadrFaderStates) {
    if (state.enabled === false || (state.intensity ?? 0) <= 0.02) continue;
    const def = args.faders.faders.find((fader) => fader.id === state.faderId);
    if (!def) continue;
    const channel = resolveKadrFaderChannel(state, def);
    if (!allow.has(channel)) continue;
    const key = `${channel}:${state.faderId}`;
    byKey.set(key, {
      ...toBoardRow(def, [state]),
      channel,
      label: `${formatChannelShort(channel)} ${formatFaderShort(state.faderId)}`,
    });
  }

  return [...byKey.values()].sort(
    (a, b) => a.channel - b.channel || a.faderId - b.faderId,
  );
}

/** @deprecated Используйте buildKadrRecordFaderRows */
export function buildKadrSofitFaderRowsForDisplay(args: {
  kadrFaderStates: StepLightKadrFaderStateV1[];
  faders: SceneLightFadersDataV1;
  sofitChannels: number[];
  lightChannelsCount?: number;
  /** Уровни заливки (K активной П) показываются в блоке «Заливка», не здесь. */
  washProgramId?: number;
}): LightFaderBoardRow[] {
  return buildKadrRecordFaderRows({
    kadrFaderStates: args.kadrFaderStates,
    faders: args.faders,
    selectedChannels: args.sofitChannels,
    lightChannelsCount: args.lightChannelsCount,
  });
}

/** Заливка в карточке картины: без дубля софитов на том же K. */
export function buildKadrWashFaderRowsForCard(args: {
  programId: number;
  kadrFaderStates: StepLightKadrFaderStateV1[];
  faders: SceneLightFadersDataV1;
  sofitRows: LightFaderBoardRow[];
  sofitChannels: number[];
  lightChannelsCount?: number;
}): { washChannel: number; rows: LightFaderBoardRow[]; programOnly: boolean } {
  const washChannel = Math.max(1, Math.trunc(args.programId) || 1);
  const sofitFaderIds = new Set(args.sofitRows.map((row) => row.faderId));
  const sofitSet = new Set(
    normalizeSofitChannels(args.sofitChannels, args.lightChannelsCount ?? 64),
  );

  const byFader = new Map<number, LightFaderBoardRow>();
  for (const state of args.kadrFaderStates) {
    if (state.enabled === false || (state.intensity ?? 0) <= 0.02) continue;
    if (sofitFaderIds.has(state.faderId)) continue;
    const def = args.faders.faders.find((fader) => fader.id === state.faderId);
    if (!def) continue;
    const channel = resolveKadrFaderChannel(state, def);
    if (channel !== washChannel) continue;
    byFader.set(state.faderId, {
      ...toBoardRow(def, [state]),
      channel,
      label: `${formatChannelShort(washChannel)} ${formatFaderShort(state.faderId)}`,
    });
  }
  const rows = [...byFader.values()];

  const programOnly =
    rows.length === 0 ||
    (sofitSet.has(washChannel) &&
      args.kadrFaderStates.every((state) => {
        const def = args.faders.faders.find((fader) => fader.id === state.faderId);
        const ch = resolveKadrFaderChannel(state, def);
        return ch !== washChannel || sofitFaderIds.has(state.faderId);
      }));

  return { washChannel, rows, programOnly };
}

export function buildLightConsoleSplitModel(args: {
  programId: number;
  lightChannels: string[];
  faders: SceneLightFadersDataV1;
  kadrFaderStates?: StepLightKadrFaderStateV1[];
  sofitChannels?: number[];
  programLabel?: string;
}): LightConsoleSplitModel {
  const sofitChannels = normalizeSofitChannels(args.sofitChannels, args.lightChannels.length);
  const washChannel = Math.max(1, args.programId);
  const programRaw = args.lightChannels[washChannel - 1] ?? "";
  const programParsed = parseLightChannel(programRaw);
  const programLabel =
    args.programLabel?.trim() ||
    programParsed.label ||
    formatProgramDefaultLabel(washChannel);

  const rows = args.faders.faders.map((fader) => toBoardRow(fader, args.kadrFaderStates));

  return {
    programId: washChannel,
    programLabel,
    programColor: programParsed.color ?? null,
    sofitChannels,
    sofitFaders: rows.filter((row) => sofitChannels.includes(row.channel)),
    washChannel,
    washLabel: programParsed.label || `K${washChannel}`,
    washColor: programParsed.color ?? null,
    washFaders: rows.filter((row) => row.channel === washChannel),
  };
}
