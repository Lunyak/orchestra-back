import {
  createKadrTemplateSnippet,
  createLightKadrId,
  type MarkdownKadrSection,
  readStepLightKadrs,
  readStepLightKadrsFromMarkdown,
  renumberKadrSectionsInMarkdown,
  scanMarkdownKadrSections,
  syncLightKadrsFromMarkdown,
} from "../../theater/model/light-kadrs";
import type { ScriptStep, StepLightKadrsDataV1 } from "../../../shared/types/script";

export type SpectacleTapeItem = {
  /** Индекс в steps[] */
  stepIndex: number;
  stepId: number;
  stepTitle: string;
  /** Порядковый номер шага в спектакле (1-based) */
  stepOrdinal: number;
  kadrNo: number;
  kadrId: string | null;
  headingTitle: string;
  section: MarkdownKadrSection | null;
  /** Шаг без ### Картина — placeholder в ленте */
  isPlaceholder?: boolean;
};

export function buildSpectacleKadrTape(steps: ScriptStep[]): SpectacleTapeItem[] {
  const items: SpectacleTapeItem[] = [];

  steps.forEach((step, stepIndex) => {
    const stepOrdinal = stepIndex + 1;
    const stepTitle = String(step.title ?? "").trim() || `Шаг ${stepOrdinal}`;
    const markdown = String(step.markdown ?? "");
    const sections = scanMarkdownKadrSections(markdown);
    const kadrs = readStepLightKadrsFromMarkdown(step);

    if (sections.length > 0) {
      for (const section of sections) {
        const sameNoCount = sections.filter((s) => s.kadrNo === section.kadrNo).length;
        const linked =
          (section.id ? kadrs.kadrs.find((k) => k.id === section.id) : undefined) ??
          (sameNoCount === 1
            ? kadrs.kadrs.find((k) => k.kadrNo === section.kadrNo)
            : undefined);
        items.push({
          stepIndex,
          stepId: step.id,
          stepTitle,
          stepOrdinal,
          kadrNo: section.kadrNo,
          kadrId: section.id ?? linked?.id ?? null,
          headingTitle: section.headingTitle,
          section,
        });
      }
      return;
    }

    items.push({
      stepIndex,
      stepId: step.id,
      stepTitle,
      stepOrdinal,
      kadrNo: 0,
      kadrId: null,
      headingTitle: "Без картин",
      section: null,
      isPlaceholder: true,
    });
  });

  return items;
}

export type SpectacleTapeStepGroup = {
  stepIndex: number;
  stepId: number;
  stepOrdinal: number;
  stepTitle: string;
  items: Array<{ tapeIndex: number; item: SpectacleTapeItem }>;
};

/** Группы ленты по шагам сценария — для нижней полосы кадров. */
export function buildSpectacleTapeStepGroups(
  tape: SpectacleTapeItem[],
): SpectacleTapeStepGroup[] {
  const groups: SpectacleTapeStepGroup[] = [];
  let group: SpectacleTapeStepGroup | null = null;

  tape.forEach((item, tapeIndex) => {
    if (!group || group.stepId !== item.stepId) {
      group = {
        stepIndex: item.stepIndex,
        stepId: item.stepId,
        stepOrdinal: item.stepOrdinal,
        stepTitle: item.stepTitle,
        items: [],
      };
      groups.push(group);
    }
    group.items.push({ tapeIndex, item });
  });

  return groups;
}

export function isLastTapeItemInStep(
  tape: SpectacleTapeItem[],
  index: number,
): boolean {
  const item = tape[index];
  if (!item) return true;
  const next = tape[index + 1];
  return !next || next.stepId !== item.stepId;
}

export { nextKadrNumberForStep } from "../../theater/model/light-kadrs";

export type InsertKadrAfterTarget = {
  id?: string | null;
  kadrNo?: number;
};

/** Вставить картину после указанной (или в конец шага) и перенумеровать 1…N. */
export function insertKadrAfterInStep(args: {
  step: ScriptStep;
  after?: InsertKadrAfterTarget | null;
  kadrId?: string;
}): { nextMarkdown: string; nextKadrs: StepLightKadrsDataV1; kadrId: string; kadrNo: number } {
  const markdown = String(args.step.markdown ?? "");
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
  const prevKadrs = readStepLightKadrs(args.step);
  const nextKadrs = syncLightKadrsFromMarkdown({ markdown: nextMarkdown, kadrs: prevKadrs });
  const createdSection =
    scanMarkdownKadrSections(nextMarkdown).find((section) => section.id === kadrId) ?? null;
  const kadrNo = createdSection?.kadrNo ?? tempKadrNo;

  return { nextMarkdown, nextKadrs, kadrId, kadrNo };
}

/** Добавить в конец markdown шага блок ### Картина N. */
export function appendKadrToStep(args: {
  step: ScriptStep;
  kadrNo?: number;
  kadrId?: string;
}): { nextMarkdown: string; nextKadrs: StepLightKadrsDataV1; kadrId: string; kadrNo: number } {
  return insertKadrAfterInStep({ step: args.step, after: null, kadrId: args.kadrId });
}

export function findTapeIndexForStepKadr(
  tape: SpectacleTapeItem[],
  stepIndex: number,
  kadrId: string | null,
  kadrNo?: number,
): number {
  if (kadrId) {
    const byId = tape.findIndex((item) => item.kadrId === kadrId);
    if (byId >= 0) return byId;
  }
  if (stepIndex >= 0 && kadrNo != null && kadrNo > 0) {
    const byNo = tape.findIndex(
      (item) => item.stepIndex === stepIndex && item.kadrNo === kadrNo,
    );
    if (byNo >= 0) return byNo;
  }
  if (stepIndex >= 0) {
    return tape.findIndex((item) => item.stepIndex === stepIndex);
  }
  return -1;
}
