import { tc } from "../../../../shared/styles/theme-color";
import type { TheaterLayout } from "../../../../shared/types/script";
import { getAudienceBoundaryZ } from "../../model/theater-metrics";
import { resolveStageGeometry } from "../../model/theater-stage-geometry";

type AudienceBoundaryLineProps = {
  layout: TheaterLayout;
};

export function AudienceBoundaryLine({ layout }: AudienceBoundaryLineProps) {
  const geom = resolveStageGeometry(layout);
  const z = getAudienceBoundaryZ(layout);
  const color = tc("--color-active-ascent");
  const useStem =
    geom.stageShape === "t-shape" ||
    (geom.stageShape === "trapezoid" && geom.prosceniumEnabled);
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
