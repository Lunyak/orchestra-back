import type {
  TheaterDoor,
  TheaterDoorWall,
  TheaterLayout,
  TheaterStageShape,
  TheaterWallOpening,
  TheaterWallRecess,
} from "../../../shared/types/script";
import { getStageBackZ, getStageFrontZ } from "./theater-metrics";
import { resolveLayoutWallOpenings } from "./theater-wall-openings";
import { resolveLayoutWallRecesses } from "./theater-wall-recesses";
import {
  buildCustomStageWallEdgeChains,
  resolveStageOutlinePoints,
} from "./theater-custom-outline";

export type StagePoint = { x: number; z: number };

export type StageGeometry = {
  halfW: number;
  halfD: number;
  backZ: number;
  prosceniumZ: number;
  stageBackWidth: number;
  prosceniumWidth: number;
  prosceniumHeight: number;
  wallHeight: number;
  stageShape: TheaterStageShape;
  prosceniumEnabled: boolean;
  tJunctionZ: number;
  backLeft: StagePoint;
  backRight: StagePoint;
  proscLeft: StagePoint;
  proscRight: StagePoint;
};

export type StageWallChain = {
  id: string;
  points: StagePoint[];
};

export type WallHideGroup = "left" | "right" | "back" | "front" | "lintel";

export type WallSegment3D = {
  position: [number, number, number];
  rotation: [number, number, number];
  size: [number, number];
  /** id цепочки стены (back, left, right, edge-0, lintel, …) */
  chainId?: string;
  /** Группа для скрытия «стены перед камерой» (вся сторона целиком). */
  hideGroup?: WallHideGroup;
};

export type StageWallMeshes = {
  back: WallSegment3D[];
  left: WallSegment3D[];
  right: WallSegment3D[];
  front: WallSegment3D[];
  /** Стены произвольного контура (stageShape = custom) */
  custom: WallSegment3D[];
  lintel: WallSegment3D | null;
  leftPillar: WallSegment3D | null;
  rightPillar: WallSegment3D | null;
};

export const STAGE_RISE_LIMITS = { min: 0, max: 2 } as const;
export const CIRCLE_STAGE_SEGMENTS = 36;
const WALL_SIDES: TheaterDoorWall[] = ["left", "right", "back", "front"];

export function resolveStageRise(layout: Pick<TheaterLayout, "stageRise">) {
  return clamp(layout.stageRise ?? 0, STAGE_RISE_LIMITS.min, STAGE_RISE_LIMITS.max);
}

export function normalizeHiddenWalls(
  layout: Pick<TheaterLayout, "hiddenWalls">,
): TheaterDoorWall[] | undefined {
  if (!Array.isArray(layout.hiddenWalls)) return undefined;
  return WALL_SIDES.filter((side) => layout.hiddenWalls?.includes(side));
}

export function resolveHiddenWalls(layout: Pick<TheaterLayout, "hiddenWalls">) {
  return normalizeHiddenWalls(layout) ?? (["front"] as TheaterDoorWall[]);
}

export function isWallHidden(
  layout: Pick<TheaterLayout, "hiddenWalls">,
  side: TheaterDoorWall,
) {
  return resolveHiddenWalls(layout).includes(side);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function resolveStageShape(layout: TheaterLayout): TheaterStageShape {
  return layout.stageShape ?? "rectangle";
}

export function stageUsesAudienceWidth(shape: TheaterStageShape): boolean {
  return shape === "trapezoid" || shape === "t-shape";
}

const TAPER_EPS = 0.05;
const TRAPEZOID_FRONT_RATIO = 0.72;
const T_SHAPE_STEM_RATIO = 0.55;

function resolveLayoutBackWidth(
  layout: Pick<TheaterLayout, "hallWidth" | "stageBackWidth" | "prosceniumWidth">,
) {
  return layout.stageBackWidth ?? layout.prosceniumWidth ?? layout.hallWidth;
}

export function patchForStageShape(
  layout: TheaterLayout,
  shape: TheaterStageShape,
): Partial<TheaterLayout> {
  const back = resolveLayoutBackWidth(layout);
  const front = layout.prosceniumWidth ?? layout.hallWidth;
  const hasTaper = Math.abs(back - front) >= TAPER_EPS;

  const wasOpenDeck =
    layout.stageShape === "circle" || layout.stageShape === "semicircle";
  const wallsAfterOpen = wasOpenDeck ? (["front"] as TheaterDoorWall[]) : layout.hiddenWalls;

  if (shape === "trapezoid") {
    return {
      stageShape: shape,
      prosceniumEnabled: true,
      stageBackWidth: back,
      prosceniumWidth: hasTaper ? front : Math.max(2, back * TRAPEZOID_FRONT_RATIO),
      hiddenWalls: wallsAfterOpen,
    };
  }
  if (shape === "t-shape") {
    return {
      stageShape: shape,
      stageBackWidth: back,
      prosceniumWidth: hasTaper ? front : Math.max(2, back * T_SHAPE_STEM_RATIO),
      hiddenWalls: wallsAfterOpen,
    };
  }
  if (shape === "circle") {
    return {
      stageShape: shape,
      stageBackWidth: back,
      prosceniumWidth: back,
      hiddenWalls: ["left", "right", "back", "front"],
    };
  }
  if (shape === "semicircle") {
    return {
      stageShape: shape,
      stageBackWidth: back,
      prosceniumWidth: back,
      hiddenWalls: ["left", "right", "front"],
      audienceLayout: "arc",
    };
  }
  if (shape === "rectangle") {
    return {
      stageShape: shape,
      stageBackWidth: back,
      prosceniumWidth: back,
      hiddenWalls: wallsAfterOpen,
    };
  }
  return {
    stageShape: shape,
    hiddenWalls: wallsAfterOpen,
  };
}

export function resolveProsceniumEnabled(layout: TheaterLayout): boolean {
  if (layout.prosceniumEnabled === true) return true;
  if (layout.prosceniumEnabled === false) return false;
  if (resolveStageShape(layout) === "trapezoid") return true;
  return false;
}

export function resolveStageGeometry(layout: TheaterLayout): StageGeometry {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const backZ = getStageBackZ(layout);
  const prosceniumZ = getStageFrontZ(layout);
  const stageShape = resolveStageShape(layout);
  const prosceniumEnabled = resolveProsceniumEnabled(layout);

  let stageBackWidth = layout.stageBackWidth ?? layout.hallWidth;
  let prosceniumWidth = layout.prosceniumWidth ?? layout.hallWidth;

  if (stageShape === "rectangle" && !prosceniumEnabled) {
    const width = layout.stageBackWidth ?? layout.prosceniumWidth ?? layout.hallWidth;
    stageBackWidth = width;
    prosceniumWidth = width;
  }

  const prosceniumHeight = layout.prosceniumHeight ?? layout.wallHeight;
  const span = Math.max(0.5, prosceniumZ - backZ);
  const tJunctionZ = clamp(
    layout.tJunctionZ ?? backZ + span * 0.55,
    backZ + span * 0.2,
    prosceniumZ - span * 0.15,
  );

  return {
    halfW,
    halfD,
    backZ,
    prosceniumZ,
    stageBackWidth,
    prosceniumWidth,
    prosceniumHeight,
    wallHeight: layout.wallHeight,
    stageShape,
    prosceniumEnabled,
    tJunctionZ,
    backLeft: { x: -stageBackWidth / 2, z: backZ },
    backRight: { x: stageBackWidth / 2, z: backZ },
    proscLeft: { x: -prosceniumWidth / 2, z: prosceniumZ },
    proscRight: { x: prosceniumWidth / 2, z: prosceniumZ },
  };
}

function circleStageRadii(geom: StageGeometry) {
  const radiusX = geom.stageBackWidth / 2;
  const radiusZ = Math.max(0.5, (geom.prosceniumZ - geom.backZ) / 2);
  const centerZ = (geom.backZ + geom.prosceniumZ) / 2;
  return { radiusX, radiusZ, centerZ };
}

function semicircleStageRadii(geom: StageGeometry) {
  const radiusX = geom.stageBackWidth / 2;
  const radiusZ = Math.max(0.5, geom.prosceniumZ - geom.backZ);
  return { radiusX, radiusZ, centerZ: geom.backZ };
}

export function semicircleStagePoint(geom: StageGeometry, t: number) {
  const { radiusX, radiusZ, centerZ } = semicircleStageRadii(geom);
  const theta = (t * Math.PI) / 2;
  return {
    x: radiusX * Math.sin(theta),
    z: centerZ + radiusZ * Math.cos(theta),
  };
}

export function buildSemicircleStageOutline(geom: StageGeometry): StagePoint[] {
  const count = Math.round(CIRCLE_STAGE_SEGMENTS / 2);
  const points: StagePoint[] = [];
  for (let i = 0; i <= count; i += 1) {
    points.push(semicircleStagePoint(geom, -1 + (2 * i) / count));
  }
  return points;
}

export function circleStagePoint(geom: StageGeometry, index: number, count = CIRCLE_STAGE_SEGMENTS) {
  const { radiusX, radiusZ, centerZ } = circleStageRadii(geom);
  const theta = -Math.PI + (2 * Math.PI * index) / count;
  return {
    x: radiusX * Math.sin(theta),
    z: centerZ - radiusZ * Math.cos(theta),
  };
}

export function buildCircleStageOutline(geom: StageGeometry): StagePoint[] {
  const points: StagePoint[] = [];
  for (let i = 0; i < CIRCLE_STAGE_SEGMENTS; i += 1) {
    points.push(circleStagePoint(geom, i));
  }
  return points;
}

function chainFromCircleIndices(id: string, geom: StageGeometry, from: number, to: number) {
  const points: StagePoint[] = [];
  for (let i = from; i <= to; i += 1) {
    points.push(circleStagePoint(geom, i));
  }
  return { id, points };
}

function buildCircleStageWallChains(geom: StageGeometry): StageWallChain[] {
  const n = CIRCLE_STAGE_SEGMENTS;
  const gap = 2;
  const leftEnd = Math.round(n / 3);
  const rightStart = Math.round((2 * n) / 3);
  return [
    chainFromCircleIndices("left", geom, gap, leftEnd),
    chainFromCircleIndices("back", geom, leftEnd, rightStart),
    chainFromCircleIndices("right", geom, rightStart, n - gap),
    {
      id: "front",
      points: [
        circleStagePoint(geom, n - gap),
        ...Array.from({ length: gap * 2 - 1 }, (_, i) =>
          circleStagePoint(geom, (n - gap + 1 + i) % n),
        ),
        circleStagePoint(geom, gap),
      ],
    },
  ];
}

export function resolveBaseStageWallChains(layout: TheaterLayout): StageWallChain[] {
  if (resolveStageShape(layout) === "custom") {
    return buildCustomStageWallEdgeChains(layout);
  }

  const geom = resolveStageGeometry(layout);
  const wingHalf = geom.stageBackWidth / 2;
  const stemHalf = geom.prosceniumWidth / 2;

  if (geom.stageShape === "t-shape") {
    const jZ = geom.tJunctionZ;
    return [
      { id: "back", points: [geom.backLeft, geom.backRight] },
      {
        id: "right",
        points: [
          geom.backRight,
          { x: wingHalf, z: jZ },
          { x: stemHalf, z: jZ },
          geom.proscRight,
        ],
      },
      {
        id: "left",
        points: [
          geom.proscLeft,
          { x: -stemHalf, z: jZ },
          { x: -wingHalf, z: jZ },
          geom.backLeft,
        ],
      },
      { id: "front", points: [geom.proscRight, geom.proscLeft] },
    ];
  }

  if (geom.stageShape === "trapezoid") {
    return [
      { id: "back", points: [geom.backLeft, geom.backRight] },
      { id: "right", points: [geom.backRight, geom.proscRight] },
      { id: "left", points: [geom.proscLeft, geom.backLeft] },
      { id: "front", points: [geom.proscRight, geom.proscLeft] },
    ];
  }

  if (geom.stageShape === "circle") {
    return buildCircleStageWallChains(geom);
  }

  if (geom.stageShape === "semicircle") {
    const outline = buildSemicircleStageOutline(geom);
    const left = outline[0];
    const right = outline[outline.length - 1];
    return [
      { id: "back", points: [left, right] },
      { id: "front", points: outline },
    ];
  }

  const rectLeft = { x: -geom.stageBackWidth / 2, z: geom.backZ };
  const rectRight = { x: geom.stageBackWidth / 2, z: geom.backZ };
  const rectProscLeft = { x: -geom.stageBackWidth / 2, z: geom.prosceniumZ };
  const rectProscRight = { x: geom.stageBackWidth / 2, z: geom.prosceniumZ };

  return [
    { id: "back", points: [rectLeft, rectRight] },
    { id: "right", points: [rectRight, rectProscRight] },
    { id: "left", points: [rectProscLeft, rectLeft] },
    { id: "front", points: [rectProscRight, rectProscLeft] },
  ];
}

function chainLength(points: StagePoint[]): number {
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    total += Math.hypot(points[i + 1].x - points[i].x, points[i + 1].z - points[i].z);
  }
  return total;
}

function pointAtDistance(points: StagePoint[], distance: number): StagePoint {
  let cursor = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z);
    if (cursor + segLen >= distance || i === points.length - 2) {
      const t = segLen < 1e-6 ? 0 : clamp((distance - cursor) / segLen, 0, 1);
      return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t };
    }
    cursor += segLen;
  }
  return { ...points[points.length - 1] };
}

function distanceToPointOnChain(points: StagePoint[], target: StagePoint): number {
  let best = Infinity;
  let bestDist = 0;
  let cursor = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-8) continue;
    let t = ((target.x - a.x) * dx + (target.z - a.z) * dz) / lenSq;
    t = clamp(t, 0, 1);
    const cx = a.x + t * dx;
    const cz = a.z + t * dz;
    const dist = Math.hypot(target.x - cx, target.z - cz);
    if (dist < best) {
      best = dist;
      bestDist = cursor + Math.sqrt(lenSq) * t;
    }
    cursor += Math.sqrt(lenSq);
  }
  return bestDist;
}

function inwardOffsetForWall(wall: string): StagePoint {
  if (wall === "back") return { x: 0, z: 1 };
  if (wall === "front") return { x: 0, z: -1 };
  if (wall === "left") return { x: 1, z: 0 };
  if (wall === "right") return { x: -1, z: 0 };
  return { x: 0, z: 0 };
}

function dedupeChainPoints(points: StagePoint[]): StagePoint[] {
  return points.filter((point, index, arr) => {
    if (index === 0) return true;
    const prev = arr[index - 1];
    return Math.hypot(point.x - prev.x, point.z - prev.z) > 0.02;
  });
}

function wallOpeningTarget(
  chainId: string,
  points: StagePoint[],
  pos: number,
): StagePoint {
  if (chainId === "back" || chainId === "front") {
    return { x: pos, z: points[0].z };
  }
  return { x: points[0].x, z: pos };
}

function applyRecessToPoints(
  points: StagePoint[],
  startDist: number,
  endDist: number,
  depth: number,
  inward: StagePoint,
): StagePoint[] {
  if (endDist - startDist < 0.05) return points;

  const pStart = pointAtDistance(points, startDist);
  const pEnd = pointAtDistance(points, endDist);
  const pInStart = {
    x: pStart.x + inward.x * depth,
    z: pStart.z + inward.z * depth,
  };
  const pInEnd = {
    x: pEnd.x + inward.x * depth,
    z: pEnd.z + inward.z * depth,
  };

  const rebuilt: StagePoint[] = [points[0]];
  let cursor = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const b = points[i + 1];
    const segLen = Math.hypot(b.x - points[i].x, b.z - points[i].z);
    cursor += segLen;
    if (cursor < startDist - 1e-6) {
      rebuilt.push(b);
    } else {
      break;
    }
  }

  rebuilt.push(pStart, pInStart, pInEnd, pEnd);

  cursor = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const b = points[i + 1];
    const segLen = Math.hypot(b.x - points[i].x, b.z - points[i].z);
    cursor += segLen;
    if (cursor > endDist + 1e-6) {
      rebuilt.push(b);
    }
  }

  return dedupeChainPoints(rebuilt);
}

function applyRecessesToChain(
  chain: StageWallChain,
  recesses: TheaterWallRecess[],
): StagePoint[] {
  const onWall = recesses
    .filter((item) => item.wall === chain.id)
    .sort((a, b) => b.pos - a.pos);
  if (onWall.length === 0) return [...chain.points];

  const inward = inwardOffsetForWall(chain.id);
  let points = [...chain.points];

  for (const recess of onWall) {
    const centerDist = distanceToPointOnChain(
      points,
      wallOpeningTarget(chain.id, points, recess.pos),
    );
    const half = recess.width / 2;
    const startDist = Math.max(0, centerDist - half);
    const endDist = Math.min(chainLength(points), centerDist + half);
    points = applyRecessToPoints(points, startDist, endDist, recess.depth, inward);
  }

  return points;
}

export function resolveStageWallChains(layout: TheaterLayout): StageWallChain[] {
  const recesses = resolveLayoutWallRecesses(layout);
  return resolveBaseStageWallChains(layout).map((chain) => ({
    id: chain.id,
    points: applyRecessesToChain(chain, recesses),
  }));
}

export function buildStageOutline(layout: TheaterLayout): StagePoint[] {
  if (resolveStageShape(layout) === "custom") {
    return resolveStageOutlinePoints(layout);
  }

  const geom = resolveStageGeometry(layout);
  if (geom.stageShape === "circle") {
    return buildCircleStageOutline(geom);
  }
  if (geom.stageShape === "semicircle") {
    return buildSemicircleStageOutline(geom);
  }

  const chains = resolveStageWallChains(layout);
  const back = chains.find((item) => item.id === "back");
  const right = chains.find((item) => item.id === "right");
  const left = chains.find((item) => item.id === "left");
  if (!back || !right || !left) return [];
  return [...back.points, ...right.points.slice(1), ...left.points];
}

export function circleStageXAtZ(geom: StageGeometry, z: number) {
  const { radiusX, radiusZ, centerZ } = circleStageRadii(geom);
  const dz = (z - centerZ) / radiusZ;
  if (Math.abs(dz) >= 1) return 0;
  return radiusX * Math.sqrt(1 - dz * dz);
}

export function semicircleStageXAtZ(geom: StageGeometry, z: number) {
  const { radiusX, radiusZ, centerZ } = semicircleStageRadii(geom);
  const dz = (z - centerZ) / radiusZ;
  if (dz < 0 || dz > 1) return 0;
  return radiusX * Math.sqrt(1 - dz * dz);
}

export function getStageSideWallX(
  wall: "left" | "right",
  z: number,
  geom: StageGeometry,
): number {
  if (geom.stageShape === "circle") {
    const x = circleStageXAtZ(geom, z);
    return wall === "left" ? -x : x;
  }
  if (geom.stageShape === "semicircle") {
    const x = semicircleStageXAtZ(geom, z);
    return wall === "left" ? -x : x;
  }
  const layout = {
    hallWidth: geom.halfW * 2,
    hallDepth: geom.halfD * 2,
    wallHeight: geom.wallHeight,
    audienceStartZ: geom.prosceniumZ,
    stageBackZ: geom.backZ,
    stageBackWidth: geom.stageBackWidth,
    prosceniumWidth: geom.prosceniumWidth,
    prosceniumHeight: geom.prosceniumHeight,
    stageShape: geom.stageShape,
    prosceniumEnabled: geom.prosceniumEnabled,
    tJunctionZ: geom.tJunctionZ,
  } as TheaterLayout;
  const chain = resolveStageWallChains(layout).find((item) => item.id === wall);
  if (!chain || chain.points.length < 2) {
    return wall === "left" ? -geom.halfW : geom.halfW;
  }
  let bestX = chain.points[0].x;
  let best = Infinity;
  for (let i = 0; i < chain.points.length - 1; i += 1) {
    const a = chain.points[i];
    const b = chain.points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    if (Math.abs(dz) < 0.001) continue;
    const t = clamp((z - a.z) / dz, 0, 1);
    const cx = a.x + dx * t;
    const cz = a.z + dz * t;
    const dist = Math.abs(cz - z);
    if (dist < best) {
      best = dist;
      bestX = cx;
    }
  }
  return bestX;
}

export function getStageWallSpanZ(geom: StageGeometry) {
  return { min: geom.backZ, max: geom.prosceniumZ };
}

export function getStageBackWallSpanX(geom: StageGeometry) {
  return { min: -geom.stageBackWidth / 2, max: geom.stageBackWidth / 2 };
}

function wallLength(start: StagePoint, end: StagePoint) {
  return Math.hypot(end.x - start.x, end.z - start.z);
}

function pointAlongWall(start: StagePoint, end: StagePoint, distance: number): StagePoint {
  const len = wallLength(start, end);
  if (len < 0.001) return { ...start };
  const t = distance / len;
  return {
    x: start.x + (end.x - start.x) * t,
    z: start.z + (end.z - start.z) * t,
  };
}

function wallTangentRotation(start: StagePoint, end: StagePoint): number {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return Math.atan2(-dx, dz) - Math.PI / 2;
}

type WallOpening = { center: number; halfWidth: number; height: number; sill: number };

function buildWallSegmentsWithOpenings(
  start: StagePoint,
  end: StagePoint,
  wallHeight: number,
  openings: WallOpening[],
  rotationOverride?: number,
  chainId?: string,
  hideGroup?: WallHideGroup,
  deckY = 0,
): WallSegment3D[] {
  const length = wallLength(start, end);
  if (length < 0.02) return [];

  const rotationY = rotationOverride ?? wallTangentRotation(start, end);
  const yCenter = deckY + wallHeight / 2;
  const sorted = [...openings]
    .filter((item) => item.halfWidth > 0)
    .sort((a, b) => a.center - b.center);

  const segments: WallSegment3D[] = [];
  let cursor = 0;

  const pushSegment = (s0: number, s1: number) => {
    const segLen = s1 - s0;
    if (segLen < 0.02) return;
    const mid = (s0 + s1) / 2;
    const midPoint = pointAlongWall(start, end, mid);
    segments.push({
      position: [midPoint.x, yCenter, midPoint.z],
      rotation: [0, rotationY, 0],
      size: [segLen, wallHeight],
      chainId,
      hideGroup,
    });
  };

  const pushBand = (s0: number, s1: number, y0: number, y1: number) => {
    const segLen = s1 - s0;
    const bandHeight = y1 - y0;
    if (segLen < 0.02 || bandHeight < 0.02) return;
    const mid = (s0 + s1) / 2;
    const midPoint = pointAlongWall(start, end, mid);
    segments.push({
      position: [midPoint.x, deckY + y0 + bandHeight / 2, midPoint.z],
      rotation: [0, rotationY, 0],
      size: [segLen, bandHeight],
      chainId,
      hideGroup,
    });
  };

  for (const opening of sorted) {
    const o0 = Math.max(0, opening.center - opening.halfWidth);
    const o1 = Math.min(length, opening.center + opening.halfWidth);
    const sill = Math.max(0, opening.sill);
    const openingTop = Math.min(wallHeight, sill + opening.height);
    if (o0 > cursor + 0.01) pushSegment(cursor, o0);
    pushBand(o0, o1, 0, sill);
    pushBand(o0, o1, openingTop, wallHeight);
    cursor = Math.max(cursor, o1);
  }
  if (cursor < length - 0.01) pushSegment(cursor, length);
  if (segments.length === 0) pushSegment(0, length);
  return segments;
}

function openingsAlongChain(
  chain: StageWallChain,
  doors: TheaterDoor[],
  recesses: TheaterWallRecess[],
  wallOpenings: TheaterWallOpening[],
  wallHeight: number,
): WallOpening[] {
  const doorOpenings = doors
    .filter((item) => item.wall === chain.id)
    .map((door) => ({
      center: distanceToPointOnChain(
        chain.points,
        wallOpeningTarget(chain.id, chain.points, door.pos),
      ),
      halfWidth: door.width / 2,
      height: door.height,
      sill: 0,
    }));

  const recessOpenings = recesses
    .filter((item) => item.wall === chain.id)
    .map((recess) => ({
      center: distanceToPointOnChain(
        chain.points,
        wallOpeningTarget(chain.id, chain.points, recess.pos),
      ),
      halfWidth: recess.width / 2,
      height: wallHeight,
      sill: 0,
    }));

  const cutOpenings = wallOpenings
    .filter((item) => item.wall === chain.id)
    .map((opening) => ({
      center: distanceToPointOnChain(
        chain.points,
        wallOpeningTarget(chain.id, chain.points, opening.pos),
      ),
      halfWidth: opening.width / 2,
      height: opening.height,
      sill: opening.sill ?? 0,
    }));

  return [...doorOpenings, ...recessOpenings, ...cutOpenings];
}

function buildRecessCavitySegments(
  chain: StageWallChain,
  recesses: TheaterWallRecess[],
  wallHeight: number,
  hideGroup: WallHideGroup,
  deckY = 0,
): WallSegment3D[] {
  const inward = inwardOffsetForWall(chain.id);
  const segments: WallSegment3D[] = [];

  for (const recess of recesses.filter((item) => item.wall === chain.id)) {
    const centerDist = distanceToPointOnChain(
      chain.points,
      wallOpeningTarget(chain.id, chain.points, recess.pos),
    );
    const half = recess.width / 2;
    const startDist = Math.max(0, centerDist - half);
    const endDist = Math.min(chainLength(chain.points), centerDist + half);
    if (endDist - startDist < 0.05) continue;

    const pStart = pointAtDistance(chain.points, startDist);
    const pEnd = pointAtDistance(chain.points, endDist);
    const pInStart = {
      x: pStart.x + inward.x * recess.depth,
      z: pStart.z + inward.z * recess.depth,
    };
    const pInEnd = {
      x: pEnd.x + inward.x * recess.depth,
      z: pEnd.z + inward.z * recess.depth,
    };

    const edges: Array<[StagePoint, StagePoint]> = [
      [pStart, pInStart],
      [pInStart, pInEnd],
      [pInEnd, pEnd],
    ];
    for (const [a, b] of edges) {
      segments.push(
        ...buildWallSegmentsWithOpenings(
          a,
          b,
          wallHeight,
          [],
          undefined,
          chain.id,
          hideGroup,
          deckY,
        ),
      );
    }
  }

  return segments;
}

function buildChainWallSegments(
  chain: StageWallChain,
  wallHeight: number,
  doors: TheaterDoor[],
  recesses: TheaterWallRecess[],
  wallOpenings: TheaterWallOpening[],
  hideGroup: WallHideGroup,
  deckY = 0,
): WallSegment3D[] {
  const openings = openingsAlongChain(chain, doors, recesses, wallOpenings, wallHeight);
  const segments: WallSegment3D[] = [];
  let edgeStart = 0;

  for (let i = 0; i < chain.points.length - 1; i += 1) {
    const a = chain.points[i];
    const b = chain.points[i + 1];
    const len = wallLength(a, b);
    const edgeOpenings = openings
      .filter((item) => item.center >= edgeStart - 0.01 && item.center <= edgeStart + len + 0.01)
      .map((item) => ({
        center: item.center - edgeStart,
        halfWidth: item.halfWidth,
        height: item.height,
        sill: item.sill,
      }));
    segments.push(
      ...buildWallSegmentsWithOpenings(
        a,
        b,
        wallHeight,
        edgeOpenings,
        chain.id === "back" ? Math.PI : undefined,
        chain.id,
        hideGroup,
        deckY,
      ),
    );
    edgeStart += len;
  }

  segments.push(...buildRecessCavitySegments(chain, recesses, wallHeight, hideGroup, deckY));
  return segments;
}

function buildPillarSegment(
  point: StagePoint,
  height: number,
  rotationY: number,
  chainId: string,
  hideGroup: WallHideGroup,
  deckY = 0,
): WallSegment3D {
  return {
    position: [point.x, deckY + height / 2, point.z],
    rotation: [0, rotationY, 0],
    size: [0.12, height],
    chainId,
    hideGroup,
  };
}

function getStageCenterXZ(geom: StageGeometry): StagePoint {
  return { x: 0, z: (geom.backZ + geom.prosceniumZ) / 2 };
}

function classifyChainHideGroupByNormal(
  chain: StageWallChain,
  stageCenter: StagePoint,
): WallHideGroup {
  let sumNx = 0;
  let sumNz = 0;
  let count = 0;
  for (let i = 0; i < chain.points.length - 1; i += 1) {
    const normal = exteriorEdgeNormal(chain.points[i], chain.points[i + 1], stageCenter);
    if (!normal) continue;
    sumNx += normal.nx;
    sumNz += normal.nz;
    count += 1;
  }
  if (count === 0) return "back";
  const nx = sumNx / count;
  const nz = sumNz / count;
  const len = Math.hypot(nx, nz) || 1;
  const snx = nx / len;
  const snz = nz / len;
  if (Math.abs(snx) > Math.abs(snz)) {
    return snx > 0 ? "right" : "left";
  }
  return snz > 0 ? "front" : "back";
}

export function resolveWallHideGroup(
  chain: StageWallChain,
  stageCenter: StagePoint,
): WallHideGroup {
  if (chain.id === "left") return "left";
  if (chain.id === "right") return "right";
  if (chain.id === "back") return "back";
  if (chain.id === "front") return "front";
  return classifyChainHideGroupByNormal(chain, stageCenter);
}

export function buildStageWallMeshes(
  layout: TheaterLayout,
  doors: TheaterDoor[],
): StageWallMeshes {
  const geom = resolveStageGeometry(layout);
  if (geom.stageShape === "circle") {
    return {
      back: [],
      left: [],
      right: [],
      front: [],
      custom: [],
      lintel: null,
      leftPillar: null,
      rightPillar: null,
    };
  }
  const deckY = resolveStageRise(layout);
  const hidden = new Set(resolveHiddenWalls(layout));
  // Outer walls use the base outline; recesses are mouth-cut + cavity panels.
  // Building from the recessed polyline broke door openings and "ate" wall spans.
  const chains = resolveBaseStageWallChains(layout).filter((chain) => {
    const group = resolveWallHideGroup(chain, getStageCenterXZ(geom));
    return !hidden.has(group as TheaterDoorWall);
  });
  const recesses = resolveLayoutWallRecesses(layout);
  const wallOpenings = resolveLayoutWallOpenings(layout);
  const stageCenter = getStageCenterXZ(geom);
  const visibleDoors = doors.filter((door) => !hidden.has(door.wall));
  const visibleRecesses = recesses.filter((recess) => !hidden.has(recess.wall));
  const visibleOpenings = wallOpenings.filter((opening) => !hidden.has(opening.wall));

  if (geom.stageShape === "custom") {
    const custom = chains.flatMap((chain) =>
      buildChainWallSegments(
        chain,
        geom.wallHeight,
        visibleDoors,
        visibleRecesses,
        visibleOpenings,
        resolveWallHideGroup(chain, stageCenter),
        deckY,
      ),
    );
    return {
      back: [],
      left: [],
      right: [],
      front: [],
      custom,
      lintel: null,
      leftPillar: null,
      rightPillar: null,
    };
  }

  const backChain = chains.find((item) => item.id === "back");
  const leftChain = chains.find((item) => item.id === "left");
  const rightChain = chains.find((item) => item.id === "right");
  const frontChain = chains.find((item) => item.id === "front");

  const back = backChain
    ? buildChainWallSegments(backChain, geom.wallHeight, visibleDoors, visibleRecesses, visibleOpenings, "back", deckY)
    : [];
  const left = leftChain
    ? buildChainWallSegments(leftChain, geom.wallHeight, visibleDoors, visibleRecesses, visibleOpenings, "left", deckY)
    : [];
  const right = rightChain
    ? buildChainWallSegments(rightChain, geom.wallHeight, visibleDoors, visibleRecesses, visibleOpenings, "right", deckY)
    : [];
  const front = frontChain
    ? buildChainWallSegments(frontChain, geom.wallHeight, visibleDoors, visibleRecesses, visibleOpenings, "front", deckY)
    : [];

  let lintel: WallSegment3D | null = null;
  let leftPillar: WallSegment3D | null = null;
  let rightPillar: WallSegment3D | null = null;

  const showArchFrame =
    geom.prosceniumEnabled &&
    geom.stageShape === "trapezoid" &&
    geom.prosceniumHeight < geom.wallHeight - 0.05 &&
    !hidden.has("front");

  if (showArchFrame) {
    const lintelHeight = geom.wallHeight - geom.prosceniumHeight;
    lintel = {
      position: [0, deckY + geom.prosceniumHeight + lintelHeight / 2, geom.prosceniumZ],
      rotation: [0, 0, 0],
      size: [geom.prosceniumWidth, lintelHeight],
      chainId: "lintel",
      hideGroup: "lintel",
    };
    const baseLeft = resolveBaseStageWallChains(layout).find((item) => item.id === "left");
    const baseRight = resolveBaseStageWallChains(layout).find((item) => item.id === "right");
    if (baseLeft && baseLeft.points.length >= 2 && !hidden.has("left")) {
      const rot = wallTangentRotation(
        baseLeft.points[baseLeft.points.length - 2],
        baseLeft.points[baseLeft.points.length - 1],
      );
      leftPillar = buildPillarSegment(
        geom.proscLeft,
        geom.prosceniumHeight,
        rot,
        "left-pillar",
        "left",
        deckY,
      );
    }
    if (baseRight && baseRight.points.length >= 2 && !hidden.has("right")) {
      const rot = wallTangentRotation(baseRight.points[0], baseRight.points[1]);
      rightPillar = buildPillarSegment(
        geom.proscRight,
        geom.prosceniumHeight,
        rot,
        "right-pillar",
        "right",
        deckY,
      );
    }
  }

  return { back, left, right, front, custom: [], lintel, leftPillar, rightPillar };
}

function exteriorEdgeNormal(
  a: StagePoint,
  b: StagePoint,
  stageCenter: StagePoint,
): { nx: number; nz: number } | null {
  const ex = b.x - a.x;
  const ez = b.z - a.z;
  const len = Math.hypot(ex, ez);
  if (len < 1e-8) return null;
  const midX = (a.x + b.x) / 2;
  const midZ = (a.z + b.z) / 2;
  let nx = -ez / len;
  let nz = ex / len;
  const toCenterX = stageCenter.x - midX;
  const toCenterZ = stageCenter.z - midZ;
  if (nx * toCenterX + nz * toCenterZ > 0) {
    nx = -nx;
    nz = -nz;
  }
  return { nx, nz };
}

/** Группа стены (вся сторона), ближайшая к камере — скрываем целиком. */
export function findStageWallChainHiddenFromCamera(
  layout: TheaterLayout,
  cameraPosition: [number, number, number],
  viewTarget: [number, number, number],
): WallHideGroup | null {
  const geom = resolveStageGeometry(layout);
  const chains = resolveStageWallChains(layout);
  const stageCenter: StagePoint = { x: viewTarget[0], z: viewTarget[2] };
  const camX = cameraPosition[0];
  const camZ = cameraPosition[2];

  const groupDist = new Map<WallHideGroup, number>();

  for (const chain of chains) {
    const hideGroup = resolveWallHideGroup(chain, stageCenter);
    for (let i = 0; i < chain.points.length - 1; i += 1) {
      const a = chain.points[i];
      const b = chain.points[i + 1];
      const normal = exteriorEdgeNormal(a, b, stageCenter);
      if (!normal) continue;

      const midX = (a.x + b.x) / 2;
      const midZ = (a.z + b.z) / 2;
      const toCamX = camX - midX;
      const toCamZ = camZ - midZ;
      if (normal.nx * toCamX + normal.nz * toCamZ <= 0.05) continue;

      const dist = distancePointToSegment(camX, camZ, a.x, a.z, b.x, b.z);
      const prev = groupDist.get(hideGroup) ?? Infinity;
      if (dist < prev) {
        groupDist.set(hideGroup, dist);
      }
    }
  }

  const showArchFrame =
    geom.prosceniumEnabled &&
    geom.stageShape === "trapezoid" &&
    geom.prosceniumHeight < geom.wallHeight - 0.05;
  if (showArchFrame && camZ > geom.prosceniumZ) {
    const lintelDist = Math.hypot(camX, camZ - geom.prosceniumZ);
    const prev = groupDist.get("lintel") ?? Infinity;
    if (lintelDist < prev) {
      groupDist.set("lintel", lintelDist);
    }
  }

  let bestGroup: WallHideGroup | null = null;
  let bestDist = Infinity;
  for (const [group, dist] of groupDist) {
    if (dist < bestDist) {
      bestDist = dist;
      bestGroup = group;
    }
  }

  return bestGroup;
}

export function distancePointToSegment(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number,
): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-8) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = clamp(t, 0, 1);
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

export function placeOpeningOnWall(
  wall: TheaterDoor["wall"] | TheaterWallRecess["wall"],
  center: StagePoint,
  inset: number,
): { x: number; z: number; rotationY: number } {
  let x = center.x;
  let z = center.z;
  let rotationY = 0;
  if (wall === "left") {
    x += inset;
    rotationY = Math.PI / 2;
  } else if (wall === "right") {
    x -= inset;
    rotationY = -Math.PI / 2;
  } else if (wall === "back") {
    z += inset;
    rotationY = Math.PI;
  } else {
    z -= inset;
  }
  return { x, z, rotationY };
}

export function doorWallNormal(wall: TheaterDoorWall): [number, number, number] {
  if (wall === "left") return [1, 0, 0];
  if (wall === "right") return [-1, 0, 0];
  if (wall === "back") return [0, 0, 1];
  return [0, 0, -1];
}

export function getDoorCenterOnWall(
  door: TheaterDoor,
  layout: TheaterLayout,
): StagePoint | null {
  const geom = resolveStageGeometry(layout);
  if (door.wall === "back") {
    return { x: door.pos, z: geom.backZ };
  }
  if (door.wall === "left") {
    return { x: getStageSideWallX("left", door.pos, geom), z: door.pos };
  }
  if (door.wall === "right") {
    return { x: getStageSideWallX("right", door.pos, geom), z: door.pos };
  }
  if (door.wall === "front") {
    return { x: door.pos, z: geom.halfD };
  }
  return null;
}

export function distancePointToWallChain(
  px: number,
  pz: number,
  chain: StageWallChain,
): number {
  let min = Infinity;
  for (let i = 0; i < chain.points.length - 1; i += 1) {
    const a = chain.points[i];
    const b = chain.points[i + 1];
    min = Math.min(min, distancePointToSegment(px, pz, a.x, a.z, b.x, b.z));
  }
  return min;
}

export const STAGE_SHAPE_LABELS: Record<TheaterStageShape, string> = {
  rectangle: "Прямоугольник",
  trapezoid: "Трапеция",
  circle: "Круг",
  semicircle: "Полукруг",
  "t-shape": "Т-образная",
  custom: "Свой контур",
};

export const STAGE_SHAPE_HINTS: Record<TheaterStageShape, string> = {
  rectangle: "Стены параллельны. Коробка зала и сцена одной ширины.",
  trapezoid: "Стены сужаются к зрителям. Коробка зала с креслами остаётся прямоугольной.",
  circle: "Открытый круглый планшет. Стен нет — как у арены.",
  semicircle: "Орхестра амфитеатра: полукруг к залу, сзади может быть стена скены.",
  "t-shape": "Широкие крылья у задней стены и узкая «ножка» к залу.",
  custom: "Контур стен задаёте вершинами на плане.",
};

export const STAGE_WALL_SIDE_LABELS: Record<TheaterDoorWall, string> = {
  back: "Задняя",
  left: "Левая",
  right: "Правая",
  front: "У зрителей",
};
