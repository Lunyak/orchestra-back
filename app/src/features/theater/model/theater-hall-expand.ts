import type {
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { roundM } from "./theater-metrics";

export type HallExpandSide = "east" | "west" | "south" | "north" | "up";

export const HALL_SIZE_LIMITS = {
  hallWidth: { min: 4, max: 80 },
  hallDepth: { min: 4, max: 80 },
  wallHeight: { min: 2.5, max: 20 },
} as const;

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
  return {
    patch: {
      hallDepth: nextDepth,
      hallOffsetZ: roundM(offsetZ + offsetDelta),
    },
    objectShift: [0, 0, -offsetDelta],
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
  if (side === "up") return `${roundM(layout.wallHeight)} м`;
  if (side === "east" || side === "west") return `${roundM(layout.hallWidth)} м`;
  return `${roundM(layout.hallDepth)} м`;
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
