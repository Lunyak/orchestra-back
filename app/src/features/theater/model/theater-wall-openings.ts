import type {
  TheaterDoorWall,
  TheaterLayout,
  TheaterWallOpening,
} from "../../../shared/types/script";
import { roundM } from "./theater-metrics";
import {
  distancePointToWallChain,
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

export const THEATER_OPENING_WALL_LABELS: Record<TheaterDoorWall, string> = {
  left: "Левая",
  right: "Правая",
  back: "Задняя (сцена)",
  front: "Передняя (зал)",
};

export const OPENING_WIDTH_LIMITS = { min: 0.6, max: 6 } as const;
export const OPENING_HEIGHT_LIMITS = { min: 0.6, max: 8 } as const;

const DEFAULT_OPENING_WIDTH = 1.5;
const DEFAULT_OPENING_HEIGHT = 2.2;
const DEFAULT_OPENING_SILL = 0;

function resolveOpeningId(raw: unknown, fallback: number): number {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : fallback;
}

function parseOpeningWall(raw: unknown): TheaterDoorWall {
  const value = String(raw ?? "left");
  if (value === "right" || value === "back" || value === "front") return value;
  return "left";
}

function openingsOverlap(a: TheaterWallOpening, b: TheaterWallOpening): boolean {
  if (a.wall !== b.wall) return false;
  const gap = 0.15;
  const a0 = a.pos - a.width / 2;
  const a1 = a.pos + a.width / 2;
  const b0 = b.pos - b.width / 2;
  const b1 = b.pos + b.width / 2;
  return a0 < b1 + gap && b0 < a1 + gap;
}

export function clampWallOpening(
  opening: TheaterWallOpening,
  layout: TheaterLayout,
): TheaterWallOpening {
  const geom = resolveStageGeometry(layout);
  const halfW = layout.hallWidth / 2;
  const width = roundM(clamp(opening.width, OPENING_WIDTH_LIMITS.min, OPENING_WIDTH_LIMITS.max));
  const sill = roundM(clamp(opening.sill ?? 0, 0, Math.max(0, layout.wallHeight - 0.7)));
  const maxHeight = Math.max(OPENING_HEIGHT_LIMITS.min, layout.wallHeight - sill - 0.05);
  const height = roundM(
    clamp(opening.height, OPENING_HEIGHT_LIMITS.min, Math.min(OPENING_HEIGHT_LIMITS.max, maxHeight)),
  );
  const half = width / 2;
  const margin = 0.25;

  let pos = opening.pos;
  if (opening.wall === "left" || opening.wall === "right") {
    const { min, max } = getStageWallSpanZ(geom);
    pos = roundM(clamp(opening.pos, min + half + margin, max - half - margin));
  } else if (opening.wall === "back") {
    const { min, max } = getStageBackWallSpanX(geom);
    pos = roundM(clamp(opening.pos, min + half + margin, max - half - margin));
  } else {
    pos = roundM(clamp(opening.pos, -halfW + half + margin, halfW - half - margin));
  }

  return {
    ...opening,
    wall: opening.wall,
    pos,
    width,
    height,
    sill,
  };
}

export function getOpeningPosBounds(
  opening: Pick<TheaterWallOpening, "wall" | "width">,
  layout: TheaterLayout,
): { min: number; max: number } {
  const geom = resolveStageGeometry(layout);
  const half = clamp(opening.width, OPENING_WIDTH_LIMITS.min, OPENING_WIDTH_LIMITS.max) / 2;
  const margin = 0.25;
  if (opening.wall === "left" || opening.wall === "right") {
    const span = getStageWallSpanZ(geom);
    return {
      min: roundM(span.min + half + margin),
      max: roundM(span.max - half - margin),
    };
  }
  if (opening.wall === "back") {
    const span = getStageBackWallSpanX(geom);
    return {
      min: roundM(span.min + half + margin),
      max: roundM(span.max - half - margin),
    };
  }
  const halfW = layout.hallWidth / 2;
  return {
    min: roundM(-halfW + half + margin),
    max: roundM(halfW - half - margin),
  };
}

export function resolveLayoutWallOpenings(layout: TheaterLayout): TheaterWallOpening[] {
  if (!Array.isArray(layout.wallOpenings)) return [];
  return layout.wallOpenings;
}

export function findLayoutWallOpening(
  layout: TheaterLayout,
  openingId: number,
): TheaterWallOpening | undefined {
  return resolveLayoutWallOpenings(layout).find((item) => item.id === openingId);
}

export function getOpeningCenterOnWall(
  opening: TheaterWallOpening,
  layout: TheaterLayout,
): StagePoint | null {
  const geom = resolveStageGeometry(layout);
  if (opening.wall === "back") {
    return { x: opening.pos, z: geom.backZ };
  }
  if (opening.wall === "left") {
    return { x: getStageSideWallX("left", opening.pos, geom), z: opening.pos };
  }
  if (opening.wall === "right") {
    return { x: getStageSideWallX("right", opening.pos, geom), z: opening.pos };
  }
  if (opening.wall === "front") {
    return { x: opening.pos, z: geom.halfD };
  }
  return null;
}

export function getOpeningHighlightPose(
  opening: TheaterWallOpening,
  layout: TheaterLayout,
): { x: number; z: number; rotationY: number } | null {
  const center = getOpeningCenterOnWall(opening, layout);
  if (!center) return null;
  return placeOpeningOnWall(opening.wall, center, 0.06);
}

export function normalizeWallOpenings(
  openings: TheaterWallOpening[],
  layout: TheaterLayout,
): TheaterWallOpening[] {
  const normalized = openings.map((opening, index) =>
    clampWallOpening(
      {
        id: resolveOpeningId(opening.id, index + 1),
        wall: parseOpeningWall(opening.wall),
        pos: Number.isFinite(opening.pos) ? opening.pos : 0,
        width: Number.isFinite(opening.width) ? opening.width : DEFAULT_OPENING_WIDTH,
        height: Number.isFinite(opening.height) ? opening.height : DEFAULT_OPENING_HEIGHT,
        sill: Number.isFinite(opening.sill) ? opening.sill : DEFAULT_OPENING_SILL,
      },
      layout,
    ),
  );

  const sorted = [...normalized].sort((a, b) => a.id - b.id);
  const usedIds = new Set<number>();
  for (const opening of sorted) {
    let id = opening.id;
    while (usedIds.has(id)) id += 1;
    opening.id = id;
    usedIds.add(id);
  }

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (openingsOverlap(sorted[i], sorted[j])) {
        sorted[j] = clampWallOpening(
          { ...sorted[j], pos: sorted[j].pos + sorted[j].width + 0.2 },
          layout,
        );
      }
    }
  }

  return sorted;
}

export function normalizeLayoutWallOpeningFields(
  layout: TheaterLayout,
): Pick<TheaterLayout, "wallOpenings"> {
  const source = resolveLayoutWallOpenings(layout);
  return { wallOpenings: normalizeWallOpenings(source, layout) };
}

function suggestOpeningPos(
  wall: TheaterDoorWall,
  openings: TheaterWallOpening[],
  layout: TheaterLayout,
): number {
  const geom = resolveStageGeometry(layout);
  const onWall = openings.filter((item) => item.wall === wall);
  const candidates =
    wall === "left" || wall === "right"
      ? [0, 2, -2, 3.5, -3.5, 1, -1, 4, -4]
      : [0, 2, -2, 3, -3, 1, -1];
  for (const candidate of candidates) {
    const probe: TheaterWallOpening = {
      id: -1,
      wall,
      pos: candidate,
      width: DEFAULT_OPENING_WIDTH,
      height: DEFAULT_OPENING_HEIGHT,
      sill: DEFAULT_OPENING_SILL,
    };
    if (!onWall.some((item) => openingsOverlap(item, probe))) {
      return clampWallOpening(probe, layout).pos;
    }
  }
  const halfSpan =
    wall === "left" || wall === "right"
      ? (geom.prosceniumZ - geom.backZ) / 2
      : (wall === "back" ? geom.stageBackWidth : layout.hallWidth) / 2;
  return roundM(Math.max(-halfSpan + 1, Math.min(halfSpan - 1, onWall.length * 1.5)));
}

export function createLayoutWallOpening(
  layout: TheaterLayout,
  wall: TheaterDoorWall = "left",
  pos?: number,
): TheaterWallOpening[] {
  const existing = resolveLayoutWallOpenings(layout);
  const nextId = existing.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
  const nextPos =
    typeof pos === "number" && Number.isFinite(pos)
      ? pos
      : suggestOpeningPos(wall, existing, layout);
  const opening = clampWallOpening(
    {
      id: nextId,
      wall,
      pos: nextPos,
      width: DEFAULT_OPENING_WIDTH,
      height: DEFAULT_OPENING_HEIGHT,
      sill: DEFAULT_OPENING_SILL,
    },
    layout,
  );
  return normalizeWallOpenings([...existing, opening], layout);
}

export function removeLayoutWallOpening(
  layout: TheaterLayout,
  openingId: number,
): TheaterWallOpening[] {
  return normalizeWallOpenings(
    resolveLayoutWallOpenings(layout).filter((item) => item.id !== openingId),
    layout,
  );
}

export function patchLayoutWallOpening(
  layout: TheaterLayout,
  openingId: number,
  patch: Partial<Pick<TheaterWallOpening, "pos" | "width" | "height" | "wall" | "sill">>,
): TheaterWallOpening[] {
  return normalizeWallOpenings(
    resolveLayoutWallOpenings(layout).map((item) =>
      item.id === openingId ? { ...item, ...patch } : item,
    ),
    layout,
  );
}

export type OpeningPlanHit = {
  openingId: number;
  part: "move" | "width-start" | "width-end";
};

function hitTestSingleOpeningOnPlan(
  worldX: number,
  worldZ: number,
  opening: TheaterWallOpening,
  layout: TheaterLayout,
): OpeningPlanHit | null {
  const geom = resolveStageGeometry(layout);
  const halfD = layout.hallDepth / 2;
  const half = opening.width / 2;
  const edgeThreshold = Math.max(0.3, half * 0.35);
  const thresholdNormal = Math.max(0.55, layout.hallWidth * 0.05);
  const chains = resolveStageWallChains(layout);

  if (opening.wall === "left" || opening.wall === "right" || opening.wall === "back") {
    const chain = chains.find((item) => item.id === opening.wall);
    if (!chain || distancePointToWallChain(worldX, worldZ, chain) > thresholdNormal) {
      return null;
    }
  }

  if (opening.wall === "left" || opening.wall === "right") {
    const axis0 = opening.pos - half;
    const axis1 = opening.pos + half;
    if (Math.abs(worldZ - axis0) <= edgeThreshold) {
      return { openingId: opening.id, part: "width-start" };
    }
    if (Math.abs(worldZ - axis1) <= edgeThreshold) {
      return { openingId: opening.id, part: "width-end" };
    }
    if (worldZ >= axis0 - edgeThreshold && worldZ <= axis1 + edgeThreshold) {
      return { openingId: opening.id, part: "move" };
    }
    return null;
  }

  if (opening.wall === "back") {
    if (Math.abs(worldZ - geom.backZ) > thresholdNormal) return null;
    const axis0 = opening.pos - half;
    const axis1 = opening.pos + half;
    if (Math.abs(worldX - axis0) <= edgeThreshold) {
      return { openingId: opening.id, part: "width-start" };
    }
    if (Math.abs(worldX - axis1) <= edgeThreshold) {
      return { openingId: opening.id, part: "width-end" };
    }
    if (worldX >= axis0 - edgeThreshold && worldX <= axis1 + edgeThreshold) {
      return { openingId: opening.id, part: "move" };
    }
    return null;
  }

  if (Math.abs(worldZ - halfD) > thresholdNormal) return null;
  const axis0 = opening.pos - half;
  const axis1 = opening.pos + half;
  if (Math.abs(worldX - axis0) <= edgeThreshold) {
    return { openingId: opening.id, part: "width-start" };
  }
  if (Math.abs(worldX - axis1) <= edgeThreshold) {
    return { openingId: opening.id, part: "width-end" };
  }
  if (worldX >= axis0 - edgeThreshold && worldX <= axis1 + edgeThreshold) {
    return { openingId: opening.id, part: "move" };
  }
  return null;
}

export function hitTestOpeningsOnPlan(
  worldX: number,
  worldZ: number,
  layout: TheaterLayout,
): OpeningPlanHit | null {
  const openings = resolveLayoutWallOpenings(layout);
  for (let index = openings.length - 1; index >= 0; index -= 1) {
    const hit = hitTestSingleOpeningOnPlan(worldX, worldZ, openings[index], layout);
    if (hit) return hit;
  }
  return null;
}

export function applyOpeningDragPreview(
  layout: TheaterLayout,
  openingId: number,
  kind: OpeningPlanHit["part"],
  worldX: number,
  worldZ: number,
): TheaterWallOpening[] | null {
  const opening = findLayoutWallOpening(layout, openingId);
  if (!opening) return null;
  const axis = opening.wall === "left" || opening.wall === "right" ? worldZ : worldX;
  if (kind === "move") {
    return patchLayoutWallOpening(layout, openingId, { pos: axis });
  }
  if (kind === "width-start" || kind === "width-end") {
    const width =
      kind === "width-start"
        ? Math.max(OPENING_WIDTH_LIMITS.min, Math.min(OPENING_WIDTH_LIMITS.max, 2 * (opening.pos - axis)))
        : Math.max(OPENING_WIDTH_LIMITS.min, Math.min(OPENING_WIDTH_LIMITS.max, 2 * (axis - opening.pos)));
    return patchLayoutWallOpening(layout, openingId, { width });
  }
  return null;
}
