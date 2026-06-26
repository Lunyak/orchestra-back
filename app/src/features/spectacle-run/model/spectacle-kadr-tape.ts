import {
  createKadrTemplateSnippet,
  createLightKadrId,
  type MarkdownKadrSection,
  readSceneLightKadrs,
  readSceneLightKadrsFromMarkdown,
  renumberKadrSectionsInMarkdown,
  scanMarkdownKadrSections,
  syncLightKadrsFromMarkdown,
} from "../../theater/model/light-kadrs";
import type { ScriptScene, SceneLightKadrsDataV1 } from "../../../shared/types/script";

export type SpectacleTapeItem = {
  /** Индекс в scenes[] */
  sceneIndex: number;
  sceneId: number;
  sceneTitle: string;
  /** Порядковый номер сцены в спектакле (1-based) */
  sceneOrdinal: number;
  kadrNo: number;
  kadrId: string | null;
  headingTitle: string;
  section: MarkdownKadrSection | null;
  /** Сцена без ### Картина — placeholder в ленте */
  isPlaceholder?: boolean;
};

export function buildSpectacleKadrTape(scenes: ScriptScene[]): SpectacleTapeItem[] {
  const items: SpectacleTapeItem[] = [];

  scenes.forEach((scene, sceneIndex) => {
    const sceneOrdinal = sceneIndex + 1;
    const sceneTitle = String(scene.title ?? "").trim() || `Сцена ${sceneOrdinal}`;
    const markdown = String(scene.markdown ?? "");
    const sections = scanMarkdownKadrSections(markdown);
    const kadrs = readSceneLightKadrsFromMarkdown(scene);

    if (sections.length > 0) {
      for (const section of sections) {
        const sameNoCount = sections.filter((s) => s.kadrNo === section.kadrNo).length;
        const linked =
          (section.id ? kadrs.kadrs.find((k) => k.id === section.id) : undefined) ??
          (sameNoCount === 1
            ? kadrs.kadrs.find((k) => k.kadrNo === section.kadrNo)
            : undefined);
        items.push({
          sceneIndex,
          sceneId: scene.id,
          sceneTitle,
          sceneOrdinal,
          kadrNo: section.kadrNo,
          kadrId: section.id ?? linked?.id ?? null,
          headingTitle: section.headingTitle,
          section,
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
      section: null,
      isPlaceholder: true,
    });
  });

  return items;
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

/** Вставить картину после указанной (или в конец сцены) и перенумеровать 1…N. */
export function insertKadrAfterInScene(args: {
  scene: ScriptScene;
  after?: InsertKadrAfterTarget | null;
  kadrId?: string;
}): { nextMarkdown: string; nextKadrs: SceneLightKadrsDataV1; kadrId: string; kadrNo: number } {
  const markdown = String(args.scene.markdown ?? "");
  const kadrId = args.kadrId ?? createLightKadrId();
  const sections = scanMarkdownKadrSections(markdown);

  let insertAt = markdown.trimEnd().length;
  let tempKadrNo = sections.length > 0 ? sections.length + 1 : 1;

  if (args.after && sections.length > 0) {
    const target =
      (args.after.id ? sections.find((section) => section.id === args.after!.id) : undefined) ??
      (args.after.kadrNo != null && args.after.kadrNo > 0
        ? sections.find((section) => section.kadrNo === args.after!.kadrNo)
        : undefined);
    if (target) {
      insertAt = target.sectionEnd;
      tempKadrNo = target.kadrNo + 1;
    }
  }

  const snippet = createKadrTemplateSnippet(tempKadrNo, kadrId);
  const prefix = markdown.slice(insertAt, insertAt + 1) === "\n" || insertAt === 0 ? "" : "\n";
  const insertedMarkdown = `${markdown.slice(0, insertAt)}${prefix}${snippet}${markdown.slice(insertAt)}`;
  const nextMarkdown = renumberKadrSectionsInMarkdown(insertedMarkdown);
  const prevKadrs = readSceneLightKadrs(args.scene);
  const nextKadrs = syncLightKadrsFromMarkdown({ markdown: nextMarkdown, kadrs: prevKadrs });
  const createdSection =
    scanMarkdownKadrSections(nextMarkdown).find((section) => section.id === kadrId) ?? null;
  const kadrNo = createdSection?.kadrNo ?? tempKadrNo;

  return { nextMarkdown, nextKadrs, kadrId, kadrNo };
}

/** Добавить в конец markdown сцены блок ### Картина N. */
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
