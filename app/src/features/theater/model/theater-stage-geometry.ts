import type {
  TheaterDoor,
  TheaterLayout,
  TheaterStageShape,
  TheaterWallRecess,
} from "../../../shared/types/script";
import { getStageFrontZ } from "./theater-metrics";
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
  /** Стены произвольного контура (stageShape = custom) */
  custom: WallSegment3D[];
  lintel: WallSegment3D | null;
  leftPillar: WallSegment3D | null;
  rightPillar: WallSegment3D | null;
};

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function resolveStageShape(layout: TheaterLayout): TheaterStageShape {
  return layout.stageShape ?? "rectangle";
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
  const backZ = -halfD;
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
    ];
  }

  if (geom.stageShape === "trapezoid" && geom.prosceniumEnabled) {
    return [
      { id: "back", points: [geom.backLeft, geom.backRight] },
      { id: "right", points: [geom.backRight, geom.proscRight] },
      { id: "left", points: [geom.proscLeft, geom.backLeft] },
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
  if (chainId === "back") {
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

  const chains = resolveStageWallChains(layout);
  const back = chains.find((item) => item.id === "back");
  const right = chains.find((item) => item.id === "right");
  const left = chains.find((item) => item.id === "left");
  if (!back || !right || !left) return [];
  return [...back.points, ...right.points.slice(1), ...left.points];
}

export function getStageSideWallX(
  wall: "left" | "right",
  z: number,
  geom: StageGeometry,
): number {
  const layout = {
    hallWidth: geom.halfW * 2,
    hallDepth: geom.halfD * 2,
    wallHeight: geom.wallHeight,
    audienceStartZ: geom.prosceniumZ,
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

type WallOpening = { center: number; halfWidth: number; height: number };

function buildWallSegmentsWithOpenings(
  start: StagePoint,
  end: StagePoint,
  wallHeight: number,
  openings: WallOpening[],
  rotationOverride?: number,
  chainId?: string,
  hideGroup?: WallHideGroup,
): WallSegment3D[] {
  const length = wallLength(start, end);
  if (length < 0.02) return [];

  const rotationY = rotationOverride ?? wallTangentRotation(start, end);
  const yCenter = wallHeight / 2;
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

  const pushLintel = (s0: number, s1: number, doorHeight: number) => {
    const segLen = s1 - s0;
    const clampedDoorHeight = Math.min(doorHeight, wallHeight - 0.05);
    const lintelHeight = wallHeight - clampedDoorHeight;
    if (segLen < 0.02 || lintelHeight < 0.02) return;
    const mid = (s0 + s1) / 2;
    const midPoint = pointAlongWall(start, end, mid);
    segments.push({
      position: [midPoint.x, clampedDoorHeight + lintelHeight / 2, midPoint.z],
      rotation: [0, rotationY, 0],
      size: [segLen, lintelHeight],
      chainId,
      hideGroup,
    });
  };

  for (const opening of sorted) {
    const o0 = Math.max(0, opening.center - opening.halfWidth);
    const o1 = Math.min(length, opening.center + opening.halfWidth);
    if (o0 > cursor + 0.01) pushSegment(cursor, o0);
    pushLintel(o0, o1, opening.height);
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
    }));

  const recessOpenings = recesses
    .filter((item) => item.wall === chain.id)
    .map((recess) => ({
      center: distanceToPointOnChain(
        chain.points,
        wallOpeningTarget(chain.id, chain.points, recess.pos),
      ),
      halfWidth: recess.width / 2,
      // Full-height mouth; cavity walls are added separately.
      height: wallHeight,
    }));

  return [...doorOpenings, ...recessOpenings];
}

function buildRecessCavitySegments(
  chain: StageWallChain,
  recesses: TheaterWallRecess[],
  wallHeight: number,
  hideGroup: WallHideGroup,
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
  hideGroup: WallHideGroup,
): WallSegment3D[] {
  const openings = openingsAlongChain(chain, doors, recesses, wallHeight);
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
      ),
    );
    edgeStart += len;
  }

  segments.push(...buildRecessCavitySegments(chain, recesses, wallHeight, hideGroup));
  return segments;
}

function buildPillarSegment(
  point: StagePoint,
  height: number,
  rotationY: number,
  chainId: string,
  hideGroup: WallHideGroup,
): WallSegment3D {
  return {
    position: [point.x, height / 2, point.z],
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
  return classifyChainHideGroupByNormal(chain, stageCenter);
}

export function buildStageWallMeshes(
  layout: TheaterLayout,
  doors: TheaterDoor[],
): StageWallMeshes {
  const geom = resolveStageGeometry(layout);
  // Outer walls use the base outline; recesses are mouth-cut + cavity panels.
  // Building from the recessed polyline broke door openings and "ate" wall spans.
  const chains = resolveBaseStageWallChains(layout);
  const recesses = resolveLayoutWallRecesses(layout);
  const stageCenter = getStageCenterXZ(geom);

  if (geom.stageShape === "custom") {
    const custom = chains.flatMap((chain) =>
      buildChainWallSegments(
        chain,
        geom.wallHeight,
        doors,
        recesses,
        resolveWallHideGroup(chain, stageCenter),
      ),
    );
    return {
      back: [],
      left: [],
      right: [],
      custom,
      lintel: null,
      leftPillar: null,
      rightPillar: null,
    };
  }

  const backChain = chains.find((item) => item.id === "back");
  const leftChain = chains.find((item) => item.id === "left");
  const rightChain = chains.find((item) => item.id === "right");

  const back = backChain
    ? buildChainWallSegments(backChain, geom.wallHeight, doors, recesses, "back")
    : [];
  const left = leftChain
    ? buildChainWallSegments(leftChain, geom.wallHeight, doors, recesses, "left")
    : [];
  const right = rightChain
    ? buildChainWallSegments(rightChain, geom.wallHeight, doors, recesses, "right")
    : [];

  let lintel: WallSegment3D | null = null;
  let leftPillar: WallSegment3D | null = null;
  let rightPillar: WallSegment3D | null = null;

  const showArchFrame =
    geom.prosceniumEnabled &&
    geom.stageShape === "trapezoid" &&
    geom.prosceniumHeight < geom.wallHeight - 0.05;

  if (showArchFrame) {
    const lintelHeight = geom.wallHeight - geom.prosceniumHeight;
    lintel = {
      position: [0, geom.prosceniumHeight + lintelHeight / 2, geom.prosceniumZ],
      rotation: [0, 0, 0],
      size: [geom.prosceniumWidth, lintelHeight],
      chainId: "lintel",
      hideGroup: "lintel",
    };
    const baseLeft = resolveBaseStageWallChains(layout).find((item) => item.id === "left");
    const baseRight = resolveBaseStageWallChains(layout).find((item) => item.id === "right");
    if (baseLeft && baseLeft.points.length >= 2) {
      const rot = wallTangentRotation(
        baseLeft.points[baseLeft.points.length - 2],
        baseLeft.points[baseLeft.points.length - 1],
      );
      leftPillar = buildPillarSegment(geom.proscLeft, geom.prosceniumHeight, rot, "left-pillar", "left");
    }
    if (baseRight && baseRight.points.length >= 2) {
      const rot = wallTangentRotation(baseRight.points[0], baseRight.points[1]);
      rightPillar = buildPillarSegment(geom.proscRight, geom.prosceniumHeight, rot, "right-pillar", "right");
    }
  }

  return { back, left, right, custom: [], lintel, leftPillar, rightPillar };
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
  trapezoid: "Трапеция (портал)",
  "t-shape": "Т-образная",
  custom: "Свой контур",
};
