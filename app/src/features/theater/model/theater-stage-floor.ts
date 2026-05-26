import * as THREE from "three";
import type { TheaterLayout } from "../../../shared/types/script";
import { buildStageOutline } from "./theater-stage-geometry";

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
