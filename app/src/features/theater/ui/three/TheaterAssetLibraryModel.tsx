import { useGLTF } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { TheaterModel } from "../../../../shared/types/script";
import { resolvePublicAssetUrl } from "../../../../shared/utils/public-asset-url";
import { resolveDecorMaterialSide } from "../../model/theater-decor-material";
import {
  createDecorPresetCanvas,
  getDecorTexturePresetId,
  resolveDecorTextureSrc,
} from "../../model/theater-decor-textures";

function cloneAssetScene(source: THREE.Object3D) {
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

function configureTexture(
  texture: THREE.Texture,
  model: TheaterModel,
): THREE.Texture {
  const repeat = model.decorTextureRepeat ?? 1;
  const repeatTexture = model.decorTextureMode === "repeat";
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.wrapS = repeatTexture
    ? THREE.RepeatWrapping
    : THREE.ClampToEdgeWrapping;
  texture.wrapT = repeatTexture
    ? THREE.RepeatWrapping
    : THREE.ClampToEdgeWrapping;
  texture.repeat.set(repeatTexture ? repeat : 1, repeatTexture ? repeat : 1);
  texture.needsUpdate = true;
  return texture;
}

function applyAssetAppearance(
  scene: THREE.Object3D,
  model: TheaterModel,
  texture: THREE.Texture | null,
) {
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const materials = Array.isArray(mesh.material)
      ? mesh.material
      : [mesh.material];
    materials.forEach((material) => {
      const standard = material as THREE.MeshStandardMaterial;
      if (!standard.isMeshStandardMaterial) return;
      const originalColor =
        standard.userData.libraryOriginalColor ??
        (standard.userData.libraryOriginalColor = standard.color.clone());
      if (!("libraryOriginalMap" in standard.userData)) {
        standard.userData.libraryOriginalMap = standard.map;
      }
      const originalMap = standard.userData.libraryOriginalMap as
        | THREE.Texture
        | null;
      const originalRoughness =
        standard.userData.libraryOriginalRoughness ??
        (standard.userData.libraryOriginalRoughness = standard.roughness);
      const originalMetalness =
        standard.userData.libraryOriginalMetalness ??
        (standard.userData.libraryOriginalMetalness = standard.metalness);
      const originalOpacity =
        standard.userData.libraryOriginalOpacity ??
        (standard.userData.libraryOriginalOpacity = standard.opacity);
      const originalTransparent =
        standard.userData.libraryOriginalTransparent ??
        (standard.userData.libraryOriginalTransparent = standard.transparent);
      const originalSide =
        standard.userData.libraryOriginalSide ??
        (standard.userData.libraryOriginalSide = standard.side);

      standard.color.copy(originalColor);
      standard.map = originalMap;
      standard.roughness = model.decorRoughness ?? originalRoughness;
      standard.metalness = model.decorMetalness ?? originalMetalness;
      standard.opacity = model.decorOpacity ?? originalOpacity;
      standard.transparent =
        model.decorOpacity != null
          ? model.decorOpacity < 1
          : originalTransparent;
      standard.emissive.set(model.decorEmissiveColor ?? "#000000");
      standard.emissiveIntensity = model.decorEmissiveIntensity ?? 0;
      standard.side = model.decorMaterialSide
        ? resolveDecorMaterialSide(model.decorMaterialSide)
        : originalSide;

      if (texture) {
        standard.map = texture;
        standard.color.set(model.decorColor ?? "#ffffff");
      } else if (model.decorColor) {
        standard.color.set(model.decorColor);
      }
      standard.needsUpdate = true;
    });
  });
}

export function TheaterAssetLibraryModel({
  assetKey,
  lowDetail,
  model,
  projectName,
}: {
  assetKey: string;
  lowDetail: boolean;
  model: TheaterModel;
  projectName: string;
}) {
  const detailSuffix = lowDetail ? "-low" : "";
  const url = resolvePublicAssetUrl(
    `theater/library/${assetKey}${detailSuffix}.glb`,
  );
  const gltf = useGLTF(url);
  const scene = useMemo(() => cloneAssetScene(gltf.scene), [gltf.scene]);

  useEffect(() => {
    let texture: THREE.Texture | null = null;
    let active = true;
    const applyTexture = (nextTexture: THREE.Texture | null) => {
      if (!active) {
        nextTexture?.dispose();
        return;
      }
      texture = nextTexture;
      applyAssetAppearance(scene, model, texture);
    };

    const presetId = getDecorTexturePresetId(model.decorTexture);
    if (presetId) {
      applyTexture(
        configureTexture(
          new THREE.CanvasTexture(createDecorPresetCanvas(presetId)),
          model,
        ),
      );
    } else {
      const textureSrc = resolveDecorTextureSrc(
        projectName,
        model.decorTexture,
      );
      if (textureSrc) {
        applyAssetAppearance(scene, model, null);
        new THREE.TextureLoader().load(textureSrc, (loadedTexture) =>
          applyTexture(configureTexture(loadedTexture, model)),
        );
      } else {
        applyTexture(null);
      }
    }

    return () => {
      active = false;
      texture?.dispose();
    };
  }, [
    model,
    projectName,
    scene,
  ]);

  return <primitive object={scene} />;
}
