import * as THREE from "three";
import type { TheaterModel } from "../../../shared/types/script";
import {
  isParametricDecorBuiltin,
  resolveDecorSize,
} from "./theater-decor-catalog";
import {
  getFurnitureBounds,
  isHumanTheaterBuiltin,
  isSeatableBuiltin,
  ROUND_TABLE_METRICS,
} from "./theater-furniture-metrics";
import { getTheaterAssetLibraryItem } from "./theater-asset-library";
import { roundM } from "./theater-metrics";

export type TheaterModelWorldSize = {
  /** Мировая ширина по X, м */
  width: number;
  /** Мировая высота по Y, м */
  height: number;
  /** Мировая длина/глубина по Z, м */
  depth: number;
};

const CABINET_BASE: [number, number, number] = [0.9, 1.0, 0.42];
const FENCE_BASE: [number, number, number] = [2.2, 1.3, 0.14];
const STAGE_SPOTLIGHT_BASE: [number, number, number] = [1.5, 1.5, 1.5];
const LIGHT_TRUSS_6M_BASE: [number, number, number] = [6.2, 0.9, 0.4];
const STRAW_GRID_BASE: [number, number, number] = [2, 2, 0.05];
const DANCER_BASE: [number, number, number] = [0.7, 1.8, 0.7];
const STAGE_ACTOR_BASE: [number, number, number] = [0.75, 1.8, 0.7];

function actorBaseSize(
  pose: TheaterModel["actorPose"],
): [number, number, number] {
  if (pose === "lie") return [0.85, 0.45, 1.9];
  if (pose === "sit") return [0.75, 1.45, 0.9];
  return [0.75, 1.8, 0.7];
}

function humanBaseSize(
  builtin: TheaterModel["builtin"],
): [number, number, number] {
  const seated = builtin === "humanSitting" || builtin === "humanSmoothSitting";
  return seated ? [0.7, 1.25, 0.85] : [0.7, 1.8, 0.7];
}

function roundTableBaseSize(): [number, number, number] {
  const diameter = ROUND_TABLE_METRICS.radius * 2;
  const height = 0.5 + ROUND_TABLE_METRICS.topThickness / 2;
  return [diameter, height, diameter];
}

/** Размер геометрии при scale = 1 (метры). Fallback, если объект ещё не в сцене. */
export function getTheaterModelBaseSize(
  model: Pick<
    TheaterModel,
    "type" | "file" | "builtin" | "decorSize" | "actorPose"
  >,
): [number, number, number] | null {
  const libraryItem = getTheaterAssetLibraryItem(model.builtin);
  if (libraryItem) return libraryItem.size;

  if (isParametricDecorBuiltin(model.builtin)) {
    return resolveDecorSize(model);
  }

  if (model.builtin === "roundTable") return roundTableBaseSize();

  if (
    model.builtin &&
    (isSeatableBuiltin(model.builtin) ||
      model.builtin === "table" ||
      model.builtin === "blackCube")
  ) {
    return getFurnitureBounds(model.builtin);
  }

  if (model.builtin === "cabinet") return CABINET_BASE;
  if (model.builtin === "fence") return FENCE_BASE;
  if (model.builtin === "stageSpotlight") return STAGE_SPOTLIGHT_BASE;
  if (model.builtin === "lightTruss6m") return LIGHT_TRUSS_6M_BASE;
  if (model.builtin === "strawGrid") return STRAW_GRID_BASE;
  if (model.builtin === "dancer") return DANCER_BASE;
  if (model.builtin === "stageActor") return STAGE_ACTOR_BASE;
  if (model.builtin === "actor") return actorBaseSize(model.actorPose);
  if (isHumanTheaterBuiltin(model.builtin)) return humanBaseSize(model.builtin);

  return null;
}

function scaleTuple(
  base: [number, number, number],
  scale: [number, number, number] | readonly [number, number, number],
): TheaterModelWorldSize {
  return {
    width: roundM(Math.abs(base[0] * scale[0])),
    height: roundM(Math.abs(base[1] * scale[1])),
    depth: roundM(Math.abs(base[2] * scale[2])),
  };
}

function isHelperMesh(mesh: THREE.Mesh): boolean {
  if (mesh.userData?.theaterHelper === true) return true;
  const materials = Array.isArray(mesh.material)
    ? mesh.material
    : [mesh.material];
  return materials.some((material) => {
    if (!material) return false;
    const basic = material as THREE.MeshBasicMaterial;
    if (basic.colorWrite === false) return true;
    if (
      basic.transparent &&
      typeof basic.opacity === "number" &&
      basic.opacity < 0.02
    ) {
      return true;
    }
    return false;
  });
}

/** Мировой AABB видимой геометрии (без helper-mesh). */
export function measureObjectWorldBox(root: THREE.Object3D): THREE.Box3 | null {
  root.updateWorldMatrix(true, true);
  const box = new THREE.Box3();
  const temp = new THREE.Box3();
  let hasMesh = false;

  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    if (isHelperMesh(mesh)) return;
    const geometry = mesh.geometry;
    if (!geometry.boundingBox) geometry.computeBoundingBox();
    if (!geometry.boundingBox) return;
    hasMesh = true;
    temp.copy(geometry.boundingBox);
    temp.applyMatrix4(mesh.matrixWorld);
    box.union(temp);
  });

  if (!hasMesh || box.isEmpty()) return null;
  return box;
}

/** Реальные габариты того, что видно на сцене (мировой AABB). */
export function measureObjectWorldSize(
  root: THREE.Object3D,
): TheaterModelWorldSize | null {
  const box = measureObjectWorldBox(root);
  if (!box) return null;
  const size = box.getSize(new THREE.Vector3());
  if (
    !Number.isFinite(size.x) ||
    !Number.isFinite(size.y) ||
    !Number.isFinite(size.z)
  ) {
    return null;
  }
  return {
    width: roundM(Math.max(0, size.x)),
    height: roundM(Math.max(0, size.y)),
    depth: roundM(Math.max(0, size.z)),
  };
}

export function resolveTheaterModelWorldSize(
  model: TheaterModel,
  object?: THREE.Object3D | null,
): TheaterModelWorldSize | null {
  if (object) {
    const measured = measureObjectWorldSize(object);
    if (measured) return measured;
  }

  const knownBase = getTheaterModelBaseSize(model);
  if (knownBase) return scaleTuple(knownBase, model.scale);

  return null;
}

export function formatTheaterModelWorldSize(
  size: TheaterModelWorldSize,
): string {
  return `Ш ${size.width.toFixed(2)} · Д ${size.depth.toFixed(2)} · В ${size.height.toFixed(2)}`;
}

const MIN_MODEL_SIZE_M = 0.05;
const MAX_MODEL_SIZE_M = 80;

export function clampTheaterModelSizeMeters(value: number) {
  if (!Number.isFinite(value)) return MIN_MODEL_SIZE_M;
  return roundM(Math.min(MAX_MODEL_SIZE_M, Math.max(MIN_MODEL_SIZE_M, value)));
}

/**
 * Патч модели под целевые габариты в метрах.
 * Параметрический декор — decorSize; остальное — scale от текущего размера.
 */
export function buildTheaterModelSizePatch(
  model: TheaterModel,
  current: TheaterModelWorldSize,
  next: Partial<TheaterModelWorldSize>,
): Partial<TheaterModel> | null {
  const width =
    next.width != null
      ? clampTheaterModelSizeMeters(next.width)
      : current.width;
  const height =
    next.height != null
      ? clampTheaterModelSizeMeters(next.height)
      : current.height;
  const depth =
    next.depth != null
      ? clampTheaterModelSizeMeters(next.depth)
      : current.depth;

  const widthChanged = width !== current.width;
  const heightChanged = height !== current.height;
  const depthChanged = depth !== current.depth;
  if (!widthChanged && !heightChanged && !depthChanged) return null;

  if (isParametricDecorBuiltin(model.builtin)) {
    const [baseW, baseH, baseD] = resolveDecorSize(model);
    const scaleX = Math.abs(model.scale[0]) || 1;
    const scaleY = Math.abs(model.scale[1]) || 1;
    const scaleZ = Math.abs(model.scale[2]) || 1;
    return {
      decorSize: [
        roundM(width / scaleX || baseW),
        roundM(height / scaleY || baseH),
        roundM(depth / scaleZ || baseD),
      ],
    };
  }

  const safeCurrentW = Math.max(current.width, 1e-4);
  const safeCurrentH = Math.max(current.height, 1e-4);
  const safeCurrentD = Math.max(current.depth, 1e-4);
  const scaleX = (model.scale[0] || 1) * (width / safeCurrentW);
  const scaleY = (model.scale[1] || 1) * (height / safeCurrentH);
  const scaleZ = (model.scale[2] || 1) * (depth / safeCurrentD);

  return {
    scale: [
      roundM(Math.max(0.001, scaleX)),
      roundM(Math.max(0.001, scaleY)),
      roundM(Math.max(0.001, scaleZ)),
    ],
  };
}
