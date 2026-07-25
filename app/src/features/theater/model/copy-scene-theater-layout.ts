import type {
  LightCue,
  ScriptRequisite,
  ScriptScene,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { DEFAULT_THEATER_LAYOUT } from "./theater-defaults";
import { buildLightPlotFromSpotlights } from "./theater-light-channel-link";
import { cloneTheaterModels, cloneTheaterSpotlights } from "./theater-history";
import { readSceneTheaterModels, writeSceneTheaterModels } from "./theater-scene-models";

export type CopySceneTheaterLayoutOptions = {
  includeRequisites?: boolean;
  includeLightCues?: boolean;
  includeLightKadrs?: boolean;
  includeSmokeMachine?: boolean;
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
  const requisites = scene.requisites ?? [];
  return models.length > 0 || spotlights.length > 0 || requisites.length > 0;
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function buildCopySceneTheaterLayoutPatch(args: {
  spotlights: TheaterSpotlight[];
  models: TheaterModel[];
  layout?: TheaterLayout | null;
  requisites?: ScriptRequisite[] | null;
  lightCues?: LightCue[] | null;
  lightKadrs?: ScriptScene["lightKadrs"];
  theaterSmokeMachine?: boolean;
  options?: CopySceneTheaterLayoutOptions;
}): Partial<ScriptScene> {
  const clonedSpotlights = cloneTheaterSpotlights(args.spotlights);
  const clonedModels = cloneTheaterModels(args.models);
  const includeRequisites = args.options?.includeRequisites !== false;
  const includeLightCues = args.options?.includeLightCues === true;
  const includeLightKadrs = args.options?.includeLightKadrs === true;
  const includeSmokeMachine = args.options?.includeSmokeMachine === true;
  const layout = args.layout ?? DEFAULT_THEATER_LAYOUT;

  const patch: Partial<ScriptScene> = {
    theaterSpotlights: clonedSpotlights,
    lightPlot: buildLightPlotFromSpotlights(clonedSpotlights, layout),
    ...writeSceneTheaterModels(clonedModels),
    theaterActiveSpotlightId: clonedSpotlights[0]?.id,
    theaterActiveModelId: clonedModels[0]?.id,
  };

  if (includeRequisites && args.requisites?.length) {
    patch.requisites = args.requisites.map((item) => ({ ...item }));
  }

  if (includeLightCues && args.lightCues?.length) {
    patch.lightCues = args.lightCues.map((cue) => ({ ...cue }));
  }

  if (includeLightKadrs && args.lightKadrs != null) {
    patch.lightKadrs = cloneJson(args.lightKadrs);
  }

  if (includeSmokeMachine) {
    patch.theaterSmokeMachine = args.theaterSmokeMachine === true;
  }

  return patch;
}

export function buildCopySceneTheaterLayoutPatchFromScene(
  sourceScene: ScriptScene,
  layout?: TheaterLayout | null,
  options?: CopySceneTheaterLayoutOptions,
): Partial<ScriptScene> {
  return buildCopySceneTheaterLayoutPatch({
    spotlights: sourceScene.theaterSpotlights ?? [],
    models: readSceneTheaterModels(sourceScene),
    layout,
    requisites: sourceScene.requisites,
    lightCues: sourceScene.lightCues,
    lightKadrs: sourceScene.lightKadrs,
    theaterSmokeMachine: sourceScene.theaterSmokeMachine,
    options,
  });
}
