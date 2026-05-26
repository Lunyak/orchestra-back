import { Suspense, useMemo } from "react";
import * as THREE from "three";
import type { TheaterModel } from "../../../../shared/types/script";
import { DecorTexturedMaterial } from "./DecorTexturedMaterial";

type HangingFabricModelProps = {
  projectName: string;
  model: TheaterModel;
  width: number;
  height: number;
  foldDepth: number;
  color: string;
  tone: string | null;
};

function buildHangingFabricGeometry(
  width: number,
  height: number,
  foldDepth: number,
) {
  const cols = 72;
  const rows = 36;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const folds = Math.max(3, Math.round(width * 1.8));

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const sag = Math.sin(v * Math.PI) * 0.08;
    const bottomWave = row === 0 ? 0 : Math.sin(v * Math.PI) * 0.025;

    for (let col = 0; col <= cols; col += 1) {
      const u = col / cols;
      const x = (u - 0.5) * width;
      const fold = Math.sin(u * Math.PI * 2 * folds);
      const fineFold = Math.sin(u * Math.PI * 2 * folds * 2.3 + v * 1.7) * 0.22;
      const z = (fold + fineFold) * foldDepth * (0.35 + v * 0.65);
      const lowerEdge =
        row === 0
          ? Math.sin(u * Math.PI * 8) * 0.035 + Math.sin(u * Math.PI * 15) * 0.018
          : 0;
      const y = v * height - lowerEdge - sag + bottomWave;
      positions.push(x, y, z);
      uvs.push(u, 1 - v);
    }
  }

  const stride = cols + 1;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * stride + col;
      const b = a + 1;
      const c = a + stride;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function HangingFabricModel({
  projectName,
  model,
  width,
  height,
  foldDepth,
  color,
  tone,
}: HangingFabricModelProps) {
  const geometry = useMemo(
    () => buildHangingFabricGeometry(width, height, foldDepth),
    [foldDepth, height, width],
  );
  const materialSide = model.decorOneSided ? THREE.FrontSide : THREE.DoubleSide;

  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <Suspense fallback={<meshStandardMaterial color={tone || color} side={materialSide} />}>
          <DecorTexturedMaterial
            projectName={projectName}
            model={model}
            surfaceWidth={width}
            surfaceHeight={height}
            color={color}
            tone={tone}
            opacity={0.96}
            transparent
            side={materialSide}
          />
        </Suspense>
      </mesh>
      <mesh position={[0, height + 0.03, 0]}>
        <cylinderGeometry args={[0.035, 0.035, width * 1.04, 16]} />
        <meshStandardMaterial color={tone || "#2b211c"} roughness={0.75} />
      </mesh>
    </group>
  );
}
