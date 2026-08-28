import { useMemo } from "react";
import type { TeamProfile } from "../../../sync/api/profile";
import { useProfilesBatchQuery } from "../../profile/api/profile-api";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import { normalizeEmail } from "./session-page-utils";
import { buildSessionSlotInsights } from "./session-slot-insights";
import type { ProjectDataCache } from "./session-page-types";
import {
  buildActorsSummary,
  buildDaySessionPreviewsById,
  buildSessionsSideCalledRowsBySlotId,
  buildSlotGatherStatusBySlotId,
  collectActorEmails,
  collectDayPreviewActorEmails,
  collectMissingAvailabilityEmails,
  collectSessionPickedActorEmails,
} from "./director-sessions-page-helpers";

type UseDirectorSessionsPanelDataParams = {
  accessToken: string | null | undefined;
  activeSession: DirectorRehearsalSession | null;
  activeSlotId: string | null;
  sessionDateKey: string | null;
  sessionsForSelectedDay: DirectorRehearsalSession[];
  dataCache: ProjectDataCache;
  projectLabelBySlug: ReadonlyMap<string, string>;
  selfEmailNorm: string | null;
};

export function useDirectorSessionsPanelData({
  accessToken,
  activeSession,
  activeSlotId,
  sessionDateKey,
  sessionsForSelectedDay,
  dataCache,
  projectLabelBySlug,
  selfEmailNorm,
}: UseDirectorSessionsPanelDataParams) {
  const slotById = useMemo(() => {
    const map = new Map<string, DirectorSessionSlot>();
    (activeSession?.slots ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [activeSession?.slots]);

  const slotInsights = useMemo(() => {
    if (!activeSession) return [];
    return buildSessionSlotInsights(
      activeSession,
      dataCache,
      projectLabelBySlug,
    );
  }, [activeSession, dataCache, projectLabelBySlug]);

  const sessionPickedActorEmails = useMemo(
    () => collectSessionPickedActorEmails(activeSession, dataCache),
    [activeSession?.id, activeSession?.slots, dataCache],
  );

  const actorsSummary = useMemo(
    () => buildActorsSummary(slotInsights),
    [slotInsights],
  );

  const actorEmails = useMemo(
    () => collectActorEmails(actorsSummary, activeSession?.plannedEmails),
    [actorsSummary, activeSession?.plannedEmails, activeSession?.id],
  );

  const profileEmailsSorted = useMemo(
    () => Array.from(new Set(actorEmails)).filter(Boolean).sort(),
    [actorEmails],
  );

  const dayPreviewActorEmails = useMemo(
    () => collectDayPreviewActorEmails(sessionsForSelectedDay, dataCache),
    [sessionsForSelectedDay, dataCache],
  );

  const profilesQueryEmails = useMemo(
    () =>
      Array.from(new Set([...profileEmailsSorted, ...dayPreviewActorEmails]))
        .filter(Boolean)
        .sort(),
    [profileEmailsSorted, dayPreviewActorEmails],
  );

  const { data: profilesList = [] } = useProfilesBatchQuery(profilesQueryEmails, {
    skip: !accessToken || profilesQueryEmails.length === 0,
  });

  const profilesByEmail = useMemo(() => {
    const map = new Map<string, TeamProfile>();
    for (const p of profilesList) {
      const e = normalizeEmail(p.email);
      if (e) map.set(e, p);
    }
    return map;
  }, [profilesList]);

  const slotGatherStatusBySlotId = useMemo(
    () =>
      buildSlotGatherStatusBySlotId(activeSession, slotInsights, slotById),
    [activeSession, slotInsights, slotById],
  );

  const daySessionPreviewsById = useMemo(
    () =>
      buildDaySessionPreviewsById(
        sessionsForSelectedDay,
        dataCache,
        projectLabelBySlug,
      ),
    [sessionsForSelectedDay, dataCache, projectLabelBySlug],
  );

  const sessionsSideCalledRowsBySlotId = useMemo(
    () =>
      buildSessionsSideCalledRowsBySlotId({
        activeSession,
        slotInsights,
        profilesByEmail,
        sessionDateKey,
      }),
    [activeSession, slotInsights, profilesByEmail, sessionDateKey],
  );

  const sessionsSideCalledRows = useMemo(() => {
    if (!activeSlotId) return [];
    return sessionsSideCalledRowsBySlotId.get(activeSlotId) ?? [];
  }, [activeSlotId, sessionsSideCalledRowsBySlotId]);

  const sessionMissingAvailabilityEmails = useMemo(
    () =>
      collectMissingAvailabilityEmails({
        activeSession,
        sessionDateKey,
        sessionPickedActorEmails,
        profilesByEmail,
        selfEmailNorm,
      }),
    [
      activeSession,
      activeSession?.plannedEmails,
      sessionDateKey,
      sessionPickedActorEmails,
      profilesByEmail,
      selfEmailNorm,
    ],
  );

  const activeSlotInsight = useMemo(
    () => slotInsights.find((x) => x.slotId === activeSlotId) ?? null,
    [slotInsights, activeSlotId],
  );

  return {
    slotInsights,
    slotGatherStatusBySlotId,
    daySessionPreviewsById,
    sessionsSideCalledRows,
    sessionsSideCalledRowsBySlotId,
    sessionMissingAvailabilityEmails,
    activeSlotInsight,
  };
}
