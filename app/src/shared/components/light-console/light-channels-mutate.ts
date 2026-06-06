import type {
  SceneData,
  SceneLightChannelRolesV1,
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../../features/scene/model/scene-slice";
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

export type LightConsoleLayoutCounts = {
  channelCount: number;
  faderCount: number;
  programCount: number;
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

/** @deprecated используйте mergeLightChannelsAtCount / resolveLightChannelsForPersist */
export function mergeLightChannelsPreferLonger(prev: string[], loaded: string[]): string[] {
  const longer = prev.length >= loaded.length ? prev : loaded;
  const shorter = prev.length >= loaded.length ? loaded : prev;
  return mergeLightChannelsAtCount(longer, shorter);
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
  faders: SceneLightFadersDataV1 | null | undefined,
  count: number,
): SceneLightFadersDataV1 {
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
  lightFaders?: SceneLightFadersDataV1 | null;
  lightPrograms?: SceneLightProgramsDataV1 | null;
}): LightConsoleLayoutCounts {
  const faders = resolveLightFaders(args.lightFaders);
  const programSlotCount = readLightProgramSlotCount(args.lightPrograms ?? null);
  const programs = resolveLightPrograms(args.lightPrograms);
  return {
    channelCount: args.lightChannels.length,
    faderCount: faders.count ?? faders.faders.length,
    programCount: programSlotCount > 0 ? programSlotCount : programs.programs.length,
  };
}

/** Только роли софитов при изменении числа K (без P и F). */
export function patchSceneDataForLightChannelsChange(
  prev: SceneData | null | undefined,
  nextChannels: string[],
): Pick<SceneData, "lightChannelRoles"> {
  const nextLen = nextChannels.length;
  const roles = resolveLightChannelRoles(prev?.lightChannelRoles, nextLen);
  const sofitChannels = roles.sofitChannels.filter((ch) => ch <= nextLen);
  const lightChannelRoles: SceneLightChannelRolesV1 = { v: 1, sofitChannels };
  return { lightChannelRoles };
}

/** @deprecated используйте patchSceneDataForLightChannelsChange */
export function patchSceneDataForLightChannelCount(
  prev: SceneData | null | undefined,
  nextChannels: string[],
  _prevChannelCount?: number,
): Pick<SceneData, "lightChannelRoles"> {
  return patchSceneDataForLightChannelsChange(prev, nextChannels);
}

export function applyLightConsoleLayoutToSceneData(
  prev: SceneData | null | undefined,
  args: {
    lightChannels: string[];
    layout: LightConsoleLayoutCounts;
  },
): Pick<SceneData, "lightChannels" | "lightFaders" | "lightPrograms" | "lightChannelRoles"> {
  const nextChannels = resizeLightChannels(args.lightChannels, args.layout.channelCount);
  return {
    lightChannels: nextChannels,
    lightFaders: resizeLightFaders(prev?.lightFaders, args.layout.faderCount),
    lightPrograms: resizeLightPrograms(prev?.lightPrograms, args.layout.programCount),
    ...patchSceneDataForLightChannelsChange(prev, nextChannels),
  };
}
