import type { TheaterLayout, TheaterModel } from "../../../shared/types/script";
import { roundM } from "./theater-metrics";
import { followFloorY } from "./theater-stage-floor";
import { isLightTrussModel } from "./theater-truss-mounts";

export const DEFAULT_LIGHT_RIG_HEIGHT = 6;
export const LIGHT_RIG_HEIGHT_LIMITS = { min: 1, max: 20 } as const;
export const LIGHT_TRUSS_SPACING = 1.5;

export type LightRigHandleBounds = {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
};

export function getLightTrussModels(models: TheaterModel[]): TheaterModel[] {
  return models.filter(isLightTrussModel);
}

export function resolveLightRigHeight(models: TheaterModel[]): number {
  const truss = getLightTrussModels(models)[0];
  if (!truss) return DEFAULT_LIGHT_RIG_HEIGHT;
  return roundM(truss.position[1]);
}

export function clampLightRigHeight(height: number): number {
  if (!Number.isFinite(height)) return DEFAULT_LIGHT_RIG_HEIGHT;
  return roundM(
    Math.min(
      LIGHT_RIG_HEIGHT_LIMITS.max,
      Math.max(LIGHT_RIG_HEIGHT_LIMITS.min, height),
    ),
  );
}

export function setLightTrussHeight(
  models: TheaterModel[],
  height: number,
): TheaterModel[] {
  const nextY = clampLightRigHeight(height);
  let changed = false;
  const next = models.map((model) => {
    if (!isLightTrussModel(model)) return model;
    if (Math.abs(model.position[1] - nextY) < 1e-4) return model;
    changed = true;
    return {
      ...model,
      position: [model.position[0], nextY, model.position[2]] as [
        number,
        number,
        number,
      ],
    };
  });
  return changed ? next : models;
}

export function translateLightTrusses(
  models: TheaterModel[],
  deltaX: number,
  deltaZ: number,
): TheaterModel[] {
  if (Math.abs(deltaX) < 1e-6 && Math.abs(deltaZ) < 1e-6) return models;
  return models.map((model) => {
    if (!isLightTrussModel(model)) return model;
    return {
      ...model,
      position: [
        roundM(model.position[0] + deltaX),
        model.position[1],
        roundM(model.position[2] + deltaZ),
      ] as [number, number, number],
    };
  });
}

export function getLightRigHandleBounds(
  trusses: TheaterModel[],
): LightRigHandleBounds | null {
  if (trusses.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const truss of trusses) {
    minX = Math.min(minX, truss.position[0]);
    maxX = Math.max(maxX, truss.position[0]);
    minZ = Math.min(minZ, truss.position[2]);
    maxZ = Math.max(maxZ, truss.position[2]);
  }
  return {
    x: (minX + maxX) / 2,
    y: trusses[0].position[1],
    z: (minZ + maxZ) / 2,
    width: Math.max(1.2, maxX - minX + 1.2),
    depth: Math.max(1.2, maxZ - minZ + 1.2),
  };
}

export function resolveModelKeepHeightY(
  model: TheaterModel,
  layout: TheaterLayout,
  nextX: number,
  nextZ: number,
): number {
  if (isLightTrussModel(model)) return model.position[1];
  return followFloorY(
    layout,
    model.position[0],
    model.position[2],
    nextX,
    nextZ,
    model.position[1],
  );
}
