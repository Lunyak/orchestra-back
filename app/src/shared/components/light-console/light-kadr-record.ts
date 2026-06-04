import type {
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../../features/scene/model/scene-slice";
import type { StepLightKadrsDataV1 } from "../../types/script";
import {
  buildKadrFromConsole,
  createLightKadrId,
  findKadrById,
  type MarkdownKadrSection,
  recordKadrToMarkdown,
  upsertKadrInStep,
} from "../../../features/theater/model/light-kadrs";
import { resolveLightFaders, resolveLightPrograms } from "./light-console-data";

export type RecordLightKadrInput = {
  markdown: string;
  section: MarkdownKadrSection;
  existingKadrId?: string | null;
  kadrs: StepLightKadrsDataV1;
  lightChannels: string[];
  lightFaders: SceneLightFadersDataV1 | null | undefined;
  lightPrograms: SceneLightProgramsDataV1 | null | undefined;
  /** Активная программа на пульте (кнопка П1–П8). */
  programId: number;
};

export type RecordLightKadrResult = {
  kadrId: string;
  nextKadrs: StepLightKadrsDataV1;
  nextMarkdown: string;
  summary: string;
};

export function recordLightKadrForSection(input: RecordLightKadrInput): RecordLightKadrResult | null {
  if (!input.section) return null;

  const faders = resolveLightFaders(input.lightFaders ?? undefined);
  const kadrId = input.section.id ?? input.existingKadrId ?? createLightKadrId();
  const programId = Math.max(1, Math.trunc(input.programId) || 1);

  const kadr = buildKadrFromConsole({
    id: kadrId,
    kadrNo: input.section.kadrNo,
    title: input.section.headingTitle,
    programId,
    faders,
  });

  const nextKadrs = upsertKadrInStep({ kadrs: input.kadrs, kadr });
  const nextMarkdown = recordKadrToMarkdown({
    markdown: input.markdown,
    section: { ...input.section, id: kadrId },
    kadr,
    lightChannels: input.lightChannels,
    lightFaders: faders,
    programs: input.lightPrograms,
  });

  const activeFaders = kadr.faders.filter(
    (f) => (f.enabled ?? true) && (f.intensity ?? 0) > 0.02,
  ).length;

  const prev = input.existingKadrId ? findKadrById(input.kadrs, input.existingKadrId) : undefined;
  const summary = prev
    ? `Картина ${kadr.kadrNo}: обновлено · П${programId} · ${activeFaders} фейдер(ов) в look`
    : `Картина ${kadr.kadrNo}: записано · П${programId} · ${activeFaders} фейдер(ов) в look`;

  return { kadrId, nextKadrs, nextMarkdown, summary };
}

export function resolveActiveProgramId(
  programs: SceneLightProgramsDataV1 | null | undefined,
): number {
  const resolved = resolveLightPrograms(programs);
  return resolved.activeProgramId ?? 1;
}
