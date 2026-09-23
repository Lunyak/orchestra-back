import type { TheaterDoorWall, TheaterLayout } from "../../../shared/types/script";
import { doorUsesAxisZ } from "./theater-doors";
import { resolveStageShape } from "./theater-stage-geometry";

export type TheaterObjectContextKind = "wall" | "door" | "floor" | "audience" | "recess" | "opening";

export type TheaterWallContextHit = {
  kind: "wall";
  wall: TheaterDoorWall;
  pos: number;
  clientX: number;
  clientY: number;
};

export type TheaterFloorContextHit = {
  kind: "floor";
  surface: "stage";
  clientX: number;
  clientY: number;
};

export type TheaterDoorContextHit = {
  kind: "door";
  doorId: number;
  clientX: number;
  clientY: number;
};

export type TheaterRecessContextHit = {
  kind: "recess";
  recessId: number;
  clientX: number;
  clientY: number;
};

export type TheaterOpeningContextHit = {
  kind: "opening";
  openingId: number;
  clientX: number;
  clientY: number;
};

export type TheaterAudienceContextHit = {
  kind: "audience";
  x: number;
  z: number;
  clientX: number;
  clientY: number;
};

export type TheaterObjectContextHit =
  | TheaterWallContextHit
  | TheaterFloorContextHit
  | TheaterDoorContextHit
  | TheaterRecessContextHit
  | TheaterOpeningContextHit
  | TheaterAudienceContextHit;

export function canAddTheaterLayoutDoors(layout: TheaterLayout): boolean {
  const shape = resolveStageShape(layout);
  return shape !== "custom" && shape !== "circle";
}

export function isTheaterDoorWall(value: string | undefined): value is TheaterDoorWall {
  return value === "left" || value === "right" || value === "back" || value === "front";
}

export const THEATER_PICK_WALL = "wall";
export const THEATER_PICK_DOOR = "door";
export const THEATER_PICK_FLOOR = "floor";
export const THEATER_PICK_AUDIENCE = "audience";
export const THEATER_PICK_RECESS = "recess";
export const THEATER_PICK_OPENING = "opening";

type TheaterRaycastObject = {
  userData: Record<string, unknown>;
  parent?: TheaterRaycastObject | null;
  isTransformControls?: boolean;
  isTransformControlsGizmo?: boolean;
  isTransformControlsPlane?: boolean;
};

type TheaterRaycastHit = {
  object: TheaterRaycastObject;
};

function isTransformGizmoObject(object: TheaterRaycastObject | null | undefined): boolean {
  let current = object;
  while (current) {
    if (
      current.isTransformControls ||
      current.isTransformControlsGizmo ||
      current.isTransformControlsPlane
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

export function filterTheaterRaycastHits<T extends TheaterRaycastHit>(hits: T[]): T[] {
  if (hits.some((hit) => isTransformGizmoObject(hit.object))) return [];
  const withoutSurfaces = hits.filter((hit) => {
    const pick = hit.object.userData.theaterPick;
    return pick !== THEATER_PICK_WALL && pick !== THEATER_PICK_FLOOR && pick !== THEATER_PICK_AUDIENCE;
  });
  return withoutSurfaces.length > 0 ? withoutSurfaces : hits;
}

export function doorPosAlongWall(
  wall: TheaterDoorWall,
  localX: number,
  localZ: number,
): number {
  return doorUsesAxisZ(wall) ? localZ : localX;
}
