import * as THREE from "three";
import type { TheaterLayout } from "../../../shared/types/script";
import { buildStageOutline, resolveStageRise } from "./theater-stage-geometry";
import { isPointInZoneOutline } from "./theater-zone-grid";

const FLOOR_UP = new THREE.Vector3(0, 1, 0);

export function buildStageFloorShape(layout: TheaterLayout): THREE.Shape | null {
  const points = buildStageOutline(layout);
  if (points.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(points[0].x, points[0].z);
  for (let i = 1; i < points.length; i += 1) {
    shape.lineTo(points[i].x, points[i].z);
  }
  shape.closePath();
  return shape;
}

export function buildStageFloorGeometry(layout: TheaterLayout): THREE.ShapeGeometry | null {
  const shape = buildStageFloorShape(layout);
  if (!shape) return null;
  return new THREE.ShapeGeometry(shape);
}

export function isPointOnStage(layout: TheaterLayout, x: number, z: number): boolean {
  const points = buildStageOutline(layout);
  if (points.length < 3) return false;
  const outline: [number, number][] = points.map((point) => [point.x, point.z]);
  return isPointInZoneOutline(x, z, outline);
}

export function resolveFloorYAt(layout: TheaterLayout, x: number, z: number): number {
  const rise = resolveStageRise(layout);
  if (rise <= 0) return 0;
  return isPointOnStage(layout, x, z) ? rise : 0;
}

export function followFloorY(
  layout: TheaterLayout,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  currentY: number,
): number {
  return currentY + resolveFloorYAt(layout, toX, toZ) - resolveFloorYAt(layout, fromX, fromZ);
}

export function intersectTheaterFloor(
  ray: THREE.Ray,
  layout: TheaterLayout,
  hallOffsetX: number,
  hallOffsetZ: number,
  target: THREE.Vector3,
): boolean {
  const rise = resolveStageRise(layout);
  if (rise > 0) {
    const stagePlane = new THREE.Plane(FLOOR_UP, -rise);
    if (ray.intersectPlane(stagePlane, target)) {
      const localX = target.x - hallOffsetX;
      const localZ = target.z - hallOffsetZ;
      if (isPointOnStage(layout, localX, localZ)) return true;
    }
  }
  const hallPlane = new THREE.Plane(FLOOR_UP, 0);
  return Boolean(ray.intersectPlane(hallPlane, target));
}
