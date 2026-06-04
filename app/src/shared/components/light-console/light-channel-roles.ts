import type { SceneLightChannelRolesV1 } from "../../../features/scene/model/scene-slice";

export const DEFAULT_SOFIT_CHANNELS = [1, 2];

export function normalizeSofitChannels(
  raw: number[] | null | undefined,
  lightChannelsCount: number,
): number[] {
  const max = Math.max(1, lightChannelsCount);
  const list = Array.isArray(raw)
    ? raw
        .map((n) => Math.trunc(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= max)
    : [];
  const unique = [...new Set(list)].sort((a, b) => a - b);
  if (unique.length > 0) return unique;
  return DEFAULT_SOFIT_CHANNELS.filter((n) => n <= max);
}

export function resolveLightChannelRoles(
  raw: SceneLightChannelRolesV1 | null | undefined,
  lightChannelsCount: number,
): SceneLightChannelRolesV1 {
  const sofitChannels = normalizeSofitChannels(raw?.sofitChannels, lightChannelsCount);
  return { v: 1, sofitChannels };
}

export function toggleSofitChannel(
  roles: SceneLightChannelRolesV1,
  channel: number,
  lightChannelsCount: number,
): SceneLightChannelRolesV1 {
  const normalized = normalizeSofitChannels(roles.sofitChannels, lightChannelsCount);
  const next = normalized.includes(channel)
    ? normalized.filter((n) => n !== channel)
    : [...normalized, channel].sort((a, b) => a - b);
  return { v: 1, sofitChannels: next };
}

export function formatSofitChannelsLabel(channels: number[]): string {
  if (channels.length === 0) return "—";
  return channels.map((n) => `K${n}`).join(", ");
}
