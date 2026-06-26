import type {
  PlaybookLightChannelRolesV1,
  PlaybookLightFaderV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../../features/playbook/model/playbook-slice";
import type { LightFixture, SceneLightKadrV1 } from "../../types/script";
import { parseLightChannel, resolveLightColor } from "../show-script/utils/lightTokens";
import { parseLightChannelSlot } from "../../../features/theater/model/theater-light-channel-link";
import { buildLightConsoleSplitModel, type LightFaderBoardRow } from "./light-console-split";
import { resolveLightChannelRoles, resolveSofitChannelsForKadrDisplay } from "./light-channel-roles";

export type FixtureLookState = {
  fixtureId: number;
  label: string;
  channelSlot: number | null;
  intensity: number;
  color: string | null;
  faderLabel: string | null;
  isSofitChannel: boolean;
};

export type ChannelLookSummary = {
  channel: number;
  label: string;
  role: "sofit" | "wash";
  activeFaderCount: number;
  totalFaderCount: number;
  faders: LightFaderBoardRow[];
};

export type LightSchemeLookModel = {
  kadrNo: number;
  title: string;
  blackout: boolean;
  programId: number;
  programLabel: string;
  programColor: string | null;
  washIntensity: number;
  sofitChannels: number[];
  channelSummaries: ChannelLookSummary[];
  fixtureStates: Map<number, FixtureLookState>;
};

function readFaderChannel(fader: PlaybookLightFaderV1): number {
  return fader.channel ?? fader.links?.[0]?.channel ?? fader.id;
}

function readFaderLevel(
  fader: PlaybookLightFaderV1,
  kadrStates: SceneLightKadrV1["faders"] | undefined,
): number {
  const state = kadrStates?.find((item) => item.faderId === fader.id);
  const intensity =
    typeof state?.intensity === "number"
      ? state.intensity
      : typeof fader.intensity === "number"
        ? fader.intensity
        : 1;
  const enabled = state?.enabled ?? fader.enabled ?? true;
  if (!enabled || intensity <= 0) return 0;
  return Math.min(1, Math.max(0, intensity));
}

function faderLinkedToFixture(fader: PlaybookLightFaderV1, fixtureId: number): boolean {
  if (fader.spotlightId === fixtureId) return true;
  return (fader.links ?? []).some((link) => link.spotlightId === fixtureId);
}

function resolveFixtureFader(
  fixture: LightFixture,
  faders: PlaybookLightFaderV1[],
): PlaybookLightFaderV1 | null {
  const direct = faders.find((fader) => faderLinkedToFixture(fader, fixture.id));
  if (direct) return direct;

  const slot = parseLightChannelSlot(fixture.channel);
  if (slot == null) return null;

  const onChannel = faders.filter((fader) => readFaderChannel(fader) === slot);
  if (onChannel.length === 1) return onChannel[0] ?? null;

  const index = Math.max(0, (fixture.id - 1) % Math.max(1, onChannel.length));
  return onChannel[index] ?? onChannel[0] ?? null;
}

function channelLabel(lightChannels: string[], channel: number): string {
  const parsed = parseLightChannel(lightChannels[channel - 1] ?? "");
  return parsed.label ? `K${channel} ${parsed.label}` : `K${channel}`;
}

export function buildLightSchemeLookModel(args: {
  kadr: SceneLightKadrV1;
  sectionTitle?: string;
  lightPlot: LightFixture[];
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1;
  lightPrograms: PlaybookLightProgramsDataV1 | null;
  lightChannelRoles: PlaybookLightChannelRolesV1 | null;
}): LightSchemeLookModel {
  const roles = resolveLightChannelRoles(args.lightChannelRoles, args.lightChannels.length);
  const sofitChannels = resolveSofitChannelsForKadrDisplay({
    lightChannelRoles: args.lightChannelRoles,
    kadr: args.kadr,
    lightChannelsCount: args.lightChannels.length,
  });
  const split = buildLightConsoleSplitModel({
    programId: args.kadr.programId,
    lightChannels: args.lightChannels,
    faders: args.lightFaders,
    kadrFaderStates: args.kadr.faders,
    sofitChannels,
    programLabel:
      args.lightPrograms?.programs.find((p) => p.id === args.kadr.programId)?.label ?? undefined,
  });

  const programColor = split.programColor
    ? resolveLightColor("", split.programColor)
    : null;

  const channelSummaries: ChannelLookSummary[] = [];
  const allChannels = new Set<number>([
    ...sofitChannels,
    split.washChannel,
    ...split.sofitFaders.map((r) => r.channel),
    ...split.washFaders.map((r) => r.channel),
  ]);

  for (const channel of [...allChannels].sort((a, b) => a - b)) {
    const isSofit = sofitChannels.includes(channel);
    const faders = isSofit
      ? split.sofitFaders.filter((r) => r.channel === channel)
      : channel === split.washChannel
        ? split.washFaders
        : [];
    if (faders.length === 0 && channel !== split.washChannel && !isSofit) continue;

    const activeFaderCount = faders.filter((r) => r.intensity > 0).length;
    channelSummaries.push({
      channel,
      label: channelLabel(args.lightChannels, channel),
      role: isSofit ? "sofit" : "wash",
      activeFaderCount,
      totalFaderCount: faders.length,
      faders,
    });
  }

  if (!channelSummaries.some((c) => c.channel === split.washChannel && c.role === "wash")) {
    channelSummaries.push({
      channel: split.washChannel,
      label: channelLabel(args.lightChannels, split.washChannel),
      role: "wash",
      activeFaderCount: args.kadr.blackout || args.kadr.programId <= 0 ? 0 : 1,
      totalFaderCount: split.washFaders.length,
      faders: split.washFaders,
    });
    channelSummaries.sort((a, b) => a.channel - b.channel);
  }

  const washIntensity =
    args.kadr.blackout || args.kadr.programId <= 0
      ? 0
      : split.washFaders.length > 0
        ? Math.max(0, ...split.washFaders.map((r) => r.intensity))
        : 1;

  const fixtureStates = new Map<number, FixtureLookState>();
  for (const fixture of args.lightPlot) {
    const slot = parseLightChannelSlot(fixture.channel);
    const bound = resolveFixtureFader(fixture, args.lightFaders.faders);
    const intensity = args.kadr.blackout
      ? 0
      : bound
        ? readFaderLevel(bound, args.kadr.faders)
        : 0;
    const isSofitChannel = slot != null && sofitChannels.includes(slot);
    const faderColor = bound?.color ?? null;
    const channelColor =
      slot != null
        ? resolveLightColor(
            parseLightChannel(args.lightChannels[slot - 1] ?? "").label,
            parseLightChannel(args.lightChannels[slot - 1] ?? "").color,
          )
        : null;

    fixtureStates.set(fixture.id, {
      fixtureId: fixture.id,
      label: fixture.label,
      channelSlot: slot,
      intensity,
      color: faderColor ?? channelColor,
      faderLabel: bound?.label ?? null,
      isSofitChannel,
    });
  }

  return {
    kadrNo: args.kadr.kadrNo,
    title: args.sectionTitle ?? args.kadr.title ?? `Картина ${args.kadr.kadrNo}`,
    blackout: args.kadr.blackout === true || args.kadr.programId <= 0,
    programId: args.kadr.programId,
    programLabel: split.programLabel,
    programColor,
    washIntensity,
    sofitChannels,
    channelSummaries,
    fixtureStates,
  };
}

export function fixtureLookState(
  model: LightSchemeLookModel | null,
  fixtureId: number,
): FixtureLookState | null {
  if (!model) return null;
  return model.fixtureStates.get(fixtureId) ?? null;
}
