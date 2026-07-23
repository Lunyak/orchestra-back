import type { TheaterModel } from "../../../shared/types/script";
import { normalizeDecorTextureFaces } from "./theater-decor-faces";

export function normalizeTheaterModels(items: TheaterModel[]): TheaterModel[] {
  return items.map((item, index) => {
    const nextId = Number(item.id) || index + 1;
    return {
      id: nextId,
      name: item.name?.trim() || `Модель ${nextId}`,
      file: item.file,
      type: item.type ?? (item.file ? "file" : "builtin"),
      builtin: item.builtin,
      allowOutOfBounds: item.allowOutOfBounds ?? false,
      ignoreCollisions: item.ignoreCollisions ?? false,
      actorPose:
        item.actorPose === "stand" || item.actorPose === "sit" || item.actorPose === "lie"
          ? item.actorPose
          : undefined,
      modelLowDetail: item.modelLowDetail ?? false,
      position: item.position ?? [0, 0, 0],
      rotation: item.rotation ?? [0, 0, 0],
      scale: item.scale ?? [1, 1, 1],
      decorSize: item.decorSize
        ? ([...item.decorSize] as [number, number, number])
        : undefined,
      decorColor: item.decorColor,
      decorTexture: item.decorTexture,
      decorTextureRepeat:
        typeof item.decorTextureRepeat === "number" ? item.decorTextureRepeat : undefined,
      decorTextureMode:
        item.decorTextureMode === "repeat" ||
        item.decorTextureMode === "cover" ||
        item.decorTextureMode === "contain" ||
        item.decorTextureMode === "once"
          ? item.decorTextureMode
          : undefined,
      decorTextureFaces: normalizeDecorTextureFaces(item.decorTextureFaces),
      decorOneSided: item.decorOneSided ?? false,
      decorOpacity: typeof item.decorOpacity === "number" ? item.decorOpacity : undefined,
      decorRoughness:
        typeof item.decorRoughness === "number" ? item.decorRoughness : undefined,
      decorMetalness:
        typeof item.decorMetalness === "number" ? item.decorMetalness : undefined,
      decorEmissiveColor: item.decorEmissiveColor,
      decorEmissiveIntensity:
        typeof item.decorEmissiveIntensity === "number"
          ? item.decorEmissiveIntensity
          : undefined,
      decorMaterialSide:
        item.decorMaterialSide === "front" ||
        item.decorMaterialSide === "back" ||
        item.decorMaterialSide === "double"
          ? item.decorMaterialSide
          : undefined,
      humanSkinColor: item.humanSkinColor,
      humanTopColor: item.humanTopColor,
      humanBottomColor: item.humanBottomColor,
      humanShoeColor: item.humanShoeColor,
      ...(item.hidden ? { hidden: true } : {}),
    };
  });
}
