import { tc } from "../../../../shared/styles/theme-color";
import { useMemo } from "react";
import * as THREE from "three";
import { buildHallAxisGridLines } from "../../model/theater-hall-grid";

type TheaterFloorGridProps = {
  hallWidth: number;
  hallDepth: number;
  step: number;
};

function buildHallGridGeometry(
  hallWidth: number,
  hallDepth: number,
  step: number,
): THREE.BufferGeometry {
  const halfW = hallWidth / 2;
  const halfD = hallDepth / 2;
  const positions: number[] = [];

  for (const x of buildHallAxisGridLines(halfW, step)) {
    positions.push(x, 0, -halfD, x, 0, halfD);
  }

  for (const z of buildHallAxisGridLines(halfD, step)) {
    positions.push(-halfW, 0, z, halfW, 0, z);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geometry;
}

export function TheaterFloorGrid({
  hallWidth,
  hallDepth,
  step,
}: TheaterFloorGridProps) {
  const geometry = useMemo(
    () => buildHallGridGeometry(hallWidth, hallDepth, step),
    [hallDepth, hallWidth, step],
  );

  return (
    <lineSegments geometry={geometry} position={[0, 0.01, 0]}>
      <lineBasicMaterial color={tc("--color-border-default")} />
    </lineSegments>
  );
}
