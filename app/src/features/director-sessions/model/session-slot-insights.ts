import type { DirectorRehearsalSession, DirectorSessionSlot } from "../directorSessionsSync";
import {
  findDirectorSessionParticipant,
  formatSlotTime,
  isDirectorSessionPublished,
  normalizeEmail,
  projectDisplayLabel,
} from "./session-page-utils";
import { getEmailsPlannedForDirectorSlot, getNormalizedRoleKeysForSlotStep } from "./session-slot-planned";
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
        return {
          slotId: sl.id,
          time: formatSlotTime(session.startsAt, sl.offsetMin),
          projectLabel: "",
          stepLabel: "Материал не выбран",
          title: "Материал не выбран",
          ready: false,
          missingRoles: [] as string[],
          actors: [] as string[],
        };
      }

      const data = dataCache[ref.projectSlug];
      const step = data?.steps?.find((x) => x.id === ref.stepId) ?? null;
      const stepLabel = String(step?.title ?? "").trim() || `Шаг #${ref.stepId}`;
      const roleKeys = getNormalizedRoleKeysForSlotStep(
        step ?? null,
        data?.sceneRoles,
        ref.stepId,
      );
      const missingRoles = roleKeys
        .filter((key) => !key || !(data?.roleEmailsByKey ?? {})[key]?.length)
        .map(
          (key) =>
            String(data?.roleTitleByKey?.[key ?? ""] ?? key ?? "").trim() || key,
        );
      const actors = getEmailsPlannedForDirectorSlot(
        ref.projectSlug,
        ref.stepId,
        data,
        (sl as DirectorSessionSlot).roleRehearsalPicks,
      );
      const projectLabel = projectDisplayLabel(ref.projectSlug, projectLabelBySlug);

      return {
        slotId: sl.id,
        time: formatSlotTime(session.startsAt, sl.offsetMin),
        projectLabel,
        stepLabel,
        title: `${projectLabel} · #${ref.stepId} ${stepLabel}`.trim(),
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
  if (!slot?.ref) return "none";
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
