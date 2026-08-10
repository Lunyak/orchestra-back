import type { DirectorRehearsalSession, DirectorSessionSlot } from "../directorSessionsSync";
import {
  findDirectorSessionParticipant,
  formatSlotTime,
  isDirectorSessionPublished,
  normalizeEmail,
  projectDisplayLabel,
} from "./session-page-utils";
import { getEmailsPlannedForDirectorSlot, getNormalizedRoleKeysForSlotScene } from "./session-slot-planned";
import type { ProjectDataCache, SlotGatherStatus, SlotInsight } from "./session-page-types";

export function buildSessionSlotInsights(
  session: DirectorRehearsalSession,
  dataCache: ProjectDataCache,
  projectLabelBySlug?: ReadonlyMap<string, string>,
): SlotInsight[] {
  return [...(session.slots ?? [])]
    .sort((a, b) => a.offsetMin - b.offsetMin)
    .map((sl) => {
      const ref = sl.ref;
      if (!ref) {
        const customTitle = String(sl.title ?? "").trim();
        const participantEmails = (sl.participantEmails ?? [])
          .map((email) => normalizeEmail(String(email ?? "")))
          .filter(Boolean);
        return {
          slotId: sl.id,
          time: formatSlotTime(session.startsAt, sl.offsetMin),
          projectLabel: "",
          sceneLabel: customTitle || "Слот без названия",
          title: customTitle || "Слот без названия",
          ready: Boolean(customTitle),
          missingRoles: [] as string[],
          actors: Array.from(new Set(participantEmails)),
        };
      }

      const data = dataCache[ref.projectSlug];
      const scene = data?.scenes?.find((x) => x.id === ref.sceneId) ?? null;
      const sceneLabel = String(scene?.title ?? "").trim() || `Сцена #${ref.sceneId}`;
      const roleKeys = getNormalizedRoleKeysForSlotScene(
        scene ?? null,
        data?.sceneRoles,
        ref.sceneId,
      );
      const missingRoles = roleKeys
        .filter((key) => !key || !(data?.roleEmailsByKey ?? {})[key]?.length)
        .map(
          (key) =>
            String(data?.roleTitleByKey?.[key ?? ""] ?? key ?? "").trim() || key,
        );
      const actors = getEmailsPlannedForDirectorSlot(
        ref.projectSlug,
        ref.sceneId,
        data,
        (sl as DirectorSessionSlot).roleRehearsalPicks,
      );
      const projectLabel = projectDisplayLabel(ref.projectSlug, projectLabelBySlug);

      return {
        slotId: sl.id,
        time: formatSlotTime(session.startsAt, sl.offsetMin),
        projectLabel,
        sceneLabel,
        title: `${projectLabel} · #${ref.sceneId} ${sceneLabel}`.trim(),
        ready: roleKeys.length === 0 ? true : missingRoles.length === 0,
        missingRoles,
        actors: Array.from(
          new Set(actors.map((x) => String(x ?? "").trim()).filter(Boolean)),
        ),
      };
    });
}

export function computeSlotGatherStatus(
  session: DirectorRehearsalSession,
  insight: SlotInsight,
  slot: DirectorSessionSlot | null | undefined,
): SlotGatherStatus {
  if (!slot) return "none";
  const isCustomSlot = !slot.ref && Boolean(String(slot.title ?? "").trim());
  if (!slot.ref && !isCustomSlot) return "none";
  if (!insight.ready) return "bad";

  const actors = insight.actors ?? [];
  const normActors = actors
    .map((a) => normalizeEmail(String(a ?? "")))
    .filter(Boolean);
  if (normActors.length === 0) return "warn";

  const published = isDirectorSessionPublished(session);
  const participants = session.participants ?? [];
  const hasCallTable = published && participants.length > 0;

  if (!hasCallTable) return "warn";

  for (const email of normActors) {
    const status = findDirectorSessionParticipant(session, email)?.status;
    if (status === "absent") return "bad";
    if (status !== "present") return "warn";
  }

  return "ok";
}
