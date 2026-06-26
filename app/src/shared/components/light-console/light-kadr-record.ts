import type {
  PlaybookLightChannelRolesV1,
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../../features/playbook/model/playbook-slice";
import type { SceneLightKadrsDataV1, TheaterSpotlight } from "../../types/script";
import { resolveLightChannelRoles } from "./light-channel-roles";
import {
  buildKadrFromConsole,
  createLightKadrId,
  findKadrById,
  type MarkdownKadrSection,
  recordKadrToMarkdown,
  upsertKadrInScene,
} from "../../../features/theater/model/light-kadrs";
import { resolveLightFaders, resolveLightPrograms } from "./light-console-data";

export type RecordLightKadrInput = {
  markdown: string;
  section: MarkdownKadrSection;
  existingKadrId?: string | null;
  kadrs: SceneLightKadrsDataV1;
  lightChannels: string[];
  lightFaders: PlaybookLightFadersDataV1 | null | undefined;
  lightPrograms: PlaybookLightProgramsDataV1 | null | undefined;
  /** Активная программа на пульте (кнопка П1–П8). */
  programId: number;
  /** Софиты сцены — для записи F, привязанных к K3, K4 и т.д. */
  spotlights?: TheaterSpotlight[];
  /** Активный K на пульте при записи. */
  liveConsoleChannel?: number;
  lightChannelRoles?: PlaybookLightChannelRolesV1 | null;
};

export type RecordLightKadrResult = {
  kadrId: string;
  nextKadrs: SceneLightKadrsDataV1;
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

  const nextKadrs = upsertKadrInScene({ kadrs: input.kadrs, kadr });
  const nextMarkdown = recordKadrToMarkdown({
    markdown: input.markdown,
    section: { ...input.section, id: kadrId },
    kadr,
    lightChannels: input.lightChannels,
    lightFaders: faders,
    programs: input.lightPrograms,
  });

  const totalFaders = kadr.faders.length;
  const activeFaders = kadr.faders.filter(
    (f) => (f.enabled ?? true) && (f.intensity ?? 0) > 0.02,
  ).length;
  const offFaders = totalFaders - activeFaders;

  const prev = input.existingKadrId ? findKadrById(input.kadrs, input.existingKadrId) : undefined;
  const faderSummary =
    totalFaders === 0
      ? "нет F с оборудованием на отмеченных K"
      : offFaders > 0
        ? `${activeFaders} вкл, ${offFaders} выкл`
        : `${activeFaders} вкл`;
  const summary =
    totalFaders === 0
      ? `Картина ${kadr.kadrNo}: П${programId} · ${faderSummary}`
      : prev
        ? `Картина ${kadr.kadrNo}: обновлено · П${programId} · ${faderSummary}`
        : `Картина ${kadr.kadrNo}: записано · П${programId} · ${faderSummary}`;

  return { kadrId, nextKadrs, nextMarkdown, summary };
}

export function resolveActiveProgramId(
  programs: PlaybookLightProgramsDataV1 | null | undefined,
): number {
  const resolved = resolveLightPrograms(programs);
  return resolved.activeProgramId ?? 1;
}
