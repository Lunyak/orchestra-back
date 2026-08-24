import type {
  SceneLightKadrTheaterSnapshotV1,
  ScriptScene,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { cloneTheaterModels, cloneTheaterSpotlights } from "./theater-history";
import {
  sceneTheaterSyncPayload,
  writeSceneTheaterModels,
} from "./theater-scene-models";

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Снимок мизансцены текущей сцены для картины. */
export function captureSceneTheaterSnapshot(
  scene: ScriptScene | null | undefined,
): SceneLightKadrTheaterSnapshotV1 | null {
  if (!scene) return null;
  const { theaterModels, theaterDecor } = sceneTheaterSyncPayload(scene);
  const spotlights = scene.theaterSpotlights ?? [];
  return {
    theaterModels: cloneTheaterModels(theaterModels),
    theaterDecor: theaterDecor.length > 0 ? cloneTheaterModels(theaterDecor) : undefined,
    theaterSpotlights: cloneTheaterSpotlights(spotlights),
    theaterSmokeMachine: scene.theaterSmokeMachine === true,
  };
}

/** Применить снапшот картины к сцене (viewport 3D). */
export function buildTheaterSnapshotScenePatch(
  snapshot: SceneLightKadrTheaterSnapshotV1,
): Partial<ScriptScene> {
  const models: TheaterModel[] = [
    ...(Array.isArray(snapshot.theaterModels)
      ? cloneTheaterModels(snapshot.theaterModels)
      : []),
    ...(Array.isArray(snapshot.theaterDecor)
      ? cloneTheaterModels(snapshot.theaterDecor)
      : []),
  ];
  const spotlights: TheaterSpotlight[] = Array.isArray(snapshot.theaterSpotlights)
    ? cloneTheaterSpotlights(snapshot.theaterSpotlights)
    : [];

  return {
    ...writeSceneTheaterModels(models),
    theaterSpotlights: spotlights,
    theaterActiveSpotlightId: spotlights[0]?.id,
    theaterActiveModelId: models[0]?.id,
    theaterSmokeMachine: snapshot.theaterSmokeMachine === true,
  };
}

export function cloneTheaterSnapshot(
  snapshot: SceneLightKadrTheaterSnapshotV1 | null | undefined,
): SceneLightKadrTheaterSnapshotV1 | null {
  if (!snapshot) return null;
  return cloneJson(snapshot);
}
