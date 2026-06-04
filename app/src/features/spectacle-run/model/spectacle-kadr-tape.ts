import {
  createKadrTemplateSnippet,
  createLightKadrId,
  type MarkdownKadrSection,
  nextKadrNumberForStep,
  readStepLightKadrs,
  readStepLightKadrsFromMarkdown,
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

/** Добавить в markdown шага блок ### Картина N и синхронизировать lightKadrs. */
export function appendKadrToStep(args: {
  step: ScriptStep;
  kadrNo?: number;
  kadrId?: string;
}): { nextMarkdown: string; nextKadrs: StepLightKadrsDataV1; kadrId: string; kadrNo: number } {
  const markdown = String(args.step.markdown ?? "");
  const kadrNo = args.kadrNo ?? nextKadrNumberForStep(args.step);
  const kadrId = args.kadrId ?? createLightKadrId();
  const snippet = createKadrTemplateSnippet(kadrNo, kadrId);
  const nextMarkdown = `${markdown.trimEnd()}${snippet}`;
  const prevKadrs = readStepLightKadrs(args.step);
  const nextKadrs = syncLightKadrsFromMarkdown({ markdown: nextMarkdown, kadrs: prevKadrs });
  return { nextMarkdown, nextKadrs, kadrId, kadrNo };
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
