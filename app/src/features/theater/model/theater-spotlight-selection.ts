import type { TheaterSpotlight } from "../../../shared/types/script";
import { STAGE_AIM_TARGET } from "./spotlight-batch-layout";

export function patchSpotlightsByIds(
  spotlights: TheaterSpotlight[],
  ids: number[],
  patch: (items: TheaterSpotlight[]) => TheaterSpotlight[],
): TheaterSpotlight[] {
  const idSet = new Set(ids);
  const selected = spotlights.filter((item) => idSet.has(item.id));
  if (selected.length === 0) return spotlights;
  const patched = new Map(patch(selected).map((item) => [item.id, item]));
  return spotlights.map((item) => patched.get(item.id) ?? item);
}

export function setSpotlightsVisibilityByIds(
  spotlights: TheaterSpotlight[],
  ids: number[],
  hidden: boolean,
): TheaterSpotlight[] {
  const idSet = new Set(ids);
  return spotlights.map((item) => {
    if (!idSet.has(item.id)) return item;
    if (hidden) return { ...item, hidden: true };
    const { hidden: _hidden, ...rest } = item;
    return rest;
  });
}

export function aimSpotlightsByIds(
  spotlights: TheaterSpotlight[],
  ids: number[],
  target: [number, number, number] = STAGE_AIM_TARGET,
): TheaterSpotlight[] {
  const idSet = new Set(ids);
  return spotlights.map((item) =>
    idSet.has(item.id) ? { ...item, target: [...target] as [number, number, number] } : item,
  );
}

export function cloneSpotlightsByIds(
  spotlights: TheaterSpotlight[],
  ids: number[],
): { next: TheaterSpotlight[]; createdIds: number[] } {
  const idSet = new Set(ids);
  const sources = spotlights.filter((item) => idSet.has(item.id));
  if (sources.length === 0) {
    return { next: spotlights, createdIds: [] };
  }
  let nextId = spotlights.reduce((acc, item) => Math.max(acc, item.id), 0);
  const created: TheaterSpotlight[] = sources.map((source, index) => {
    nextId += 1;
    const offset = 0.35 * (index + 1);
    return {
      ...source,
      id: nextId,
      label: `${source.label} (копия)`,
      channel: nextId,
      position: [
        source.position[0] + offset,
        source.position[1],
        source.position[2] + offset,
      ] as [number, number, number],
      target: [...source.target] as [number, number, number],
      hidden: false,
      mountModelId: undefined,
      mountPointId: undefined,
    };
  });
  return {
    next: [...spotlights, ...created],
    createdIds: created.map((item) => item.id),
  };
}
