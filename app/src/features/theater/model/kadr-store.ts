import type {
  SceneLightKadrProjectorCueV1,
  SceneLightKadrSoundCueV1,
  SceneLightKadrTheaterSnapshotV1,
  SceneLightKadrV1,
  SceneLightKadrsDataV1,
  ScriptScene,
} from "../../../shared/types/script";
import type { PlaybookLightFadersDataV1 } from "../../playbook/model/playbook-slice";
import {
  applyKadrToFaders,
  createLightKadrId,
  findKadrById,
  lightKadrsStableKey,
  readSceneLightKadrs,
  renumberSceneLightKadrs,
  upsertKadrInScene,
} from "./light-kadrs";

export function kadrDisplayTitle(kadr: SceneLightKadrV1): string {
  const title = String(kadr.title ?? "").trim();
  return title || `Картина ${kadr.kadrNo}`;
}

export function insertKadrInSceneData(args: {
  scene: ScriptScene;
  afterKadrId?: string | null;
  kadrId?: string;
  title?: string;
  imageMarkdown?: string;
  theaterSnapshot?: SceneLightKadrTheaterSnapshotV1 | null;
}): { nextKadrs: SceneLightKadrsDataV1; kadrId: string; kadrNo: number } {
  const kadrId = args.kadrId ?? createLightKadrId();
  const prev = readSceneLightKadrs(args.scene);
  const sorted = [...prev.kadrs].sort(
    (a, b) => a.kadrNo - b.kadrNo || a.id.localeCompare(b.id),
  );
  let insertIndex = sorted.length;
  if (args.afterKadrId) {
    const afterIndex = sorted.findIndex((kadr) => kadr.id === args.afterKadrId);
    if (afterIndex >= 0) insertIndex = afterIndex + 1;
  }

  const stub: SceneLightKadrV1 = {
    id: kadrId,
    kadrNo: insertIndex + 1,
    programId: 1,
    faders: [],
    updatedAt: new Date().toISOString(),
    ...(args.title ? { title: args.title } : {}),
    ...(args.imageMarkdown ? { imageMarkdown: args.imageMarkdown } : {}),
    ...(args.theaterSnapshot ? { theaterSnapshot: args.theaterSnapshot } : {}),
  };
  const withStub = [
    ...sorted.slice(0, insertIndex),
    stub,
    ...sorted.slice(insertIndex),
  ];
  const nextKadrs = renumberSceneLightKadrs({ v: 1, kadrs: withStub });
  const created = findKadrById(nextKadrs, kadrId);
  return {
    nextKadrs,
    kadrId,
    kadrNo: created?.kadrNo ?? insertIndex + 1,
  };
}

export function upsertFullKadrInScene(args: {
  kadrs: SceneLightKadrsDataV1;
  kadr: SceneLightKadrV1;
}): SceneLightKadrsDataV1 {
  return upsertKadrInScene({
    kadrs: args.kadrs,
    kadr: {
      ...args.kadr,
      updatedAt: args.kadr.updatedAt ?? new Date().toISOString(),
    },
  });
}

export function copyKadrLookToTarget(args: {
  kadrs: SceneLightKadrsDataV1;
  sourceKadrId: string;
  targetKadrId: string;
}): SceneLightKadrsDataV1 | null {
  const source = findKadrById(args.kadrs, args.sourceKadrId);
  const target = findKadrById(args.kadrs, args.targetKadrId);
  if (!source || !target) return null;
  const nextKadr: SceneLightKadrV1 = {
    ...source,
    id: target.id,
    kadrNo: target.kadrNo,
    title: target.title ?? source.title,
    updatedAt: new Date().toISOString(),
  };
  return upsertFullKadrInScene({ kadrs: args.kadrs, kadr: nextKadr });
}

export type ApplyKadrLookResult = {
  faders: PlaybookLightFadersDataV1;
  programId: number | null;
  smokeMachine: boolean | undefined;
  sound?: SceneLightKadrSoundCueV1;
  projector?: SceneLightKadrProjectorCueV1;
};

/** Look картины → пульт (фейдеры / программа) + флаги для 3D / медиа. */
export function applyKadrLook(
  kadr: SceneLightKadrV1,
  faders: PlaybookLightFadersDataV1,
): ApplyKadrLookResult {
  return {
    faders: applyKadrToFaders(kadr, faders),
    programId: kadr.programId > 0 ? kadr.programId : null,
    smokeMachine: kadr.smokeMachine === true ? true : undefined,
    sound: kadr.sound,
    projector: kadr.projector,
  };
}

export function sceneLightKadrsChanged(
  prev: SceneLightKadrsDataV1 | null | undefined,
  next: SceneLightKadrsDataV1 | null | undefined,
): boolean {
  return lightKadrsStableKey(prev) !== lightKadrsStableKey(next);
}
