import type { TheaterModel } from "../../../shared/types/script";
import { isParametricDecorBuiltin } from "./theater-decor-catalog";
import {
  getFurnitureBounds,
  getFurnitureBoundsYOffset,
} from "./theater-furniture-metrics";

export const INSTANCED_FURNITURE_BUILTINS = new Set<
  NonNullable<TheaterModel["builtin"]>
>(["blackCube"]);

export type FurnitureInstanceGroup = {
  key: string;
  builtin: NonNullable<TheaterModel["builtin"]>;
  color: string;
  models: TheaterModel[];
};

export function canInstanceTheaterModel(model: TheaterModel): boolean {
  if (model.type === "file" || model.file) return false;
  if (model.isRequisite === true) return false;
  if (!model.builtin || !INSTANCED_FURNITURE_BUILTINS.has(model.builtin)) {
    return false;
  }
  if (model.decorTexture || isParametricDecorBuiltin(model.builtin)) return false;
  return true;
}

export function splitModelsForFurnitureInstancing(
  models: TheaterModel[],
  excludeIds: ReadonlySet<number>,
): {
  instanced: TheaterModel[];
  individual: TheaterModel[];
} {
  const instanced: TheaterModel[] = [];
  const individual: TheaterModel[] = [];

  for (const model of models) {
    if (excludeIds.has(model.id) || !canInstanceTheaterModel(model)) {
      individual.push(model);
      continue;
    }
    instanced.push(model);
  }

  return { instanced, individual };
}

export function groupFurnitureInstances(
  models: TheaterModel[],
): FurnitureInstanceGroup[] {
  const map = new Map<string, FurnitureInstanceGroup>();

  for (const model of models) {
    if (!model.builtin) continue;
    const color = model.decorColor ?? "default";
    const scaleKey = model.scale.map((value) => value.toFixed(3)).join(",");
    const key = `${model.builtin}|${color}|${scaleKey}`;
    const existing = map.get(key);
    if (existing) {
      existing.models.push(model);
      continue;
    }
    map.set(key, {
      key,
      builtin: model.builtin,
      color,
      models: [model],
    });
  }

  return Array.from(map.values());
}

export function getFurnitureInstanceGeometry(
  builtin: NonNullable<TheaterModel["builtin"]>,
): [number, number, number] {
  return getFurnitureBounds(builtin);
}

export function getFurnitureInstanceYOffset(
  builtin: NonNullable<TheaterModel["builtin"]>,
): number {
  return getFurnitureBoundsYOffset(builtin);
}
