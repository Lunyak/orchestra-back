import type { TheaterModel } from "../../../shared/types/script";

export type SeatableBuiltin = "chair" | "bench" | "sofa";

export type FurnitureSeatMetrics = {
  width: number;
  seatHeight: number;
  seatThickness: number;
  depth: number;
  seatOffsetZ: number;
  facingOffset: number;
};

export const CHAIR_METRICS = {
  width: 0.5,
  depth: 0.52,
  seatHeight: 0.45,
  seatThickness: 0.08,
  backHeight: 0.66,
  backThickness: 0.08,
  backZ: -0.22,
  legThickness: 0.06,
} as const;

export const BENCH_METRICS = {
  width: 1.4,
  depth: 0.38,
  seatHeight: 0.45,
  seatThickness: 0.08,
  legThickness: 0.06,
} as const;

export const SOFA_METRICS = {
  width: 1.8,
  depth: 0.82,
  seatHeight: 0.43,
  seatThickness: 0.12,
  backHeight: 0.68,
  backThickness: 0.12,
  backZ: -0.35,
  armWidth: 0.12,
  armHeight: 0.62,
} as const;

export function isHumanTheaterBuiltin(
  builtin: TheaterModel["builtin"] | undefined,
): boolean {
  return (
    builtin === "humanStanding" ||
    builtin === "humanSitting" ||
    builtin === "humanSmoothStanding" ||
    builtin === "humanSmoothSitting"
  );
}

export function toSittingHumanBuiltin(
  builtin: TheaterModel["builtin"] | undefined,
): TheaterModel["builtin"] | undefined {
  if (builtin === "humanStanding") return "humanSitting";
  if (builtin === "humanSmoothStanding") return "humanSmoothSitting";
  return builtin;
}

export function isSeatableBuiltin(
  builtin: TheaterModel["builtin"] | undefined,
): builtin is SeatableBuiltin {
  return builtin === "chair" || builtin === "bench" || builtin === "sofa";
}

export function getFurnitureSeatMetrics(
  builtin: SeatableBuiltin,
): FurnitureSeatMetrics {
  if (builtin === "bench") {
    return {
      width: BENCH_METRICS.width,
      seatHeight: BENCH_METRICS.seatHeight,
      seatThickness: BENCH_METRICS.seatThickness,
      depth: BENCH_METRICS.depth,
      seatOffsetZ: 0.44,
      facingOffset: 0,
    };
  }

  if (builtin === "sofa") {
    return {
      width: SOFA_METRICS.width,
      seatHeight: SOFA_METRICS.seatHeight,
      seatThickness: SOFA_METRICS.seatThickness,
      depth: SOFA_METRICS.depth,
      seatOffsetZ: 0.5,
      facingOffset: 0,
    };
  }

  return {
    width: CHAIR_METRICS.width,
    seatHeight: CHAIR_METRICS.seatHeight,
    seatThickness: CHAIR_METRICS.seatThickness,
    depth: CHAIR_METRICS.depth,
    seatOffsetZ: 0.44,
    facingOffset: 0,
  };
}

export function getFurnitureBounds(
  builtin: NonNullable<TheaterModel["builtin"]>,
): [number, number, number] {
  switch (builtin) {
    case "sofa":
      return [
        SOFA_METRICS.width,
        SOFA_METRICS.seatHeight + SOFA_METRICS.backHeight,
        SOFA_METRICS.depth,
      ];
    case "bench":
      return [
        BENCH_METRICS.width,
        BENCH_METRICS.seatHeight,
        BENCH_METRICS.depth,
      ];
    case "chair":
      return [
        CHAIR_METRICS.width,
        CHAIR_METRICS.seatHeight + CHAIR_METRICS.backHeight,
        CHAIR_METRICS.depth,
      ];
    case "blackCube":
      return [1, 1, 1];
    default:
      return [0.5, 0.5, 0.5];
  }
}

export function getFurnitureBoundsYOffset(
  builtin: NonNullable<TheaterModel["builtin"]>,
): number {
  const [, height] = getFurnitureBounds(builtin);
  return height / 2;
}
