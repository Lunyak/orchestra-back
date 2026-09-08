import { tc } from "../../../../shared/styles/theme-color";
import { useMemo } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import {
  THEATER_PICK_FLOOR,
  type TheaterFloorContextHit,
} from "../../model/theater-object-context";
import { buildStageFloorGeometry, buildStageFloorShape } from "../../model/theater-stage-floor";
import { resolveStageRise } from "../../model/theater-stage-geometry";
import { TheaterSurfaceMaterial } from "./TheaterSurfaceMaterial";
import { useTheaterObjectContextGesture } from "./use-theater-object-context-gesture";

type TheaterStageFloorProps = {
  projectName: string;
  layout: TheaterLayout;
  onFloorContextMenu?: (hit: TheaterFloorContextHit) => void;
};

export function TheaterStageFloor({
  projectName,
  layout,
  onFloorContextMenu,
}: TheaterStageFloorProps) {
  const deckY = resolveStageRise(layout);
  const topGeometry = useMemo(() => buildStageFloorGeometry(layout), [layout]);
  const riserGeometry = useMemo(() => {
    if (deckY < 0.02) return null;
    const shape = buildStageFloorShape(layout);
    if (!shape) return null;
    return new THREE.ExtrudeGeometry(shape, {
      depth: deckY,
      bevelEnabled: false,
    });
  }, [deckY, layout]);

  const contextHandlers = useTheaterObjectContextGesture(
    Boolean(onFloorContextMenu),
    (event) => {
      onFloorContextMenu?.({
        kind: "floor",
        surface: "stage",
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
  );

  if (!topGeometry) return null;

  return (
    <group>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        position={[0, deckY + 0.004, 0]}
        receiveShadow
        geometry={topGeometry}
        userData={{ theaterPick: THEATER_PICK_FLOOR }}
        {...contextHandlers}
      >
        <TheaterSurfaceMaterial
          projectName={projectName}
          material={layout.stageFloorMaterial}
          fallbackColor={layout.stageFloorMaterial?.color ?? tc("--color-surface-2")}
          surfaceWidth={layout.hallWidth}
          surfaceHeight={layout.hallDepth}
          side={THREE.DoubleSide}
        />
      </mesh>
      {riserGeometry ? (
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, deckY, 0]}
          receiveShadow
          geometry={riserGeometry}
          userData={{ theaterPick: THEATER_PICK_FLOOR }}
          {...contextHandlers}
        >
          <TheaterSurfaceMaterial
            projectName={projectName}
            material={layout.stageFloorMaterial}
            fallbackColor={layout.stageFloorMaterial?.color ?? tc("--color-surface-2")}
            surfaceWidth={layout.hallWidth}
            surfaceHeight={deckY}
          />
        </mesh>
      ) : null}
    </group>
  );
}
