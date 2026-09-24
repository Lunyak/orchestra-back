import type {
  SceneLightKadrTheaterSnapshotV1,
  SceneLightKadrsDataV1,
  ScriptScene,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import { cloneTheaterModels, cloneTheaterSpotlights } from "./theater-history";
import { findKadrById, readSceneLightKadrs } from "./light-kadrs";
import {
  readSceneTheaterModels,
  sceneTheaterSyncPayload,
  splitSceneTheaterModels,
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

export function buildTheaterSnapshotFromSet(args: {
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
  smokeEnabled: boolean;
}): SceneLightKadrTheaterSnapshotV1 {
  const split = splitSceneTheaterModels(args.models);
  return {
    theaterModels: cloneTheaterModels(split.theaterModels),
    ...(split.theaterDecor
      ? { theaterDecor: cloneTheaterModels(split.theaterDecor) }
      : {}),
    theaterSpotlights: cloneTheaterSpotlights(args.spotlights),
    theaterSmokeMachine: args.smokeEnabled === true,
  };
}

export function theaterSnapshotMatchesScene(
  scene: ScriptScene,
  snapshot: SceneLightKadrTheaterSnapshotV1,
): boolean {
  const current = buildTheaterSnapshotFromSet({
    models: readSceneTheaterModels(scene),
    spotlights: scene.theaterSpotlights ?? [],
    smokeEnabled: scene.theaterSmokeMachine === true,
  });
  return JSON.stringify(current) === JSON.stringify(snapshot);
}

function withKadrSnapshot(
  scene: ScriptScene,
  kadrId: string,
  snapshot: SceneLightKadrTheaterSnapshotV1,
  forkMissingFrom: SceneLightKadrTheaterSnapshotV1 | null,
): SceneLightKadrsDataV1 | null {
  const kadrs = readSceneLightKadrs(scene);
  if (!findKadrById(kadrs, kadrId)) return null;
  const updatedAt = new Date().toISOString();
  let changed = false;
  const nextKadrs = kadrs.kadrs.map((kadr) => {
    if (kadr.id === kadrId) {
      changed = true;
      return { ...kadr, theaterSnapshot: snapshot, updatedAt };
    }
    if (!kadr.theaterSnapshot && forkMissingFrom) {
      changed = true;
      return {
        ...kadr,
        theaterSnapshot: cloneTheaterSnapshot(forkMissingFrom) ?? forkMissingFrom,
        updatedAt,
      };
    }
    return kadr;
  });
  if (!changed) return null;
  return { v: 1, kadrs: nextKadrs };
}

/** Положение сета после правки — только у активной картины. Остальные без снимка получают состояние до правки. */
export function commitActiveKadrTheaterSet(args: {
  scene: ScriptScene;
  activeKadrId: string | null;
  previousModels: TheaterModel[];
  nextModels: TheaterModel[];
  previousSpotlights: TheaterSpotlight[];
  nextSpotlights: TheaterSpotlight[];
}): SceneLightKadrsDataV1 | null {
  if (!args.activeKadrId) return null;
  const smokeEnabled = args.scene.theaterSmokeMachine === true;
  const previous = buildTheaterSnapshotFromSet({
    models: args.previousModels,
    spotlights: args.previousSpotlights,
    smokeEnabled,
  });
  const next = buildTheaterSnapshotFromSet({
    models: args.nextModels,
    spotlights: args.nextSpotlights,
    smokeEnabled,
  });
  return withKadrSnapshot(args.scene, args.activeKadrId, next, previous);
}

export function writeTheaterSnapshotOntoKadr(
  scene: ScriptScene,
  kadrId: string | null,
  snapshot: SceneLightKadrTheaterSnapshotV1,
): SceneLightKadrsDataV1 | null {
  if (!kadrId) return null;
  return withKadrSnapshot(scene, kadrId, snapshot, null);
}

export function writeSceneTheaterOntoKadr(
  scene: ScriptScene,
  kadrId: string | null,
): SceneLightKadrsDataV1 | null {
  if (!kadrId) return null;
  const snapshot = buildTheaterSnapshotFromSet({
    models: readSceneTheaterModels(scene),
    spotlights: scene.theaterSpotlights ?? [],
    smokeEnabled: scene.theaterSmokeMachine === true,
  });
  const existing = findKadrById(readSceneLightKadrs(scene), kadrId);
  if (
    existing?.theaterSnapshot &&
    JSON.stringify(existing.theaterSnapshot) === JSON.stringify(snapshot)
  ) {
    return null;
  }
  return writeTheaterSnapshotOntoKadr(scene, kadrId, snapshot);
}
