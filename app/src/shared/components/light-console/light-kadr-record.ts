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
  upsertKadrInScene,
} from "../../../features/theater/model/light-kadrs";
import { resolveLightFaders, resolveLightPrograms } from "./light-console-data";

export type RecordLightKadrInput = {
  kadrId?: string | null;
  kadrNo?: number;
  title?: string;
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
  /** @deprecated markdown больше не пишется */
  markdown?: string;
  /** @deprecated */
  section?: { id?: string | null; kadrNo?: number; headingTitle?: string } | null;
  /** @deprecated */
  existingKadrId?: string | null;
};

export type RecordLightKadrResult = {
  kadrId: string;
  nextKadrs: SceneLightKadrsDataV1;
  /** @deprecated всегда исходный markdown / пустая строка */
  nextMarkdown: string;
  summary: string;
};

export function recordLightKadrForSection(input: RecordLightKadrInput): RecordLightKadrResult | null {
  const faders = resolveLightFaders(input.lightFaders ?? undefined);
  const kadrId =
    input.kadrId ??
    input.existingKadrId ??
    input.section?.id ??
    createLightKadrId();
  const existing = findKadrById(input.kadrs, kadrId);
  const kadrNo =
    existing?.kadrNo ??
    Math.max(1, Math.trunc(input.kadrNo ?? input.section?.kadrNo ?? 1) || 1);
  const programId = Math.max(1, Math.trunc(input.programId) || 1);

  const roles = resolveLightChannelRoles(
    input.lightChannelRoles,
    input.lightChannels.length,
  );
  const liveCh = Math.max(1, Math.trunc(input.liveConsoleChannel ?? 1) || 1);
  const programs = resolveLightPrograms(input.lightPrograms);

  const kadr = buildKadrFromConsole({
    id: kadrId,
    kadrNo,
    title: input.title ?? existing?.title ?? input.section?.headingTitle,
    programId,
    faders,
    spotlights: input.spotlights ?? [],
    lightPrograms: programs,
    sofitChannels: roles.sofitChannels,
    liveConsoleChannel: liveCh,
    lightChannelsCount: input.lightChannels.length,
  });

  const preserved: typeof kadr = {
    ...kadr,
    ...(existing?.sound ? { sound: existing.sound } : {}),
    ...(existing?.projector ? { projector: existing.projector } : {}),
    ...(existing?.transitionText ? { transitionText: existing.transitionText } : {}),
    ...(existing?.commentText ? { commentText: existing.commentText } : {}),
    ...(existing?.imageMarkdown ? { imageMarkdown: existing.imageMarkdown } : {}),
    ...(existing?.blackoutDurationSec != null
      ? { blackoutDurationSec: existing.blackoutDurationSec }
      : {}),
    ...(existing?.smokeDurationSec != null
      ? { smokeDurationSec: existing.smokeDurationSec }
      : {}),
    ...(existing?.smokeMachine ? { smokeMachine: true } : {}),
  };

  const nextKadrs = upsertKadrInScene({ kadrs: input.kadrs, kadr: preserved });

  const totalFaders = preserved.faders.length;
  const activeFaders = preserved.faders.filter(
    (f) => (f.enabled ?? true) && (f.intensity ?? 0) > 0.02,
  ).length;
  const offFaders = totalFaders - activeFaders;

  const faderSummary =
    totalFaders === 0
      ? "нет F с оборудованием на отмеченных K"
      : offFaders > 0
        ? `${activeFaders} вкл, ${offFaders} выкл`
        : `${activeFaders} вкл`;
  const summary =
    totalFaders === 0
      ? `Картина ${preserved.kadrNo}: П${programId} · ${faderSummary}`
      : existing
        ? `Картина ${preserved.kadrNo}: обновлено · П${programId} · ${faderSummary}`
        : `Картина ${preserved.kadrNo}: записано · П${programId} · ${faderSummary}`;

  return {
    kadrId,
    nextKadrs,
    nextMarkdown: String(input.markdown ?? ""),
    summary,
  };
}

export function resolveActiveProgramId(
  programs: PlaybookLightProgramsDataV1 | null | undefined,
): number {
  const resolved = resolveLightPrograms(programs);
  return resolved.activeProgramId ?? 1;
}
