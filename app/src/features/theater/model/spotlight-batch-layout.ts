import type { TheaterLayout, TheaterSpotlight } from "../../../shared/types/script";
import { METRIC } from "./theater-metrics";

/** Раскладка пакета софитов: N штук, по 3 или 4 на линию (ряд по оси X). */
export type SpotlightsPerLine = 3 | 4;

export type SpotlightLayoutScope = "regular" | "rgb" | "all";

export const STAGE_AIM_TARGET: [number, number, number] = [0, 1, 1];
export const DEFAULT_SOURCE_Y = 6;

export type SpotlightBatchSlot = {
  position: [number, number, number];
  target: [number, number, number];
};

const BATCH = {
  heightY: 6,
  frontZ: 4,
  rowGapZ: 1.5,
  targetY: 1,
  targetZ: 1,
  targetXFactor: 0.5,
  /** Отступ линии софитов от переднего ряда кресел к сцене, м */
  beforeAudienceGapZ: 1.1,
  hallMargin: 1,
  maxSpacingX: 4,
} as const;

function lineSpacingX(itemsOnLine: number, hallWidth: number) {
  if (itemsOnLine <= 1) return 0;
  const usable = Math.max(2, hallWidth - 2 * BATCH.hallMargin);
  return Math.min(BATCH.maxSpacingX, usable / (itemsOnLine - 1));
}

function xPositionsEvenlyAcrossHall(itemsInRow: number, hallWidth: number) {
  if (itemsInRow <= 1) return [0];
  const margin = METRIC.sideClearance;
  const usable = Math.max(1, hallWidth - 2 * margin);
  const startX = -usable / 2;
  return Array.from({ length: itemsInRow }, (_, index) =>
    round2(startX + (index * usable) / (itemsInRow - 1)),
  );
}

function zForHallRow(rowIndex: number, rowCount: number, hallDepth: number) {
  const halfD = hallDepth / 2;
  const zMin = -halfD + METRIC.backClearance;
  const zMax = halfD - METRIC.stageClearance;
  if (rowCount <= 1) return round2((zMin + zMax) / 2);
  return round2(zMin + (rowIndex * (zMax - zMin)) / (rowCount - 1));
}

/**
 * Сетка по залу: N рядов по глубине, в каждом до perLine софитов с равным шагом по ширине.
 */
export function buildSpotlightGridInHall(
  count: number,
  rows: number,
  perLine: SpotlightsPerLine,
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth">,
): SpotlightBatchSlot[] {
  const total = Math.max(0, Math.trunc(count));
  const rowCount = Math.max(1, Math.min(32, Math.trunc(rows)));
  if (total === 0) return [];

  const slots: SpotlightBatchSlot[] = [];
  let index = 0;
  for (let row = 0; row < rowCount && index < total; row += 1) {
    const inRow = Math.min(perLine, total - index);
    const xs = xPositionsEvenlyAcrossHall(inRow, layout.hallWidth);
    const z = zForHallRow(row, rowCount, layout.hallDepth);
    for (let col = 0; col < inRow; col += 1) {
      const x = xs[col] ?? 0;
      slots.push({
        position: [x, BATCH.heightY, z],
        target: [
          round2(x * BATCH.targetXFactor),
          BATCH.targetY,
          BATCH.targetZ,
        ],
      });
      index += 1;
    }
  }
  return slots;
}

/** Позиции и цели для count софитов, сгруппированных по perLine на каждой линии. */
export function buildSpotlightBatchSlots(
  count: number,
  perLine: SpotlightsPerLine,
  hallWidth = 12,
): SpotlightBatchSlot[] {
  const total = Math.max(0, Math.trunc(count));
  if (total === 0) return [];

  const slots: SpotlightBatchSlot[] = [];
  for (let i = 0; i < total; i += 1) {
    const lineIndex = Math.floor(i / perLine);
    const lineStart = lineIndex * perLine;
    const lineEnd = Math.min(lineStart + perLine, total);
    const itemsInLine = lineEnd - lineStart;
    const indexInLine = i - lineStart;

    const spacing = lineSpacingX(itemsInLine, hallWidth);
    const span = (itemsInLine - 1) * spacing;
    const startX = -span / 2;
    const x = round2(startX + indexInLine * spacing);
    const z = round2(BATCH.frontZ - lineIndex * BATCH.rowGapZ);

    slots.push({
      position: [x, BATCH.heightY, z],
      target: [round2(x * BATCH.targetXFactor), BATCH.targetY, BATCH.targetZ],
    });
  }
  return slots;
}

/** Z линии заливки перед первым рядом зрителей. */
export function resolveSpotlightWashLineZ(
  layout: Pick<
    TheaterLayout,
    "hallDepth" | "audienceStartZ" | "seatRows" | "rowSpacing"
  >,
): number | null {
  const halfD = layout.hallDepth / 2;
  const maxZ = halfD - METRIC.stageClearance;
  const frontRowZ = getFrontAudienceRowZ(layout);
  if (frontRowZ == null) return null;
  let z = frontRowZ + BATCH.beforeAudienceGapZ;
  z = round2(Math.min(Math.max(z, -halfD + METRIC.backClearance), maxZ));
  return z;
}

/** Z переднего ряда зрителей (ближе к сцене). */
export function getFrontAudienceRowZ(
  layout: Pick<TheaterLayout, "audienceStartZ" | "seatRows" | "rowSpacing">,
) {
  if (layout.seatRows <= 0) return null;
  return layout.audienceStartZ + (layout.seatRows - 1) * layout.rowSpacing;
}

/** Линия софитов: равный шаг по X на всю ширину зала, перед первым рядом кресел. */
export function buildEvenLineBeforeAudience(
  count: number,
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth" | "audienceStartZ" | "seatRows" | "rowSpacing">,
): SpotlightBatchSlot[] {
  const total = Math.max(0, Math.trunc(count));
  if (total === 0) return [];

  const halfD = layout.hallDepth / 2;
  const maxZ = halfD - METRIC.stageClearance;
  const frontRowZ = getFrontAudienceRowZ(layout);
  let z =
    frontRowZ != null
      ? frontRowZ + BATCH.beforeAudienceGapZ
      : BATCH.frontZ;
  z = round2(Math.min(Math.max(z, -halfD + METRIC.backClearance), maxZ));

  const margin = METRIC.sideClearance;
  const usable = Math.max(1, layout.hallWidth - 2 * margin);
  const startX = -usable / 2;

  const slots: SpotlightBatchSlot[] = [];
  for (let i = 0; i < total; i += 1) {
    const x =
      total <= 1 ? 0 : round2(startX + (i * usable) / (total - 1));
    slots.push({
      position: [x, BATCH.heightY, z],
      target: [
        round2(x * BATCH.targetXFactor),
        BATCH.targetY,
        BATCH.targetZ,
      ],
    });
  }
  return slots;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

export function sortSpotlightsByX(items: TheaterSpotlight[]) {
  return [...items].sort(
    (a, b) => a.position[0] - b.position[0] || a.id - b.id,
  );
}

export function matchesSpotlightScope(
  item: TheaterSpotlight,
  scope: SpotlightLayoutScope,
) {
  if (scope === "all") return true;
  if (scope === "rgb") return Boolean(item.isRgb);
  return !item.isRgb;
}

/** Применить слоты раскладки к существующим софитам (порядок — слева направо). */
export function applyLayoutSlotsToSpotlights(
  spotlights: TheaterSpotlight[],
  slots: SpotlightBatchSlot[],): TheaterSpotlight[] {
  return spotlights.map((item, index) => {
    const slot = slots[index];
    if (!slot) return item;
    return {
      ...item,
      position: [...slot.position] as [number, number, number],
      target: [...slot.target] as [number, number, number],
    };
  });
}

export function aimSpotlightsAt(
  spotlights: TheaterSpotlight[],
  target: [number, number, number],
): TheaterSpotlight[] {
  return spotlights.map((item) => ({
    ...item,
    target: [...target] as [number, number, number],
  }));
}

export function setSpotlightsSourceHeight(
  spotlights: TheaterSpotlight[],
  y: number,
): TheaterSpotlight[] {
  return spotlights.map((item) => ({
    ...item,
    position: [item.position[0], y, item.position[2]] as [number, number, number],
  }));
}

function snapValue(value: number, step: number, origin = 0) {
  if (step <= 0) return round2(value);
  return round2(origin + Math.round((value - origin) / step) * step);
}

export function snapSpotlightsToGrid(
  spotlights: TheaterSpotlight[],
  step: number,
  hallWidth: number,
  hallDepth: number,
): TheaterSpotlight[] {
  const originX = -hallWidth / 2;
  const originZ = -hallDepth / 2;
  return spotlights.map((item) => ({
    ...item,
    position: [
      snapValue(item.position[0], step, originX),
      item.position[1],
      snapValue(item.position[2], step, originZ),
    ] as [number, number, number],
    target: [
      snapValue(item.target[0], step, originX),
      item.target[1],
      snapValue(item.target[2], step, originZ),
    ] as [number, number, number],
  }));
}

export function mergeSpotlightPatches(
  base: TheaterSpotlight[],
  patched: TheaterSpotlight[],
): TheaterSpotlight[] {
  const byId = new Map(patched.map((item) => [item.id, item]));
  return base.map((item) => byId.get(item.id) ?? item);
}
