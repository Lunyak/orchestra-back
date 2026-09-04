import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { resolvePublicAssetUrl } from "../../../../shared/utils/public-asset-url";
import { GltfGuard } from "./GltfGuard";

const HIGH_DETAIL_URL = resolvePublicAssetUrl("theater/models/stage-light-truss-6m.glb");
const LOW_DETAIL_URL = resolvePublicAssetUrl("theater/models/stage-light-truss-6m-low.glb");

function cloneTrussScene(source: THREE.Object3D) {
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

function LightTruss6mModelInner({
  lowDetail,
  tone,
}: {
  lowDetail: boolean;
  tone?: string | null;
}) {
  const url = lowDetail ? LOW_DETAIL_URL : HIGH_DETAIL_URL;
  const gltf = useGLTF(url);
  const scene = useMemo(() => cloneTrussScene(gltf.scene), [gltf.scene]);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard.color) return;
        const originalColor =
          standard.userData.trussOriginalColor ??
          (standard.userData.trussOriginalColor = standard.color.clone());
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

export function LightTruss6mModel({
  lowDetail,
  tone,
}: {
  lowDetail: boolean;
  tone?: string | null;
}) {
  const detailKey = lowDetail ? "low" : "high";
  return (
    <GltfGuard resetKey={detailKey}>
      <LightTruss6mModelInner lowDetail={lowDetail} tone={tone} />
    </GltfGuard>
  );
}
