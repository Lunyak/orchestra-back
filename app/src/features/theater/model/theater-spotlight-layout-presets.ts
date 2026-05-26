import type { TheaterLayout } from "../../../shared/types/script";
import {
  buildEvenLineBeforeAudience,
  buildSpotlightBatchSlots,
  buildSpotlightGridInHall,
  type SpotlightBatchSlot,
} from "./spotlight-batch-layout";
import { METRIC } from "./theater-metrics";

export type SpotlightLayoutPresetId =
  | "front-wash"
  | "grid-2x4"
  | "side-pairs"
  | "back-rim"
  | "classic-6";

export type SpotlightLayoutPreset = {
  id: SpotlightLayoutPresetId;
  label: string;
  description: string;
};

export const SPOTLIGHT_LAYOUT_PRESETS: SpotlightLayoutPreset[] = [
  {
    id: "front-wash",
    label: "Заливка",
    description: "Линия перед зрителями, цель — центр сцены",
  },
  {
    id: "grid-2x4",
    label: "Сетка 2×4",
    description: "Два ряда по залу, до 4 в ряд",
  },
  {
    id: "side-pairs",
    label: "Боковой",
    description: "Пары слева/справа, боковой свет",
  },
  {
    id: "back-rim",
    label: "Контровой",
    description: "С задней стены на сцену",
  },
  {
    id: "classic-6",
    label: "Классика ×6",
    description: "6 софитов: 2 ряда по 3",
  },
];

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function buildSidePairsLayout(
  count: number,
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth">,
): SpotlightBatchSlot[] {
  const total = Math.max(0, Math.trunc(count));
  if (total === 0) return [];
  const halfW = layout.hallWidth / 2 - METRIC.sideClearance;
  const halfD = layout.hallDepth / 2;
  const zMin = -halfD + METRIC.backClearance + 1;
  const zMax = halfD - METRIC.stageClearance - 0.5;
  const pairCount = Math.ceil(total / 2);
  const zStep = pairCount <= 1 ? 0 : (zMax - zMin) / (pairCount - 1);

  const slots: SpotlightBatchSlot[] = [];
  for (let i = 0; i < total; i += 1) {
    const pairIndex = Math.floor(i / 2);
    const fromLeft = i % 2 === 0;
    const z = round2(zMin + pairIndex * zStep);
    slots.push({
      position: [fromLeft ? -halfW : halfW, 5.5, z],
      target: [0, 1, 0.5],
    });
  }
  return slots;
}

function buildBackRimLayout(
  count: number,
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth">,
): SpotlightBatchSlot[] {
  const total = Math.max(0, Math.trunc(count));
  if (total === 0) return [];
  const halfW = layout.hallWidth / 2 - METRIC.sideClearance;
  const halfD = layout.hallDepth / 2;
  const z = round2(-halfD + METRIC.backClearance + 0.35);
  const margin = METRIC.sideClearance;
  const usable = Math.max(1, layout.hallWidth - 2 * margin);
  const startX = -usable / 2;

  const slots: SpotlightBatchSlot[] = [];
  for (let i = 0; i < total; i += 1) {
    const x = total <= 1 ? 0 : round2(startX + (i * usable) / (total - 1));
    slots.push({
      position: [x, 6.2, z],
      target: [round2(x * 0.25), 1.4, halfD * 0.35],
    });
  }
  return slots;
}

export function buildSpotlightLayoutPresetSlots(
  presetId: SpotlightLayoutPresetId,
  count: number,
  layout: TheaterLayout,
): SpotlightBatchSlot[] {
  const total = Math.max(0, Math.trunc(count));
  if (total === 0) return [];

  switch (presetId) {
    case "front-wash":
      return buildEvenLineBeforeAudience(total, layout);
    case "grid-2x4":
      return buildSpotlightGridInHall(total, 2, 4, layout);
    case "side-pairs":
      return buildSidePairsLayout(total, layout);
    case "back-rim":
      return buildBackRimLayout(total, layout);
    case "classic-6":
      return buildSpotlightBatchSlots(Math.min(total, 6), 3, layout.hallWidth);
    default:
      return buildEvenLineBeforeAudience(total, layout);
  }
}
