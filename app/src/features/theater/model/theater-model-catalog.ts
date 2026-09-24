import { getTheaterAssetLibraryItem } from "./theater-asset-library";
import {
  THEATER_BUILTIN_TEMPLATES,
  type TheaterBuiltinTemplate,
  type TheaterBuiltinTemplateKey,
} from "./theater-model-builtin";

export type TheaterModelCatalogCategoryId =
  | "all"
  | "furniture"
  | "props"
  | "stage"
  | "light"
  | "people";

export const THEATER_MODEL_CATALOG_CATEGORIES: {
  id: TheaterModelCatalogCategoryId;
  label: string;
}[] = [
  { id: "all", label: "Все" },
  { id: "furniture", label: "Мебель" },
  { id: "props", label: "Реквизит" },
  { id: "stage", label: "Сцена" },
  { id: "light", label: "Свет" },
  { id: "people", label: "Люди" },
];

const STAGE_KEYS = new Set<TheaterBuiltinTemplateKey>([
  "curtain",
  "hangingFabric",
  "flat",
  "screen",
  "platform",
]);

const LIGHT_KEYS = new Set<TheaterBuiltinTemplateKey>([
  "stageSpotlight",
  "lightTruss6m",
]);

const PEOPLE_KEYS = new Set<TheaterBuiltinTemplateKey>([
  "stageActor",
  "actor",
  "humanStanding",
  "humanSitting",
  "humanSmoothStanding",
  "humanSmoothSitting",
  "dancer",
]);

const PROP_KEYS = new Set<TheaterBuiltinTemplateKey>([
  "blackCube",
  "strawGrid",
  "fence",
]);

export function theaterModelCatalogCategory(
  key: TheaterBuiltinTemplateKey,
): Exclude<TheaterModelCatalogCategoryId, "all"> {
  if (STAGE_KEYS.has(key)) return "stage";
  if (LIGHT_KEYS.has(key)) return "light";
  if (PEOPLE_KEYS.has(key)) return "people";
  if (PROP_KEYS.has(key)) return "props";
  const libraryItem = getTheaterAssetLibraryItem(key);
  if (libraryItem?.category === "props") return "props";
  return "furniture";
}

export function filterTheaterModelCatalog(
  filter: string,
  category: TheaterModelCatalogCategoryId,
): TheaterBuiltinTemplate[] {
  const normalizedFilter = filter.trim().toLocaleLowerCase("ru");
  return THEATER_BUILTIN_TEMPLATES.filter((item) => {
    const matchesFilter =
      !normalizedFilter ||
      item.label.toLocaleLowerCase("ru").includes(normalizedFilter);
    if (!matchesFilter) return false;
    if (category === "all") return true;
    return theaterModelCatalogCategory(item.key) === category;
  });
}

export function countTheaterModelCatalogCategories(
  filter: string,
): Record<TheaterModelCatalogCategoryId, number> {
  const matched = filterTheaterModelCatalog(filter, "all");
  const counts: Record<TheaterModelCatalogCategoryId, number> = {
    all: matched.length,
    furniture: 0,
    props: 0,
    stage: 0,
    light: 0,
    people: 0,
  };
  for (const item of matched) {
    counts[theaterModelCatalogCategory(item.key)] += 1;
  }
  return counts;
}
