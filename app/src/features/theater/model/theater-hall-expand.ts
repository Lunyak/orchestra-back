import type {
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { getStageBackZ, getStageFrontZ, roundM } from "./theater-metrics";

export type HallExpandSide = "east" | "west" | "south" | "north" | "up";

export const HALL_SIZE_LIMITS = {
  hallWidth: { min: 4, max: 80 },
  hallDepth: { min: 4, max: 80 },
  wallHeight: { min: 2.5, max: 20 },
} as const;

export const STAGE_WIDTH_LIMITS = {
  min: 2,
} as const;

function resolveStageWidthField(
  value: number | undefined,
  hallWidth: number,
) {
  return value ?? hallWidth;
}

function clampStageWidth(value: number, hallWidth: number) {
  return roundM(Math.min(hallWidth, Math.max(STAGE_WIDTH_LIMITS.min, value)));
}

const STAGE_PIN_EPS = 0.05;

/** Если сужение зала ужало сцену, расширение двигает её на ту же величину. */
export function followStageWidthsWithHall(
  layout: Pick<
    TheaterLayout,
    "hallWidth" | "stageBackWidth" | "prosceniumWidth" | "stageHallFollowDebt"
  >,
  nextHallWidth: number,
): Pick<TheaterLayout, "stageBackWidth" | "prosceniumWidth" | "stageHallFollowDebt"> {
  const oldHall = layout.hallWidth;
  const delta = nextHallWidth - oldHall;
  const oldBack = resolveStageWidthField(layout.stageBackWidth, oldHall);
  const oldProsc = resolveStageWidthField(layout.prosceniumWidth, oldHall);
  let debt = Math.max(0, layout.stageHallFollowDebt ?? 0);
  const pinnedToHall =
    oldBack >= oldHall - STAGE_PIN_EPS || oldProsc >= oldHall - STAGE_PIN_EPS;

  if (delta < 0) {
    const nextBack = clampStageWidth(oldBack, nextHallWidth);
    const nextProsc = clampStageWidth(oldProsc, nextHallWidth);
    debt += Math.max(oldBack - nextBack, oldProsc - nextProsc);
    return {
      stageBackWidth: nextBack,
      prosceniumWidth: nextProsc,
      stageHallFollowDebt: roundM(debt),
    };
  }

  if (delta > 0 && (debt > 0 || pinnedToHall)) {
    return {
      stageBackWidth: clampStageWidth(oldBack + delta, nextHallWidth),
      prosceniumWidth: clampStageWidth(oldProsc + delta, nextHallWidth),
      stageHallFollowDebt: roundM(Math.max(0, debt - delta)),
    };
  }

  return {
    stageBackWidth: clampStageWidth(oldBack, nextHallWidth),
    prosceniumWidth: clampStageWidth(oldProsc, nextHallWidth),
    stageHallFollowDebt: roundM(debt),
  };
}

export function resolveStageWidth(
  layout: Pick<TheaterLayout, "hallWidth" | "stageBackWidth" | "prosceniumWidth">,
) {
  return roundM(
    resolveStageWidthField(
      layout.stageBackWidth ?? layout.prosceniumWidth,
      layout.hallWidth,
    ),
  );
}

export function applyHallWidthStageFollow(
  previous: TheaterLayout,
  incoming: TheaterLayout,
): TheaterLayout {
  if (Math.abs(incoming.hallWidth - previous.hallWidth) < 1e-6) {
    const stageChanged =
      incoming.stageBackWidth !== previous.stageBackWidth ||
      incoming.prosceniumWidth !== previous.prosceniumWidth;
    if (!stageChanged) return incoming;
    return { ...incoming, stageHallFollowDebt: 0 };
  }

  const followed = followStageWidthsWithHall(previous, incoming.hallWidth);
  const oldBack = resolveStageWidthField(previous.stageBackWidth, previous.hallWidth);
  const clampedBack = clampStageWidth(oldBack, incoming.hallWidth);
  const incomingBack = resolveStageWidthField(incoming.stageBackWidth, incoming.hallWidth);
  const incomingLooksUnfollowed =
    Math.abs(incomingBack - followed.stageBackWidth) > STAGE_PIN_EPS &&
    Math.abs(incomingBack - clampedBack) > STAGE_PIN_EPS;

  if (incomingLooksUnfollowed) {
    return { ...incoming, stageHallFollowDebt: 0 };
  }
  return { ...incoming, ...followed };
}

export type HallExpandResult = {
  patch: Partial<TheaterLayout>;
  /** Компенсация локальных координат объектов, чтобы они остались в мире при смене hallOffset. */
  objectShift: [number, number, number];
};

export function clampHallWidth(value: number) {
  return roundM(
    Math.min(HALL_SIZE_LIMITS.hallWidth.max, Math.max(HALL_SIZE_LIMITS.hallWidth.min, value)),
  );
}

export function clampHallDepth(value: number) {
  return roundM(
    Math.min(HALL_SIZE_LIMITS.hallDepth.max, Math.max(HALL_SIZE_LIMITS.hallDepth.min, value)),
  );
}

export function clampWallHeight(value: number) {
  return roundM(
    Math.min(
      HALL_SIZE_LIMITS.wallHeight.max,
      Math.max(HALL_SIZE_LIMITS.wallHeight.min, value),
    ),
  );
}

export function resolveHallOffsetX(layout: Pick<TheaterLayout, "hallOffsetX">) {
  return Number.isFinite(layout.hallOffsetX) ? roundM(layout.hallOffsetX as number) : 0;
}

export function resolveHallOffsetZ(layout: Pick<TheaterLayout, "hallOffsetZ">) {
  return Number.isFinite(layout.hallOffsetZ) ? roundM(layout.hallOffsetZ as number) : 0;
}

/**
 * Расширение только выбранной стороны.
 * Противоположная стена остаётся на месте за счёт hallOffsetX/Z.
 * objectShift компенсирует сдвиг группы, чтобы декорации/софиты не ехали вместе со стеной.
 */
export function hallExpandLayoutPatch(
  start: TheaterLayout,
  side: HallExpandSide,
  edgeDeltaMeters: number,
): HallExpandResult {
  if (!Number.isFinite(edgeDeltaMeters) || edgeDeltaMeters === 0) {
    return { patch: {}, objectShift: [0, 0, 0] };
  }

  if (side === "up") {
    return {
      patch: { wallHeight: clampWallHeight(start.wallHeight + edgeDeltaMeters) },
      objectShift: [0, 0, 0],
    };
  }

  const offsetX = resolveHallOffsetX(start);
  const offsetZ = resolveHallOffsetZ(start);

  if (side === "east" || side === "west") {
    const nextWidth = clampHallWidth(start.hallWidth + edgeDeltaMeters);
    const applied = nextWidth - start.hallWidth;
    if (applied === 0) {
      return { patch: { hallWidth: nextWidth }, objectShift: [0, 0, 0] };
    }
    const offsetDelta = side === "east" ? applied / 2 : -applied / 2;
    return {
      patch: {
        hallWidth: nextWidth,
        hallOffsetX: roundM(offsetX + offsetDelta),
      },
      objectShift: [-offsetDelta, 0, 0],
    };
  }

  const nextDepth = clampHallDepth(start.hallDepth + edgeDeltaMeters);
  const applied = nextDepth - start.hallDepth;
  if (applied === 0) {
    return { patch: { hallDepth: nextDepth }, objectShift: [0, 0, 0] };
  }
  const offsetDelta = side === "south" ? applied / 2 : -applied / 2;
  const shiftZ = -offsetDelta;
  return {
    patch: {
      hallDepth: nextDepth,
      hallOffsetZ: roundM(offsetZ + offsetDelta),
      audienceStartZ: roundM(start.audienceStartZ + shiftZ),
      stageFrontZ: roundM(getStageFrontZ(start) + shiftZ),
      stageBackZ: roundM(getStageBackZ(start) + shiftZ),
    },
    objectShift: [0, 0, shiftZ],
  };
}

export function shiftTheaterModels(
  models: TheaterModel[],
  shift: [number, number, number],
): TheaterModel[] {
  const [sx, sy, sz] = shift;
  if (sx === 0 && sy === 0 && sz === 0) return models;
  return models.map((model) => ({
    ...model,
    position: [
      roundM(model.position[0] + sx),
      roundM(model.position[1] + sy),
      roundM(model.position[2] + sz),
    ] as [number, number, number],
  }));
}

export function shiftTheaterSpotlights(
  spotlights: TheaterSpotlight[],
  shift: [number, number, number],
): TheaterSpotlight[] {
  const [sx, sy, sz] = shift;
  if (sx === 0 && sy === 0 && sz === 0) return spotlights;
  return spotlights.map((item) => ({
    ...item,
    position: [
      roundM(item.position[0] + sx),
      roundM(item.position[1] + sy),
      roundM(item.position[2] + sz),
    ] as [number, number, number],
    target: [
      roundM(item.target[0] + sx),
      roundM(item.target[1] + sy),
      roundM(item.target[2] + sz),
    ] as [number, number, number],
  }));
}

export function hallSideWorldPosition(
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth" | "wallHeight">,
  side: HallExpandSide,
): [number, number, number] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const midY = layout.wallHeight / 2;
  switch (side) {
    case "east":
      return [halfW, midY, 0];
    case "west":
      return [-halfW, midY, 0];
    case "south":
      return [0, midY, halfD];
    case "north":
      return [0, midY, -halfD];
    case "up":
      return [0, layout.wallHeight, 0];
  }
}

export function hallSideLabel(
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth" | "wallHeight">,
  side: HallExpandSide,
): string {
  if (side === "up") return String(roundM(layout.wallHeight));
  if (side === "east" || side === "west") return String(roundM(layout.hallWidth));
  return String(roundM(layout.hallDepth));
}

export function hallSideAxis(side: HallExpandSide): "x" | "y" | "z" {
  if (side === "up") return "y";
  if (side === "east" || side === "west") return "x";
  return "z";
}

/** Положительный delta = расширение наружу. */
export function hallExpandDeltaFromPointer(
  side: HallExpandSide,
  startEdge: number,
  pointerValue: number,
): number {
  if (side === "west" || side === "north") return startEdge - pointerValue;
  return pointerValue - startEdge;
}
