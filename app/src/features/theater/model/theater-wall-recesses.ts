import type {
  TheaterLayout,
  TheaterWallRecess,
  TheaterWallRecessWall,
} from "../../../shared/types/script";
import { roundM } from "./theater-metrics";
import {
  getStageBackWallSpanX,
  getStageSideWallX,
  getStageWallSpanZ,
  placeOpeningOnWall,
  resolveStageGeometry,
  resolveStageWallChains,
  type StagePoint,
} from "./theater-stage-geometry";

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const THEATER_RECESS_WALL_LABELS: Record<TheaterWallRecessWall, string> = {
  left: "Левая",
  right: "Правая",
  back: "Задняя",
};

export function isTheaterWallRecessWall(
  wall: string,
): wall is TheaterWallRecessWall {
  return wall === "left" || wall === "right" || wall === "back";
}

const DEFAULT_RECESS_WIDTH = 1.5;
const DEFAULT_RECESS_DEPTH = 0.8;

function resolveRecessId(raw: unknown, fallback: number): number {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : fallback;
}

function parseRecessWall(raw: unknown): TheaterWallRecessWall {
  const value = String(raw ?? "left");
  if (value === "right" || value === "back") return value;
  return "left";
}

function recessesOverlap(a: TheaterWallRecess, b: TheaterWallRecess): boolean {
  if (a.wall !== b.wall) return false;
  const gap = 0.2;
  const a0 = a.pos - a.width / 2;
  const a1 = a.pos + a.width / 2;
  const b0 = b.pos - b.width / 2;
  const b1 = b.pos + b.width / 2;
  return a0 < b1 + gap && b0 < a1 + gap;
}

export function clampWallRecess(
  recess: TheaterWallRecess,
  layout: TheaterLayout,
): TheaterWallRecess {
  const geom = resolveStageGeometry(layout);
  const width = roundM(clamp(recess.width, 0.6, 4));
  const depth = roundM(clamp(recess.depth, 0.3, 2.5));
  const half = width / 2;
  const margin = 0.3;

  let pos = recess.pos;
  if (recess.wall === "left" || recess.wall === "right") {
    const { min, max } = getStageWallSpanZ(geom);
    pos = roundM(clamp(recess.pos, min + half + margin, max - half - margin));
  } else {
    const { min, max } = getStageBackWallSpanX(geom);
    pos = roundM(clamp(recess.pos, min + half + margin, max - half - margin));
  }

  return {
    ...recess,
    wall: recess.wall,
    pos,
    width,
    depth,
    filled: Boolean(recess.filled),
  };
}

export function getRecessPosBounds(
  recess: Pick<TheaterWallRecess, "wall" | "width">,
  layout: TheaterLayout,
): { min: number; max: number } {
  const geom = resolveStageGeometry(layout);
  const half = clamp(recess.width, 0.6, 4) / 2;
  const margin = 0.3;
  const span =
    recess.wall === "left" || recess.wall === "right"
      ? getStageWallSpanZ(geom)
      : getStageBackWallSpanX(geom);
  return {
    min: roundM(span.min + half + margin),
    max: roundM(span.max - half - margin),
  };
}

export function findLayoutWallRecess(
  layout: TheaterLayout,
  recessId: number,
): TheaterWallRecess | undefined {
  return resolveLayoutWallRecesses(layout).find((item) => item.id === recessId);
}

export function resolveLayoutWallRecesses(layout: TheaterLayout): TheaterWallRecess[] {
  if (!Array.isArray(layout.wallRecesses)) return [];
  return layout.wallRecesses;
}

export function getRecessCenterOnWall(
  recess: TheaterWallRecess,
  layout: TheaterLayout,
): StagePoint | null {
  const geom = resolveStageGeometry(layout);
  if (recess.wall === "back") {
    return { x: recess.pos, z: geom.backZ };
  }
  if (recess.wall === "left") {
    return { x: getStageSideWallX("left", recess.pos, geom), z: recess.pos };
  }
  if (recess.wall === "right") {
    return { x: getStageSideWallX("right", recess.pos, geom), z: recess.pos };
  }
  return null;
}

export function getRecessFillPose(
  recess: TheaterWallRecess,
  layout: TheaterLayout,
): { x: number; z: number; rotationY: number } | null {
  const mouth = getRecessCenterOnWall(recess, layout);
  if (!mouth) return null;
  return placeOpeningOnWall(recess.wall, mouth, recess.depth / 2);
}

export function normalizeWallRecesses(
  recesses: TheaterWallRecess[],
  layout: TheaterLayout,
): TheaterWallRecess[] {
  const normalized = recesses.map((recess, index) =>
    clampWallRecess(
      {
        id: resolveRecessId(recess.id, index + 1),
        wall: parseRecessWall(recess.wall),
        pos: Number.isFinite(recess.pos) ? recess.pos : 0,
        width: Number.isFinite(recess.width) ? recess.width : DEFAULT_RECESS_WIDTH,
        depth: Number.isFinite(recess.depth) ? recess.depth : DEFAULT_RECESS_DEPTH,
        filled: Boolean(recess.filled),
      },
      layout,
    ),
  );

  const sorted = [...normalized].sort((a, b) => a.id - b.id);
  const usedIds = new Set<number>();
  for (const recess of sorted) {
    let id = recess.id;
    while (usedIds.has(id)) id += 1;
    recess.id = id;
    usedIds.add(id);
  }

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (recessesOverlap(sorted[i], sorted[j])) {
        sorted[j] = clampWallRecess(
          { ...sorted[j], pos: sorted[j].pos + sorted[j].width + 0.25 },
          layout,
        );
      }
    }
  }

  return sorted;
}

export function normalizeLayoutWallRecessFields(
  layout: TheaterLayout,
): Pick<TheaterLayout, "wallRecesses"> {
  const source = resolveLayoutWallRecesses(layout);
  return { wallRecesses: normalizeWallRecesses(source, layout) };
}

export function createLayoutWallRecess(
  layout: TheaterLayout,
  wall: TheaterWallRecessWall = "left",
  pos?: number,
): TheaterWallRecess[] {
  const existing = resolveLayoutWallRecesses(layout);
  const nextId = existing.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
  const geom = resolveStageGeometry(layout);
  const defaultPos =
    typeof pos === "number" && Number.isFinite(pos)
      ? pos
      : wall === "back"
        ? 0
        : roundM((geom.backZ + geom.prosceniumZ) / 2);
  const recess = clampWallRecess(
    {
      id: nextId,
      wall,
      pos: defaultPos,
      width: DEFAULT_RECESS_WIDTH,
      depth: DEFAULT_RECESS_DEPTH,
    },
    layout,
  );
  return normalizeWallRecesses([...existing, recess], layout);
}

export function removeLayoutWallRecess(
  layout: TheaterLayout,
  recessId: number,
): TheaterWallRecess[] {
  return normalizeWallRecesses(
    resolveLayoutWallRecesses(layout).filter((item) => item.id !== recessId),
    layout,
  );
}

export function patchLayoutWallRecess(
  layout: TheaterLayout,
  recessId: number,
  patch: Partial<Pick<TheaterWallRecess, "pos" | "width" | "depth" | "wall" | "filled">>,
): TheaterWallRecess[] {
  return normalizeWallRecesses(
    resolveLayoutWallRecesses(layout).map((item) =>
      item.id === recessId ? { ...item, ...patch } : item,
    ),
    layout,
  );
}

export type RecessPlanHit = {
  recessId: number;
  part: "move" | "width-start" | "width-end";
};

function hitTestSingleRecessOnPlan(
  worldX: number,
  worldZ: number,
  recess: TheaterWallRecess,
  layout: TheaterLayout,
): RecessPlanHit | null {
  const chains = resolveStageWallChains(layout);
  const chain = chains.find((item) => item.id === recess.wall);
  if (!chain) return null;

  const half = recess.width / 2;
  const edgeThreshold = Math.max(0.28, half * 0.35);
  const thresholdNormal = Math.max(0.5, layout.hallWidth * 0.045);

  let minDist = Infinity;
  for (let i = 0; i < chain.points.length - 1; i += 1) {
    const a = chain.points[i];
    const b = chain.points[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const lenSq = dx * dx + dz * dz;
    if (lenSq < 1e-8) continue;
    let t = ((worldX - a.x) * dx + (worldZ - a.z) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
    const cx = a.x + t * dx;
    const cz = a.z + t * dz;
    minDist = Math.min(minDist, Math.hypot(worldX - cx, worldZ - cz));
  }
  if (minDist > thresholdNormal) return null;

  if (recess.wall === "left" || recess.wall === "right") {
    const axis0 = recess.pos - half;
    const axis1 = recess.pos + half;
    if (Math.abs(worldZ - axis0) <= edgeThreshold) {
      return { recessId: recess.id, part: "width-start" };
    }
    if (Math.abs(worldZ - axis1) <= edgeThreshold) {
      return { recessId: recess.id, part: "width-end" };
    }
    if (worldZ >= axis0 - edgeThreshold && worldZ <= axis1 + edgeThreshold) {
      return { recessId: recess.id, part: "move" };
    }
    return null;
  }

  const axis0 = recess.pos - half;
  const axis1 = recess.pos + half;
  if (Math.abs(worldX - axis0) <= edgeThreshold) {
    return { recessId: recess.id, part: "width-start" };
  }
  if (Math.abs(worldX - axis1) <= edgeThreshold) {
    return { recessId: recess.id, part: "width-end" };
  }
  if (worldX >= axis0 - edgeThreshold && worldX <= axis1 + edgeThreshold) {
    return { recessId: recess.id, part: "move" };
  }
  return null;
}

export function hitTestRecessesOnPlan(
  worldX: number,
  worldZ: number,
  layout: TheaterLayout,
): RecessPlanHit | null {
  const recesses = resolveLayoutWallRecesses(layout);
  for (let index = recesses.length - 1; index >= 0; index -= 1) {
    const hit = hitTestSingleRecessOnPlan(worldX, worldZ, recesses[index], layout);
    if (hit) return hit;
  }
  return null;
}

export function applyRecessDragPreview(
  layout: TheaterLayout,
  recessId: number,
  kind: RecessPlanHit["part"],
  worldX: number,
  worldZ: number,
): TheaterWallRecess[] | null {
  const recess = resolveLayoutWallRecesses(layout).find((item) => item.id === recessId);
  if (!recess) return null;
  const axis = recess.wall === "left" || recess.wall === "right" ? worldZ : worldX;
  if (kind === "move") {
    return patchLayoutWallRecess(layout, recessId, { pos: axis });
  }
  if (kind === "width-start" || kind === "width-end") {
    const width =
      kind === "width-start"
        ? Math.max(0.6, Math.min(4, 2 * (recess.pos - axis)))
        : Math.max(0.6, Math.min(4, 2 * (axis - recess.pos)));
    return patchLayoutWallRecess(layout, recessId, { width });
  }
  return null;
}
