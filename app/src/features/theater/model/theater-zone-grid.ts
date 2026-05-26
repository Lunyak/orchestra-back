import type {
  TheaterLayout,
  TheaterZone,
  TheaterZoneGrid,
  TheaterZonePreset,
} from "../../../shared/types/script";
import { getStageFrontZ, roundM } from "./theater-metrics";
import {
  getStageSideWallX,
  resolveStageGeometry,
} from "./theater-stage-geometry";

/** Ray-casting: точка [x,z] внутри полигона */
export function isPointInZoneOutline(
  x: number,
  z: number,
  outline: [number, number][],
): boolean {
  if (outline.length < 3) return false;
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
    const [xi, zi] = outline[i];
    const [xj, zj] = outline[j];
    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export type TheaterGridCell = {
  col: number;
  row: number;
};

export type TheaterSubZoneRef = TheaterGridCell & {
  subCol: number;
  subRow: number;
};

export type TheaterZoneCellSlice = {
  zone: TheaterZone;
  outline: [number, number][];
  subCol?: number;
  subRow?: number;
};

const DEFAULT_ZONE_GRID: TheaterZoneGrid = { cols: 4, rows: 3 };

export function resolveZoneGrid(layout: TheaterLayout): TheaterZoneGrid {
  const raw = layout.zoneGrid;
  const cols = Math.max(1, Math.min(12, Math.trunc(Number(raw?.cols) || DEFAULT_ZONE_GRID.cols)));
  const rows = Math.max(1, Math.min(8, Math.trunc(Number(raw?.rows) || DEFAULT_ZONE_GRID.rows)));
  return { cols, rows };
}

export function getStageGridFrame(layout: TheaterLayout) {
  const geom = resolveStageGeometry(layout);
  const frontZ = getStageFrontZ(layout);
  const backZ = geom.backZ;
  return { geom, frontZ, backZ, depth: frontZ - backZ };
}

function clampCellIndex(value: number, max: number) {
  return Math.min(max, Math.max(0, Math.trunc(value)));
}

function xAtZ(layout: TheaterLayout, z: number, side: "left" | "right") {
  const { geom } = getStageGridFrame(layout);
  return getStageSideWallX(side, z, geom);
}

/** Четыре угла ячейки сетки (трапеция), row 0 — зад сцены */
/** Центр ячейки на полу сцены [x, y, z] */
export function getGridCellCenter(
  layout: TheaterLayout,
  col: number,
  row: number,
  targetY = 0,
): [number, number, number] {
  const outline = buildGridCellOutline(layout, col, row);
  const x = outline.reduce((sum, [px]) => sum + px, 0) / outline.length;
  const z = outline.reduce((sum, [, pz]) => sum + pz, 0) / outline.length;
  return [roundM(x), targetY, roundM(z)];
}

export function formatGridCellLabel(col: number, row: number) {
  return `${col + 1}×${row + 1}`;
}

export const resolveStageGrid = resolveZoneGrid;

export function buildGridCellOutline(
  layout: TheaterLayout,
  col: number,
  row: number,
): [number, number][] {
  const grid = resolveZoneGrid(layout);
  const { frontZ, backZ } = getStageGridFrame(layout);
  const col0 = clampCellIndex(col, grid.cols - 1);
  const row0 = clampCellIndex(row, grid.rows - 1);
  const zBack = roundM(backZ + (row0 / grid.rows) * (frontZ - backZ));
  const zFront = roundM(backZ + ((row0 + 1) / grid.rows) * (frontZ - backZ));
  const xLeftBack = xAtZ(layout, zBack, "left");
  const xRightBack = xAtZ(layout, zBack, "right");
  const xLeftFront = xAtZ(layout, zFront, "left");
  const xRightFront = xAtZ(layout, zFront, "right");
  const t0 = col0 / grid.cols;
  const t1 = (col0 + 1) / grid.cols;
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  return [
    [roundM(lerp(xLeftBack, xRightBack, t0)), zBack],
    [roundM(lerp(xLeftBack, xRightBack, t1)), zBack],
    [roundM(lerp(xLeftFront, xRightFront, t1)), zFront],
    [roundM(lerp(xLeftFront, xRightFront, t0)), zFront],
  ];
}

export function zoneOutlineFromBand(
  layout: TheaterLayout,
  zone: Pick<TheaterZone, "col0" | "col1" | "row0" | "row1">,
): [number, number][] {
  const grid = resolveZoneGrid(layout);
  const col0 = clampCellIndex(zone.col0, grid.cols - 1);
  const col1 = clampCellIndex(zone.col1, grid.cols - 1);
  const row0 = clampCellIndex(zone.row0, grid.rows - 1);
  const row1 = clampCellIndex(zone.row1, grid.rows - 1);
  const cMin = Math.min(col0, col1);
  const cMax = Math.max(col0, col1);
  const rMin = Math.min(row0, row1);
  const rMax = Math.max(row0, row1);
  const back = buildGridCellOutline(layout, cMin, rMin);
  const front = buildGridCellOutline(layout, cMax, rMax);
  return [
    back[0],
    back[1],
    front[2],
    front[3],
  ];
}

export function resolveZoneWithOutline(
  layout: TheaterLayout,
  zone: TheaterZone,
): TheaterZone {
  return {
    ...zone,
    outline: zoneOutlineFromBand(layout, zone),
  };
}

export function buildZoneSubCells(
  layout: TheaterLayout,
  zone: TheaterZone,
): TheaterZoneCellSlice[] {
  const subCols = Math.max(1, Math.min(6, Math.trunc(zone.subCols ?? 1)));
  const subRows = Math.max(1, Math.min(6, Math.trunc(zone.subRows ?? 1)));
  const grid = resolveZoneGrid(layout);
  const col0 = clampCellIndex(zone.col0, grid.cols - 1);
  const col1 = clampCellIndex(zone.col1, grid.cols - 1);
  const row0 = clampCellIndex(zone.row0, grid.rows - 1);
  const row1 = clampCellIndex(zone.row1, grid.rows - 1);
  const slices: TheaterZoneCellSlice[] = [];

  for (let row = row0; row <= row1; row += 1) {
    for (let col = col0; col <= col1; col += 1) {
      const cellOutline = buildGridCellOutline(layout, col, row);
      if (subCols === 1 && subRows === 1) {
        slices.push({ zone, outline: cellOutline });
        continue;
      }
      for (let subRow = 0; subRow < subRows; subRow += 1) {
        for (let subCol = 0; subCol < subCols; subCol += 1) {
          slices.push({
            zone,
            subCol,
            subRow,
            outline: subdivideCellOutline(cellOutline, subCol, subCols, subRow, subRows),
          });
        }
      }
    }
  }
  return slices;
}

function subdivideCellOutline(
  outline: [number, number][],
  subCol: number,
  subCols: number,
  subRow: number,
  subRows: number,
): [number, number][] {
  if (outline.length < 4) return outline;
  const [[x00, z00], [x10, z10], [x11, z11], [x01, z01]] = outline;
  const u0 = subCol / subCols;
  const u1 = (subCol + 1) / subCols;
  const v0 = subRow / subRows;
  const v1 = (subRow + 1) / subRows;
  const lerp2 = (a: number, b: number, t: number) => a + (b - a) * t;
  const corner = (u: number, v: number): [number, number] => {
    const xBack = lerp2(x00, x10, u);
    const xFront = lerp2(x01, x11, u);
    const zLeft = lerp2(z00, z01, v);
    const zRight = lerp2(z10, z11, v);
    const x = lerp2(xBack, xFront, v);
    const z = lerp2(zLeft, zRight, v);
    return [roundM(x), roundM(z)];
  };
  return [corner(u0, v0), corner(u1, v0), corner(u1, v1), corner(u0, v1)];
}

export function pointToGridCell(
  layout: TheaterLayout,
  x: number,
  z: number,
): TheaterGridCell | null {
  const grid = resolveZoneGrid(layout);
  const { frontZ, backZ } = getStageGridFrame(layout);
  if (z < backZ - 0.05 || z > frontZ + 0.05) return null;
  const rowF = ((z - backZ) / (frontZ - backZ)) * grid.rows;
  const row = clampCellIndex(Math.floor(rowF), grid.rows - 1);
  const xLeft = xAtZ(layout, z, "left");
  const xRight = xAtZ(layout, z, "right");
  if (x < Math.min(xLeft, xRight) - 0.05 || x > Math.max(xLeft, xRight) + 0.05) {
    return null;
  }
  const colF = ((x - xLeft) / (xRight - xLeft + 1e-9)) * grid.cols;
  const col = clampCellIndex(Math.floor(colF), grid.cols - 1);
  return { col, row };
}

export function findZoneAtCell(
  layout: TheaterLayout,
  zones: TheaterZone[],
  col: number,
  row: number,
): TheaterZone | null {
  for (let i = zones.length - 1; i >= 0; i -= 1) {
    const zone = zones[i];
    if (zone.hidden) continue;
    const c0 = Math.min(zone.col0, zone.col1);
    const c1 = Math.max(zone.col0, zone.col1);
    const r0 = Math.min(zone.row0, zone.row1);
    const r1 = Math.max(zone.row0, zone.row1);
    if (col >= c0 && col <= c1 && row >= r0 && row <= r1) return zone;
  }
  return null;
}

export function findSubZoneAtPoint(
  layout: TheaterLayout,
  zone: TheaterZone,
  x: number,
  z: number,
): TheaterSubZoneRef | null {
  const cell = pointToGridCell(layout, x, z);
  if (!cell) return null;
  const slices = buildZoneSubCells(layout, zone);
  const hit = slices.find((slice) => isPointInZoneOutline(x, z, slice.outline));
  if (!hit) return null;
  return {
    col: cell.col,
    row: cell.row,
    subCol: hit.subCol ?? 0,
    subRow: hit.subRow ?? 0,
  };
}

export function buildStageGridLinePositions(layout: TheaterLayout): Float32Array {
  const grid = resolveZoneGrid(layout);
  const { frontZ, backZ } = getStageGridFrame(layout);
  const y = 0.012;
  const positions: number[] = [];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  for (let ci = 0; ci <= grid.cols; ci += 1) {
    const u = ci / grid.cols;
    const xBack = lerp(xAtZ(layout, backZ, "left"), xAtZ(layout, backZ, "right"), u);
    const xFront = lerp(xAtZ(layout, frontZ, "left"), xAtZ(layout, frontZ, "right"), u);
    positions.push(xBack, y, backZ, xFront, y, frontZ);
  }

  for (let ri = 0; ri <= grid.rows; ri += 1) {
    const z = roundM(backZ + (ri / grid.rows) * (frontZ - backZ));
    positions.push(xAtZ(layout, z, "left"), y, z, xAtZ(layout, z, "right"), y, z);
  }

  return new Float32Array(positions);
}

export function buildStageGridPlanSegments(
  layout: TheaterLayout,
): Array<{ x1: number; z1: number; x2: number; z2: number }> {
  const grid = resolveZoneGrid(layout);
  const { frontZ, backZ } = getStageGridFrame(layout);
  const segments: Array<{ x1: number; z1: number; x2: number; z2: number }> = [];
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  for (let ci = 0; ci <= grid.cols; ci += 1) {
    const u = ci / grid.cols;
    const xBack = lerp(xAtZ(layout, backZ, "left"), xAtZ(layout, backZ, "right"), u);
    const xFront = lerp(xAtZ(layout, frontZ, "left"), xAtZ(layout, frontZ, "right"), u);
    segments.push({ x1: xBack, z1: backZ, x2: xFront, z2: frontZ });
  }

  for (let ri = 0; ri <= grid.rows; ri += 1) {
    const z = roundM(backZ + (ri / grid.rows) * (frontZ - backZ));
    segments.push({
      x1: xAtZ(layout, z, "left"),
      z1: z,
      x2: xAtZ(layout, z, "right"),
      z2: z,
    });
  }

  return segments;
}

export function normalizeTheaterStageGridFields(
  layout: TheaterLayout,
): Pick<TheaterLayout, "zoneGrid"> {
  return { zoneGrid: resolveZoneGrid(layout) };
}

export function patchLayoutZoneGrid(
  layout: TheaterLayout,
  patch: Partial<TheaterZoneGrid>,
): Pick<TheaterLayout, "zoneGrid"> {
  return {
    zoneGrid: resolveZoneGrid({
      ...layout,
      zoneGrid: { ...resolveZoneGrid(layout), ...patch },
    }),
  };
}

export function inferBandFromOutline(
  layout: TheaterLayout,
  outline: [number, number][],
): Pick<TheaterZone, "col0" | "col1" | "row0" | "row1"> {
  const grid = resolveZoneGrid(layout);
  let col0 = grid.cols - 1;
  let col1 = 0;
  let row0 = grid.rows - 1;
  let row1 = 0;
  for (const [x, z] of outline) {
    const cell = pointToGridCell(layout, x, z);
    if (!cell) continue;
    col0 = Math.min(col0, cell.col);
    col1 = Math.max(col1, cell.col);
    row0 = Math.min(row0, cell.row);
    row1 = Math.max(row1, cell.row);
  }
  if (col1 < col0) {
    return { col0: 0, col1: grid.cols - 1, row0: 0, row1: grid.rows - 1 };
  }
  return { col0, col1, row0, row1 };
}

export function buildPresetBand(
  layout: TheaterLayout,
  preset: Exclude<TheaterZonePreset, "custom">,
): Pick<TheaterZone, "col0" | "col1" | "row0" | "row1"> {
  const grid = resolveZoneGrid(layout);
  const lastRow = grid.rows - 1;
  const lastCol = grid.cols - 1;
  if (preset === "avanscena") {
    return { col0: 0, col1: lastCol, row0: lastRow, row1: lastRow };
  }
  if (preset === "center") {
    const mid = Math.floor(grid.rows / 2);
    return { col0: 0, col1: lastCol, row0: mid, row1: mid };
  }
  return { col0: 0, col1: lastCol, row0: 0, row1: Math.max(0, Math.floor(grid.rows / 2) - 1) };
}
