import type { PlaybookLightFaderV1, PlaybookLightFadersDataV1 } from "../../../features/playbook/model/playbook-slice";
import type { SceneLightKadrFaderStateV1 } from "../../types/script";
import {
  collectActiveEquipmentBindings,
  resolveKadrFaderChannel,
} from "../../../features/theater/model/theater-light-fader-bindings";
import { formatSpotlightChannelFaderWithName, resolveSpotlightDisplayName } from "../../../features/theater/model/theater-spotlight-labels";
import type { TheaterSpotlight } from "../../types/script";
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
  /** Софит/RGB, из‑за которого строка в списке (для подсказки). */
  equipmentLabel?: string;
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

function readFaderChannel(fader: PlaybookLightFaderV1): number {
  return fader.channel ?? fader.links?.[0]?.channel ?? fader.id;
}

function readKadrFaderState(
  faderId: number,
  kadrStates: SceneLightKadrFaderStateV1[] | undefined,
  fallback: PlaybookLightFaderV1,
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
  fader: PlaybookLightFaderV1,
  kadrStates: SceneLightKadrFaderStateV1[] | undefined,
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

function toBoardRowFromKadrState(
  fader: PlaybookLightFaderV1,
  state: SceneLightKadrFaderStateV1,
  channel: number,
): LightFaderBoardRow {
  const raw =
    typeof state.intensity === "number" && Number.isFinite(state.intensity)
      ? Math.min(1, Math.max(0, state.intensity))
      : 0;
  const off = state.enabled === false || raw <= 0.02;
  const level = off ? 0 : raw;
  return {
    faderId: state.faderId,
    label: formatFaderDefaultLabel(fader.id, fader.label),
    channel,
    intensity: level,
    enabled: !off,
    color: fader.color,
  };
}

/** Строки для техкарты: только K+F с активной привязкой в 3D (как в списке софитов). */
export function buildKadrRecordFaderRows(args: {
  kadrFaderStates: SceneLightKadrFaderStateV1[];
  faders: PlaybookLightFadersDataV1;
  /** Доска с links для проверки привязок; если не задана — используется faders. */
  boardFaders?: PlaybookLightFadersDataV1;
  selectedChannels: number[];
  lightChannelsCount?: number;
  spotlights?: TheaterSpotlight[];
}): LightFaderBoardRow[] {
  const board = args.boardFaders ?? args.faders;
  const spotlights = args.spotlights ?? [];
  const bindings = collectActiveEquipmentBindings(spotlights, {
    channels: args.selectedChannels,
    lightChannelsCount: args.lightChannelsCount,
    lightFaders: board,
  });

  const stateByKey = new Map<string, SceneLightKadrFaderStateV1>();
  for (const state of args.kadrFaderStates) {
    const def = args.faders.faders.find((fader) => fader.id === state.faderId);
    if (!def) continue;
    const channel = resolveKadrFaderChannel(state, def);
    stateByKey.set(`${channel}:${state.faderId}`, state);
  }

  return bindings.map(({ channel, faderId, spotlightId }) => {
    const spotlight = spotlights.find((item) => item.id === spotlightId);
    const equipmentLabel = spotlight ? resolveSpotlightDisplayName(spotlight) : `Софит ${spotlightId}`;
    const def = args.faders.faders.find((fader) => fader.id === faderId);
    if (!def) {
      return {
        faderId,
        label: formatSpotlightChannelFaderWithName(channel, faderId, spotlight),
        channel,
        intensity: 0,
        enabled: false,
        equipmentLabel,
      };
    }
    const state = stateByKey.get(`${channel}:${faderId}`);
    const row = state
      ? toBoardRowFromKadrState(def, state, channel)
      : {
          faderId,
          label: formatFaderDefaultLabel(faderId, def.label),
          channel,
          intensity: 0,
          enabled: false,
          color: def.color,
        };
    return {
      ...row,
      label: formatSpotlightChannelFaderWithName(channel, faderId, spotlight),
      equipmentLabel,
    };
  });
}

/** Заливка в карточке картины: без дубля софитов на том же K. */
export function buildKadrWashFaderRowsForCard(args: {
  programId: number;
  kadrFaderStates: SceneLightKadrFaderStateV1[];
  faders: PlaybookLightFadersDataV1;
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
  faders: PlaybookLightFadersDataV1;
  kadrFaderStates?: SceneLightKadrFaderStateV1[];
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
