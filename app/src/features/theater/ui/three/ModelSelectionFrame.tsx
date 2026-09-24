import { useMemo } from "react";
import * as THREE from "three";
import { tc } from "../../../../shared/styles/theme-color";

export function ModelSelectionFrame({
  visible,
  size,
  center,
}: {
  visible: boolean;
  size: [number, number, number];
  center: [number, number, number];
}) {
  const color = useMemo(() => tc("--color-active-ascent"), []);
  if (!visible) return null;
  return (
    <mesh position={center} raycast={() => null}>
      <boxGeometry args={size} />
      <meshBasicMaterial color={color} wireframe transparent opacity={0.9} />
    </mesh>
  );
}

export function selectionFrameFromObject(object: THREE.Object3D): {
  size: [number, number, number];
  center: [number, number, number];
} {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);
  object.worldToLocal(center);
  return {
    size: [Math.max(size.x, 0.05), Math.max(size.y, 0.05), Math.max(size.z, 0.05)],
    center: [center.x, center.y, center.z],
  };
}
