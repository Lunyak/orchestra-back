import type { SceneLightFaderV1, SceneLightFadersDataV1 } from "../../scene/model/scene-slice";
import type { TheaterSpotlight } from "../../../shared/types/script";

export function formatCompactChannelSlot(slot: number): string {
  return `к ${Math.max(1, Math.trunc(slot))}`;
}

export function formatCompactFaderLabel(faderId: number): string {
  return `ф ${Math.max(1, Math.trunc(faderId))}`;
}

/** Фейдер, к которому привязан софит, по данным пульта (links / spotlightId). */
export function resolveFaderIdForSpotlight(
  spotlightId: number,
  lightFaders: SceneLightFadersDataV1 | null | undefined,
): number | undefined {
  if (!lightFaders || lightFaders.v !== 1) return undefined;
  for (const fader of lightFaders.faders) {
    if (fader.spotlightId === spotlightId) return fader.id;
    if (fader.links?.some((link) => link.spotlightId === spotlightId)) {
      return fader.id;
    }
  }
  return undefined;
}

export function resolveSpotlightFaderId(
  spotlight: TheaterSpotlight,
  lightFaders?: SceneLightFadersDataV1 | null,
): number {
  if (Number.isFinite(spotlight.faderId)) {
    return Math.max(1, Math.trunc(spotlight.faderId!));
  }
  const fromFader = resolveFaderIdForSpotlight(spotlight.id, lightFaders);
  if (fromFader != null) return fromFader;
  return spotlight.id;
}

export function spotlightBelongsToFader(
  spotlight: TheaterSpotlight,
  fader: SceneLightFaderV1,
  lightFaders?: SceneLightFadersDataV1 | null,
): boolean {
  return resolveSpotlightFaderId(spotlight, lightFaders) === fader.id;
}

export function getSpotlightsBoundToFader(
  fader: SceneLightFaderV1,
  spotlights: TheaterSpotlight[],
  lightFaders?: SceneLightFadersDataV1 | null,
): TheaterSpotlight[] {
  return spotlights.filter((spotlight) =>
    spotlightBelongsToFader(spotlight, fader, lightFaders),
  );
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
    channel: fader.channel ?? channel,
    spotlightId,
    links: [...withoutSpotlight, { channel, spotlightId }],
  };
}

/** Восстанавливает faderId на софитах из сохранённых привязок пульта (links / spotlightId). */
export function applyFaderBindingsToSpotlights(
  spotlights: TheaterSpotlight[],
  lightFaders: SceneLightFadersDataV1 | null | undefined,
): TheaterSpotlight[] {
  if (!lightFaders || lightFaders.v !== 1 || lightFaders.faders.length === 0) {
    return spotlights;
  }
  let changed = false;
  const next = spotlights.map((spotlight) => {
    const fromFader = resolveFaderIdForSpotlight(spotlight.id, lightFaders);
    if (fromFader == null || spotlight.faderId === fromFader) return spotlight;
    changed = true;
    return { ...spotlight, faderId: fromFader };
  });
  return changed ? next : spotlights;
}
