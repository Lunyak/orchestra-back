import { useTexture } from "@react-three/drei";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import type { TheaterModel } from "../../../../shared/types/script";
import {
  createDecorPresetCanvas,
  getDecorTexturePresetId,
  resolveDecorTextureMapping,
  resolveDecorTextureSrc,
  type DecorTextureMapping,
  type DecorTexturePresetId,
} from "../../model/theater-decor-textures";
import { decorMaterialProps } from "../../model/theater-decor-material";

function applyTextureMapping(texture: THREE.Texture, mapping: DecorTextureMapping) {
  texture.wrapS = mapping.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.wrapT = mapping.clamp ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  texture.repeat.set(mapping.repeatU, mapping.repeatV);
  texture.offset.set(mapping.offsetU, mapping.offsetV);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
}

function readTextureAspect(texture: THREE.Texture): number {
  const image = texture.image as { width?: number; height?: number } | undefined;
  const w = image?.width ?? 1;
  const h = image?.height ?? 1;
  return w / Math.max(h, 1);
}

type DecorTexturedMaterialProps = {
  projectName: string;
  model: Pick<
    TheaterModel,
    | "decorTexture"
    | "decorTextureMode"
    | "decorTextureRepeat"
    | "decorOpacity"
    | "decorRoughness"
    | "decorMetalness"
    | "decorEmissiveColor"
    | "decorEmissiveIntensity"
    | "decorMaterialSide"
  >;
  surfaceWidth: number;
  surfaceHeight: number;
  color: string;
  tone: string | null;
  opacity?: number;
  transparent?: boolean;
  side?: THREE.Side;
};

function FileDecorMaterial({
  src,
  model,
  surfaceWidth,
  surfaceHeight,
  color,
  tone,
  opacity = 1,
  transparent = false,
  side,
}: DecorTexturedMaterialProps & { src: string }) {
  const sourceTexture = useTexture(src);
  const texture = useMemo(() => {
    const clone = sourceTexture.clone();
    clone.needsUpdate = true;
    return clone;
  }, [sourceTexture]);

  useEffect(() => {
    const mapping = resolveDecorTextureMapping(
      model,
      surfaceWidth,
      surfaceHeight,
      readTextureAspect(sourceTexture),
    );
    applyTextureMapping(texture, mapping);
  }, [model, sourceTexture, surfaceHeight, surfaceWidth, texture]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <meshStandardMaterial
      {...decorMaterialProps(model)}
      map={texture}
      color={tone || color}
      opacity={opacity ?? decorMaterialProps(model).opacity}
      transparent={transparent || opacity < 1 || decorMaterialProps(model).transparent}
      side={side}
    />
  );
}

function PresetDecorMaterial({
  presetId,
  model,
  surfaceWidth,
  surfaceHeight,
  color,
  tone,
  opacity = 1,
  transparent = false,
  side,
}: DecorTexturedMaterialProps & { presetId: DecorTexturePresetId }) {
  const texture = useMemo(() => {
    const canvas = createDecorPresetCanvas(presetId);
    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    return tex;
  }, [presetId]);

  const mapping = useMemo(
    () => resolveDecorTextureMapping(model, surfaceWidth, surfaceHeight, 1),
    [model, surfaceHeight, surfaceWidth],
  );

  useEffect(() => {
    applyTextureMapping(texture, mapping);
  }, [texture, mapping]);

  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <meshStandardMaterial
      {...decorMaterialProps(model)}
      map={texture}
      color={tone || color}
      opacity={opacity ?? decorMaterialProps(model).opacity}
      transparent={transparent || opacity < 1 || decorMaterialProps(model).transparent}
      side={side}
    />
  );
}

export function DecorTexturedMaterial({
  projectName,
  model,
  surfaceWidth,
  surfaceHeight,
  color,
  tone,
  opacity,
  transparent,
  side,
}: DecorTexturedMaterialProps) {
  const presetId = getDecorTexturePresetId(model.decorTexture);
  const fileSrc = presetId ? null : resolveDecorTextureSrc(projectName, model.decorTexture);

  if (presetId) {
    return (
      <PresetDecorMaterial
        presetId={presetId}
        projectName={projectName}
        model={model}
        surfaceWidth={surfaceWidth}
        surfaceHeight={surfaceHeight}
        color={color}
        tone={tone}
        opacity={opacity}
        transparent={transparent}
        side={side}
      />
    );
  }

  if (fileSrc) {
    return (
      <FileDecorMaterial
        src={fileSrc}
        projectName={projectName}
        model={model}
        surfaceWidth={surfaceWidth}
        surfaceHeight={surfaceHeight}
        color={color}
        tone={tone}
        opacity={opacity}
        transparent={transparent}
        side={side}
      />
    );
  }

  return (
    <meshStandardMaterial
      {...decorMaterialProps(model)}
      color={tone || color}
      opacity={opacity ?? decorMaterialProps(model).opacity}
      transparent={transparent || decorMaterialProps(model).transparent}
      side={side}
    />
  );
}
