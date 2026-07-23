import type { TheaterModel } from "../../../shared/types/script";

export type TheaterAssetLibraryCategory = "furniture" | "props";

export type TheaterAssetLibraryItem = {
  builtin: NonNullable<TheaterModel["builtin"]>;
  assetKey: string;
  label: string;
  category: TheaterAssetLibraryCategory;
  size: [number, number, number];
};

export const THEATER_ASSET_LIBRARY: TheaterAssetLibraryItem[] = [
  {
    builtin: "libraryWoodenChair",
    assetKey: "wooden-chair",
    label: "Деревянный стул",
    category: "furniture",
    size: [0.6, 1.35, 0.6],
  },
  {
    builtin: "libraryVelvetArmchair",
    assetKey: "velvet-armchair",
    label: "Бархатное кресло",
    category: "furniture",
    size: [1, 1.4, 0.85],
  },
  {
    builtin: "libraryVelvetSofa",
    assetKey: "velvet-sofa",
    label: "Бархатный диван",
    category: "furniture",
    size: [2.2, 1.45, 1],
  },
  {
    builtin: "libraryDiningTable",
    assetKey: "dining-table",
    label: "Обеденный стол",
    category: "furniture",
    size: [1.9, 0.85, 1],
  },
  {
    builtin: "libraryRoundPedestalTable",
    assetKey: "round-pedestal-table",
    label: "Круглый стол",
    category: "furniture",
    size: [1.55, 0.85, 1.55],
  },
  {
    builtin: "libraryBarStool",
    assetKey: "bar-stool",
    label: "Барный табурет",
    category: "furniture",
    size: [0.65, 0.8, 0.65],
  },
  {
    builtin: "libraryWoodenBench",
    assetKey: "wooden-bench",
    label: "Деревянная скамья",
    category: "furniture",
    size: [1.8, 1.35, 0.65],
  },
  {
    builtin: "libraryDisplayCabinet",
    assetKey: "display-cabinet",
    label: "Витринный шкаф",
    category: "furniture",
    size: [1.35, 2.1, 0.65],
  },
  {
    builtin: "libraryDresser",
    assetKey: "dresser",
    label: "Комод",
    category: "furniture",
    size: [1.55, 1.35, 0.7],
  },
  {
    builtin: "libraryBookshelf",
    assetKey: "bookshelf",
    label: "Книжный шкаф",
    category: "furniture",
    size: [1.3, 2.2, 0.55],
  },
  {
    builtin: "librarySingleBed",
    assetKey: "single-bed",
    label: "Кровать",
    category: "furniture",
    size: [1.3, 0.95, 2.2],
  },
  {
    builtin: "libraryRoomDivider",
    assetKey: "room-divider",
    label: "Трёхстворчатая ширма",
    category: "furniture",
    size: [2.3, 2.05, 0.5],
  },
  {
    builtin: "librarySpiralStaircase",
    assetKey: "spiral-staircase",
    label: "Винтовая лестница",
    category: "furniture",
    size: [2.05, 4.1, 2.05],
  },
  {
    builtin: "libraryTravelTrunk",
    assetKey: "travel-trunk",
    label: "Дорожный сундук",
    category: "props",
    size: [1.2, 0.9, 0.75],
  },
  {
    builtin: "libraryVintageSuitcase",
    assetKey: "vintage-suitcase",
    label: "Винтажный чемодан",
    category: "props",
    size: [1, 0.8, 0.4],
  },
  {
    builtin: "libraryWoodenBarrel",
    assetKey: "wooden-barrel",
    label: "Деревянная бочка",
    category: "props",
    size: [0.8, 1, 0.8],
  },
  {
    builtin: "libraryWoodenCrate",
    assetKey: "wooden-crate",
    label: "Деревянный ящик",
    category: "props",
    size: [1, 0.9, 0.75],
  },
  {
    builtin: "libraryFloorLamp",
    assetKey: "floor-lamp",
    label: "Торшер",
    category: "props",
    size: [0.8, 2.1, 0.8],
  },
  {
    builtin: "libraryCandelabrum",
    assetKey: "candelabrum",
    label: "Канделябр",
    category: "props",
    size: [0.9, 1.4, 0.5],
  },
  {
    builtin: "libraryStandingMirror",
    assetKey: "standing-mirror",
    label: "Напольное зеркало",
    category: "props",
    size: [1.4, 2.1, 0.7],
  },
  {
    builtin: "libraryCoatRack",
    assetKey: "coat-rack",
    label: "Вешалка",
    category: "props",
    size: [1, 2.1, 1],
  },
  {
    builtin: "libraryGramophone",
    assetKey: "gramophone",
    label: "Граммофон",
    category: "props",
    size: [1.1, 2, 0.8],
  },
  {
    builtin: "libraryRotaryTelephone",
    assetKey: "rotary-telephone",
    label: "Дисковый телефон",
    category: "props",
    size: [0.8, 0.65, 0.55],
  },
  {
    builtin: "libraryCeramicVase",
    assetKey: "ceramic-vase",
    label: "Керамическая ваза",
    category: "props",
    size: [0.7, 1.45, 0.7],
  },
  {
    builtin: "libraryGildedPictureFrame",
    assetKey: "gilded-picture-frame",
    label: "Картина в раме",
    category: "props",
    size: [1.25, 1.7, 0.8],
  },
];

export function getTheaterAssetLibraryItem(
  builtin: TheaterModel["builtin"],
): TheaterAssetLibraryItem | undefined {
  return THEATER_ASSET_LIBRARY.find((item) => item.builtin === builtin);
}

export function isTheaterAssetLibraryBuiltin(
  builtin: TheaterModel["builtin"],
): boolean {
  return Boolean(getTheaterAssetLibraryItem(builtin));
}
