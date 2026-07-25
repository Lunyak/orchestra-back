import type {
  TheaterDoor,
  TheaterDoorStyle,
  TheaterDoorWall,
  TheaterLayout,
} from "../../../shared/types/script";
import { roundM } from "./theater-metrics";
import {
  distancePointToWallChain,
  getStageBackWallSpanX,
  getStageWallSpanZ,
  resolveStageGeometry,
  resolveStageWallChains,
} from "./theater-stage-geometry";

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export const THEATER_DOOR_WALL_LABELS: Record<TheaterDoorWall, string> = {
  left: "Левая",
  right: "Правая",
  back: "Задняя (сцена)",
  front: "Передняя (зал)",
};

export const THEATER_DOOR_STYLE_LABELS: Record<TheaterDoorStyle, string> = {
  wood: "Деревянная",
  metal: "Металлическая",
};

const DEFAULT_DOOR_WIDTH = 1.2;
const DEFAULT_DOOR_HEIGHT = 2.2;
const DEFAULT_DOOR_STYLE: TheaterDoorStyle = "wood";

function clampDoor(
  door: TheaterDoor,
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth" | "wallHeight">,
): TheaterDoor {
  const geom = resolveStageGeometry(layout as TheaterLayout);
  const halfD = layout.hallDepth / 2;
  const halfW = layout.hallWidth / 2;
  const width = roundM(clamp(door.width, 0.8, 3));
  const height = roundM(clamp(door.height, 2, layout.wallHeight - 0.1));
  const half = width / 2;
  const margin = 0.25;

  let pos = door.pos;
  if (door.wall === "left" || door.wall === "right") {
    const { min, max } = getStageWallSpanZ(geom);
    pos = roundM(clamp(door.pos, min + half + margin, max - half - margin));
  } else if (door.wall === "back") {
    const { min, max } = getStageBackWallSpanX(geom);
    pos = roundM(clamp(door.pos, min + half + margin, max - half - margin));
  } else {
    pos = roundM(clamp(door.pos, -halfW + half + margin, halfW - half - margin));
  }

  return {
    ...door,
    wall: door.wall,
    width,
    height,
    pos,
    style: door.style === "metal" ? "metal" : "wood",
  };
}

function doorsOverlap(a: TheaterDoor, b: TheaterDoor): boolean {
  if (a.wall !== b.wall) return false;
  const gap = 0.15;
  const a0 = a.pos - a.width / 2;
  const a1 = a.pos + a.width / 2;
  const b0 = b.pos - b.width / 2;
  const b1 = b.pos + b.width / 2;
  return a0 < b1 + gap && b0 < a1 + gap;
}

function resolveDoorId(raw: unknown, fallback: number): number {
  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? Math.trunc(id) : fallback;
}

function parseDoorWall(raw: unknown): TheaterDoorWall {
  const value = String(raw ?? "left");
  if (value === "right" || value === "back" || value === "front") return value;
  return "left";
}

function parseDoorStyle(raw: unknown): TheaterDoorStyle {
  return raw === "metal" ? "metal" : DEFAULT_DOOR_STYLE;
}

export function doorFromLegacyLayout(
  layout: Pick<TheaterLayout, "doorWidth" | "doorHeight" | "doorZ">,
): TheaterDoor {
  return {
    id: 1,
    wall: "left",
    pos: layout.doorZ,
    width: layout.doorWidth,
    height: layout.doorHeight,
    style: DEFAULT_DOOR_STYLE,
  };
}

export function resolveLayoutDoors(layout: TheaterLayout): TheaterDoor[] {
  if (Array.isArray(layout.doors) && layout.doors.length > 0) {
    return layout.doors;
  }
  return [doorFromLegacyLayout(layout)];
}

export function normalizeDoors(
  doors: TheaterDoor[],
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth" | "wallHeight">,
): TheaterDoor[] {
  const normalized = doors.map((door, index) =>
    clampDoor(
      {
        id: resolveDoorId(door.id, index + 1),
        wall: parseDoorWall(door.wall),
        pos: Number.isFinite(door.pos) ? door.pos : 0,
        width: Number.isFinite(door.width) ? door.width : DEFAULT_DOOR_WIDTH,
        height: Number.isFinite(door.height) ? door.height : DEFAULT_DOOR_HEIGHT,
        style: parseDoorStyle(door.style),
      },
      layout,
    ),
  );

  const sorted = [...normalized].sort((a, b) => a.id - b.id);
  const usedIds = new Set<number>();
  for (const door of sorted) {
    let id = door.id;
    while (usedIds.has(id)) id += 1;
    door.id = id;
    usedIds.add(id);
  }

  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length; j += 1) {
      if (doorsOverlap(sorted[i], sorted[j])) {
        sorted[j] = clampDoor(
          {
            ...sorted[j],
            pos: sorted[j].pos + sorted[j].width + 0.2,
          },
          layout,
        );
      }
    }
  }

  return sorted;
}

export function syncLegacyDoorFields(
  doors: TheaterDoor[],
): Pick<TheaterLayout, "doorWidth" | "doorHeight" | "doorZ"> {
  const primary =
    doors.find((item) => item.wall === "left") ?? doors[0] ?? doorFromLegacyLayout({
      doorWidth: DEFAULT_DOOR_WIDTH,
      doorHeight: DEFAULT_DOOR_HEIGHT,
      doorZ: 0,
    });
  return {
    doorWidth: primary.width,
    doorHeight: primary.height,
    doorZ: primary.pos,
  };
}

export function normalizeLayoutDoorsFields(
  layout: TheaterLayout,
): Pick<TheaterLayout, "doors" | "doorWidth" | "doorHeight" | "doorZ"> {
  const source =
    Array.isArray(layout.doors) && layout.doors.length > 0
      ? layout.doors
      : [doorFromLegacyLayout(layout)];
  const doors = normalizeDoors(source, layout);
  return {
    doors,
    ...syncLegacyDoorFields(doors),
  };
}

export function patchLayoutDoor(
  layout: TheaterLayout,
  doorId: number,
  patch: Partial<Pick<TheaterDoor, "pos" | "width" | "height" | "wall" | "style">>,
): TheaterDoor[] {
  return normalizeDoors(
    resolveLayoutDoors(layout).map((door) =>
      door.id === doorId ? { ...door, ...patch } : door,
    ),
    layout,
  );
}

function suggestDoorPos(
  wall: TheaterDoorWall,
  doors: TheaterDoor[],
  layout: Pick<
    TheaterLayout,
    "hallDepth" | "hallWidth" | "audienceStartZ" | "stageBackWidth" | "prosceniumWidth"
  >,
): number {
  const geom = resolveStageGeometry(layout as TheaterLayout);
  const onWall = doors.filter((item) => item.wall === wall);
  const candidates =
    wall === "left" || wall === "right"
      ? [0, 2, -2, 3.5, -3.5, 1, -1, 4, -4]
      : [0, 2, -2, 3, -3, 1, -1];
  for (const candidate of candidates) {
    const probe: TheaterDoor = {
      id: -1,
      wall,
      pos: candidate,
      width: DEFAULT_DOOR_WIDTH,
      height: DEFAULT_DOOR_HEIGHT,
    };
    if (!onWall.some((item) => doorsOverlap(item, probe))) {
      return clampDoor(probe, { ...layout, wallHeight: 4 }).pos;
    }
  }
  const halfSpan =
    wall === "left" || wall === "right"
      ? (geom.prosceniumZ - geom.backZ) / 2
      : (wall === "back" ? geom.stageBackWidth : layout.hallWidth) / 2;
  return roundM(Math.max(-halfSpan + 1, Math.min(halfSpan - 1, onWall.length * 1.5)));
}

export function createLayoutDoor(
  layout: TheaterLayout,
  wall: TheaterDoorWall = "left",
): TheaterDoor[] {
  const existing = resolveLayoutDoors(layout);
  const nextId = existing.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
  const door = clampDoor(
    {
      id: nextId,
      wall,
      pos: suggestDoorPos(wall, existing, layout),
      width: DEFAULT_DOOR_WIDTH,
      height: DEFAULT_DOOR_HEIGHT,
      style: DEFAULT_DOOR_STYLE,
    },
    layout,
  );
  return normalizeDoors([...existing, door], layout);
}

export function removeLayoutDoor(layout: TheaterLayout, doorId: number): TheaterDoor[] {
  const next = resolveLayoutDoors(layout).filter((door) => door.id !== doorId);
  if (next.length === 0) {
    return normalizeDoors([doorFromLegacyLayout(layout)], layout);
  }
  return normalizeDoors(next, layout);
}

export type DoorPlanHit = {
  doorId: number;
  part: "move" | "width-start" | "width-end";
};

export function hitTestDoorsOnPlan(
  worldX: number,
  worldZ: number,
  layout: TheaterLayout,
): DoorPlanHit | null {
  const doors = resolveLayoutDoors(layout);
  for (let index = doors.length - 1; index >= 0; index -= 1) {
    const hit = hitTestSingleDoorOnPlan(worldX, worldZ, doors[index], layout);
    if (hit) return hit;
  }
  return null;
}

function hitTestSingleDoorOnPlan(
  worldX: number,
  worldZ: number,
  door: TheaterDoor,
  layout: TheaterLayout,
): DoorPlanHit | null {
  const geom = resolveStageGeometry(layout);
  const halfD = layout.hallDepth / 2;
  const half = door.width / 2;
  const edgeThreshold = Math.max(0.3, half * 0.35);
  const thresholdNormal = Math.max(0.55, layout.hallWidth * 0.05);
  const chains = resolveStageWallChains(layout);

  if (door.wall === "left" || door.wall === "right" || door.wall === "back") {
    const chain = chains.find((item) => item.id === door.wall);
    if (!chain || distancePointToWallChain(worldX, worldZ, chain) > thresholdNormal) {
      return null;
    }
  }

  if (door.wall === "left" || door.wall === "right") {
    const axis0 = door.pos - half;
    const axis1 = door.pos + half;
    if (Math.abs(worldZ - axis0) <= edgeThreshold) {
      return { doorId: door.id, part: "width-start" };
    }
    if (Math.abs(worldZ - axis1) <= edgeThreshold) {
      return { doorId: door.id, part: "width-end" };
    }
    if (worldZ >= axis0 - edgeThreshold && worldZ <= axis1 + edgeThreshold) {
      return { doorId: door.id, part: "move" };
    }
    return null;
  }

  if (door.wall === "back") {
    if (Math.abs(worldZ - geom.backZ) > thresholdNormal) return null;
    const axis0 = door.pos - half;
    const axis1 = door.pos + half;
    if (Math.abs(worldX - axis0) <= edgeThreshold) {
      return { doorId: door.id, part: "width-start" };
    }
    if (Math.abs(worldX - axis1) <= edgeThreshold) {
      return { doorId: door.id, part: "width-end" };
    }
    if (worldX >= axis0 - edgeThreshold && worldX <= axis1 + edgeThreshold) {
      return { doorId: door.id, part: "move" };
    }
    return null;
  }

  if (Math.abs(worldZ - halfD) > thresholdNormal) return null;
  const axis0 = door.pos - half;
  const axis1 = door.pos + half;
  if (Math.abs(worldX - axis0) <= edgeThreshold) {
    return { doorId: door.id, part: "width-start" };
  }
  if (Math.abs(worldX - axis1) <= edgeThreshold) {
    return { doorId: door.id, part: "width-end" };
  }
  if (worldX >= axis0 - edgeThreshold && worldX <= axis1 + edgeThreshold) {
    return { doorId: door.id, part: "move" };
  }
  return null;
}

export function doorUsesAxisZ(wall: TheaterDoorWall): boolean {
  return wall === "left" || wall === "right";
}

export function findLayoutDoor(
  layout: TheaterLayout,
  doorId: number,
): TheaterDoor | undefined {
  return resolveLayoutDoors(layout).find((door) => door.id === doorId);
}

export function computeDoorMovePos(
  door: TheaterDoor,
  worldX: number,
  worldZ: number,
): number {
  return doorUsesAxisZ(door.wall) ? worldZ : worldX;
}

export function computeDoorWidthFromEdgeDrag(
  door: TheaterDoor,
  edgePos: number,
  edge: "width-start" | "width-end",
): number {
  return edge === "width-start"
    ? Math.max(0.8, Math.min(3, 2 * (door.pos - edgePos)))
    : Math.max(0.8, Math.min(3, 2 * (edgePos - door.pos)));
}

export function applyDoorDragPreview(
  layout: TheaterLayout,
  doorId: number,
  kind: DoorPlanHit["part"],
  worldX: number,
  worldZ: number,
): TheaterDoor[] | null {
  const door = findLayoutDoor(layout, doorId);
  if (!door) return null;
  const axis = computeDoorMovePos(door, worldX, worldZ);
  if (kind === "move") {
    return patchLayoutDoor(layout, doorId, { pos: axis });
  }
  if (kind === "width-start" || kind === "width-end") {
    return patchLayoutDoor(layout, doorId, {
      width: computeDoorWidthFromEdgeDrag(door, axis, kind),
    });
  }
  return null;
}
