import type {
  LightCue,
  LightFixture,
  ScriptRequisite,
  ScriptScene,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { cloneTheaterModels, cloneTheaterSpotlights } from "./theater-history";
import { readSceneTheaterModels, writeSceneTheaterModels } from "./theater-scene-models";

export type CopySceneTheaterLayoutOptions = {
  includeRequisites?: boolean;
  includeLightCues?: boolean;
};

export function sceneHasTheaterLayoutContent(
  scene: Pick<
    ScriptScene,
    "theaterSpotlights" | "theaterModels" | "theaterDecor" | "lightPlot" | "requisites"
  > | null | undefined,
): boolean {
  if (!scene) return false;
  const models = readSceneTheaterModels(scene);
  const spotlights = scene.theaterSpotlights ?? [];
  const lightPlot = scene.lightPlot ?? [];
  const requisites = scene.requisites ?? [];
  return models.length > 0 || spotlights.length > 0 || lightPlot.length > 0 || requisites.length > 0;
}

export function buildCopySceneTheaterLayoutPatch(args: {
  spotlights: TheaterSpotlight[];
  models: TheaterModel[];
  lightPlot?: LightFixture[] | null;
  requisites?: ScriptRequisite[] | null;
  lightCues?: LightCue[] | null;
  options?: CopySceneTheaterLayoutOptions;
}): Partial<ScriptScene> {
  const clonedSpotlights = cloneTheaterSpotlights(args.spotlights);
  const clonedModels = cloneTheaterModels(args.models);
  const includeRequisites = args.options?.includeRequisites !== false;
  const includeLightCues = args.options?.includeLightCues === true;

  const patch: Partial<ScriptScene> = {
    theaterSpotlights: clonedSpotlights,
    ...writeSceneTheaterModels(clonedModels),
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

export function buildCopySceneTheaterLayoutPatchFromScene(
  sourceScene: ScriptScene,
  options?: CopySceneTheaterLayoutOptions,
): Partial<ScriptScene> {
  return buildCopySceneTheaterLayoutPatch({
    spotlights: sourceScene.theaterSpotlights ?? [],
    models: readSceneTheaterModels(sourceScene),
    lightPlot: sourceScene.lightPlot,
    requisites: sourceScene.requisites,
    lightCues: sourceScene.lightCues,
    options,
  });
}
