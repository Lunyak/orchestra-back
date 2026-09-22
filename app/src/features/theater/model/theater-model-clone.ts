import type { TheaterModel } from "../../../shared/types/script";

export type TheaterAdjacentSceneDirection = "previous" | "next";

export function cloneTheaterModels(source: TheaterModel[]): TheaterModel[] {
  return source.map((item) => ({
    ...item,
    position: [...item.position] as [number, number, number],
    rotation: [...item.rotation] as [number, number, number],
    scale: [...item.scale] as [number, number, number],
    ...(item.decorSize
      ? { decorSize: [...item.decorSize] as [number, number, number] }
      : {}),
  }));
}

export function resolveAdjacentSceneIndex(
  currentPage: number,
  sceneCount: number,
  direction: TheaterAdjacentSceneDirection,
): number | null {
  const nextIndex = direction === "previous" ? currentPage - 1 : currentPage + 1;
  if (nextIndex < 0 || nextIndex >= sceneCount) return null;
  return nextIndex;
}

function collectUsedTheaterModelIds(models: TheaterModel[]): Set<number> {
  const usedIds = new Set<number>();
  for (const item of models) {
    const id = Number(item.id);
    if (Number.isFinite(id) && id > 0) usedIds.add(id);
  }
  return usedIds;
}

function nextFreeTheaterModelId(usedIds: Set<number>, fromId: number): number {
  let nextId = Number.isFinite(fromId) && fromId > 0 ? Math.trunc(fromId) : 1;
  while (usedIds.has(nextId)) nextId += 1;
  return nextId;
}

/** Copies models onto another scene with new ids and the same coordinates. */
export function appendClonedTheaterModels(
  existing: TheaterModel[],
  source: TheaterModel[],
): TheaterModel[] {
  const usedIds = collectUsedTheaterModelIds(existing);
  let nextId = usedIds.size > 0 ? Math.max(...usedIds) : 0;
  const copies = cloneTheaterModels(source).map((item) => {
    nextId = nextFreeTheaterModelId(usedIds, nextId + 1);
    usedIds.add(nextId);
    return { ...item, id: nextId };
  });
  return [...existing, ...copies];
}
