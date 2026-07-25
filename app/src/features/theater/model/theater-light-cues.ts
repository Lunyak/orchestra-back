import type { LightCue, TheaterSpotlight } from "../../../shared/types/script";
import { parseLightChannelSlot } from "./theater-light-channel-link";

export function normalizeLightCues(cues: LightCue[]): LightCue[] {
  return cues
    .map((item) => ({
      id: Number(item.id) || 0,
      tSec: Math.max(0, Number(item.tSec) || 0),
      channel: String(item.channel ?? "").trim(),
      intensity:
        typeof item.intensity === "number" && Number.isFinite(item.intensity)
          ? Math.min(2, Math.max(0, item.intensity))
          : undefined,
      enabled: item.enabled,
    }))
    .filter((item) => item.id > 0 && item.channel)
    .sort((a, b) => a.tSec - b.tSec || a.id - b.id);
}

export function resolveSpotlightsAtLightCueTime(
  spotlights: TheaterSpotlight[],
  cues: LightCue[],
  tSec: number,
): TheaterSpotlight[] {
  const normalized = normalizeLightCues(cues);
  if (normalized.length === 0) return spotlights;

  const bySlot = new Map<number, LightCue>();
  for (const cue of normalized) {
    if (cue.tSec > tSec) continue;
    const slot = parseLightChannelSlot(cue.channel);
    if (slot == null) continue;
    const prev = bySlot.get(slot);
    if (!prev || prev.tSec <= cue.tSec) bySlot.set(slot, cue);
  }

  if (bySlot.size === 0) return spotlights;

  return spotlights.map((spotlight) => {
    const slot = parseLightChannelSlot(spotlight.channel ?? spotlight.id);
    if (slot == null) return spotlight;
    const cue = bySlot.get(slot);
    if (!cue) return spotlight;
    return {
      ...spotlight,
      ...(cue.intensity != null ? { intensity: cue.intensity } : {}),
      ...(cue.enabled != null ? { enabled: cue.enabled } : {}),
    };
  });
}

export function stepDurationSec(durationMin?: number | null, fallback = 120): number {
  if (typeof durationMin === "number" && durationMin > 0) {
    return Math.max(30, Math.round(durationMin * 60));
  }
  return fallback;
}
