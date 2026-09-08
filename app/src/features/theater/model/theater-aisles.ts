import type { TheaterAisle, TheaterLayout } from "../../../shared/types/script";

const MAX_AISLES = 4;
const MIN_AISLE_GAP = 0.25;
const DEFAULT_AISLE_WIDTH = 1.2;

function roundM(value: number) {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function resolveAisleId(raw: unknown, fallback: number): number {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : fallback;
}

export function aisleWidthMax(hallWidth: number) {
  return roundM(Math.max(0.6, hallWidth * 0.45));
}

export function canAddTheaterAisle(
  layout: Pick<TheaterLayout, "aisles" | "aisleWidth" | "aisleCenterX">,
) {
  return resolveLayoutAisles(layout).length < MAX_AISLES;
}

export function resolveLayoutAisles(
  layout: Pick<TheaterLayout, "aisles" | "aisleWidth" | "aisleCenterX">,
): TheaterAisle[] {
  if (Array.isArray(layout.aisles) && layout.aisles.length > 0) {
    return layout.aisles;
  }
  if (layout.aisleWidth > 0) {
    return [{ id: 1, width: layout.aisleWidth, centerX: layout.aisleCenterX }];
  }
  return [];
}

export function totalAisleWidth(
  layout: Pick<TheaterLayout, "aisles" | "aisleWidth" | "aisleCenterX">,
) {
  return resolveLayoutAisles(layout).reduce((sum, aisle) => sum + Math.max(0, aisle.width), 0);
}

function aislesOverlap(a: TheaterAisle, b: TheaterAisle) {
  const a0 = a.centerX - a.width / 2;
  const a1 = a.centerX + a.width / 2;
  const b0 = b.centerX - b.width / 2;
  const b1 = b.centerX + b.width / 2;
  return a0 < b1 + MIN_AISLE_GAP && b0 < a1 + MIN_AISLE_GAP;
}

function clampAisle(
  aisle: TheaterAisle,
  hallWidth: number,
): TheaterAisle {
  const widthMax = aisleWidthMax(hallWidth);
  const width = roundM(clamp(aisle.width, 0, widthMax));
  const halfW = hallWidth / 2;
  const half = width / 2;
  const centerX =
    width <= 0
      ? roundM(clamp(aisle.centerX, -halfW, halfW))
      : roundM(clamp(aisle.centerX, -halfW + half, halfW - half));
  return { ...aisle, width, centerX };
}

export function normalizeAisles(
  aisles: TheaterAisle[],
  layout: Pick<TheaterLayout, "hallWidth">,
): TheaterAisle[] {
  const normalized = aisles
    .map((aisle, index) =>
      clampAisle(
        {
          id: resolveAisleId(aisle.id, index + 1),
          width: Number.isFinite(aisle.width) ? aisle.width : DEFAULT_AISLE_WIDTH,
          centerX: Number.isFinite(aisle.centerX) ? aisle.centerX : 0,
        },
        layout.hallWidth,
      ),
    )
    .filter((aisle) => aisle.width > 0)
    .slice(0, MAX_AISLES);

  const sorted = [...normalized].sort((a, b) => a.id - b.id);
  const usedIds = new Set<number>();
  for (const aisle of sorted) {
    let id = aisle.id;
    while (usedIds.has(id)) id += 1;
    aisle.id = id;
    usedIds.add(id);
  }

  const byCenter = [...sorted].sort((a, b) => a.centerX - b.centerX);
  for (let i = 0; i < byCenter.length; i += 1) {
    for (let j = i + 1; j < byCenter.length; j += 1) {
      if (!aislesOverlap(byCenter[i], byCenter[j])) continue;
      byCenter[j] = clampAisle(
        {
          ...byCenter[j],
          centerX: byCenter[j].centerX + byCenter[j].width + MIN_AISLE_GAP,
        },
        layout.hallWidth,
      );
    }
  }
  return byCenter;
}

export function syncLegacyAisleFields(
  aisles: TheaterAisle[],
): Pick<TheaterLayout, "aisleWidth" | "aisleCenterX"> {
  const primary = aisles[0];
  return {
    aisleWidth: primary?.width ?? 0,
    aisleCenterX: primary?.centerX ?? 0,
  };
}

export function normalizeLayoutAisleFields(
  layout: TheaterLayout,
): Pick<TheaterLayout, "aisles" | "aisleWidth" | "aisleCenterX"> {
  const source = resolveLayoutAisles(layout);
  const aisles = normalizeAisles(source, layout);
  return {
    aisles,
    ...syncLegacyAisleFields(aisles),
  };
}

export function patchLayoutAisle(
  layout: TheaterLayout,
  aisleId: number,
  patch: Partial<Pick<TheaterAisle, "width" | "centerX">>,
): TheaterAisle[] {
  return normalizeAisles(
    resolveLayoutAisles(layout).map((aisle) =>
      aisle.id === aisleId ? { ...aisle, ...patch } : aisle,
    ),
    layout,
  );
}

export function removeLayoutAisle(layout: TheaterLayout, aisleId: number): TheaterAisle[] {
  return normalizeAisles(
    resolveLayoutAisles(layout).filter((aisle) => aisle.id !== aisleId),
    layout,
  );
}

function suggestAisleCenterX(
  aisles: TheaterAisle[],
  layout: Pick<TheaterLayout, "hallWidth">,
  width: number,
): number {
  const halfW = layout.hallWidth / 2;
  const candidates = [0, -2, 2, -3.5, 3.5, 1, -1, 4, -4];
  for (const candidate of candidates) {
    const probe: TheaterAisle = { id: -1, width, centerX: candidate };
    const clamped = clampAisle(probe, layout.hallWidth);
    if (!aisles.some((item) => aislesOverlap(item, clamped))) {
      return clamped.centerX;
    }
  }
  return roundM(clamp(aisles.length * 1.6, -halfW + 1, halfW - 1));
}

export function createLayoutAisle(layout: TheaterLayout, centerX?: number): TheaterAisle[] {
  const existing = resolveLayoutAisles(layout);
  if (existing.length >= MAX_AISLES) return existing;
  const width = DEFAULT_AISLE_WIDTH;
  const nextId =
    existing.reduce((max, aisle) => Math.max(max, aisle.id), 0) + 1;
  const x =
    centerX != null && Number.isFinite(centerX)
      ? centerX
      : suggestAisleCenterX(existing, layout, width);
  return normalizeAisles(
    [...existing, { id: nextId, width, centerX: x }],
    layout,
  );
}

export function layoutPatchFromAisles(
  aisles: TheaterAisle[],
  layout: Pick<TheaterLayout, "hallWidth">,
): Pick<TheaterLayout, "aisles" | "aisleWidth" | "aisleCenterX"> {
  const normalized = normalizeAisles(aisles, layout);
  return {
    aisles: normalized,
    ...syncLegacyAisleFields(normalized),
  };
}
