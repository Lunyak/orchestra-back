import type {
  PlaybookData,
  PlaybookLightChannelRolesV1,
  PlaybookLightConsoleUiV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../../features/playbook/model/playbook-slice";
import { resolveLightChannelRoles } from "./light-channel-roles";
import {
  buildCompleteLightFaders,
  readLightProgramSlotCount,
  resolveLightFaders,
  resolveLightPrograms,
  resizeLightPrograms,
} from "./light-console-data";

export const MIN_LIGHT_CHANNELS = 1;
export const MAX_LIGHT_CHANNELS = 64;
export const MIN_LIGHT_CONSOLE_SLOTS = 1;
export const MAX_LIGHT_CONSOLE_SLOTS = 64;
export const MIN_LIGHT_CHANNEL_COLUMNS = 2;
export const MAX_LIGHT_CHANNEL_COLUMNS = 8;
export const DEFAULT_LIGHT_CHANNEL_COLUMNS = 4;

export type { PlaybookLightConsoleUiV1 };

export type LightConsoleLayoutCounts = {
  channelCount: number;
  faderCount: number;
  programCount: number;
  channelColumns: number;
};

export function defaultLightChannelLabel(channel: number): string {
  return `Канал ${Math.max(1, Math.trunc(channel))}`;
}

/** Слить подписи каналов; длину берём из primary (явное число K). */
export function mergeLightChannelsAtCount(primary: string[], secondary: string[]): string[] {
  const count = primary.length;
  if (count === 0) {
    if (secondary.length === 0) return Array.from({ length: 8 }, () => "");
    return secondary.map((value) => String(value ?? ""));
  }
  return Array.from({ length: count }, (_, i) => {
    const p = String(primary[i] ?? "");
    const s = String(secondary[i] ?? "");
    if (p.trim() && s.trim() && p.trim() !== s.trim()) return p;
    return p.trim() ? p : s;
  });
}

/** Для сохранения: Redux-пульт задаёт число K. */
export function resolveLightChannelsForPersist(
  uiChannels: string[] | null | undefined,
  sceneChannels: string[] | null | undefined,
): string[] {
  const ui = Array.isArray(uiChannels) ? uiChannels : [];
  const scene = Array.isArray(sceneChannels) ? sceneChannels : [];
  if (ui.length > 0) return ui.map((value) => String(value ?? ""));
  if (scene.length > 0) return scene.map((value) => String(value ?? ""));
  return Array.from({ length: 8 }, () => "");
}

function clampConsoleSlotCount(raw: number, fallback = MIN_LIGHT_CONSOLE_SLOTS): number {
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(MIN_LIGHT_CONSOLE_SLOTS, Math.min(MAX_LIGHT_CONSOLE_SLOTS, value));
}

export function clampLightChannelColumns(
  raw: number,
  fallback = DEFAULT_LIGHT_CHANNEL_COLUMNS,
): number {
  const value = Math.trunc(Number(raw));
  if (!Number.isFinite(value)) return fallback;
  return Math.max(MIN_LIGHT_CHANNEL_COLUMNS, Math.min(MAX_LIGHT_CHANNEL_COLUMNS, value));
}

export function resolveLightConsoleUi(
  raw: PlaybookLightConsoleUiV1 | null | undefined,
): PlaybookLightConsoleUiV1 {
  return {
    v: 1,
    channelColumns: clampLightChannelColumns(
      Number(raw?.channelColumns),
      DEFAULT_LIGHT_CHANNEL_COLUMNS,
    ),
  };
}

export function appendLightChannel(channels: string[]): string[] {
  if (channels.length >= MAX_LIGHT_CHANNELS) return channels;
  const channel = channels.length + 1;
  return [...channels, defaultLightChannelLabel(channel)];
}

export function removeLastLightChannel(channels: string[]): string[] | null {
  if (channels.length <= MIN_LIGHT_CHANNELS) return null;
  return channels.slice(0, -1);
}

export function resizeLightChannels(channels: string[], count: number): string[] {
  const nextCount = clampConsoleSlotCount(count, channels.length || MIN_LIGHT_CHANNELS);
  if (nextCount === channels.length) return channels;
  if (nextCount > channels.length) {
    let next = [...channels];
    while (next.length < nextCount) {
      next = appendLightChannel(next);
    }
    return next;
  }
  return channels.slice(0, nextCount);
}

export function resizeLightFaders(
  faders: PlaybookLightFadersDataV1 | null | undefined,
  count: number,
): PlaybookLightFadersDataV1 {
  const nextCount = clampConsoleSlotCount(count);
  const resolved = resolveLightFaders(faders);
  return buildCompleteLightFaders(
    {
      v: 1,
      count: nextCount,
      faders: resolved.faders.filter((fader) => fader.id <= nextCount),
    },
    nextCount,
  );
}

export function buildLightConsoleLayoutCounts(args: {
  lightChannels: string[];
  lightFaders?: PlaybookLightFadersDataV1 | null;
  lightPrograms?: PlaybookLightProgramsDataV1 | null;
  lightConsoleUi?: PlaybookLightConsoleUiV1 | null;
}): LightConsoleLayoutCounts {
  const faders = resolveLightFaders(args.lightFaders);
  const programSlotCount = readLightProgramSlotCount(args.lightPrograms ?? null);
  const programs = resolveLightPrograms(args.lightPrograms);
  const ui = resolveLightConsoleUi(args.lightConsoleUi);
  return {
    channelCount: args.lightChannels.length,
    faderCount: faders.count ?? faders.faders.length,
    programCount: programSlotCount > 0 ? programSlotCount : programs.programs.length,
    channelColumns: ui.channelColumns ?? DEFAULT_LIGHT_CHANNEL_COLUMNS,
  };
}

/** Только роли софитов при изменении числа K (без P и F). */
export function patchPlaybookDataForLightChannelsChange(
  prev: PlaybookData | null | undefined,
  nextChannels: string[],
): Pick<PlaybookData, "lightChannelRoles"> {
  const nextLen = nextChannels.length;
  const roles = resolveLightChannelRoles(prev?.lightChannelRoles, nextLen);
  const sofitChannels = roles.sofitChannels.filter((ch) => ch <= nextLen);
  const lightChannelRoles: PlaybookLightChannelRolesV1 = { v: 1, sofitChannels };
  return { lightChannelRoles };
}

export function applyLightConsoleLayoutToPlaybookData(
  prev: PlaybookData | null | undefined,
  args: {
    lightChannels: string[];
    layout: LightConsoleLayoutCounts;
  },
): Pick<
  PlaybookData,
  "lightChannels" | "lightFaders" | "lightPrograms" | "lightChannelRoles" | "lightConsoleUi"
> {
  const nextChannels = resizeLightChannels(args.lightChannels, args.layout.channelCount);
  return {
    lightChannels: nextChannels,
    lightFaders: resizeLightFaders(prev?.lightFaders, args.layout.faderCount),
    lightPrograms: resizeLightPrograms(
      prev?.lightPrograms,
      args.layout.programCount,
      args.layout.channelCount,
    ),
    lightConsoleUi: {
      v: 1,
      channelColumns: clampLightChannelColumns(
        args.layout.channelColumns,
        DEFAULT_LIGHT_CHANNEL_COLUMNS,
      ),
    },
    ...patchPlaybookDataForLightChannelsChange(prev, nextChannels),
  };
}
