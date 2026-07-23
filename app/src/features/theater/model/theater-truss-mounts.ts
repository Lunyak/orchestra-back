import * as THREE from "three";
import type { TheaterModel, TheaterSpotlight } from "../../../shared/types/script";

export type TheaterTrussMountPoint = {
  id: string;
  label: string;
  localPosition: [number, number, number];
};

export const LIGHT_TRUSS_6M_MOUNT_POINTS: TheaterTrussMountPoint[] = Array.from(
  { length: 12 },
  (_, index) => ({
    id: `mount-${String(index + 1).padStart(2, "0")}`,
    label: `Точка ${index + 1}`,
    localPosition: [-2.75 + index * 0.5, -0.42, 0],
  }),
);

export function isLightTrussModel(
  model: TheaterModel | undefined,
): model is TheaterModel {
  return model?.builtin === "lightTruss6m";
}

export function getLightTrussMountPoint(
  mountPointId: string | undefined,
): TheaterTrussMountPoint | undefined {
  return LIGHT_TRUSS_6M_MOUNT_POINTS.find((point) => point.id === mountPointId);
}

export function resolveLightTrussMountWorldPosition(
  truss: TheaterModel,
  mountPointId: string,
): [number, number, number] | null {
  if (!isLightTrussModel(truss)) return null;
  const mountPoint = getLightTrussMountPoint(mountPointId);
  if (!mountPoint) return null;

  const position = new THREE.Vector3(...truss.position);
  const rotation = new THREE.Euler(...truss.rotation);
  const quaternion = new THREE.Quaternion().setFromEuler(rotation);
  const scale = new THREE.Vector3(...truss.scale);
  const matrix = new THREE.Matrix4().compose(position, quaternion, scale);
  const worldPosition = new THREE.Vector3(...mountPoint.localPosition).applyMatrix4(matrix);

  return [worldPosition.x, worldPosition.y, worldPosition.z];
}

export function syncMountedSpotlights(
  spotlights: TheaterSpotlight[],
  models: TheaterModel[],
  mountModelId?: number,
): TheaterSpotlight[] {
  const modelsById = new Map(models.map((model) => [model.id, model]));

  return spotlights.map((spotlight) => {
    if (spotlight.mountModelId == null || !spotlight.mountPointId) return spotlight;
    if (mountModelId != null && spotlight.mountModelId !== mountModelId) return spotlight;

    const truss = modelsById.get(spotlight.mountModelId);
    const position = truss
      ? resolveLightTrussMountWorldPosition(truss, spotlight.mountPointId)
      : null;
    if (!position) {
      return { ...spotlight, mountModelId: undefined, mountPointId: undefined };
    }

    const positionUnchanged = position.every(
      (coordinate, index) => Math.abs(coordinate - spotlight.position[index]) < 0.0001,
    );
    if (positionUnchanged) return spotlight;

    return { ...spotlight, position };
  });
}

export function getOccupiedTrussMountPointIds(
  spotlights: TheaterSpotlight[],
  mountModelId: number,
  excludeSpotlightId?: number,
): Set<string> {
  return new Set(
    spotlights
      .filter(
        (spotlight) =>
          spotlight.id !== excludeSpotlightId &&
          spotlight.mountModelId === mountModelId &&
          spotlight.mountPointId,
      )
      .map((spotlight) => spotlight.mountPointId!),
  );
}
