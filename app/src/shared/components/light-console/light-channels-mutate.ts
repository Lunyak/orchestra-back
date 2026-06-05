import type { SceneData } from "../../../features/scene/model/scene-slice";
import type { SceneLightChannelRolesV1 } from "../../../features/scene/model/scene-slice";
import { resolveLightChannelRoles } from "./light-channel-roles";
import { resolveLightPrograms } from "./light-console-data";

export const MIN_LIGHT_CHANNELS = 1;
export const MAX_LIGHT_CHANNELS = 64;

export function defaultLightChannelLabel(channel: number): string {
  return `Канал ${Math.max(1, Math.trunc(channel))}`;
}

/** Не терять локально добавленные K-слоты при устаревшем снимке с сервера/файла. */
export function mergeLightChannelsPreferLonger(prev: string[], loaded: string[]): string[] {
  const len = Math.max(prev.length, loaded.length, 8);
  return Array.from({ length: len }, (_, i) => {
    const p = String(prev[i] ?? "");
    const l = String(loaded[i] ?? "");
    if (p.trim() && l.trim() && p.trim() !== l.trim()) return p;
    return p.trim() ? p : l;
  });
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

/** Программы П и роли софитов при изменении числа K. */
export function patchSceneDataForLightChannelCount(
  prev: SceneData | null | undefined,
  nextChannels: string[],
  prevChannelCount?: number,
): Pick<SceneData, "lightPrograms" | "lightChannelRoles"> {
  const nextLen = nextChannels.length;
  const prevLen =
    prevChannelCount ??
    (Array.isArray((prev as { lightChannels?: string[] } | null)?.lightChannels)
      ? (prev as { lightChannels: string[] }).lightChannels.length
      : 0);

  const programs = resolveLightPrograms(prev?.lightPrograms, nextLen);
  const roles = resolveLightChannelRoles(prev?.lightChannelRoles, nextLen);
  let sofitChannels = [...roles.sofitChannels];

  if (nextLen > prevLen) {
    sofitChannels = [...new Set([...sofitChannels, nextLen])].sort((a, b) => a - b);
  } else if (nextLen < prevLen) {
    sofitChannels = sofitChannels.filter((ch) => ch <= nextLen);
  }

  const lightChannelRoles: SceneLightChannelRolesV1 = { v: 1, sofitChannels };
  return { lightPrograms: programs, lightChannelRoles };
}
