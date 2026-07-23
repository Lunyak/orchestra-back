import type { TheaterLayout } from "../../../shared/types/script";

/** Поля layout, которые не входят в базовые колонки TheaterLayout на сервере. */
export const THEATER_LAYOUT_EXTRA_KEYS = [
  "hallOffsetX",
  "hallOffsetZ",
  "stageShape",
  "stageFrontZ",
  "stageBackWidth",
  "prosceniumWidth",
  "prosceniumHeight",
  "prosceniumEnabled",
  "tJunctionZ",
  "wallRecesses",
  "stageOutline",
  "stageOutlineOpenEdges",
  "zones",
  "zoneGrid",
  "stageFloorMaterial",
  "hallFloorMaterial",
  "backWallMaterial",
  "sideWallsMaterial",
  "portalMaterial",
] as const satisfies readonly (keyof TheaterLayout)[];

export type TheaterLayoutExtraKey = (typeof THEATER_LAYOUT_EXTRA_KEYS)[number];

export type TheaterLayoutExtras = Partial<Pick<TheaterLayout, TheaterLayoutExtraKey>>;

export function extractTheaterLayoutExtras(
  layout: Partial<TheaterLayout>,
): TheaterLayoutExtras | undefined {
  const extras: Record<string, unknown> = {};
  for (const key of THEATER_LAYOUT_EXTRA_KEYS) {
    if (layout[key] !== undefined) {
      extras[key] = layout[key];
    }
  }
  return Object.keys(extras).length > 0 ? (extras as TheaterLayoutExtras) : undefined;
}

export function mergeTheaterLayoutExtras<T extends Partial<TheaterLayout>>(
  base: T,
  extras: unknown,
): T {
  if (!extras || typeof extras !== "object") return base;
  const merged = { ...base };
  const record = extras as Record<string, unknown>;
  for (const key of THEATER_LAYOUT_EXTRA_KEYS) {
    if (record[key] !== undefined) {
      (merged as Record<string, unknown>)[key] = record[key];
    }
  }
  return merged;
}
