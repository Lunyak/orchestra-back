import type { SceneLightFaderV1, SceneLightFadersDataV1 } from "../../scene/model/scene-slice";
import type { TheaterSpotlight } from "../../../shared/types/script";

export function formatCompactChannelSlot(slot: number): string {
  return `к ${Math.max(1, Math.trunc(slot))}`;
}

export function formatCompactFaderLabel(faderId: number): string {
  return `ф ${Math.max(1, Math.trunc(faderId))}`;
}

/** Номер фейдера на софите: только явное поле, иначе совпадает с id софита. */
export function readSpotlightFaderId(spotlight: TheaterSpotlight): number {
  if (Number.isFinite(spotlight.faderId)) {
    return Math.max(1, Math.trunc(spotlight.faderId!));
  }
  return spotlight.id;
}

export function spotlightBelongsToFader(
  spotlight: TheaterSpotlight,
  faderId: number,
): boolean {
  return readSpotlightFaderId(spotlight) === faderId;
}

export function getSpotlightsBoundToFader(
  faderId: number,
  spotlights: TheaterSpotlight[],
): TheaterSpotlight[] {
  return spotlights.filter((spotlight) => spotlightBelongsToFader(spotlight, faderId));
}

export function mergeFaderSpotlightLink(
  fader: SceneLightFaderV1,
  spotlightId: number,
  channel: number,
): SceneLightFaderV1 {
  const prevLinks = Array.isArray(fader.links) ? fader.links : [];
  const withoutSpotlight = prevLinks.filter((link) => link.spotlightId !== spotlightId);
  return {
    ...fader,
    channel,
    spotlightId,
    links: [...withoutSpotlight, { channel, spotlightId }],
  };
}

/** Софит может быть только на одном фейдере: снимаем его с остальных. */
export function detachSpotlightFromOtherFaders(
  faders: SceneLightFaderV1[],
  targetFaderId: number,
  spotlightId: number,
): SceneLightFaderV1[] {
  return faders.map((fader) => {
    if (fader.id === targetFaderId) return fader;
    const links = (fader.links ?? []).filter((link) => link.spotlightId !== spotlightId);
    const spotlightIdField =
      fader.spotlightId === spotlightId
        ? links.find((link) => link.spotlightId != null)?.spotlightId
        : fader.spotlightId;
    if (links.length === (fader.links ?? []).length && spotlightIdField === fader.spotlightId) {
      return fader;
    }
    return { ...fader, links, spotlightId: spotlightIdField };
  });
}

export function bindSpotlightOnFaderBoard(
  faders: SceneLightFaderV1[],
  faderId: number,
  spotlightId: number,
  channel: number,
): SceneLightFaderV1[] {
  const exists = faders.some((item) => item.id === faderId);
  const detached = detachSpotlightFromOtherFaders(faders, faderId, spotlightId);
  const base = exists
    ? detached.find((item) => item.id === faderId)!
    : {
        id: faderId,
        label: formatCompactFaderLabel(faderId),
        channel,
        intensity: 1,
        enabled: true,
        links: [] as { channel: number; spotlightId?: number }[],
      };
  const nextFader = mergeFaderSpotlightLink(base, spotlightId, channel);
  return exists
    ? detached.map((item) => (item.id === faderId ? nextFader : item))
    : [...detached, nextFader];
}
