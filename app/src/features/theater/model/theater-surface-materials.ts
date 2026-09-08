import type {
  TheaterDoorWall,
  TheaterLayout,
  TheaterSurfaceMaterial,
  TheaterSurfaceTextureMode,
} from "../../../shared/types/script";

export type TheaterSurfaceMaterialKey =
  | "stageFloorMaterial"
  | "hallFloorMaterial"
  | "backWallMaterial"
  | "sideWallsMaterial"
  | "portalMaterial";

export type TheaterSurfaceMaterialConfig = {
  key: TheaterSurfaceMaterialKey;
  label: string;
  defaultColor: string;
};

export const THEATER_SURFACE_MATERIALS: TheaterSurfaceMaterialConfig[] = [
  { key: "stageFloorMaterial", label: "Пол сцены", defaultColor: "#334155" },
  { key: "hallFloorMaterial", label: "Пол зала", defaultColor: "#1e293b" },
  { key: "backWallMaterial", label: "Задняя стена", defaultColor: "#1f2937" },
  { key: "sideWallsMaterial", label: "Боковые стены", defaultColor: "#111827" },
  { key: "portalMaterial", label: "Портал", defaultColor: "#d4af37" },
];

const SURFACE_KEYS = new Set<string>(
  THEATER_SURFACE_MATERIALS.map((item) => item.key),
);

export function isTheaterSurfaceMaterialKey(
  value: string,
): value is TheaterSurfaceMaterialKey {
  return SURFACE_KEYS.has(value);
}

export function surfaceMaterialKeyForWall(
  wall: TheaterDoorWall,
): TheaterSurfaceMaterialKey {
  return wall === "back" ? "backWallMaterial" : "sideWallsMaterial";
}

export function getTheaterSurfaceMaterialConfig(
  key: TheaterSurfaceMaterialKey,
): TheaterSurfaceMaterialConfig {
  return (
    THEATER_SURFACE_MATERIALS.find((item) => item.key === key) ??
    THEATER_SURFACE_MATERIALS[0]
  );
}


function normalizeTextureMode(
  value: TheaterSurfaceMaterial["textureMode"],
): TheaterSurfaceTextureMode | undefined {
  return value === "repeat" ||
    value === "cover" ||
    value === "contain" ||
    value === "once"
    ? value
    : undefined;
}

export function normalizeTheaterSurfaceMaterial(
  key: TheaterSurfaceMaterialKey,
  material: TheaterSurfaceMaterial | undefined,
): TheaterSurfaceMaterial {
  const config = getTheaterSurfaceMaterialConfig(key);
  const repeat =
    typeof material?.textureRepeat === "number" &&
    Number.isFinite(material.textureRepeat)
      ? Math.min(8, Math.max(0.05, material.textureRepeat))
      : 1;

  return {
    color:
      typeof material?.color === "string" && material.color.trim()
        ? material.color
        : config.defaultColor,
    texture:
      typeof material?.texture === "string" && material.texture.trim()
        ? material.texture
        : undefined,
    textureRepeat: repeat,
    textureMode: normalizeTextureMode(material?.textureMode) ?? "repeat",
  };
}

export function normalizeTheaterSurfaceMaterials(
  layout: TheaterLayout,
): Pick<TheaterLayout, TheaterSurfaceMaterialKey> {
  return {
    stageFloorMaterial: normalizeTheaterSurfaceMaterial(
      "stageFloorMaterial",
      layout.stageFloorMaterial,
    ),
    hallFloorMaterial: normalizeTheaterSurfaceMaterial(
      "hallFloorMaterial",
      layout.hallFloorMaterial,
    ),
    backWallMaterial: normalizeTheaterSurfaceMaterial(
      "backWallMaterial",
      layout.backWallMaterial,
    ),
    sideWallsMaterial: normalizeTheaterSurfaceMaterial(
      "sideWallsMaterial",
      layout.sideWallsMaterial,
    ),
    portalMaterial: normalizeTheaterSurfaceMaterial(
      "portalMaterial",
      layout.portalMaterial,
    ),
  };
}
