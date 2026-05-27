import type { TheaterLayout } from "../../../shared/types/script";
import { getStageFrontZ, METRIC, roundM } from "./theater-metrics";
import type { StagePoint } from "./theater-stage-geometry";

function distancePointToSegment(
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
  t = Math.min(1, Math.max(0, t));
  const cx = ax + t * dx;
  const cz = az + t * dz;
  return Math.hypot(px - cx, pz - cz);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const MIN_STAGE_OUTLINE_POINTS = 3;
export const MAX_STAGE_OUTLINE_POINTS = 24;

export function stagePointsFromOutline(outline: [number, number][]): StagePoint[] {
  return outline.map(([x, z]) => ({ x, z }));
}

export function outlineFromStagePoints(points: StagePoint[]): [number, number][] {
  return points.map((point) => [point.x, point.z]);
}

export function clampOutlinePoint(
  x: number,
  z: number,
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth">,
  options?: { unbounded?: boolean },
): [number, number] {
  if (options?.unbounded) {
    return [roundM(x), roundM(z)];
  }
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const margin = 0.25;
  return [
    roundM(clamp(x, -halfW + margin, halfW - margin)),
    roundM(clamp(z, -halfD + margin, halfD - margin)),
  ];
}

function lerpStageWallX(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  z: number,
): number {
  if (Math.abs(z1 - z0) < 1e-6) return x0;
  const t = (z - z0) / (z1 - z0);
  return x0 + t * (x1 - x0);
}

export function defaultRectangleStageOutline(
  layout: TheaterLayout,
): [number, number][] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const prosceniumZ = getStageFrontZ(layout);
  return [
    [-halfW, -halfD],
    [halfW, -halfD],
    [halfW, prosceniumZ],
    [-halfW, prosceniumZ],
  ].map(([x, z]) => clampOutlinePoint(x, z, layout)) as [number, number][];
}

/** Стартовый прямоугольник «Свой контур»: 4 угла + 4 середины сторон (8 точек). */
export function defaultCustomStageOutline(layout: TheaterLayout): [number, number][] {
  const halfD = layout.hallDepth / 2;
  const backZ = -halfD;
  const prosceniumZ = getStageFrontZ(layout);
  const midZ = (backZ + prosceniumZ) / 2;
  const stageBackHalf = (layout.stageBackWidth ?? layout.hallWidth) / 2;
  const prosceniumHalf = (layout.prosceniumWidth ?? layout.hallWidth) / 2;

  const backLeftX = -stageBackHalf;
  const backRightX = stageBackHalf;
  const proscLeftX = -prosceniumHalf;
  const proscRightX = prosceniumHalf;

  return [
    [backLeftX, backZ],
    [0, backZ],
    [backRightX, backZ],
    [lerpStageWallX(backRightX, backZ, proscRightX, prosceniumZ, midZ), midZ],
    [proscRightX, prosceniumZ],
    [0, prosceniumZ],
    [proscLeftX, prosceniumZ],
    [lerpStageWallX(backLeftX, backZ, proscLeftX, prosceniumZ, midZ), midZ],
  ].map(([x, z]) => clampOutlinePoint(x, z, layout, { unbounded: true }));
}

/** Открытые рёбра стороны к залу для стандартного 8-точечного прямоугольника. */
export function defaultCustomStageOutlineOpenEdges(): number[] {
  return [4, 5];
}

function isCustomStageShape(layout: TheaterLayout) {
  return (layout.stageShape ?? "rectangle") === "custom";
}

function defaultOutlineForLayout(layout: TheaterLayout): [number, number][] {
  return isCustomStageShape(layout)
    ? defaultCustomStageOutline(layout)
    : defaultRectangleStageOutline(layout);
}

function edgeMidpoint(a: StagePoint, b: StagePoint): StagePoint {
  return { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
}

/** Ребро, обращённое к залу (максимальный Z середины). */
export function guessProsceniumEdgeIndex(points: StagePoint[]): number {
  if (points.length < 2) return 0;
  let bestIndex = 0;
  let bestZ = -Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    const mid = edgeMidpoint(points[i], points[j]);
    if (mid.z > bestZ) {
      bestZ = mid.z;
      bestIndex = i;
    }
  }
  return bestIndex;
}

export function resolveStageOutlinePoints(layout: TheaterLayout): StagePoint[] {
  if (Array.isArray(layout.stageOutline) && layout.stageOutline.length >= MIN_STAGE_OUTLINE_POINTS) {
    return stagePointsFromOutline(layout.stageOutline);
  }
  return stagePointsFromOutline(defaultOutlineForLayout(layout));
}

export function resolveStageOutlineOpenEdges(layout: TheaterLayout, points: StagePoint[]): number[] {
  if (Array.isArray(layout.stageOutlineOpenEdges) && layout.stageOutlineOpenEdges.length > 0) {
    return layout.stageOutlineOpenEdges.filter(
      (index) => index >= 0 && index < points.length,
    );
  }
  return [guessProsceniumEdgeIndex(points)];
}

export function normalizeStageOutlineFields(
  layout: TheaterLayout,
): Pick<TheaterLayout, "stageOutline" | "stageOutlineOpenEdges"> {
  if (layout.stageShape !== "custom") {
    return {
      stageOutline: layout.stageOutline,
      stageOutlineOpenEdges: layout.stageOutlineOpenEdges,
    };
  }

  const hasValidOutline =
    Array.isArray(layout.stageOutline) && layout.stageOutline.length >= 4;
  const source = hasValidOutline ? layout.stageOutline! : defaultCustomStageOutline(layout);

  const outline = source
    .slice(0, MAX_STAGE_OUTLINE_POINTS)
    .map(([x, z]) => clampOutlinePoint(x, z, layout, { unbounded: true }));

  const points = stagePointsFromOutline(outline);
  const openEdges = resolveStageOutlineOpenEdges(layout, points).filter(
    (index) => index >= 0 && index < outline.length,
  );

  let stageOutlineOpenEdges: number[];
  if (openEdges.length > 0) {
    stageOutlineOpenEdges = openEdges;
  } else if (!hasValidOutline && outline.length === 8) {
    stageOutlineOpenEdges = defaultCustomStageOutlineOpenEdges();
  } else {
    stageOutlineOpenEdges = [guessProsceniumEdgeIndex(points)];
  }

  return {
    stageOutline: outline,
    stageOutlineOpenEdges,
  };
}

export function hitTestStageOutlineVertex(
  worldX: number,
  worldZ: number,
  layout: TheaterLayout,
  threshold = 0.45,
): number | null {
  const points = resolveStageOutlinePoints(layout);
  let bestIndex: number | null = null;
  let bestDist = threshold;
  points.forEach((point, index) => {
    const dist = Math.hypot(worldX - point.x, worldZ - point.z);
    if (dist <= bestDist) {
      bestDist = dist;
      bestIndex = index;
    }
  });
  return bestIndex;
}

export function moveStageOutlineVertex(
  layout: TheaterLayout,
  vertexIndex: number,
  worldX: number,
  worldZ: number,
): [number, number][] {
  const outline = resolveStageOutlinePoints(layout).map((point) => [point.x, point.z] as [number, number]);
  if (vertexIndex < 0 || vertexIndex >= outline.length) return outline;
  outline[vertexIndex] = clampOutlinePoint(worldX, worldZ, layout, { unbounded: true });
  return outline;
}

export function appendStageOutlinePoint(
  layout: TheaterLayout,
  worldX: number,
  worldZ: number,
): [number, number][] {
  return insertStageOutlinePointAtClick(layout, worldX, worldZ).stageOutline ?? [];
}

function findNearestOutlineEdgeIndex(points: StagePoint[], px: number, pz: number): number {
  let bestIndex = 0;
  let bestDist = Infinity;
  for (let i = 0; i < points.length; i += 1) {
    const j = (i + 1) % points.length;
    const dist = distancePointToSegment(
      px,
      pz,
      points[i].x,
      points[i].z,
      points[j].x,
      points[j].z,
    );
    if (dist < bestDist) {
      bestDist = dist;
      bestIndex = i;
    }
  }
  return bestIndex;
}

/** Вставляет вершину на ближайшее ребро контура (в координатах клика). */
export function insertStageOutlinePointAtClick(
  layout: TheaterLayout,
  worldX: number,
  worldZ: number,
): Pick<TheaterLayout, "stageOutline" | "stageOutlineOpenEdges"> & {
  insertedVertexIndex: number;
} {
  const outline = resolveStageOutlinePoints(layout).map(
    (point) => [point.x, point.z] as [number, number],
  );
  const openEdges = resolveStageOutlineOpenEdges(layout, stagePointsFromOutline(outline));

  if (outline.length >= MAX_STAGE_OUTLINE_POINTS) {
    return {
      stageOutline: outline,
      stageOutlineOpenEdges: openEdges,
      insertedVertexIndex: -1,
    };
  }

  const point = clampOutlinePoint(worldX, worldZ, layout, { unbounded: true });
  const points = stagePointsFromOutline(outline);
  const edgeIndex = findNearestOutlineEdgeIndex(points, point[0], point[1]);
  const insertIndex = edgeIndex + 1;

  const nextOutline = [
    ...outline.slice(0, insertIndex),
    point,
    ...outline.slice(insertIndex),
  ];

  const nextOpenEdges = openEdges
    .map((index) => (index >= insertIndex ? index + 1 : index))
    .filter((index) => index >= 0 && index < nextOutline.length);

  return {
    stageOutline: nextOutline,
    stageOutlineOpenEdges:
      nextOpenEdges.length > 0
        ? nextOpenEdges
        : [guessProsceniumEdgeIndex(stagePointsFromOutline(nextOutline))],
    insertedVertexIndex: insertIndex,
  };
}

export function removeLastStageOutlinePoint(layout: TheaterLayout): [number, number][] {
  const outline = resolveStageOutlinePoints(layout).map((point) => [point.x, point.z] as [number, number]);
  if (outline.length <= MIN_STAGE_OUTLINE_POINTS) return outline;
  return outline.slice(0, -1);
}

export function removeStageOutlineVertex(
  layout: TheaterLayout,
  vertexIndex: number,
): Pick<TheaterLayout, "stageOutline" | "stageOutlineOpenEdges"> | null {
  const outline = resolveStageOutlinePoints(layout).map(
    (point) => [point.x, point.z] as [number, number],
  );
  if (vertexIndex < 0 || vertexIndex >= outline.length) return null;
  if (outline.length <= MIN_STAGE_OUTLINE_POINTS) return null;

  const nextOutline = outline.filter((_, index) => index !== vertexIndex);
  const points = stagePointsFromOutline(nextOutline);
  return {
    stageOutline: nextOutline,
    stageOutlineOpenEdges: [guessProsceniumEdgeIndex(points)],
  };
}

export function buildCustomStageWallEdgeChains(
  layout: TheaterLayout,
): { id: string; points: StagePoint[] }[] {
  const points = resolveStageOutlinePoints(layout);
  const openEdges = new Set(resolveStageOutlineOpenEdges(layout, points));
  const chains: { id: string; points: StagePoint[] }[] = [];

  for (let i = 0; i < points.length; i += 1) {
    if (openEdges.has(i)) continue;
    const j = (i + 1) % points.length;
    chains.push({
      id: `edge-${i}`,
      points: [points[i], points[j]],
    });
  }
  return chains;
}

export function buildCustomStageOutlinePathPoints(layout: TheaterLayout): StagePoint[] {
  return resolveStageOutlinePoints(layout);
}

export function getStageOutlineCentroid(outline: [number, number][]): [number, number] {
  if (outline.length === 0) return [0, 0];
  let sumX = 0;
  let sumZ = 0;
  for (const [x, z] of outline) {
    sumX += x;
    sumZ += z;
  }
  return [sumX / outline.length, sumZ / outline.length];
}

/** Равномерное масштабирование контура относительно якоря (центр масс). */
export function scaleStageOutlineUniform(
  outline: [number, number][],
  scale: number,
  anchor: [number, number],
): [number, number][] {
  if (!Number.isFinite(scale) || scale <= 0) return outline;
  const [ax, az] = anchor;
  return outline.map(([x, z]) => [
    roundM(ax + (x - ax) * scale),
    roundM(az + (z - az) * scale),
  ]);
}

/** Масштаб контура при смене габаритов зала (форма сохраняется). */
export function scaleStageOutlineForHallResize(
  layout: TheaterLayout,
  newHallWidth: number,
  newHallDepth: number,
): [number, number][] | undefined {
  const outline = layout.stageOutline;
  if (!outline || outline.length < MIN_STAGE_OUTLINE_POINTS) return undefined;
  if (layout.hallWidth <= 0 || layout.hallDepth <= 0) return undefined;
  const scaleX = newHallWidth / layout.hallWidth;
  const scaleZ = newHallDepth / layout.hallDepth;
  const scale = Math.min(scaleX, scaleZ);
  const anchor = getStageOutlineCentroid(outline);
  return scaleStageOutlineUniform(outline, scale, anchor);
}

function outlineBoundingBox(outline: [number, number][]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    width: maxX - minX,
    depth: maxZ - minZ,
  };
}

/** Сдвиг контура: центр по X, открытая сторона — к линии зрителей. */
export function alignStageOutlineToHall(
  outline: [number, number][],
  layout: TheaterLayout,
): [number, number][] {
  if (outline.length === 0) return outline;

  const targetFrontZ = getStageFrontZ(layout);
  const halfD = layout.hallDepth / 2;
  const targetBackZ = -halfD + METRIC.backClearance * 0.35;
  const marginFront = 0.12;

  const openEdgeIndices =
    Array.isArray(layout.stageOutlineOpenEdges) && layout.stageOutlineOpenEdges.length > 0
      ? layout.stageOutlineOpenEdges.filter(
          (index) => index >= 0 && index < outline.length,
        )
      : [];

  let frontRefZ: number;
  let frontRefX = 0;
  if (openEdgeIndices.length > 0) {
    let sumZ = 0;
    let sumX = 0;
    let count = 0;
    for (const i of openEdgeIndices) {
      const j = (i + 1) % outline.length;
      sumZ += (outline[i][1] + outline[j][1]) / 2;
      sumX += (outline[i][0] + outline[j][0]) / 2;
      count += 1;
    }
    frontRefZ = sumZ / count;
    frontRefX = sumX / count;
  } else {
    const bbox = outlineBoundingBox(outline);
    frontRefZ = bbox.maxZ;
    frontRefX = (bbox.minX + bbox.maxX) / 2;
  }

  const deltaZ = targetFrontZ - marginFront - frontRefZ;
  const deltaX = -frontRefX;
  let shifted = outline.map(([x, z]) => [
    roundM(x + deltaX),
    roundM(z + deltaZ),
  ]);

  const after = outlineBoundingBox(shifted as [number, number][]);
  const overflowBack = after.minZ - targetBackZ;
  if (overflowBack < -0.08) {
    shifted = shifted.map(([x, z]) => [x, roundM(z - overflowBack)]);
  }

  return shifted as [number, number][];
}

/**
 * Вписывает нарисованный контур в габариты зала (серый прямоугольник hallWidth × hallDepth).
 * Подходит и для периметра всего театра, и для произвольной формы стен внутри зала.
 */
export function fitStageOutlineToHallBounds(
  outline: [number, number][],
  layout: TheaterLayout,
): [number, number][] {
  if (outline.length < MIN_STAGE_OUTLINE_POINTS) return outline;

  const bbox = outlineBoundingBox(outline);
  const margin = 0.25;
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const targetMinX = -halfW + margin;
  const targetMaxX = halfW - margin;
  const targetMinZ = -halfD + margin;
  const targetMaxZ = halfD - margin;

  if (targetMaxX <= targetMinX || targetMaxZ <= targetMinZ) {
    return alignStageOutlineToHall(outline, layout);
  }

  const safeWidth = Math.max(bbox.width, 1e-6);
  const safeDepth = Math.max(bbox.depth, 1e-6);

  return outline.map(([x, z]) => {
    const tx = bbox.width < 1e-6 ? 0.5 : (x - bbox.minX) / safeWidth;
    const tz = bbox.depth < 1e-6 ? 0.5 : (z - bbox.minZ) / safeDepth;
    return [
      roundM(targetMinX + tx * (targetMaxX - targetMinX)),
      roundM(targetMinZ + tz * (targetMaxZ - targetMinZ)),
    ];
  });
}
