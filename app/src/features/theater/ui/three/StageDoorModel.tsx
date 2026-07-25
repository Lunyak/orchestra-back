import { useGLTF } from "@react-three/drei";
import { useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { resolvePublicAssetUrl } from "../../../../shared/utils/public-asset-url";
import type { TheaterDoorStyle } from "../../../../shared/types/script";

export const STAGE_DOOR_MODEL_BASE = { width: 1.2, height: 2.2 } as const;

const DOOR_MODEL_URLS: Record<TheaterDoorStyle, string> = {
  wood: resolvePublicAssetUrl("theater/models/stage-door-wood.glb"),
  metal: resolvePublicAssetUrl("theater/models/stage-door-metal.glb"),
};

function cloneDoorScene(source: THREE.Object3D) {
  const scene = SkeletonUtils.clone(source);
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
  return scene;
}

export function StageDoorModel({ style = "wood" }: { style?: TheaterDoorStyle }) {
  const url = DOOR_MODEL_URLS[style] ?? DOOR_MODEL_URLS.wood;
  const gltf = useGLTF(url);
  const scene = useMemo(() => cloneDoorScene(gltf.scene), [gltf.scene]);
  return <primitive object={scene} />;
}

useGLTF.preload(DOOR_MODEL_URLS.wood);
useGLTF.preload(DOOR_MODEL_URLS.metal);
