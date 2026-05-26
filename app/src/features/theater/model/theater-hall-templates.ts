import type { TheaterLayout, TheaterWallRecess } from "../../../shared/types/script";
import { DEFAULT_THEATER_LAYOUT } from "./theater-defaults";
import { METRIC, computeAudienceStartZ, normalizeTheaterLayout, roundM } from "./theater-metrics";
import { resolveStageShape } from "./theater-stage-geometry";
import {
  fitStageOutlineToHallBounds,
  MIN_STAGE_OUTLINE_POINTS,
} from "./theater-custom-outline";

export type TheaterHallTemplate = {
  id: string;
  label: string;
  description: string;
  patch: Partial<TheaterLayout>;
};

export const THEATER_HALL_TEMPLATES: TheaterHallTemplate[] = [
  {
    id: "workshop",
    label: "Мастерская",
    description: "7×5 м, 2 ряда",
    patch: {
      hallWidth: 7,
      hallDepth: 5,
      seatRows: 2,
      seatsPerRow: 5,
      audienceStartZ: -1.2,
    },
  },
  {
    id: "studio",
    label: "Студия",
    description: "8×6 м, 3 ряда",
    patch: {
      hallWidth: 8,
      hallDepth: 6,
      seatRows: 3,
      seatsPerRow: 6,
      audienceStartZ: -2,
    },
  },
  {
    id: "chamber",
    label: "Камерный",
    description: "9×8 м, 4 ряда",
    patch: {
      hallWidth: 9,
      hallDepth: 8,
      seatRows: 4,
      seatsPerRow: 7,
      audienceStartZ: -2.5,
    },
  },
  {
    id: "cabaret",
    label: "Кабаре",
    description: "10×7 м, зал у сцены",
    patch: {
      hallWidth: 10,
      hallDepth: 7,
      seatRows: 4,
      seatsPerRow: 8,
      rowSpacing: 0.75,
      audienceStartZ: -1.5,
    },
  },
  {
    id: "standard",
    label: "Стандарт",
    description: "12×10 м, 5 рядов",
    patch: {
      hallWidth: 12,
      hallDepth: 10,
      seatRows: 5,
      seatsPerRow: 10,
      audienceStartZ: -3,
    },
  },
  {
    id: "rehearsal",
    label: "Репетиционная",
    description: "12×10 м, без кресел",
    patch: {
      hallWidth: 12,
      hallDepth: 10,
      seatRows: 0,
      seatsPerRow: 10,
      audienceStartZ: -3,
    },
  },
  {
    id: "black-box",
    label: "Чёрный ящик",
    description: "10×10 м, пустой зал",
    patch: {
      hallWidth: 10,
      hallDepth: 10,
      wallHeight: 5,
      seatRows: 0,
      seatsPerRow: 8,
      audienceStartZ: -2,
    },
  },
  {
    id: "narrow",
    label: "Глубокая сцена",
    description: "8×14 м, узкий зал",
    patch: {
      hallWidth: 8,
      hallDepth: 14,
      seatRows: 6,
      seatsPerRow: 6,
      audienceStartZ: -4,
    },
  },
  {
    id: "wide",
    label: "Широкая сцена",
    description: "18×10 м, мало рядов",
    patch: {
      hallWidth: 18,
      hallDepth: 10,
      seatRows: 4,
      seatsPerRow: 16,
      audienceStartZ: -3.5,
    },
  },
  {
    id: "amphitheater",
    label: "Амфитеатр",
    description: "14×12 м, 10 рядов, подъём",
    patch: {
      hallWidth: 14,
      hallDepth: 12,
      seatRows: 10,
      seatsPerRow: 12,
      rowRise: 0.45,
      rowSpacing: 0.9,
      audienceStartZ: -3.5,
    },
  },
  {
    id: "large",
    label: "Большой зал",
    description: "16×14 м, 8 рядов",
    patch: {
      hallWidth: 16,
      hallDepth: 14,
      seatRows: 8,
      seatsPerRow: 14,
      audienceStartZ: -4.5,
    },
  },
  {
    id: "lecture",
    label: "Лекторий",
    description: "16×14 м, 12 рядов",
    patch: {
      hallWidth: 16,
      hallDepth: 14,
      seatRows: 12,
      seatsPerRow: 14,
      rowSpacing: 0.7,
      audienceStartZ: -5,
    },
  },
  {
    id: "open-platform",
    label: "Открытая площадка",
    description: "20×16 м, без кресел",
    patch: {
      hallWidth: 20,
      hallDepth: 16,
      wallHeight: 3.5,
      seatRows: 0,
      seatsPerRow: 12,
      audienceStartZ: -4,
    },
  },
  {
    id: "festival",
    label: "Фестивальная",
    description: "24×18 м, 8 рядов",
    patch: {
      hallWidth: 24,
      hallDepth: 18,
      seatRows: 8,
      seatsPerRow: 20,
      rowSpacing: 0.95,
      audienceStartZ: -5,
    },
  },
  {
    id: "arena",
    label: "Арена",
    description: "22×22 м, круговой обзор",
    patch: {
      hallWidth: 22,
      hallDepth: 22,
      seatRows: 6,
      seatsPerRow: 18,
      rowSpacing: 1.1,
      audienceStartZ: -6,
    },
  },
  {
    id: "regional",
    label: "Региональный",
    description: "28×22 м, 10 рядов",
    patch: {
      hallWidth: 28,
      hallDepth: 22,
      seatRows: 10,
      seatsPerRow: 22,
      rowSpacing: 0.9,
      audienceStartZ: -6,
    },
  },
  {
    id: "philharmonic",
    label: "Филармония",
    description: "32×26 м, 12 рядов",
    patch: {
      hallWidth: 32,
      hallDepth: 26,
      seatRows: 12,
      seatsPerRow: 24,
      rowRise: 0.35,
      rowSpacing: 0.95,
      audienceStartZ: -7,
    },
  },
  {
    id: "opera-house",
    label: "Оперный",
    description: "36×28 м, 14 рядов",
    patch: {
      hallWidth: 36,
      hallDepth: 28,
      seatRows: 14,
      seatsPerRow: 26,
      rowRise: 0.4,
      rowSpacing: 0.95,
      audienceStartZ: -8,
    },
  },
  {
    id: "concert-hall",
    label: "Концертный",
    description: "40×32 м, 16 рядов",
    patch: {
      hallWidth: 40,
      hallDepth: 32,
      seatRows: 16,
      seatsPerRow: 28,
      rowRise: 0.4,
      rowSpacing: 1,
      audienceStartZ: -9,
    },
  },
  {
    id: "grand-theater",
    label: "Большой театр",
    description: "48×36 м, 18 рядов",
    patch: {
      hallWidth: 48,
      hallDepth: 36,
      seatRows: 18,
      seatsPerRow: 32,
      rowRise: 0.45,
      rowSpacing: 1,
      wallHeight: 8,
      audienceStartZ: -10,
    },
  },
  {
    id: "arena-xl",
    label: "Арена XL",
    description: "44×44 м, 10 рядов",
    patch: {
      hallWidth: 44,
      hallDepth: 44,
      seatRows: 10,
      seatsPerRow: 28,
      rowSpacing: 1.15,
      audienceStartZ: -11,
    },
  },
  {
    id: "exhibition-hall",
    label: "Выставочный",
    description: "50×40 м, без кресел",
    patch: {
      hallWidth: 50,
      hallDepth: 40,
      wallHeight: 6,
      seatRows: 0,
      seatsPerRow: 20,
      audienceStartZ: -8,
    },
  },
  {
    id: "stadium-hall",
    label: "Стадионный зал",
    description: "56×44 м, 20 рядов",
    patch: {
      hallWidth: 56,
      hallDepth: 44,
      seatRows: 20,
      seatsPerRow: 36,
      rowRise: 0.45,
      rowSpacing: 1.05,
      wallHeight: 10,
      audienceStartZ: -12,
    },
  },
  {
    id: "mega-wide",
    label: "Мегаширокая",
    description: "60×28 м, широкая сцена",
    patch: {
      hallWidth: 60,
      hallDepth: 28,
      seatRows: 12,
      seatsPerRow: 40,
      rowSpacing: 1,
      audienceStartZ: -9,
    },
  },
  {
    id: "warehouse",
    label: "Ангар",
    description: "64×48 м, пустой",
    patch: {
      hallWidth: 64,
      hallDepth: 48,
      wallHeight: 7,
      seatRows: 0,
      seatsPerRow: 24,
      audienceStartZ: -10,
    },
  },
  {
    id: "mega-deep",
    label: "Мегаглубокая",
    description: "32×52 м, глубокий зал",
    patch: {
      hallWidth: 32,
      hallDepth: 52,
      seatRows: 18,
      seatsPerRow: 16,
      rowSpacing: 1.05,
      audienceStartZ: -14,
    },
  },
  {
    id: "max-hall",
    label: "Максимальный",
    description: "72×60 м, 24 ряда",
    patch: {
      hallWidth: 72,
      hallDepth: 60,
      seatRows: 24,
      seatsPerRow: 40,
      rowRise: 0.5,
      rowSpacing: 1.1,
      wallHeight: 12,
      audienceStartZ: -16,
    },
  },
];

/** Реалистичный максимум мест в одном ряду при авто-подборе сетки. */
const AUTO_SEAT_GRID_MAX_PER_ROW = 20;

function factorizeSeatCount(targetSeats: number): { seatRows: number; seatsPerRow: number } {
  if (targetSeats <= 0) {
    return { seatRows: 0, seatsPerRow: 1 };
  }
  if (targetSeats <= AUTO_SEAT_GRID_MAX_PER_ROW) {
    const seatRows = Math.max(1, Math.round(Math.sqrt(targetSeats)));
    return {
      seatRows,
      seatsPerRow: Math.max(1, Math.ceil(targetSeats / seatRows)),
    };
  }

  let bestRows = Math.max(2, Math.round(Math.sqrt(targetSeats)));
  let bestPerRow = Math.max(1, Math.ceil(targetSeats / bestRows));
  let bestOver = bestRows * bestPerRow - targetSeats;
  let bestSpread = Math.abs(bestPerRow - bestRows);

  for (let seatRows = 1; seatRows <= 80; seatRows += 1) {
    const seatsPerRow = Math.max(1, Math.ceil(targetSeats / seatRows));
    if (seatsPerRow > AUTO_SEAT_GRID_MAX_PER_ROW) continue;

    const total = seatRows * seatsPerRow;
    const over = total - targetSeats;
    const spread = Math.abs(seatsPerRow - seatRows);

    const isBetter =
      over < bestOver ||
      (over === bestOver && spread < bestSpread) ||
      (over === bestOver && spread === bestSpread && seatRows > bestRows);

    if (isBetter) {
      bestRows = seatRows;
      bestPerRow = seatsPerRow;
      bestOver = over;
      bestSpread = spread;
    }
  }

  return { seatRows: bestRows, seatsPerRow: bestPerRow };
}

/** Примерные габариты зала и сетка кресел под целевое число мест. */
export function computeHallPatchForSeatCount(targetSeats: number): Partial<TheaterLayout> {
  if (targetSeats <= 0) {
    return {
      hallWidth: 12,
      hallDepth: 10,
      seatRows: 0,
      seatsPerRow: 8,
      rowSpacing: METRIC.rowPitch,
      audienceStartZ: -2,
    };
  }

  const { seatRows, seatsPerRow } = factorizeSeatCount(targetSeats);
  const rowSpacing = METRIC.rowPitch;
  const seatPitch = METRIC.seatPitch;

  const hallWidth = roundM(
    Math.max(
      8,
      (seatsPerRow - 1) * seatPitch + 2 * METRIC.sideClearance + METRIC.aisleWidth * 0.35,
    ),
  );
  const stageDepthEstimate = 3.5;
  const audienceDepth = seatRows > 1 ? (seatRows - 1) * rowSpacing : 0;
  const hallDepth = roundM(
    Math.max(
      8,
      METRIC.backClearance +
        stageDepthEstimate +
        audienceDepth +
        METRIC.stageClearance +
        1.2,
    ),
  );

  const draft = {
    hallWidth,
    hallDepth,
    seatRows,
    seatsPerRow,
    rowSpacing,
  } as TheaterLayout;
  const audienceStartZ = computeAudienceStartZ(draft);

  return {
    hallWidth,
    hallDepth,
    seatRows,
    seatsPerRow,
    rowSpacing,
    audienceStartZ,
    stageFrontZ: audienceStartZ,
    stageBackWidth: roundM(hallWidth * 0.9),
    prosceniumWidth: roundM(hallWidth * 0.82),
  };
}

function scaleWallRecessesForHallResize(
  layout: TheaterLayout,
  newHallWidth: number,
  newHallDepth: number,
) {
  if (!Array.isArray(layout.wallRecesses) || layout.wallRecesses.length === 0) return undefined;
  if (layout.hallWidth <= 0 || layout.hallDepth <= 0) return layout.wallRecesses;
  const scale = Math.min(newHallWidth / layout.hallWidth, newHallDepth / layout.hallDepth);
  return layout.wallRecesses.map((recess) => ({
    ...recess,
    pos: roundM(recess.pos * scale),
    width: roundM(recess.width * scale),
    depth: roundM(recess.depth * scale),
  }));
}

function applyHallResizeWithCustomOutline(
  current: TheaterLayout,
  patch: Partial<TheaterLayout>,
): TheaterLayout {
  const newHallWidth = patch.hallWidth ?? current.hallWidth;
  const newHallDepth = patch.hallDepth ?? current.hallDepth;
  const scaledRecesses = scaleWallRecessesForHallResize(current, newHallWidth, newHallDepth);

  const merged = normalizeTheaterLayout({
    ...current,
    ...patch,
    ...(scaledRecesses ? { wallRecesses: scaledRecesses } : {}),
  });

  const outline = current.stageOutline;
  if (!outline || outline.length < MIN_STAGE_OUTLINE_POINTS) {
    return merged;
  }

  const fittedOutline = fitStageOutlineToHallBounds(outline, merged);
  return normalizeTheaterLayout({
    ...merged,
    stageOutline: fittedOutline,
  });
}

function getCustomOutlineBounds(outline: [number, number][]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

function shiftWallRecessesWithOutline(
  recesses: TheaterWallRecess[],
  deltaX: number,
  deltaZ: number,
): TheaterWallRecess[] {
  return recesses.map((recess) => ({
    ...recess,
    pos:
      recess.wall === "back"
        ? roundM(recess.pos + deltaX)
        : roundM(recess.pos + deltaZ),
  }));
}

function maxSeatsPerRowForHallWidth(hallWidth: number): number {
  const usable = hallWidth - 2 * METRIC.sideClearance - METRIC.aisleWidth * 0.35;
  return Math.max(1, Math.floor(usable / METRIC.seatPitch) + 1);
}

/** Ряды × места/ряд под целевое число мест и текущую ширину зала. */
export function resolveSeatGridForHall(
  targetSeats: number,
  hallWidth: number,
): Pick<TheaterLayout, "seatRows" | "seatsPerRow" | "rowSpacing"> {
  const seats = Math.max(0, Math.trunc(targetSeats));
  if (seats <= 0) {
    return { seatRows: 0, seatsPerRow: 1, rowSpacing: METRIC.rowPitch };
  }
  const seatPatch = computeHallPatchForSeatCount(seats);
  const maxPerRow = maxSeatsPerRowForHallWidth(hallWidth);
  let seatsPerRow = Math.min(seatPatch.seatsPerRow ?? 1, maxPerRow);
  let seatRows = seatPatch.seatRows ?? 1;
  while (seatRows * seatsPerRow < seats && seatRows < 80) {
    if (seatsPerRow < maxPerRow) {
      seatsPerRow = Math.min(maxPerRow, seatsPerRow + 1);
    } else {
      seatRows += 1;
    }
  }
  return {
    seatRows,
    seatsPerRow,
    rowSpacing: seatPatch.rowSpacing ?? METRIC.rowPitch,
  };
}

/** Только сетка кресел (без смены габаритов зала и контура). */
export function applySeatCountToLayout(
  layout: TheaterLayout,
  targetSeats: number,
): TheaterLayout {
  const grid = resolveSeatGridForHall(targetSeats, layout.hallWidth);
  return normalizeTheaterLayout({ ...layout, ...grid });
}

/**
 * Серый прямоугольник зала и (опционально) кресла — по нарисованному периметру стен.
 * Контур не пережимается: задаёт габариты, при необходимости центрируется.
 */
export function applyHallLayoutFromCustomOutline(
  layout: TheaterLayout,
  options?: { targetSeats?: number },
): TheaterLayout {
  if (resolveStageShape(layout) !== "custom") {
    return normalizeTheaterLayout(layout);
  }
  const outline = layout.stageOutline;
  if (!outline || outline.length < MIN_STAGE_OUTLINE_POINTS) {
    return normalizeTheaterLayout(layout);
  }

  const bounds = getCustomOutlineBounds(outline);
  const hallWidth = roundM(Math.max(4, bounds.width));
  const hallDepth = roundM(Math.max(4, bounds.depth));
  const deltaX = -bounds.centerX;
  const deltaZ = -bounds.centerZ;

  const stageOutline = outline.map(
    ([x, z]) => [roundM(x + deltaX), roundM(z + deltaZ)] as [number, number],
  );

  const wallRecesses =
    Array.isArray(layout.wallRecesses) && layout.wallRecesses.length > 0
      ? shiftWallRecessesWithOutline(layout.wallRecesses, deltaX, deltaZ)
      : layout.wallRecesses;

  const currentSeats = (layout.seatRows ?? 0) * (layout.seatsPerRow ?? 0);
  const targetSeats =
    options?.targetSeats != null
      ? Math.max(0, Math.trunc(options.targetSeats))
      : currentSeats;

  let patch: Partial<TheaterLayout> = {
    hallWidth,
    hallDepth,
    stageOutline,
    wallRecesses,
    stageBackWidth: roundM(hallWidth * 0.9),
    prosceniumWidth: roundM(hallWidth * 0.82),
  };

  if (targetSeats > 0) {
    const grid = resolveSeatGridForHall(targetSeats, hallWidth);
    const draft = {
      ...layout,
      ...patch,
      ...grid,
    } as TheaterLayout;
    const audienceStartZ = computeAudienceStartZ(draft);
    patch = {
      ...patch,
      ...grid,
      audienceStartZ,
      stageFrontZ: audienceStartZ,
    };
  }

  return normalizeTheaterLayout({ ...layout, ...patch });
}

/** Зал + масштаб «Своего контура» под целевое число мест (форма сцены сохраняется). */
export function fitCustomLayoutToSeatCount(
  layout: TheaterLayout,
  targetSeats: number,
): TheaterLayout {
  const hallPatch = computeHallPatchForSeatCount(targetSeats);
  if (resolveStageShape(layout) === "custom") {
    return applyHallResizeWithCustomOutline(layout, hallPatch);
  }
  return normalizeTheaterLayout({ ...layout, ...hallPatch });
}

export function applyTheaterHallTemplate(
  current: TheaterLayout,
  templateId: string,
): TheaterLayout {
  const template = THEATER_HALL_TEMPLATES.find((item) => item.id === templateId);
  const base = template?.patch ?? DEFAULT_THEATER_LAYOUT;
  if (resolveStageShape(current) === "custom") {
    return applyHallResizeWithCustomOutline(current, base);
  }
  return normalizeTheaterLayout({ ...current, ...base });
}
