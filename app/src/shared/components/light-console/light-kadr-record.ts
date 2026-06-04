import type {
  SceneLightChannelRolesV1,
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../../features/scene/model/scene-slice";
import type { StepLightKadrsDataV1, TheaterSpotlight } from "../../types/script";
import { resolveLightChannelRoles } from "./light-channel-roles";
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
  /** Софиты шага — для записи F, привязанных к K3, K4 и т.д. */
  spotlights?: TheaterSpotlight[];
  /** Активный K на пульте при записи. */
  liveConsoleChannel?: number;
  lightChannelRoles?: SceneLightChannelRolesV1 | null;
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
  const existing = input.existingKadrId
    ? findKadrById(input.kadrs, input.existingKadrId)
    : undefined;

  const roles = resolveLightChannelRoles(
    input.lightChannelRoles,
    input.lightChannels.length,
  );
  const liveCh = Math.max(1, Math.trunc(input.liveConsoleChannel ?? 1) || 1);
  const programs = resolveLightPrograms(input.lightPrograms);

  const kadr = buildKadrFromConsole({
    id: kadrId,
    kadrNo: existing?.kadrNo ?? input.section.kadrNo,
    title: input.section.headingTitle,
    programId,
    faders,
    spotlights: input.spotlights ?? [],
    lightPrograms: programs,
    sofitChannels: roles.sofitChannels,
    liveConsoleChannel: liveCh,
    lightChannelsCount: input.lightChannels.length,
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
  const summary =
    activeFaders === 0
      ? `Картина ${kadr.kadrNo}: П${programId} записана, но нет фейдеров >0% — поднимите F у софитов K3/K4`
      : prev
        ? `Картина ${kadr.kadrNo}: обновлено · П${programId} · ${activeFaders} фейдер(ов)`
        : `Картина ${kadr.kadrNo}: записано · П${programId} · ${activeFaders} фейдер(ов)`;

  return { kadrId, nextKadrs, nextMarkdown, summary };
}

export function resolveActiveProgramId(
  programs: SceneLightProgramsDataV1 | null | undefined,
): number {
  const resolved = resolveLightPrograms(programs);
  return resolved.activeProgramId ?? 1;
}
