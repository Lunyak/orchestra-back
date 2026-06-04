import type { SceneLightFaderV1, SceneLightFadersDataV1 } from "../../../features/scene/model/scene-slice";
import type { StepLightKadrFaderStateV1 } from "../../types/script";
import { parseLightChannel } from "../show-script/utils/lightTokens";
import { normalizeSofitChannels } from "./light-channel-roles";

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
    label: fader.label || `Ф${fader.id}`,
    channel,
    intensity: level,
    enabled: level > 0,
    color: fader.color,
  };
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
    `Программа ${washChannel}`;

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
