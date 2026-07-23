import type { TheaterLayout } from "../../../shared/types/script";
import {
  getStageFrontZ,
  getStageFrontZBounds,
  roundM,
} from "./theater-metrics";
import { getStageSideWallX, resolveStageGeometry } from "./theater-stage-geometry";
import { getStageGridFrame, resolveZoneGrid } from "./theater-zone-grid";

export type StageGridHandleSide = "east" | "west" | "front" | "back";

const MIN_STAGE_DEPTH_M = 0.5;
const MIN_STAGE_WIDTH_M = 2;

export type StageGridFrameBounds = {
  left: number;
  right: number;
  backZ: number;
  frontZ: number;
  midX: number;
  midZ: number;
  width: number;
  depth: number;
  midY: number;
};

export function getStageGridHandleBounds(layout: TheaterLayout): StageGridFrameBounds {
  const { frontZ, backZ, depth } = getStageGridFrame(layout);
  const geom = resolveStageGeometry(layout);
  const midZ = (frontZ + backZ) / 2;
  const left = getStageSideWallX("left", midZ, geom);
  const right = getStageSideWallX("right", midZ, geom);
  const width = Math.max(0.5, right - left);
  return {
    left,
    right,
    backZ,
    frontZ,
    midX: (left + right) / 2,
    midZ,
    width,
    depth: Math.max(0.5, depth),
    midY: 0.08,
  };
}

export function stageGridSideWorldPosition(
  bounds: StageGridFrameBounds,
  side: StageGridHandleSide,
): [number, number, number] {
  switch (side) {
    case "east":
      return [bounds.right, bounds.midY, bounds.midZ];
    case "west":
      return [bounds.left, bounds.midY, bounds.midZ];
    case "front":
      return [bounds.midX, bounds.midY, bounds.frontZ];
    case "back":
      return [bounds.midX, bounds.midY, bounds.backZ];
  }
}

function clampStageWidth(value: number, hallWidth: number) {
  return roundM(Math.min(hallWidth, Math.max(MIN_STAGE_WIDTH_M, value)));
}

function resolveStageWidth(layout: TheaterLayout) {
  return layout.stageBackWidth ?? layout.prosceniumWidth ?? layout.hallWidth;
}

/**
 * Растягивание контура сцены (не числа ячеек).
 * front — к залу; east/west — ширина; back — глубина через front при фиксированной задней стене.
 */
export function stageGridExpandPatch(
  start: TheaterLayout,
  side: StageGridHandleSide,
  edgeDeltaMeters: number,
): Partial<TheaterLayout> {
  if (!Number.isFinite(edgeDeltaMeters) || edgeDeltaMeters === 0) return {};

  if (side === "east" || side === "west") {
    const startWidth = resolveStageWidth(start);
    const nextWidth = clampStageWidth(startWidth + edgeDeltaMeters, start.hallWidth);
    if (nextWidth === roundM(startWidth)) return {};
    return {
      stageBackWidth: nextWidth,
      prosceniumWidth: nextWidth,
    };
  }

  const startFront = getStageFrontZ(start);
  const geom = resolveStageGeometry(start);
  const frontBounds = getStageFrontZBounds(start);
  const minFront = Math.max(frontBounds.min, geom.backZ + MIN_STAGE_DEPTH_M);
  const maxFront = frontBounds.max;

  // back: задняя стена зала фиксирована — глубину меняем тем же сдвигом переднего края
  // (delta для back уже инвертирован в stageGridExpandDeltaFromPointer).
  const nextFront = roundM(
    Math.min(maxFront, Math.max(minFront, startFront + edgeDeltaMeters)),
  );
  if (nextFront === roundM(startFront)) return {};
  return { stageFrontZ: nextFront };
}

export function stageGridLabel(layout: TheaterLayout) {
  const bounds = getStageGridHandleBounds(layout);
  const grid = resolveZoneGrid(layout);
  return `${bounds.width.toFixed(1)}×${bounds.depth.toFixed(1)} м · ${grid.cols}×${grid.rows}`;
}

export function stageGridSideAxis(side: StageGridHandleSide): "x" | "z" {
  return side === "east" || side === "west" ? "x" : "z";
}

export function stageGridExpandDeltaFromPointer(
  side: StageGridHandleSide,
  startEdge: number,
  pointerValue: number,
): number {
  if (side === "west" || side === "back") return startEdge - pointerValue;
  return pointerValue - startEdge;
}

export function roundStageGridEdge(value: number) {
  return roundM(value);
}
