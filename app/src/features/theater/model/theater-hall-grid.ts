import type { TheaterLayout } from "../../../shared/types/script";

/** Привязка к origin: origin, origin+step, origin+2*step, … */
export function snapTheaterCoord(
  value: number,
  step: number,
  origin = 0,
): number {
  if (step <= 0) return value;
  return origin + Math.round((value - origin) / step) * step;
}

/** Линии сетки от стены до стены: -half, -half+step, …, +half */
export function buildHallAxisGridLines(halfExtent: number, step: number): number[] {
  const safeStep = Math.max(step, 0.05);
  const min = -halfExtent;
  const max = halfExtent;
  const lines: number[] = [min];

  let value = min + safeStep;
  while (value < max - 1e-6) {
    lines.push(value);
    value += safeStep;
  }

  if (Math.abs(lines[lines.length - 1] - max) > 1e-6) {
    lines.push(max);
  }

  return lines;
}

export function snapTheaterHallX(
  x: number,
  step: number,
  hallWidth: number,
  enabled = true,
): number {
  if (!enabled || step <= 0) return x;
  return snapTheaterCoord(x, step, -hallWidth / 2);
}

export function snapTheaterHallZ(
  z: number,
  step: number,
  hallDepth: number,
  enabled = true,
): number {
  if (!enabled || step <= 0) return z;
  return snapTheaterCoord(z, step, -hallDepth / 2);
}

export function snapTheaterHallPoint(
  x: number,
  z: number,
  hallWidth: number,
  hallDepth: number,
  step: number,
  enabled = true,
): [number, number] {
  return [
    snapTheaterHallX(x, step, hallWidth, enabled),
    snapTheaterHallZ(z, step, hallDepth, enabled),
  ];
}

export function snapTheaterHallPoint3(
  position: [number, number, number],
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth">,
  step: number,
  enabled = true,
): [number, number, number] {
  const [x, z] = snapTheaterHallPoint(
    position[0],
    position[2],
    layout.hallWidth,
    layout.hallDepth,
    step,
    enabled,
  );
  return [x, position[1], z];
}
