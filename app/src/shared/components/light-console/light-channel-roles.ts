import type { PlaybookLightChannelRolesV1 } from "../../../features/playbook/model/playbook-slice";
import type { SceneLightKadrV1 } from "../../types/script";

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
  raw: PlaybookLightChannelRolesV1 | null | undefined,
  lightChannelsCount: number,
): PlaybookLightChannelRolesV1 {
  const sofitChannels = normalizeSelectedRecordChannels(raw?.sofitChannels, lightChannelsCount);
  return { v: 1, sofitChannels };
}

/** K для карточки картины: toggles сцены → снимок картины → каналы из faders. */
export function resolveSofitChannelsForKadrDisplay(args: {
  lightChannelRoles?: PlaybookLightChannelRolesV1 | null;
  kadr?: SceneLightKadrV1 | null;
  lightChannelsCount: number;
}): number[] {
  const fromRoles = normalizeSelectedRecordChannels(
    args.lightChannelRoles?.sofitChannels,
    args.lightChannelsCount,
  );
  if (fromRoles.length > 0) return fromRoles;

  const fromKadr = normalizeSelectedRecordChannels(
    args.kadr?.recordChannels,
    args.lightChannelsCount,
  );
  if (fromKadr.length > 0) return fromKadr;

  if (args.kadr?.faders?.length) {
    const channels = new Set<number>();
    for (const state of args.kadr.faders) {
      if (state.channel != null && Number.isFinite(state.channel) && state.channel > 0) {
        channels.add(Math.trunc(state.channel));
      }
    }
    if (channels.size > 0) return [...channels].sort((a, b) => a - b);
  }

  return [];
}

export function toggleSofitChannel(
  roles: PlaybookLightChannelRolesV1,
  channel: number,
  lightChannelsCount: number,
): PlaybookLightChannelRolesV1 {
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
