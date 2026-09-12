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

/** Copies models onto another scene with new ids and the same coordinates. */
export function appendClonedTheaterModels(
  existing: TheaterModel[],
  source: TheaterModel[],
): TheaterModel[] {
  let nextId = existing.reduce((acc, item) => Math.max(acc, item.id), 0);
  const copies = cloneTheaterModels(source).map((item) => {
    nextId += 1;
    return { ...item, id: nextId };
  });
  return [...existing, ...copies];
}
