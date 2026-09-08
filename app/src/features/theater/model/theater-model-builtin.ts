import type { TheaterModel } from "../../../shared/types/script";
import {
  getTheaterAssetLibraryItem,
  isTheaterAssetLibraryBuiltin,
  THEATER_ASSET_LIBRARY,
} from "./theater-asset-library";
import { getDecorCatalogEntryByBuiltin } from "./theater-decor-catalog";
import { DEFAULT_LIGHT_RIG_HEIGHT } from "./theater-light-rig";

/** Builtin-шаблоны, доступные во вкладке «3D модели» (порядок = порядок в пикере). */
export const THEATER_BUILTIN_TEMPLATE_KEYS = [
  "table",
  "roundTable",
  "chair",
  "sofa",
  "bench",
  "cabinet",
  "libraryWoodenChair",
  "libraryVelvetArmchair",
  "libraryVelvetSofa",
  "libraryDiningTable",
  "libraryRoundPedestalTable",
  "libraryBarStool",
  "libraryWoodenBench",
  "libraryDisplayCabinet",
  "libraryDresser",
  "libraryBookshelf",
  "librarySingleBed",
  "libraryRoomDivider",
  "librarySpiralStaircase",
  "libraryTravelTrunk",
  "libraryVintageSuitcase",
  "libraryWoodenBarrel",
  "libraryWoodenCrate",
  "libraryFloorLamp",
  "libraryCandelabrum",
  "libraryStandingMirror",
  "libraryCoatRack",
  "libraryGramophone",
  "libraryRotaryTelephone",
  "libraryCeramicVase",
  "libraryGildedPictureFrame",
  "curtain",
  "hangingFabric",
  "flat",
  "screen",
  "platform",
  "blackCube",
  "strawGrid",
  "stageActor",
  "actor",
  "stageSpotlight",
  "lightTruss6m",
  "humanStanding",
  "humanSitting",
  "humanSmoothStanding",
  "humanSmoothSitting",
  "fence",
  "dancer",
] as const;

export type TheaterBuiltinTemplateKey =
  (typeof THEATER_BUILTIN_TEMPLATE_KEYS)[number];

export type TheaterBuiltinTemplate = {
  key: TheaterBuiltinTemplateKey;
  label: string;
};

export const THEATER_BUILTIN_MODEL_NAMES: Record<string, string> = {
  table: "Стол",
  roundTable: "Круглый стол",
  chair: "Стул",
  sofa: "Диван",
  bench: "Скамейка",
  cabinet: "Тумба",
  blackCube: "Черный куб",
  strawGrid: "Сетка + солома",
  stageActor: "Актёр для мизансцены",
  actor: "Актер",
  stageSpotlight: "Софит",
  lightTruss6m: "Световая ферма 6 м",
  curtain: "Занавес",
  hangingFabric: "Висящая ткань",
  flat: "Кулиса",
  screen: "Параметрическая ширма",
  platform: "Подиум",
  humanStanding: "Человек — стоит",
  humanSitting: "Человек — сидит",
  humanSmoothStanding: "Человек сглаженный — стоит",
  humanSmoothSitting: "Человек сглаженный — сидит",
  fence: "Забор",
  dancer: "Танцор",
  ...Object.fromEntries(
    THEATER_ASSET_LIBRARY.map((item) => [item.builtin, item.label]),
  ),
};

export const THEATER_BUILTIN_TEMPLATES: TheaterBuiltinTemplate[] =
  THEATER_BUILTIN_TEMPLATE_KEYS.map((key) => ({
    key,
    label: THEATER_BUILTIN_MODEL_NAMES[key] ?? key,
  }));

export function isTheaterBuiltinTemplateKey(
  value: string | undefined | null,
): value is TheaterBuiltinTemplateKey {
  return (
    value != null &&
    (THEATER_BUILTIN_TEMPLATE_KEYS as readonly string[]).includes(value)
  );
}

export function isHumanBuiltinTheaterModel(
  builtin: TheaterModel["builtin"],
): boolean {
  return (
    builtin === "humanStanding" ||
    builtin === "humanSitting" ||
    builtin === "humanSmoothStanding" ||
    builtin === "humanSmoothSitting"
  );
}

export function createBuiltinTheaterModel(
  nextId: number,
  builtinModelKey: TheaterModel["builtin"],
): TheaterModel {
  const isHumanModel = isHumanBuiltinTheaterModel(builtinModelKey);
  const isLightTruss = builtinModelKey === "lightTruss6m";
  const libraryItem = getTheaterAssetLibraryItem(builtinModelKey);
  const isLibraryAsset = isTheaterAssetLibraryBuiltin(builtinModelKey);
  const decorPreset = getDecorCatalogEntryByBuiltin(builtinModelKey);
  const initialY = isLightTruss ? DEFAULT_LIGHT_RIG_HEIGHT : isHumanModel ? 0.02 : 0;
  const baseName =
    libraryItem?.label ??
    THEATER_BUILTIN_MODEL_NAMES[builtinModelKey ?? "table"] ??
    `Модель ${nextId}`;
  return {
    id: nextId,
    name: isLightTruss ? `${baseName} ${nextId}` : baseName,
    type: "builtin",
    builtin: builtinModelKey,
    allowOutOfBounds: false,
    ignoreCollisions: builtinModelKey === "actor" || isLightTruss,
    position: [0, initialY, 0],
    rotation: [0, 0, 0],
    scale: isHumanModel ? [0.9, 0.9, 0.9] : [1, 1, 1],
    ...(builtinModelKey === "actor" ? { actorPose: "stand" as const } : {}),
    ...(builtinModelKey === "stageSpotlight" || isLightTruss || isLibraryAsset
      ? { modelLowDetail: false }
      : {}),
    ...(decorPreset
      ? {
          decorSize: decorPreset.defaultSize,
          decorColor: decorPreset.defaultColor,
        }
      : {}),
    ...(isHumanModel
      ? {
          humanSkinColor: "#d7a77f",
          humanTopColor: "#334155",
          humanBottomColor: "#1e293b",
          humanShoeColor: "#111827",
        }
      : {}),
  };
}
