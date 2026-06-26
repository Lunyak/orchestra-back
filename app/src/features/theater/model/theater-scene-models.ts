import type { ScriptScene, TheaterModel } from "../../../shared/types/script";
import { isTheaterDecorModel } from "./theater-decor-catalog";

export function readSceneTheaterModels(
  scene: Pick<ScriptScene, "theaterModels" | "theaterDecor"> | undefined,
): TheaterModel[] {
  const props = scene?.theaterModels ?? [];
  const decor = scene?.theaterDecor;
  if (!decor?.length) return props;
  return [...props, ...decor];
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
  return splitSceneTheaterModels(models);
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
