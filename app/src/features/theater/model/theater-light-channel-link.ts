import type {
  LightFixture,
  TheaterLayout,
  TheaterSpotlight,
} from "../../../shared/types/script";
import {
  parseLightChannel,
  resolveLightColor,
} from "../../../shared/components/show-script/utils/lightTokens";
import { tc } from "../../../shared/styles/theme-color";
import {
  matchesSpotlightScope,
  sortSpotlightsByX,
  type SpotlightLayoutScope,
} from "./spotlight-batch-layout";
import { THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY } from "./theater-scene-lighting";

export const LIGHT_CHANNEL_SLOT_COUNT = 8;

export function parseLightChannelSlot(
  raw: string | number | undefined | null,
): number | null {
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    const slot = Math.trunc(raw);
    return slot >= 1 ? slot : null;
  }
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum)) {
    const slot = Math.trunc(asNum);
    return slot >= 1 ? slot : null;
  }
  return null;
}

export function formatLightChannelSlot(slot: number): string {
  return String(Math.max(1, Math.trunc(slot)));
}

export function assignSequentialChannelsToSpotlights(
  spotlights: TheaterSpotlight[],
  scope: SpotlightLayoutScope,
): TheaterSpotlight[] {
  const ordered = sortSpotlightsByX(
    spotlights.filter((item) => matchesSpotlightScope(item, scope)),
  );
  const channelById = new Map<number, number>();
  ordered.forEach((item, index) => {
    channelById.set(item.id, index + 1);
  });
  return spotlights.map((item) => {
    const slot = channelById.get(item.id);
    if (slot == null) return item;
    return { ...item, channel: slot };
  });
}

/** Каналы 1…N слева направо для уже отфильтрованного списка. */
export function assignSequentialChannelsOrdered(
  spotlights: TheaterSpotlight[],
): TheaterSpotlight[] {
  const ordered = sortSpotlightsByX(spotlights);
  const channelById = new Map<number, number>();
  ordered.forEach((item, index) => {
    channelById.set(item.id, index + 1);
  });
  return spotlights.map((item) => {
    const slot = channelById.get(item.id);
    if (slot == null) return item;
    return { ...item, channel: slot };
  });
}

export function resolveLightChannelLabel(
  lightChannels: string[],
  slot: number,
): string {
  const parsed = parseLightChannel(lightChannels[slot - 1] ?? "");
  return parsed.label || `Канал ${slot}`;
}

export function resolveLightChannelDisplayColor(
  lightChannels: string[],
  slot: number,
): string | null {
  const raw = lightChannels[slot - 1] ?? "";
  const parsed = parseLightChannel(raw);
  return resolveLightColor(parsed.label, parsed.color);
}

export function buildLightChannelSelectOptions(lightChannels: string[], minCount = LIGHT_CHANNEL_SLOT_COUNT): {
  value: string;
  label: string;
  slot: number;
}[] {
  return Array.from({ length: Math.max(LIGHT_CHANNEL_SLOT_COUNT, minCount, lightChannels.length) }, (_, index) => {
    const slot = index + 1;
    return {
      value: formatLightChannelSlot(slot),
      label: `к ${slot}`,
      slot,
    };
  });
}

export function lightPlotGridToWorld(
  gridX: number,
  gridY: number,
  layout: TheaterLayout,
  gridCols: number,
  gridRows: number,
): [number, number] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const x = ((gridX - 0.5) / gridCols) * layout.hallWidth - halfW;
  const z = ((gridY - 0.5) / gridRows) * layout.hallDepth - halfD;
  return [x, z];
}

export function worldToLightPlotGrid(
  x: number,
  z: number,
  layout: TheaterLayout,
  gridCols: number,
  gridRows: number,
): [number, number] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const gridX = ((x + halfW) / layout.hallWidth) * gridCols + 0.5;
  const gridY = ((z + halfD) / layout.hallDepth) * gridRows + 0.5;
  return [gridX, gridY];
}

function spotlightBeamToFixtureAngle(spotlight: TheaterSpotlight): number {
  const dx = spotlight.target[0] - spotlight.position[0];
  const dz = spotlight.target[2] - spotlight.position[2];
  return Math.round((Math.atan2(dz, dx) * 180) / Math.PI);
}

function spotlightBeamToFixtureLength(spotlight: TheaterSpotlight): number {
  const dx = spotlight.target[0] - spotlight.position[0];
  const dz = spotlight.target[2] - spotlight.position[2];
  const dist = Math.hypot(dx, dz);
  return Math.round(Math.min(120, Math.max(10, (dist / 4) * 54)));
}

export function spotlightMatchesChannelSlot(
  spotlight: TheaterSpotlight,
  slot: number,
): boolean {
  return parseLightChannelSlot(spotlight.channel ?? spotlight.id) === slot;
}

export function fixtureMatchesChannelSlot(fixture: LightFixture, slot: number): boolean {
  return parseLightChannelSlot(fixture.channel) === slot;
}

export function countSceneLightChannelLinks(
  lightPlot: LightFixture[] | undefined,
  spotlights: TheaterSpotlight[] | undefined,
): { fixtures: number; spotlights: number; linkedSlots: number } {
  const slots = new Set<number>();
  for (const fixture of lightPlot ?? []) {
    const slot = parseLightChannelSlot(fixture.channel);
    if (slot != null) slots.add(slot);
  }
  for (const spotlight of spotlights ?? []) {
    const slot = parseLightChannelSlot(spotlight.channel ?? spotlight.id);
    if (slot != null) slots.add(slot);
  }
  return {
    fixtures: lightPlot?.length ?? 0,
    spotlights: spotlights?.length ?? 0,
    linkedSlots: slots.size,
  };
}

export function mergeSpotlightsFromLightPlot(
  fixtures: LightFixture[],
  existing: TheaterSpotlight[],
  layout: TheaterLayout,
  lightChannels: string[],
  gridCols = 12,
  gridRows = 20,
): TheaterSpotlight[] {
  const result = existing.map((item) => ({
    ...item,
    position: [...item.position] as [number, number, number],
    target: [...item.target] as [number, number, number],
  }));
  const usedIds = new Set<number>();

  for (const fixture of fixtures) {
    const slot = parseLightChannelSlot(fixture.channel);
    const [wx, wz] = lightPlotGridToWorld(
      fixture.x,
      fixture.y,
      layout,
      gridCols,
      gridRows,
    );
    const angleRad = ((fixture.angle ?? 0) * Math.PI) / 180;
    const beamLen = Math.max(0.5, ((fixture.length ?? 54) / 54) * 4);
    const targetX = wx + Math.cos(angleRad) * beamLen;
    const targetZ = wz + Math.sin(angleRad) * beamLen;
    const color =
      slot != null
        ? resolveLightChannelDisplayColor(lightChannels, slot) ?? undefined
        : undefined;

    let matchIdx = -1;
    if (slot != null) {
      matchIdx = result.findIndex(
        (item) =>
          !usedIds.has(item.id) && spotlightMatchesChannelSlot(item, slot),
      );
    }
    if (matchIdx < 0) {
      matchIdx = result.findIndex(
        (item) => !usedIds.has(item.id) && item.label === fixture.label,
      );
    }

    const fallbackLabel = fixture.label?.trim() || `Софит ${fixture.id}`;
    const patch = {
      position: [wx, 6, wz] as [number, number, number],
      target: [targetX, 1, targetZ] as [number, number, number],
      angleDeg: Math.round(12 + Math.min(40, beamLen * 6)),
      channel: slot ?? undefined,
      color,
    };

    if (matchIdx >= 0) {
      result[matchIdx] = { ...result[matchIdx], ...patch };
      usedIds.add(result[matchIdx].id);
    } else {
      const nextId = result.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
      result.push({
        id: nextId,
        label: fallbackLabel,
        position: patch.position,
        target: patch.target,
        angleDeg: patch.angleDeg,
        intensity: THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
        color: patch.color ?? tc("--color-warning"),
        enabled: true,
        channel: slot ?? nextId,
        isRgb: false,
      });
      usedIds.add(nextId);
    }
  }

  return result;
}

/** 3D-софиты → lightPlot (источник истины: theaterSpotlights). */
export function buildLightPlotFromSpotlights(
  spotlights: TheaterSpotlight[],
  layout: TheaterLayout,
  gridCols = 12,
  gridRows = 20,
): LightFixture[] {
  return spotlights
    .filter((spotlight) => spotlight.hidden !== true)
    .map((spotlight) => {
      const slot = parseLightChannelSlot(spotlight.channel ?? spotlight.id);
      const [gridX, gridY] = worldToLightPlotGrid(
        spotlight.position[0],
        spotlight.position[2],
        layout,
        gridCols,
        gridRows,
      );
      return {
        id: spotlight.id,
        label: spotlight.label?.trim() || `Софит ${spotlight.id}`,
        channel:
          slot != null
            ? formatLightChannelSlot(slot)
            : String(spotlight.channel ?? spotlight.id),
        x: Math.round(Math.max(1, Math.min(gridCols, gridX))),
        y: Math.round(Math.max(1, Math.min(gridRows, gridY))),
        angle: spotlightBeamToFixtureAngle(spotlight),
        length: spotlightBeamToFixtureLength(spotlight),
      };
    });
}

export function applyLightPlotChannelsToSpotlights(
  spotlights: TheaterSpotlight[],
  lightPlot: LightFixture[] | undefined,
): TheaterSpotlight[] {
  if (!lightPlot?.length) return spotlights;
  return spotlights.map((spotlight) => {
    const slot = parseLightChannelSlot(spotlight.channel ?? spotlight.id);
    if (slot == null) return spotlight;
    const fixture = lightPlot.find((item) => fixtureMatchesChannelSlot(item, slot));
    if (!fixture) return spotlight;
    return {
      ...spotlight,
      label: fixture.label?.trim() || spotlight.label,
      channel: slot,
    };
  });
}
