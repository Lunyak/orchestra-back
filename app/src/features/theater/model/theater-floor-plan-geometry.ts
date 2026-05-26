import type {
  TheaterDoor,
  TheaterDoorWall,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
  TheaterZone,
} from "../../../shared/types/script";
import { zoneOutlineFromBand } from "./theater-zone-grid";
import { resolveLayoutZones } from "./theater-zones";
import { resolveLayoutDoors } from "./theater-doors";
import { getChairMetrics } from "./theater-metrics";
import { resolveSpotlightWashLineZ } from "./spotlight-batch-layout";
import {
  isParametricDecorBuiltin,
  isTheaterDecorModel,
  resolveDecorSize,
} from "./theater-decor-catalog";
import {
  buildHallAxisGridLines,
  snapTheaterHallPoint,
} from "./theater-hall-grid";
import {
  buildStageOutline,
  getStageSideWallX,
  resolveStageGeometry,
  resolveStageShape,
  resolveStageWallChains,
} from "./theater-stage-geometry";
import { resolveLayoutWallRecesses } from "./theater-wall-recesses";

export type FloorPlanViewport = {
  padding: number;
  width: number;
  height: number;
};

export type FloorPlanFootprint = {
  id: number;
  label: string;
  kind: "decor" | "model" | "builtin";
  cx: number;
  cz: number;
  halfW: number;
  halfD: number;
  rotationY: number;
  color?: string;
  outOfBounds?: boolean;
};

export function createFloorPlanViewport(
  width: number,
  height: number,
  padding = 12,
): FloorPlanViewport {
  return { padding, width, height };
}

export type FloorPlanHallLayout = {
  /** Единый масштаб: пикселей на метр по обеим осям */
  scale: number;
  drawW: number;
  drawH: number;
  offsetX: number;
  offsetY: number;
};

export function getFloorPlanHallLayout(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): FloorPlanHallLayout {
  const innerW = viewport.width - viewport.padding * 2;
  const innerH = viewport.height - viewport.padding * 2;
  const scale = Math.min(innerW / layout.hallWidth, innerH / layout.hallDepth);
  const drawW = layout.hallWidth * scale;
  const drawH = layout.hallDepth * scale;
  const offsetX = viewport.padding + (innerW - drawW) / 2;
  const offsetY = viewport.padding + (innerH - drawH) / 2;
  return { scale, drawW, drawH, offsetX, offsetY };
}

export function worldToPlanPoint(
  x: number,
  z: number,
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): [number, number] {
  const hall = getFloorPlanHallLayout(layout, viewport);
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const svgX = hall.offsetX + ((x + halfW) / layout.hallWidth) * hall.drawW;
  const svgY = hall.offsetY + ((z + halfD) / layout.hallDepth) * hall.drawH;
  return [svgX, svgY];
}

export function planPointToWorld(
  svgX: number,
  svgY: number,
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
  options?: { unbounded?: boolean },
): [number, number] {
  const hall = getFloorPlanHallLayout(layout, viewport);
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const x =
    ((svgX - hall.offsetX) / hall.drawW) * layout.hallWidth - halfW;
  const z =
    ((svgY - hall.offsetY) / hall.drawH) * layout.hallDepth - halfD;
  if (options?.unbounded) return [x, z];
  return clampPlanWorldPoint(x, z, layout);
}

export function clampPlanWorldPoint(
  x: number,
  z: number,
  layout: TheaterLayout,
): [number, number] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  return [
    Math.min(halfW, Math.max(-halfW, x)),
    Math.min(halfD, Math.max(-halfD, z)),
  ];
}

export function worldLengthToPlanPx(
  meters: number,
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): number {
  return meters * getFloorPlanHallLayout(layout, viewport).scale;
}

export type FloorPlanGridLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  major: boolean;
};

export function buildFloorPlanGridLines(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
  step: number,
): FloorPlanGridLine[] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const lines: FloorPlanGridLine[] = [];

  for (const x of buildHallAxisGridLines(halfW, step)) {
    const [x1, y1] = worldToPlanPoint(x, -halfD, layout, viewport);
    const [, y2] = worldToPlanPoint(x, halfD, layout, viewport);
    lines.push({
      x1,
      y1,
      x2: x1,
      y2: y2,
      major: Math.abs(x + halfW) < 1e-6 || Math.abs(x - halfW) < 1e-6,
    });
  }

  for (const z of buildHallAxisGridLines(halfD, step)) {
    const [x1, y1] = worldToPlanPoint(-halfW, z, layout, viewport);
    const [x2] = worldToPlanPoint(halfW, z, layout, viewport);
    lines.push({
      x1,
      y1,
      x2,
      y2: y1,
      major: Math.abs(z + halfD) < 1e-6 || Math.abs(z - halfD) < 1e-6,
    });
  }

  return lines;
}

export function buildSpotlightWashPlanLine(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const z = resolveSpotlightWashLineZ(layout);
  if (z == null) return null;
  const halfW = layout.hallWidth / 2;
  const [x1, y1] = worldToPlanPoint(-halfW, z, layout, viewport);
  const [x2, y2] = worldToPlanPoint(halfW, z, layout, viewport);
  return { x1, y1, x2, y2 };
}

export function buildAudienceBoundaryPlanLine(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): { x1: number; y1: number; x2: number; y2: number } {
  const geom = resolveStageGeometry(layout);
  const z = layout.audienceStartZ;
  const spanHalf =
    geom.stageShape === "t-shape" || (geom.stageShape === "trapezoid" && geom.prosceniumEnabled)
      ? geom.prosceniumWidth / 2
      : geom.stageBackWidth / 2;
  const [x1, y1] = worldToPlanPoint(-spanHalf, z, layout, viewport);
  const [x2, y2] = worldToPlanPoint(spanHalf, z, layout, viewport);
  return { x1, y1, x2, y2 };
}

export function buildZonePlanPath(
  zone: TheaterZone,
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): string {
  const outline =
    zone.outline && zone.outline.length >= 3
      ? zone.outline
      : zoneOutlineFromBand(layout, zone);
  if (outline.length < 3) return "";
  const planPoints = outline.map(([x, z]) =>
    worldToPlanPoint(x, z, layout, viewport),
  );
  const [firstX, firstY] = planPoints[0];
  const rest = planPoints.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ");
  return `M ${firstX} ${firstY} ${rest} Z`;
}

export function buildStageZonesPlanPaths(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
  options?: { activeZoneId?: number; hidden?: boolean },
): Array<{ zone: TheaterZone; path: string; active: boolean }> {
  return resolveLayoutZones(layout)
    .filter((zone) => (options?.hidden ? true : !zone.hidden))
    .map((zone) => ({
      zone,
      path: buildZonePlanPath(zone, layout, viewport),
      active: zone.id === options?.activeZoneId,
    }))
    .filter((item) => item.path.length > 0);
}

export function buildStageOutlinePlanPath(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): string {
  const points = buildStageOutline(layout);
  if (points.length < 3) return "";
  const planPoints = points.map((point) =>
    worldToPlanPoint(point.x, point.z, layout, viewport),
  );
  const [firstX, firstY] = planPoints[0];
  const rest = planPoints.slice(1).map(([x, y]) => `L ${x} ${y}`).join(" ");
  return `M ${firstX} ${firstY} ${rest} Z`;
}

export type FloorPlanRecessOverlay = {
  id: number;
  wall: "left" | "right" | "back";
  cx: number;
  cy: number;
  halfLenPx: number;
  thicknessPx: number;
  horizontal: boolean;
};

function buildWallChainPlanSegments(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
  chain: ReturnType<typeof resolveStageWallChains>[number],
): FloorPlanWallLine[] {
  const segments: FloorPlanWallLine[] = [];
  for (let i = 0; i < chain.points.length - 1; i += 1) {
    const a = chain.points[i];
    const b = chain.points[i + 1];
    const [x1, y1] = worldToPlanPoint(a.x, a.z, layout, viewport);
    const [x2, y2] = worldToPlanPoint(b.x, b.z, layout, viewport);
    segments.push({ x1, y1, x2, y2 });
  }
  return segments;
}

function buildRecessOverlays(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): FloorPlanRecessOverlay[] {
  const geom = resolveStageGeometry(layout);
  const thicknessPx = Math.max(10, worldLengthToPlanPx(0.35, layout, viewport));
  return resolveLayoutWallRecesses(layout).map((recess) => {
    if (recess.wall === "back") {
      const [cx, cy] = worldToPlanPoint(recess.pos, geom.backZ, layout, viewport);
      return {
        id: recess.id,
        wall: recess.wall,
        cx,
        cy,
        halfLenPx: Math.max(6, worldLengthToPlanPx(recess.width / 2, layout, viewport)),
        thicknessPx,
        horizontal: true,
      };
    }
    const x = getStageSideWallX(recess.wall, recess.pos, geom);
    const [cx, cy] = worldToPlanPoint(x, recess.pos, layout, viewport);
    return {
      id: recess.id,
      wall: recess.wall,
      cx,
      cy,
      halfLenPx: Math.max(6, worldLengthToPlanPx(recess.width / 2, layout, viewport)),
      thicknessPx,
      horizontal: false,
    };
  });
}

export function snapPlanWorldCoords(
  x: number,
  z: number,
  layout: TheaterLayout,
  snapEnabled: boolean,
  snapStep: number,
): [number, number] {
  return snapTheaterHallPoint(
    x,
    z,
    layout.hallWidth,
    layout.hallDepth,
    snapStep,
    snapEnabled,
  );
}

export function enumerateSeatPositions(layout: TheaterLayout): [number, number][] {
  const positions: [number, number][] = [];
  const offset = (layout.seatsPerRow - 1) * layout.seatSpacing * 0.5;
  const aisleLeft = layout.aisleCenterX - layout.aisleWidth / 2;
  const aisleRight = layout.aisleCenterX + layout.aisleWidth / 2;

  for (let row = 0; row < layout.seatRows; row += 1) {
    const z = layout.audienceStartZ + row * layout.rowSpacing;
    for (let index = 0; index < layout.seatsPerRow; index += 1) {
      const x = index * layout.seatSpacing - offset;
      if (x >= aisleLeft && x <= aisleRight) continue;
      positions.push([x, z]);
    }
  }
  return positions;
}

function resolveModelFootprint(model: TheaterModel): {
  halfW: number;
  halfD: number;
} {
  if (isParametricDecorBuiltin(model.builtin)) {
    const [width, , depth] = resolveDecorSize(model);
    return { halfW: width / 2, halfD: depth / 2 };
  }
  if (model.builtin === "chair" || model.builtin === "bench") {
    const chair = getChairMetrics(0.55);
    return {
      halfW: (chair.width / 2) * model.scale[0],
      halfD: (chair.depth / 2) * model.scale[2],
    };
  }
  const scaleW = 0.5 * model.scale[0];
  const scaleD = 0.5 * model.scale[2];
  return { halfW: scaleW, halfD: scaleD };
}

function footprintCornersWorld(
  cx: number,
  cz: number,
  halfW: number,
  halfD: number,
  rotationY: number,
): [number, number][] {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const locals: [number, number][] = [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, halfD],
    [-halfW, halfD],
  ];
  return locals.map(([lx, lz]) => [
    cx + lx * cos + lz * sin,
    cz - lx * sin + lz * cos,
  ]);
}

function isModelOutOfHallBounds(
  model: TheaterModel,
  halfW: number,
  halfD: number,
  layout: TheaterLayout,
): boolean {
  if (model.allowOutOfBounds) return false;
  const halfHallW = layout.hallWidth / 2;
  const halfHallD = layout.hallDepth / 2;
  const corners = footprintCornersWorld(
    model.position[0],
    model.position[2],
    halfW,
    halfD,
    model.rotation[1],
  );
  return corners.some(
    ([x, z]) => x < -halfHallW || x > halfHallW || z < -halfHallD || z > halfHallD,
  );
}

export function buildModelFootprints(
  models: TheaterModel[],
  layout?: TheaterLayout,
): FloorPlanFootprint[] {
  return models.map((model) => {
    const { halfW, halfD } = resolveModelFootprint(model);
    return {
      id: model.id,
      label: model.name,
      kind: isTheaterDecorModel(model) ? "decor" : model.type === "file" ? "model" : "builtin",
      cx: model.position[0],
      cz: model.position[2],
      halfW,
      halfD,
      rotationY: model.rotation[1],
      color: model.decorColor,
      outOfBounds: layout ? isModelOutOfHallBounds(model, halfW, halfD, layout) : undefined,
    };
  });
}

export function hitTestFootprint(
  worldX: number,
  worldZ: number,
  footprint: FloorPlanFootprint,
): boolean {
  const dx = worldX - footprint.cx;
  const dz = worldZ - footprint.cz;
  const cos = Math.cos(-footprint.rotationY);
  const sin = Math.sin(-footprint.rotationY);
  const localX = dx * cos - dz * sin;
  const localZ = dx * sin + dz * cos;
  return (
    Math.abs(localX) <= footprint.halfW && Math.abs(localZ) <= footprint.halfD
  );
}

export function findFootprintAtPoint(
  worldX: number,
  worldZ: number,
  footprints: FloorPlanFootprint[],
): FloorPlanFootprint | null {
  for (let index = footprints.length - 1; index >= 0; index -= 1) {
    const item = footprints[index];
    if (hitTestFootprint(worldX, worldZ, item)) return item;
  }
  return null;
}

export function hitTestSpotlight(
  worldX: number,
  worldZ: number,
  spotlight: TheaterSpotlight,
  threshold = 0.35,
): "source" | "target" | null {
  const [sx, sz] = [spotlight.position[0], spotlight.position[2]];
  const [tx, tz] = [spotlight.target[0], spotlight.target[2]];
  const sourceDist = Math.hypot(worldX - sx, worldZ - sz);
  if (sourceDist <= threshold) return "source";
  const targetDist = Math.hypot(worldX - tx, worldZ - tz);
  if (targetDist <= threshold * 0.85) return "target";
  return null;
}

export function findSpotlightAtPoint(
  worldX: number,
  worldZ: number,
  spotlights: TheaterSpotlight[],
): { spotlight: TheaterSpotlight; part: "source" | "target" } | null {
  for (let index = spotlights.length - 1; index >= 0; index -= 1) {
    const spotlight = spotlights[index];
    const part = hitTestSpotlight(worldX, worldZ, spotlight);
    if (part) return { spotlight, part };
  }
  return null;
}

export type FloorPlanWallLine = {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type FloorPlanDoorOverlay = {
  id: number;
  wall: TheaterDoorWall;
  cx: number;
  cy: number;
  halfLenPx: number;
  thicknessPx: number;
  horizontal: boolean;
};

export type FloorPlanWallOverlay = {
  leftWall: FloorPlanWallLine[];
  rightWall: FloorPlanWallLine[];
  backWall: FloorPlanWallLine[];
  frontWall: FloorPlanWallLine[];
  /** Все сегменты стен сцены (для custom) */
  stageWalls: FloorPlanWallLine[];
  doors: FloorPlanDoorOverlay[];
  recesses: FloorPlanRecessOverlay[];
};

function buildVerticalWallSegments(
  wall: "left" | "right",
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
  doors: TheaterDoor[],
): { segments: FloorPlanWallLine[]; overlays: FloorPlanDoorOverlay[] } {
  const geom = resolveStageGeometry(layout);
  const chain = resolveStageWallChains(layout).find((item) => item.id === wall);
  const segments = chain ? buildWallChainPlanSegments(layout, viewport, chain) : [];
  const thicknessPx = Math.max(10, worldLengthToPlanPx(0.35, layout, viewport));
  const onWall = doors.filter((item) => item.wall === wall).sort((a, b) => a.pos - b.pos);
  const overlays: FloorPlanDoorOverlay[] = onWall.map((door) => {
    const x = getStageSideWallX(wall, door.pos, geom);
    const [cx, cy] = worldToPlanPoint(x, door.pos, layout, viewport);
    return {
      id: door.id,
      wall: door.wall,
      cx,
      cy,
      halfLenPx: Math.max(6, worldLengthToPlanPx(door.width / 2, layout, viewport)),
      thicknessPx,
      horizontal: false,
    };
  });
  return { segments, overlays };
}

function buildHorizontalWallSegments(
  wall: "back" | "front",
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
  doors: TheaterDoor[],
): { segments: FloorPlanWallLine[]; overlays: FloorPlanDoorOverlay[] } {
  const geom = resolveStageGeometry(layout);
  const halfD = layout.hallDepth / 2;
  if (wall === "back") {
    const chain = resolveStageWallChains(layout).find((item) => item.id === "back");
    const segments = chain ? buildWallChainPlanSegments(layout, viewport, chain) : [];
    const thicknessPx = Math.max(10, worldLengthToPlanPx(0.35, layout, viewport));
    const onWall = doors.filter((item) => item.wall === "back");
    const overlays = onWall.map((door) => {
      const [cx, cy] = worldToPlanPoint(door.pos, geom.backZ, layout, viewport);
      return {
        id: door.id,
        wall: door.wall,
        cx,
        cy,
        halfLenPx: Math.max(6, worldLengthToPlanPx(door.width / 2, layout, viewport)),
        thicknessPx,
        horizontal: true,
      };
    });
    return { segments, overlays };
  }

  const wallZ = halfD;
  const spanHalf = layout.hallWidth / 2;
  const [, yPlan] = worldToPlanPoint(0, wallZ, layout, viewport);
  const [xLeft] = worldToPlanPoint(-spanHalf, wallZ, layout, viewport);
  const [xRight] = worldToPlanPoint(spanHalf, wallZ, layout, viewport);
  const thicknessPx = Math.max(10, worldLengthToPlanPx(0.35, layout, viewport));
  const onWall = doors.filter((item) => item.wall === wall).sort((a, b) => a.pos - b.pos);
  const segments: FloorPlanWallLine[] = [{ x1: xLeft, y1: yPlan, x2: xRight, y2: yPlan }];
  const overlays: FloorPlanDoorOverlay[] = onWall.map((door) => {
    const [cx, cy] = worldToPlanPoint(door.pos, wallZ, layout, viewport);
    return {
      id: door.id,
      wall: door.wall,
      cx,
      cy,
      halfLenPx: Math.max(6, worldLengthToPlanPx(door.width / 2, layout, viewport)),
      thicknessPx,
      horizontal: true,
    };
  });
  return { segments, overlays };
}

export function buildFloorPlanWallOverlay(
  layout: TheaterLayout,
  viewport: FloorPlanViewport,
): FloorPlanWallOverlay {
  const doors = resolveLayoutDoors(layout);

  if (resolveStageShape(layout) === "custom") {
    const chains = resolveStageWallChains(layout);
    const stageWalls = chains.flatMap((chain) =>
      buildWallChainPlanSegments(layout, viewport, chain),
    );
    return {
      leftWall: [],
      rightWall: [],
      backWall: [],
      frontWall: [],
      stageWalls,
      doors: [],
      recesses: [],
    };
  }

  const left = buildVerticalWallSegments("left", layout, viewport, doors);
  const right = buildVerticalWallSegments("right", layout, viewport, doors);
  const back = buildHorizontalWallSegments("back", layout, viewport, doors);
  const front = buildHorizontalWallSegments("front", layout, viewport, doors);

  return {
    leftWall: left.segments,
    rightWall: right.segments,
    backWall: back.segments,
    frontWall: front.segments,
    stageWalls: [],
    doors: [...left.overlays, ...right.overlays, ...back.overlays, ...front.overlays],
    recesses: buildRecessOverlays(layout, viewport),
  };
}
