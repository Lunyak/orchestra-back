import type { ScriptScene, TheaterModel } from "../../../shared/types/script";
import { isTheaterDecorModel } from "./theater-decor-catalog";

export function readSceneTheaterModels(
  scene: Pick<ScriptScene, "theaterModels" | "theaterDecor"> | undefined,
): TheaterModel[] {
  const props = scene?.theaterModels ?? [];
  const decor = scene?.theaterDecor ?? [];
  const combined = decor.length > 0 ? [...props, ...decor] : props;
  const seenIds = new Set<number>();
  const unique: TheaterModel[] = [];
  for (const model of combined) {
    if (seenIds.has(model.id)) continue;
    seenIds.add(model.id);
    unique.push(model);
  }
  return unique;
}

export function splitSceneTheaterModels(models: TheaterModel[]): {
  theaterModels: TheaterModel[];
  theaterDecor?: TheaterModel[];
} {
  const theaterModels: TheaterModel[] = [];
  const theaterDecor: TheaterModel[] = [];
  for (const model of models) {
    if (isTheaterDecorModel(model)) theaterDecor.push(model);
    else theaterModels.push(model);
  }
  return {
    theaterModels,
    theaterDecor: theaterDecor.length > 0 ? theaterDecor : undefined,
  };
}

export function writeSceneTheaterModels(
  models: TheaterModel[],
): Pick<ScriptScene, "theaterModels" | "theaterDecor"> {
  const split = splitSceneTheaterModels(models);
  return {
    theaterModels: split.theaterModels,
    theaterDecor: split.theaterDecor ?? [],
  };
}

/** Payload for sync push (props + decor arrays). */
export function sceneTheaterSyncPayload(
  scene: Pick<ScriptScene, "theaterModels" | "theaterDecor"> | undefined | null,
): { theaterModels: TheaterModel[]; theaterDecor: TheaterModel[] } {
  if (!scene) return { theaterModels: [], theaterDecor: [] };
  if (Array.isArray(scene.theaterDecor)) {
    return {
      theaterModels: scene.theaterModels ?? [],
      theaterDecor: scene.theaterDecor,
    };
  }
  const split = splitSceneTheaterModels(readSceneTheaterModels(scene));
  return {
    theaterModels: split.theaterModels,
    theaterDecor: split.theaterDecor ?? [],
  };
}
