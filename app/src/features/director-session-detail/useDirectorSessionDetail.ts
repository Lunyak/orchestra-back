import { useEffect, useMemo, useState } from "react";
import type { TeamProfile } from "../../sync/api/profile";
import { useMyProfileQuery, useProfilesBatchQuery } from "../profile/api/profile-api";
import {
  directorSessionsApi,
  useConfirmDirectorSessionAttendanceMutation,
  useDeclineDirectorSessionAttendanceMutation,
  useDirectorSessionQuery,
} from "../director-sessions/api/director-sessions-api";
import type { DirectorRehearsalSession } from "../director-sessions/directorSessionsSync";
import { normalizeEmail } from "../director-sessions/model/session-page-utils";
import {
  computeActorArrivalByEmail,
  type ActorCallArrival,
} from "../director-sessions/model/session-actor-call-times";
import {
  getEmailsPlannedForDirectorSlot,
  type DirectorSlotPlannedData,
} from "../director-sessions/model/session-slot-planned";
import type { ProjectDataCache } from "../director-sessions/model/session-page-types";
import { useAppDispatch } from "../../shared/store/hooks";

function directorSessionErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") return "Не удалось загрузить сессию";
  const e = error as { status?: number; data?: { message?: string }; message?: string };
  if (e.status === 404) return "Сессия не найдена";
  return String(e.data?.message ?? e.message ?? "Не удалось загрузить сессию");
}

export function useDirectorSessionDetail(accessToken: string | null | undefined, sessionId: string) {
  const id = String(sessionId ?? "").trim();
  const dispatch = useAppDispatch();

  const {
    data: session = null,
    isLoading,
    error: sessionQueryError,
  } = useDirectorSessionQuery(id, { skip: !accessToken || !id });

  const loading = isLoading;
  const error = sessionQueryError ? directorSessionErrorMessage(sessionQueryError) : null;

  const { data: myProfile } = useMyProfileQuery(undefined, { skip: !accessToken });
  const myEmail = useMemo(() => {
    const email = normalizeEmail(String(myProfile?.email ?? ""));
    return email || null;
  }, [myProfile?.email]);

  const sessionEmails = useMemo(() => {
    const unique = new Set<string>();
    for (const e of session?.plannedEmails ?? []) {
      const v = normalizeEmail(String(e));
      if (v) unique.add(v);
    }
    for (const p of session?.participants ?? []) {
      const v = normalizeEmail(String(p.email));
      if (v) unique.add(v);
    }
    return Array.from(unique).sort();
  }, [session?.plannedEmails, session?.participants]);

  const { data: resolvedProfiles = [] } = useProfilesBatchQuery(sessionEmails, {
    skip: !accessToken || sessionEmails.length === 0,
  });

  const projectSlugs = useMemo(() => {
    const slugs = new Set<string>();
    for (const slot of session?.slots ?? []) {
      const slug = String(slot.ref?.projectSlug ?? "").trim();
      if (slug) slugs.add(slug);
    }
    return Array.from(slugs).sort();
  }, [session?.slots]);

  const projectSlugsKey = projectSlugs.join("|");
  const [sceneTitleBySlugAndId, setSceneTitleBySlugAndId] = useState<
    Record<string, Record<number, string>>
  >({});
  const [projectDataCache, setProjectDataCache] = useState<ProjectDataCache>({});

  useEffect(() => {
    if (!accessToken || projectSlugs.length === 0) {
      setSceneTitleBySlugAndId({});
      setProjectDataCache({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const mergedTitles: Record<string, Record<number, string>> = {};
      const mergedCache: ProjectDataCache = {};
      await Promise.all(
        projectSlugs.map(async (slug) => {
          try {
            const data = await dispatch(
              directorSessionsApi.endpoints.projectMaterial.initiate(slug),
            ).unwrap();
            mergedCache[slug] = data;
            const byId: Record<number, string> = {};
            for (const st of data.scenes ?? []) {
              const title = String(st.title ?? "").trim();
              if (title) byId[st.id] = title;
            }
            mergedTitles[slug] = byId;
          } catch {
            mergedTitles[slug] = {};
          }
        }),
      );
      if (!cancelled) {
        setSceneTitleBySlugAndId(mergedTitles);
        setProjectDataCache(mergedCache);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, dispatch, projectSlugsKey, projectSlugs]);

  const emailsBySlotId = useMemo(() => {
    const out: Record<string, string[]> = {};
    if (!session) return out;
    for (const sl of session.slots ?? []) {
      const ref = sl.ref;
      if (!ref?.projectSlug || ref.sceneId == null) continue;
      const slug = String(ref.projectSlug).trim();
      const cached = projectDataCache[slug];
      if (!cached?.scenes?.length) continue;
      const plannedData: DirectorSlotPlannedData = {
        scenes: cached.scenes,
        sceneRoles: cached.sceneRoles ?? null,
        roleEmailsByKey: cached.roleEmailsByKey ?? {},
      };
      out[sl.id] = getEmailsPlannedForDirectorSlot(
        slug,
        ref.sceneId,
        plannedData,
        sl.roleRehearsalPicks ?? null,
      );
    }
    return out;
  }, [session, projectDataCache]);

  const actorArrivalByEmail = useMemo(() => {
    if (!session?.startsAt) return new Map<string, ActorCallArrival>();
    return computeActorArrivalByEmail(
      session.startsAt,
      session.slots ?? [],
      emailsBySlotId,
    );
  }, [session?.startsAt, session?.slots, emailsBySlotId]);

  const [confirmAttendance, confirmState] = useConfirmDirectorSessionAttendanceMutation();
  const [declineAttendance, declineState] = useDeclineDirectorSessionAttendanceMutation();
  const [attendanceErr, setAttendanceErr] = useState<string | null>(null);
  const [attendanceOk, setAttendanceOk] = useState<string | null>(null);

  useEffect(() => {
    setAttendanceErr(null);
    setAttendanceOk(null);
  }, [id]);

  const attendanceBusy = confirmState.isLoading || declineState.isLoading;

  const onConfirmAttendance = async () => {
    if (!accessToken || !id) return;
    setAttendanceErr(null);
    setAttendanceOk(null);
    try {
      await confirmAttendance(id).unwrap();
      setAttendanceOk("Вызов подтверждён");
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string };
      setAttendanceErr(String(err?.data?.message ?? err?.message ?? "Не удалось подтвердить вызов"));
    }
  };

  const onDeclineAttendance = async () => {
    if (!accessToken || !id) return;
    const ok = window.confirm(
      "Отметить «не приду»? Режиссёр увидит, что вы не сможете прийти на эту сессию.",
    );
    if (!ok) return;
    setAttendanceErr(null);
    setAttendanceOk(null);
    try {
      await declineAttendance(id).unwrap();
      setAttendanceOk("Ответ сохранён: не приду");
    } catch (e: unknown) {
      const err = e as { data?: { message?: string }; message?: string };
      setAttendanceErr(String(err?.data?.message ?? err?.message ?? "Не удалось сохранить ответ"));
    }
  };

  return {
    session: session as DirectorRehearsalSession | null,
    loading,
    error,
    sceneTitleBySlugAndId,
    actorArrivalByEmail,
    resolvedProfiles: resolvedProfiles as TeamProfile[],
    myEmail,
    attendanceBusy,
    attendanceErr,
    attendanceOk,
    onConfirmAttendance,
    onDeclineAttendance,
  };
}
