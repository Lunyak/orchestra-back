import type { TheaterLayout } from "../../../shared/types/script";
import { snapTheaterHallX, snapTheaterHallZ } from "./theater-hall-grid";

export type DecorGridSpec = {
  cols: number;
  rows: number;
  spacingX: number;
  spacingZ: number;
  snapEnabled: boolean;
};

export function normalizeDecorGridSpec(spec: Partial<DecorGridSpec>): DecorGridSpec {
  return {
    cols: Math.max(1, Math.min(20, Math.trunc(spec.cols ?? 1))),
    rows: Math.max(1, Math.min(20, Math.trunc(spec.rows ?? 1))),
    spacingX: Math.max(0.1, spec.spacingX ?? 0.5),
    spacingZ: Math.max(0.1, spec.spacingZ ?? 0.5),
    snapEnabled: spec.snapEnabled ?? true,
  };
}

export function buildDecorGridPositions(
  origin: [number, number, number],
  spec: DecorGridSpec,
  hall?: Pick<TheaterLayout, "hallWidth" | "hallDepth">,
): [number, number, number][] {
  const grid = normalizeDecorGridSpec(spec);
  const spanX = (grid.cols - 1) * grid.spacingX;
  const spanZ = (grid.rows - 1) * grid.spacingZ;
  const startX = origin[0] - spanX / 2;
  const startZ = origin[2] - spanZ / 2;
  const positions: [number, number, number][] = [];

  for (let row = 0; row < grid.rows; row += 1) {
    for (let col = 0; col < grid.cols; col += 1) {
      let x = startX + col * grid.spacingX;
      let z = startZ + row * grid.spacingZ;
      if (grid.snapEnabled) {
        if (hall) {
          x = snapTheaterHallX(x, grid.spacingX, hall.hallWidth);
          z = snapTheaterHallZ(z, grid.spacingZ, hall.hallDepth);
        }
      }
      positions.push([x, origin[1], z]);
    }
  }

  return positions;
}

export function decorGridItemCount(spec: Partial<DecorGridSpec>): number {
  const grid = normalizeDecorGridSpec(spec);
  return grid.cols * grid.rows;
}
