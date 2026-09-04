import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import { resolvePublicAssetUrl } from "../../../../shared/utils/public-asset-url";
import { GltfGuard } from "./GltfGuard";

const SPOTLIGHT_MODEL_URLS = {
  fresnel: {
    high: resolvePublicAssetUrl("theater/models/stage-spotlight.glb"),
    low: resolvePublicAssetUrl("theater/models/stage-spotlight-low.glb"),
  },
  rgb: {
    high: resolvePublicAssetUrl("theater/models/stage-rgb-spotlight.glb"),
    low: resolvePublicAssetUrl("theater/models/stage-rgb-spotlight-low.glb"),
  },
} as const;

function cloneSpotlightScene(source: THREE.Object3D) {
  const scene = SkeletonUtils.clone(source);
  const embeddedLights: THREE.Object3D[] = [];
  scene.traverse((child) => {
    if ((child as THREE.Light).isLight) {
      embeddedLights.push(child);
      return;
    }
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.material = Array.isArray(mesh.material)
      ? mesh.material.map((material) => material.clone())
      : mesh.material.clone();
  });
  embeddedLights.forEach((light) => light.parent?.remove(light));
  return scene;
}

function StageSpotlightModelInner({
  lowDetail,
  tone,
  variant = "fresnel",
}: {
  lowDetail: boolean;
  tone?: string | null;
  variant?: keyof typeof SPOTLIGHT_MODEL_URLS;
}) {
  const modelUrls = SPOTLIGHT_MODEL_URLS[variant];
  const url = lowDetail ? modelUrls.low : modelUrls.high;
  const gltf = useGLTF(url);
  const scene = useMemo(() => cloneSpotlightScene(gltf.scene), [gltf.scene]);

  useEffect(() => {
    scene.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard.color) return;
        const originalColor =
          standard.userData.spotlightOriginalColor ??
          (standard.userData.spotlightOriginalColor = standard.color.clone());
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

export function StageSpotlightModel({
  lowDetail,
  tone,
  variant = "fresnel",
}: {
  lowDetail: boolean;
  tone?: string | null;
  variant?: keyof typeof SPOTLIGHT_MODEL_URLS;
}) {
  const detailKey = lowDetail ? "low" : "high";
  return (
    <GltfGuard resetKey={`${variant}-${detailKey}`}>
      <StageSpotlightModelInner
        lowDetail={lowDetail}
        tone={tone}
        variant={variant}
      />
    </GltfGuard>
  );
}
