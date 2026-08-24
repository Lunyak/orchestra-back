import type { MarkdownKadrSection } from "../../theater/model/light-kadrs";
import { insertKadrInSceneData } from "../../theater/model/kadr-store";
import {
  buildSceneKadrTape,
  type SceneKadrTapeItem,
} from "../../theater/model/scene-kadr-tape";
import type { ScriptScene, SceneLightKadrsDataV1 } from "../../../shared/types/script";

export type SpectacleTapeItem = SceneKadrTapeItem & {
  /** @deprecated markdown-секции больше не SoT; всегда null для JSON-ленты */
  section: MarkdownKadrSection | null;
};

export function buildSpectacleKadrTape(scenes: ScriptScene[]): SpectacleTapeItem[] {
  return buildSceneKadrTape(scenes).map((item) => ({
    ...item,
    section: null,
  }));
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

/** @deprecated используйте insertKadrInSceneData из kadr-store */
export function insertKadrAfterInScene(args: {
  scene: ScriptScene;
  after?: InsertKadrAfterTarget | null;
  kadrId?: string;
}): { nextMarkdown: string; nextKadrs: SceneLightKadrsDataV1; kadrId: string; kadrNo: number } {
  const result = insertKadrInSceneData({
    scene: args.scene,
    afterKadrId: args.after?.id ?? null,
    kadrId: args.kadrId,
  });
  return {
    nextMarkdown: String(args.scene.markdown ?? ""),
    nextKadrs: result.nextKadrs,
    kadrId: result.kadrId,
    kadrNo: result.kadrNo,
  };
}

/** @deprecated */
export function appendKadrToScene(args: {
  scene: ScriptScene;
  kadrNo?: number;
  kadrId?: string;
}): { nextMarkdown: string; nextKadrs: SceneLightKadrsDataV1; kadrId: string; kadrNo: number } {
  return insertKadrAfterInScene({ scene: args.scene, after: null, kadrId: args.kadrId });
}

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
