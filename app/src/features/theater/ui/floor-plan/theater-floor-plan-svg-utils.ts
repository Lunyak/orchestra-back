import type { TheaterLayout } from "../../../../shared/types/script";
import {
  createFloorPlanViewport,
  worldLengthToPlanPx,
  worldToPlanPoint,
  type FloorPlanFootprint,
} from "../../model/theater-floor-plan-geometry";

export function doorRectGeometry(overlay: {
  cx: number;
  cy: number;
  halfLenPx: number;
  thicknessPx: number;
  horizontal: boolean;
}) {
  if (overlay.horizontal) {
    return {
      x: overlay.cx - overlay.halfLenPx,
      y: overlay.cy - overlay.thicknessPx / 2,
      width: overlay.halfLenPx * 2,
      height: overlay.thicknessPx,
    };
  }
  return {
    x: overlay.cx - overlay.thicknessPx / 2,
    y: overlay.cy - overlay.halfLenPx,
    width: overlay.thicknessPx,
    height: overlay.halfLenPx * 2,
  };
}

export function doorHandlePoints(overlay: {
  cx: number;
  cy: number;
  halfLenPx: number;
  horizontal: boolean;
}) {
  if (overlay.horizontal) {
    return [
      { cx: overlay.cx - overlay.halfLenPx, cy: overlay.cy, part: "width-start" as const },
      { cx: overlay.cx + overlay.halfLenPx, cy: overlay.cy, part: "width-end" as const },
    ];
  }
  return [
    { cx: overlay.cx, cy: overlay.cy - overlay.halfLenPx, part: "width-start" as const },
    { cx: overlay.cx, cy: overlay.cy + overlay.halfLenPx, part: "width-end" as const },
  ];
}

export function footprintToRect(
  item: FloorPlanFootprint,
  layout: TheaterLayout,
  viewport: ReturnType<typeof createFloorPlanViewport>,
) {
  const [sx, sy] = worldToPlanPoint(item.cx, item.cz, layout, viewport);
  const w = Math.max(4, worldLengthToPlanPx(item.halfW * 2, layout, viewport));
  const h = Math.max(4, worldLengthToPlanPx(item.halfD * 2, layout, viewport));
  const deg = -(item.rotationY * 180) / Math.PI;
  return { sx, sy, w, h, deg };
}
