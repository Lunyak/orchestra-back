import type { ScriptStep, TheaterModel } from "../../../shared/types/script";
import { isTheaterDecorModel } from "./theater-decor-catalog";

export function readStepTheaterModels(
  step: Pick<ScriptStep, "theaterModels" | "theaterDecor"> | undefined,
): TheaterModel[] {
  const props = step?.theaterModels ?? [];
  const decor = step?.theaterDecor;
  if (!decor?.length) return props;
  return [...props, ...decor];
}

export function splitStepTheaterModels(models: TheaterModel[]): {
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

export function writeStepTheaterModels(
  models: TheaterModel[],
): Pick<ScriptStep, "theaterModels" | "theaterDecor"> {
  return splitStepTheaterModels(models);
}

/** Payload for sync push (props + decor arrays). */
export function stepTheaterSyncPayload(
  step: Pick<ScriptStep, "theaterModels" | "theaterDecor"> | undefined | null,
): { theaterModels: TheaterModel[]; theaterDecor: TheaterModel[] } {
  if (!step) return { theaterModels: [], theaterDecor: [] };
  if (Array.isArray(step.theaterDecor)) {
    return {
      theaterModels: step.theaterModels ?? [],
      theaterDecor: step.theaterDecor,
    };
  }
  const split = splitStepTheaterModels(readStepTheaterModels(step));
  return {
    theaterModels: split.theaterModels,
    theaterDecor: split.theaterDecor ?? [],
  };
}
