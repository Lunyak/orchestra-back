import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { resolvePublicAssetUrl } from "../../../../shared/utils/public-asset-url";
import { GltfGuard } from "./GltfGuard";

const STAGE_BLOCKING_ACTOR_URL = resolvePublicAssetUrl(
  "theater/humans/stage-blocking-actor.glb",
);

function cloneStageActor(source: THREE.Object3D) {
  const scene = source.clone(true);
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

function StageBlockingActorModelInner({ tone }: { tone?: string | null }) {
  const gltf = useGLTF(STAGE_BLOCKING_ACTOR_URL);
  const scene = useMemo(() => cloneStageActor(gltf.scene), [gltf.scene]);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard.color) return;
        const originalColor =
          standard.userData.stageActorOriginalColor ??
          (standard.userData.stageActorOriginalColor = standard.color.clone());
        if (tone) {
          standard.color.set(tone);
        } else {
          standard.color.copy(originalColor);
        }
      });
    });
  }, [scene, tone]);

  return <primitive object={scene} />;
}

export function StageBlockingActorModel({ tone }: { tone?: string | null }) {
  return (
    <GltfGuard>
      <StageBlockingActorModelInner tone={tone} />
    </GltfGuard>
  );
}
