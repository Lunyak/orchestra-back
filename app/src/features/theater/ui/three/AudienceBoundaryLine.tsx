import { tc } from "../../../../shared/styles/theme-color";
import { useMemo } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import {
  buildAudienceArcPolyline,
  isRadialAudience,
} from "../../model/theater-audience-arc";
import { resolveAudienceStartZ } from "../../model/theater-metrics";
import { resolveStageGeometry } from "../../model/theater-stage-geometry";

type AudienceBoundaryLineProps = {
  layout: TheaterLayout;
};

export function AudienceBoundaryLine({ layout }: AudienceBoundaryLineProps) {
  const geom = resolveStageGeometry(layout);
  const color = tc("--color-active-ascent");
  const radial = isRadialAudience(layout);
  const arcGeometry = useMemo(() => {
    if (!radial) return null;
    const points = buildAudienceArcPolyline(layout);
    const positions: number[] = [];
    for (let i = 0; i < points.length - 1; i += 1) {
      const a = points[i];
      const b = points[i + 1];
      positions.push(a.x, 0.04, a.z, b.x, 0.04, b.z);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geometry;
  }, [layout, radial]);

  if (radial && arcGeometry) {
    return (
      <lineSegments geometry={arcGeometry} renderOrder={3}>
        <lineBasicMaterial color={color} />
      </lineSegments>
    );
  }

  const z = resolveAudienceStartZ(layout);
  const useStem =
    geom.stageShape === "t-shape" ||
    geom.stageShape === "trapezoid" ||
    geom.stageShape === "circle" ||
    geom.stageShape === "semicircle";
  const width = useStem ? geom.prosceniumWidth : geom.stageBackWidth;

  return (
    <group position={[0, 0.04, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={3}>
        <planeGeometry args={[width, 0.06]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position={[-width / 2 + 0.04, 0.02, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[width / 2 - 0.04, 0.02, 0]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
