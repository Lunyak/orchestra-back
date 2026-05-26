import { tc } from "../../../../shared/styles/theme-color";
import { useMemo } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { buildStageFloorGeometry } from "../../model/theater-stage-floor";
import { TheaterSurfaceMaterial } from "./TheaterSurfaceMaterial";

type TheaterStageFloorProps = {
  projectName: string;
  layout: TheaterLayout;
};

export function TheaterStageFloor({ projectName, layout }: TheaterStageFloorProps) {
  const geometry = useMemo(() => buildStageFloorGeometry(layout), [layout]);

  if (!geometry) return null;

  return (
    <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow geometry={geometry}>
      <TheaterSurfaceMaterial
        projectName={projectName}
        material={layout.stageFloorMaterial}
        fallbackColor={layout.stageFloorMaterial?.color ?? tc("--color-surface-2")}
        surfaceWidth={layout.hallWidth}
        surfaceHeight={layout.hallDepth}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
