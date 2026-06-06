import type {
  LightCue,
  LightFixture,
  ScriptRequisite,
  ScriptStep,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { cloneTheaterModels, cloneTheaterSpotlights } from "./theater-history";
import { readStepTheaterModels, writeStepTheaterModels } from "./theater-step-models";

export type CopyStepTheaterSceneOptions = {
  includeRequisites?: boolean;
  includeLightCues?: boolean;
};

export function stepHasTheaterSceneContent(
  step: Pick<
    ScriptStep,
    "theaterSpotlights" | "theaterModels" | "theaterDecor" | "lightPlot" | "requisites"
  > | null | undefined,
): boolean {
  if (!step) return false;
  const models = readStepTheaterModels(step);
  const spotlights = step.theaterSpotlights ?? [];
  const lightPlot = step.lightPlot ?? [];
  const requisites = step.requisites ?? [];
  return models.length > 0 || spotlights.length > 0 || lightPlot.length > 0 || requisites.length > 0;
}

export function buildCopyStepTheaterScenePatch(args: {
  spotlights: TheaterSpotlight[];
  models: TheaterModel[];
  lightPlot?: LightFixture[] | null;
  requisites?: ScriptRequisite[] | null;
  lightCues?: LightCue[] | null;
  options?: CopyStepTheaterSceneOptions;
}): Partial<ScriptStep> {
  const clonedSpotlights = cloneTheaterSpotlights(args.spotlights);
  const clonedModels = cloneTheaterModels(args.models);
  const includeRequisites = args.options?.includeRequisites !== false;
  const includeLightCues = args.options?.includeLightCues === true;

  const patch: Partial<ScriptStep> = {
    theaterSpotlights: clonedSpotlights,
    ...writeStepTheaterModels(clonedModels),
    ...(args.lightPlot?.length
      ? { lightPlot: args.lightPlot.map((fixture) => ({ ...fixture })) }
      : {}),
    theaterActiveSpotlightId: clonedSpotlights[0]?.id,
    theaterActiveModelId: clonedModels[0]?.id,
  };

  if (includeRequisites && args.requisites?.length) {
    patch.requisites = args.requisites.map((item) => ({ ...item }));
  }

  if (includeLightCues && args.lightCues?.length) {
    patch.lightCues = args.lightCues.map((cue) => ({ ...cue }));
  }

  return patch;
}

export function buildCopyStepTheaterScenePatchFromStep(
  sourceStep: ScriptStep,
  options?: CopyStepTheaterSceneOptions,
): Partial<ScriptStep> {
  return buildCopyStepTheaterScenePatch({
    spotlights: sourceStep.theaterSpotlights ?? [],
    models: readStepTheaterModels(sourceStep),
    lightPlot: sourceStep.lightPlot,
    requisites: sourceStep.requisites,
    lightCues: sourceStep.lightCues,
    options,
  });
}
