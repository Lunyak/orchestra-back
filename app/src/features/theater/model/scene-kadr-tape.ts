import type { ScriptScene } from "../../../shared/types/script";
import { readSceneLightKadrs } from "./light-kadrs";
import { kadrDisplayTitle } from "./kadr-store";

/** Элемент единой ленты «сцена → картины» (прогон и 3D-театр). */
export type SceneKadrTapeItem = {
  sceneIndex: number;
  sceneId: number;
  sceneTitle: string;
  /** Порядковый номер сцены в спектакле (1-based). */
  sceneOrdinal: number;
  kadrNo: number;
  kadrId: string | null;
  headingTitle: string;
  /** Сцена без картин — placeholder в ленте. */
  isPlaceholder?: boolean;
};

export type SceneKadrTapeGroup = {
  sceneIndex: number;
  sceneId: number;
  sceneOrdinal: number;
  sceneTitle: string;
  items: Array<{ tapeIndex: number; item: SceneKadrTapeItem }>;
};

/** Плоская лента по всем сценам playbook. */
export function buildSceneKadrTape(scenes: ScriptScene[]): SceneKadrTapeItem[] {
  const items: SceneKadrTapeItem[] = [];

  scenes.forEach((scene, sceneIndex) => {
    const sceneOrdinal = sceneIndex + 1;
    const sceneTitle = String(scene.title ?? "").trim() || `Сцена ${sceneOrdinal}`;
    const kadrs = readSceneLightKadrs(scene);
    const sorted = [...kadrs.kadrs].sort(
      (a, b) => a.kadrNo - b.kadrNo || a.id.localeCompare(b.id),
    );

    if (sorted.length > 0) {
      for (const kadr of sorted) {
        items.push({
          sceneIndex,
          sceneId: scene.id,
          sceneTitle,
          sceneOrdinal,
          kadrNo: kadr.kadrNo,
          kadrId: kadr.id,
          headingTitle: kadrDisplayTitle(kadr),
        });
      }
      return;
    }

    items.push({
      sceneIndex,
      sceneId: scene.id,
      sceneTitle,
      sceneOrdinal,
      kadrNo: 0,
      kadrId: null,
      headingTitle: "Без картин",
      isPlaceholder: true,
    });
  });

  return items;
}

/** Группы ленты по сценам. */
export function buildSceneKadrTapeGroups(
  tape: SceneKadrTapeItem[],
): SceneKadrTapeGroup[] {
  const groups: SceneKadrTapeGroup[] = [];
  let group: SceneKadrTapeGroup | null = null;

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

export function buildSceneKadrTapeGroupsFromScenes(
  scenes: ScriptScene[],
): SceneKadrTapeGroup[] {
  return buildSceneKadrTapeGroups(buildSceneKadrTape(scenes));
}
