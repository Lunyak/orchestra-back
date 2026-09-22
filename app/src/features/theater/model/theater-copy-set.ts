import type {
  SceneLightKadrTheaterSnapshotV1,
  ScriptScene,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { buildLightPlotFromSpotlights } from "./theater-light-channel-link";
import { isTheaterDecorModel } from "./theater-decor-catalog";
import { normalizeTheaterModels } from "./theater-model-normalize";
import {
  cloneTheaterModels,
  cloneTheaterSpotlights,
} from "./theater-history";
import {
  readSceneTheaterModels,
  splitSceneTheaterModels,
  writeSceneTheaterModels,
} from "./theater-scene-models";
import { syncMountedSpotlights } from "./theater-truss-mounts";

export type TheaterCopyCategory = "furniture" | "decor" | "spotlights";
export type TheaterCopyScope = "all" | "selected";
export type TheaterCopyMode = "replace" | "append";

export const THEATER_COPY_CATEGORY_LABELS: Record<TheaterCopyCategory, string> = {
  furniture: "мебель",
  decor: "декор",
  spotlights: "софиты",
};

export function formatTheaterCopyCategories(
  categories: TheaterCopyCategory[],
): string {
  const labels = categories.map((item) => THEATER_COPY_CATEGORY_LABELS[item]);
  if (labels.length === 0) return "";
  const first = labels[0];
  if (labels.length === 1) return first ? capitalizeCopyLabel(first) : "";
  return capitalizeCopyLabel(labels.join(", "));
}

function capitalizeCopyLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export type TheaterCopySetOptions = {
  categories: TheaterCopyCategory[];
  scope: TheaterCopyScope;
};

function collectUsedIds(ids: number[]): Set<number> {
  const usedIds = new Set<number>();
  for (const id of ids) {
    if (Number.isFinite(id) && id > 0) usedIds.add(id);
  }
  return usedIds;
}

function nextFreeId(usedIds: Set<number>, fromId: number): number {
  let nextId = Number.isFinite(fromId) && fromId > 0 ? Math.trunc(fromId) : 1;
  while (usedIds.has(nextId)) nextId += 1;
  return nextId;
}

function isFurnitureModel(model: TheaterModel): boolean {
  return !isTheaterDecorModel(model);
}

export function filterModelsByCopyCategories(
  models: TheaterModel[],
  categories: TheaterCopyCategory[],
): TheaterModel[] {
  const includeFurniture = categories.includes("furniture");
  const includeDecor = categories.includes("decor");
  if (!includeFurniture && !includeDecor) return [];
  return models.filter((item) =>
    isTheaterDecorModel(item) ? includeDecor : includeFurniture,
  );
}

export function resolveTheaterCopySource(args: {
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
  categories: TheaterCopyCategory[];
  scope: TheaterCopyScope;
  selectedModelIds: number[];
  selectedSpotlightIds: number[];
}): { models: TheaterModel[]; spotlights: TheaterSpotlight[] } {
  const selectedModelIdSet = new Set(args.selectedModelIds);
  const selectedSpotlightIdSet = new Set(args.selectedSpotlightIds);
  const scopedModels =
    args.scope === "selected"
      ? args.models.filter((item) => selectedModelIdSet.has(item.id))
      : args.models;
  const scopedSpotlights =
    args.scope === "selected"
      ? args.spotlights.filter((item) => selectedSpotlightIdSet.has(item.id))
      : args.spotlights;
  return {
    models: filterModelsByCopyCategories(scopedModels, args.categories),
    spotlights: args.categories.includes("spotlights") ? scopedSpotlights : [],
  };
}

export function resolveActiveCopyCategories(args: {
  categories: TheaterCopyCategory[];
  sourceModels: TheaterModel[];
  sourceSpotlights: TheaterSpotlight[];
  skipEmptyCategories: boolean;
}): TheaterCopyCategory[] {
  if (!args.skipEmptyCategories) return args.categories;
  const hasFurniture = args.sourceModels.some(isFurnitureModel);
  const hasDecor = args.sourceModels.some(isTheaterDecorModel);
  const hasSpotlights = args.sourceSpotlights.length > 0;
  return args.categories.filter((category) => {
    if (category === "furniture") return hasFurniture;
    if (category === "decor") return hasDecor;
    return hasSpotlights;
  });
}

function remapSpotlightMount(
  spotlight: TheaterSpotlight,
  modelIdMap: Map<number, number>,
  modelIds: Set<number>,
): TheaterSpotlight {
  if (spotlight.mountModelId == null) return spotlight;
  const mappedMountId =
    modelIdMap.get(spotlight.mountModelId) ?? spotlight.mountModelId;
  if (!modelIds.has(mappedMountId)) {
    return {
      ...spotlight,
      mountModelId: undefined,
      mountPointId: undefined,
    };
  }
  if (mappedMountId === spotlight.mountModelId) return spotlight;
  return { ...spotlight, mountModelId: mappedMountId };
}

function mergeCopiedModels(args: {
  targetModels: TheaterModel[];
  incoming: TheaterModel[];
  mode: TheaterCopyMode;
  replaceFurniture: boolean;
  replaceDecor: boolean;
}): { models: TheaterModel[]; idMap: Map<number, number> } {
  const kept =
    args.mode === "append"
      ? args.targetModels
      : args.targetModels.filter((item) => {
          const isDecor = isTheaterDecorModel(item);
          if (isDecor) return !args.replaceDecor;
          return !args.replaceFurniture;
        });
  const usedIds = collectUsedIds(kept.map((item) => item.id));
  const idMap = new Map<number, number>();
  const cloned = cloneTheaterModels(args.incoming);
  const assignNewIds = args.mode === "append";
  let cursor = usedIds.size > 0 ? Math.max(...usedIds) : 0;
  const nextIncoming = cloned.map((item) => {
    const originalId = item.id;
    let nextId = originalId;
    if (assignNewIds) {
      cursor = nextFreeId(usedIds, cursor + 1);
      nextId = cursor;
    } else if (!Number.isFinite(nextId) || nextId <= 0 || usedIds.has(nextId)) {
      nextId = nextFreeId(usedIds, nextId);
    }
    usedIds.add(nextId);
    idMap.set(originalId, nextId);
    return nextId === item.id ? item : { ...item, id: nextId };
  });
  return { models: [...kept, ...nextIncoming], idMap };
}

function mergeCopiedSpotlights(args: {
  targetSpotlights: TheaterSpotlight[];
  incoming: TheaterSpotlight[];
  mode: TheaterCopyMode;
  modelIdMap: Map<number, number>;
  nextModels: TheaterModel[];
}): TheaterSpotlight[] {
  const modelIds = new Set(args.nextModels.map((item) => item.id));
  const cloned = cloneTheaterSpotlights(args.incoming).map((item) =>
    remapSpotlightMount(item, args.modelIdMap, modelIds),
  );
  if (args.mode === "replace") {
    return syncMountedSpotlights(cloned, args.nextModels);
  }
  const usedIds = collectUsedIds(args.targetSpotlights.map((item) => item.id));
  let cursor = usedIds.size > 0 ? Math.max(...usedIds) : 0;
  const copies = cloned.map((item) => {
    cursor = nextFreeId(usedIds, cursor + 1);
    usedIds.add(cursor);
    return { ...item, id: cursor };
  });
  return syncMountedSpotlights(
    [...args.targetSpotlights, ...copies],
    args.nextModels,
  );
}

export function applyTheaterCopyToScene(args: {
  targetModels: TheaterModel[];
  targetSpotlights: TheaterSpotlight[];
  sourceModels: TheaterModel[];
  sourceSpotlights: TheaterSpotlight[];
  categories: TheaterCopyCategory[];
  mode: TheaterCopyMode;
}): { models: TheaterModel[]; spotlights: TheaterSpotlight[] } {
  const replaceFurniture = args.categories.includes("furniture");
  const replaceDecor = args.categories.includes("decor");
  const replaceSpotlights = args.categories.includes("spotlights");
  const modelsTouched = replaceFurniture || replaceDecor;
  let nextModels = args.targetModels;
  let idMap = new Map<number, number>();
  if (modelsTouched) {
    const incoming = filterModelsByCopyCategories(
      args.sourceModels,
      args.categories,
    );
    const merged = mergeCopiedModels({
      targetModels: args.targetModels,
      incoming,
      mode: args.mode,
      replaceFurniture,
      replaceDecor,
    });
    nextModels = normalizeTheaterModels(merged.models);
    idMap = merged.idMap;
  }
  if (replaceSpotlights) {
    return {
      models: nextModels,
      spotlights: mergeCopiedSpotlights({
        targetSpotlights: args.targetSpotlights,
        incoming: args.sourceSpotlights,
        mode: args.mode,
        modelIdMap: idMap,
        nextModels,
      }),
    };
  }
  if (!modelsTouched) {
    return { models: nextModels, spotlights: args.targetSpotlights };
  }
  return {
    models: nextModels,
    spotlights: syncMountedSpotlights(args.targetSpotlights, nextModels),
  };
}

export type TheaterCopySceneResult = {
  patch: Partial<ScriptScene>;
  appliedCategories: TheaterCopyCategory[];
};

export function buildCopiedTheaterScenePatch(args: {
  targetScene: Pick<
    ScriptScene,
    "theaterModels" | "theaterDecor" | "theaterSpotlights"
  >;
  sourceModels: TheaterModel[];
  sourceSpotlights: TheaterSpotlight[];
  categories: TheaterCopyCategory[];
  mode: TheaterCopyMode;
  layout: TheaterLayout;
  skipEmptyCategories?: boolean;
}): TheaterCopySceneResult {
  const skipEmptyCategories = args.skipEmptyCategories !== false;
  const appliedCategories = resolveActiveCopyCategories({
    categories: args.categories,
    sourceModels: args.sourceModels,
    sourceSpotlights: args.sourceSpotlights,
    skipEmptyCategories,
  });
  if (appliedCategories.length === 0) {
    return { patch: {}, appliedCategories };
  }
  const targetModels = readSceneTheaterModels(args.targetScene);
  const targetSpotlights = args.targetScene.theaterSpotlights ?? [];
  const result = applyTheaterCopyToScene({
    targetModels,
    targetSpotlights,
    sourceModels: args.sourceModels,
    sourceSpotlights: args.sourceSpotlights,
    categories: appliedCategories,
    mode: args.mode,
  });
  const modelsTouched =
    appliedCategories.includes("furniture") ||
    appliedCategories.includes("decor");
  const lightsTouched = appliedCategories.includes("spotlights");
  const patch: Partial<ScriptScene> = {};
  if (modelsTouched) {
    Object.assign(patch, writeSceneTheaterModels(result.models));
    if (
      args.mode === "replace" &&
      appliedCategories.includes("furniture") &&
      appliedCategories.includes("decor")
    ) {
      patch.theaterActiveModelId = undefined;
    }
  }
  if (lightsTouched) {
    patch.theaterSpotlights = result.spotlights;
    patch.lightPlot = buildLightPlotFromSpotlights(result.spotlights, args.layout);
    if (args.mode === "replace") {
      patch.theaterActiveSpotlightId = result.spotlights[0]?.id;
    }
  } else if (modelsTouched) {
    const lightsChanged = result.spotlights.some(
      (item, index) => item !== targetSpotlights[index],
    );
    if (lightsChanged) {
      patch.theaterSpotlights = result.spotlights;
      patch.lightPlot = buildLightPlotFromSpotlights(
        result.spotlights,
        args.layout,
      );
    }
  }
  return { patch, appliedCategories };
}

export function readTheaterSnapshotCopySource(
  snapshot: SceneLightKadrTheaterSnapshotV1 | null | undefined,
): { models: TheaterModel[]; spotlights: TheaterSpotlight[] } {
  if (!snapshot) return { models: [], spotlights: [] };
  return {
    models: [
      ...(snapshot.theaterModels ?? []),
      ...(snapshot.theaterDecor ?? []),
    ],
    spotlights: snapshot.theaterSpotlights ?? [],
  };
}

export function buildCopiedTheaterSnapshot(args: {
  snapshot: SceneLightKadrTheaterSnapshotV1 | null | undefined;
  sourceModels: TheaterModel[];
  sourceSpotlights: TheaterSpotlight[];
  categories: TheaterCopyCategory[];
  mode: TheaterCopyMode;
  skipEmptyCategories?: boolean;
}): {
  snapshot: SceneLightKadrTheaterSnapshotV1;
  appliedCategories: TheaterCopyCategory[];
} {
  const appliedCategories = resolveActiveCopyCategories({
    categories: args.categories,
    sourceModels: args.sourceModels,
    sourceSpotlights: args.sourceSpotlights,
    skipEmptyCategories: args.skipEmptyCategories !== false,
  });
  const existing = args.snapshot ?? {};
  const existingSource = readTheaterSnapshotCopySource(existing);
  if (appliedCategories.length === 0) {
    return { snapshot: existing, appliedCategories };
  }
  const result = applyTheaterCopyToScene({
    targetModels: existingSource.models,
    targetSpotlights: existingSource.spotlights,
    sourceModels: args.sourceModels,
    sourceSpotlights: args.sourceSpotlights,
    categories: appliedCategories,
    mode: args.mode,
  });
  const split = splitSceneTheaterModels(result.models);
  return {
    snapshot: {
      theaterModels: split.theaterModels,
      theaterDecor: split.theaterDecor,
      theaterSpotlights: result.spotlights,
      theaterSmokeMachine: existing.theaterSmokeMachine,
    },
    appliedCategories,
  };
}
