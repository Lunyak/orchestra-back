import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { TheaterSurfaceMaterial as TheaterSurfaceMaterialConfig } from "../../../../shared/types/script";
import {
  createDecorPresetCanvas,
  getDecorTexturePresetId,
  resolveDecorTextureMapping,
  resolveDecorTextureSrc,
  type DecorTextureMapping,
  type DecorTexturePresetId,
} from "../../model/theater-decor-textures";

function applyTextureMapping(texture: THREE.Texture, mapping: DecorTextureMapping) {
  texture.wrapS = mapping.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.wrapT = mapping.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.repeat.set(mapping.repeatU, mapping.repeatV);
  texture.offset.set(mapping.offsetU, mapping.offsetV);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

function textureAspect(texture: THREE.Texture): number {
  const image = texture.image as { width?: number; height?: number } | undefined;
  return (image?.width ?? 1) / Math.max(image?.height ?? 1, 1);
}

type TheaterSurfaceMaterialProps = {
  projectName: string;
  material: TheaterSurfaceMaterialConfig | undefined;
  fallbackColor: string;
  surfaceWidth: number;
  surfaceHeight: number;
  transparent?: boolean;
  opacity?: number;
  side?: THREE.Side;
};

function toDecorLikeMaterial(material: TheaterSurfaceMaterialConfig | undefined) {
  return {
    decorTexture: material?.texture,
    decorTextureMode: material?.textureMode,
    decorTextureRepeat: material?.textureRepeat,
  };
}

function FileSurfaceMaterial({
  projectName,
  material,
  fallbackColor,
  surfaceWidth,
  surfaceHeight,
  src,
  transparent,
  opacity,
  side,
}: TheaterSurfaceMaterialProps & { src: string }) {
  const sourceTexture = useTexture(src);
  const texture = useMemo(() => {
    const clone = sourceTexture.clone();
    clone.needsUpdate = true;
    return clone;
  }, [sourceTexture]);

  useEffect(() => {
    applyTextureMapping(
      texture,
      resolveDecorTextureMapping(
        toDecorLikeMaterial(material),
        surfaceWidth,
        surfaceHeight,
        textureAspect(sourceTexture),
      ),
    );
  }, [material, sourceTexture, surfaceHeight, surfaceWidth, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <meshStandardMaterial
      map={texture}
      color={material?.color ?? fallbackColor}
      roughness={0.86}
      metalness={0.04}
      transparent={transparent || (opacity ?? 1) < 1}
      opacity={opacity ?? 1}
      side={side}
    />
  );
}

function PresetSurfaceMaterial({
  material,
  fallbackColor,
  surfaceWidth,
  surfaceHeight,
  presetId,
  transparent,
  opacity,
  side,
}: TheaterSurfaceMaterialProps & { presetId: DecorTexturePresetId }) {
  const texture = useMemo(() => {
    const canvas = createDecorPresetCanvas(presetId);
    const next = new THREE.CanvasTexture(canvas);
    next.generateMipmaps = true;
    next.minFilter = THREE.LinearMipmapLinearFilter;
    return next;
  }, [presetId]);

  const mapping = useMemo(
    () =>
      resolveDecorTextureMapping(
        toDecorLikeMaterial(material),
        surfaceWidth,
        surfaceHeight,
        1,
      ),
    [material, surfaceHeight, surfaceWidth],
  );

  useEffect(() => {
    applyTextureMapping(texture, mapping);
  }, [mapping, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <meshStandardMaterial
      map={texture}
      color={material?.color ?? fallbackColor}
      roughness={0.86}
      metalness={0.04}
      transparent={transparent || (opacity ?? 1) < 1}
      opacity={opacity ?? 1}
      side={side}
    />
  );
}

export function TheaterSurfaceMaterial({
  projectName,
  material,
  fallbackColor,
  surfaceWidth,
  surfaceHeight,
  transparent,
  opacity,
  side,
}: TheaterSurfaceMaterialProps) {
  const presetId = getDecorTexturePresetId(material?.texture);
  const fileSrc = presetId ? null : resolveDecorTextureSrc(projectName, material?.texture);

  if (presetId) {
    return (
      <PresetSurfaceMaterial
        projectName={projectName}
        material={material}
        fallbackColor={fallbackColor}
        surfaceWidth={surfaceWidth}
        surfaceHeight={surfaceHeight}
        presetId={presetId}
        transparent={transparent}
        opacity={opacity}
        side={side}
      />
    );
  }

  if (fileSrc) {
    return (
      <FileSurfaceMaterial
        projectName={projectName}
        material={material}
        fallbackColor={fallbackColor}
        surfaceWidth={surfaceWidth}
        surfaceHeight={surfaceHeight}
        src={fileSrc}
        transparent={transparent}
        opacity={opacity}
        side={side}
      />
    );
  }

  return (
    <meshStandardMaterial
      color={material?.color ?? fallbackColor}
      roughness={0.86}
      metalness={0.04}
      transparent={transparent || (opacity ?? 1) < 1}
      opacity={opacity ?? 1}
      side={side}
    />
  );
}
