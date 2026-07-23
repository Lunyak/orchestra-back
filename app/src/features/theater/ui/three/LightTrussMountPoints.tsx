import { useState } from "react";
import type { TheaterModel, TheaterSpotlight } from "../../../../shared/types/script";
import { tc } from "../../../../shared/styles/theme-color";
import {
  getOccupiedTrussMountPointIds,
  LIGHT_TRUSS_6M_MOUNT_POINTS,
} from "../../model/theater-truss-mounts";

export function LightTrussMountPoints({
  model,
  spotlights,
  onMountPointClick,
}: {
  model: TheaterModel;
  spotlights: TheaterSpotlight[];
  onMountPointClick: (
    mountPointId: string,
    occupiedSpotlightId?: number,
  ) => void;
}) {
  const [hoveredPointId, setHoveredPointId] = useState<string | null>(null);
  const occupiedPointIds = getOccupiedTrussMountPointIds(spotlights, model.id);
  const mountedSpotlightsByPoint = new Map(
    spotlights
      .filter(
        (spotlight) =>
          spotlight.mountModelId === model.id && spotlight.mountPointId,
      )
      .map((spotlight) => [spotlight.mountPointId!, spotlight]),
  );

  return (
    <group position={model.position} rotation={model.rotation} scale={model.scale}>
      {LIGHT_TRUSS_6M_MOUNT_POINTS.map((point) => {
        const occupied = occupiedPointIds.has(point.id);
        const hovered = hoveredPointId === point.id;
        const color = occupied || hovered
          ? tc("--color-active-ascent")
          : tc("--color-primary-light");
        const pointScale = hovered ? 1.35 : 1;
        const mountedSpotlight = mountedSpotlightsByPoint.get(point.id);

        return (
          <mesh
            key={point.id}
            position={point.localPosition}
            scale={pointScale}
            onPointerOver={(event) => {
              event.stopPropagation();
              setHoveredPointId(point.id);
            }}
            onPointerOut={(event) => {
              event.stopPropagation();
              setHoveredPointId(null);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onMountPointClick(point.id, mountedSpotlight?.id);
            }}
          >
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshStandardMaterial
              color={color}
              emissive={color}
              emissiveIntensity={occupied ? 0.9 : 0.35}
              toneMapped={false}
            />
          </mesh>
        );
      })}
    </group>
  );
}
