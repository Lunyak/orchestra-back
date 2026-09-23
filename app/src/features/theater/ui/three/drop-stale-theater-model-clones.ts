import type * as THREE from "three";

export function dropStaleTheaterModelClones(
  node: THREE.Object3D,
  modelId: number,
) {
  node.userData.theaterModelId = modelId;
  let root: THREE.Object3D = node;
  while (root.parent) root = root.parent;
  const stale: THREE.Object3D[] = [];
  root.traverse((child) => {
    if (child === node) return;
    if (child.userData?.theaterModelId !== modelId) return;
    stale.push(child);
  });
  stale.forEach((child) => child.removeFromParent());
}
