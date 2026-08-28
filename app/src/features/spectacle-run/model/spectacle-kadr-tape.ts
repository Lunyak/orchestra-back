import {
  buildSceneKadrTape,
  type SceneKadrTapeItem,
} from "../../theater/model/scene-kadr-tape";
import type { ScriptScene } from "../../../shared/types/script";

export type SpectacleTapeItem = SceneKadrTapeItem;

export function buildSpectacleKadrTape(scenes: ScriptScene[]): SpectacleTapeItem[] {
  return buildSceneKadrTape(scenes);
}

export type SpectacleTapeSceneGroup = {
  sceneIndex: number;
  sceneId: number;
  sceneOrdinal: number;
  sceneTitle: string;
  items: Array<{ tapeIndex: number; item: SpectacleTapeItem }>;
};

/** Группы ленты по сценам сценария — для нижней полосы кадров. */
export function buildSpectacleTapeSceneGroups(
  tape: SpectacleTapeItem[],
): SpectacleTapeSceneGroup[] {
  const groups: SpectacleTapeSceneGroup[] = [];
  let group: SpectacleTapeSceneGroup | null = null;

  tape.forEach((item, tapeIndex) => {
    if (!group || group.sceneId !== item.sceneId) {
      group = {
        sceneIndex: item.sceneIndex,
        sceneId: item.sceneId,
        sceneOrdinal: item.sceneOrdinal,
        sceneTitle: item.sceneTitle,
        items: [],
      };
      groups.push(group);
    }
    group.items.push({ tapeIndex, item });
  });

  return groups;
}

export function isLastTapeItemInScene(
  tape: SpectacleTapeItem[],
  index: number,
): boolean {
  const item = tape[index];
  if (!item) return true;
  const next = tape[index + 1];
  return !next || next.sceneId !== item.sceneId;
}

export { nextKadrNumberForScene } from "../../theater/model/light-kadrs";

export type InsertKadrAfterTarget = {
  id?: string | null;
  kadrNo?: number;
};

export function findTapeIndexForSceneKadr(
  tape: SpectacleTapeItem[],
  sceneIndex: number,
  kadrId: string | null,
  kadrNo?: number,
): number {
  if (kadrId) {
    const byId = tape.findIndex((item) => item.kadrId === kadrId);
    if (byId >= 0) return byId;
  }
  if (sceneIndex >= 0 && kadrNo != null && kadrNo > 0) {
    const byNo = tape.findIndex(
      (item) => item.sceneIndex === sceneIndex && item.kadrNo === kadrNo,
    );
    if (byNo >= 0) return byNo;
  }
  if (sceneIndex >= 0) {
    return tape.findIndex((item) => item.sceneIndex === sceneIndex);
  }
  return -1;
}
