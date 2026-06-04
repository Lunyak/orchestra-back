import type { SceneLightChannelRolesV1 } from "../../../features/scene/model/scene-slice";

export const DEFAULT_SOFIT_CHANNELS = [1, 2];

/** Каналы, отмеченные в toggles — только они, без подстановки K1/K2 по умолчанию. */
export function normalizeSelectedRecordChannels(
  raw: number[] | null | undefined,
  lightChannelsCount: number,
): number[] {
  const max = Math.max(1, lightChannelsCount);
  const list = Array.isArray(raw)
    ? raw
        .map((n) => Math.trunc(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= max)
    : [];
  return [...new Set(list)].sort((a, b) => a - b);
}

export function normalizeSofitChannels(
  raw: number[] | null | undefined,
  lightChannelsCount: number,
): number[] {
  const selected = normalizeSelectedRecordChannels(raw, lightChannelsCount);
  if (selected.length > 0) return selected;
  const max = Math.max(1, lightChannelsCount);
  return DEFAULT_SOFIT_CHANNELS.filter((n) => n <= max);
}

export function resolveLightChannelRoles(
  raw: SceneLightChannelRolesV1 | null | undefined,
  lightChannelsCount: number,
): SceneLightChannelRolesV1 {
  const sofitChannels = normalizeSelectedRecordChannels(raw?.sofitChannels, lightChannelsCount);
  return { v: 1, sofitChannels };
}

export function toggleSofitChannel(
  roles: SceneLightChannelRolesV1,
  channel: number,
  lightChannelsCount: number,
): SceneLightChannelRolesV1 {
  const normalized = normalizeSelectedRecordChannels(roles.sofitChannels, lightChannelsCount);
  const next = normalized.includes(channel)
    ? normalized.filter((n) => n !== channel)
    : [...normalized, channel].sort((a, b) => a - b);
  return { v: 1, sofitChannels: next };
}

export function formatSofitChannelsLabel(channels: number[]): string {
  if (channels.length === 0) return "—";
  return channels.map((n) => `K${n}`).join(", ");
}
