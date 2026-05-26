import * as THREE from "three";
import type { TheaterModel } from "../../../shared/types/script";

export const DECOR_MATERIAL_SIDE_OPTIONS = [
  { value: "front", label: "Лицевая" },
  { value: "back", label: "Задняя" },
  { value: "double", label: "Две стороны" },
] as const;

export function resolveDecorMaterialSide(
  side: TheaterModel["decorMaterialSide"],
): THREE.Side {
  if (side === "back") return THREE.BackSide;
  if (side === "front") return THREE.FrontSide;
  return THREE.DoubleSide;
}

export function decorMaterialProps(
  model: Pick<
    TheaterModel,
    | "decorOpacity"
    | "decorRoughness"
    | "decorMetalness"
    | "decorEmissiveColor"
    | "decorEmissiveIntensity"
    | "decorMaterialSide"
  >,
) {
  const opacity = model.decorOpacity ?? 1;
  return {
    opacity,
    transparent: opacity < 1,
    roughness: model.decorRoughness ?? 0.82,
    metalness: model.decorMetalness ?? 0,
    emissive: model.decorEmissiveColor ?? "#000000",
    emissiveIntensity: model.decorEmissiveIntensity ?? 0,
    side: resolveDecorMaterialSide(model.decorMaterialSide),
  };
}
