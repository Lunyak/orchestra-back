import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { useLocation } from "react-router-dom";
import { useMyProfileQuery, useProfilesBatchQuery } from "../../profile/api/profile-api";
import { useProjectRolesQuery } from "../../project/api/project-api";
import { useAuth } from "../../auth";
import {
  rehearsalsApi,
  type RehearsalPlanResponse,
  useCreateRehearsalMutation,
  useLazyGetRehearsalQuery,
  useListRehearsalsQuery,
  usePublishRehearsalMutation,
  useRehearsalScenesQuery,
  useUpdateRehearsalMutation,
} from "../api/rehearsals-api";
import {
  extractRolesSmart,
  formatMemberLabel,
  isoDate,
  normalizeEmail,
  normalizeRoleName,
} from "./rehearsals-page-utils";
import { useProject } from "../../project";
import { usePlaybook } from "../../playbook";
import { useTeam } from "../../team";
import type { CalendarSectionState } from "../../../shared/components/calendar/CalendarSection";
import type { TeamProfile } from "../../../sync/api/profile";
import type { Rehearsal, RehearsalSelectedScene } from "../../../sync/api/rehearsals";

dayjs.extend(isoWeek);
dayjs.locale("ru");

export type RehearsalsPageViewModel = ReturnType<typeof useRehearsalsPage>;

export function useRehearsalsPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { projectMembers, projectOwner } = useTeam();
  const { scenes: scriptScenes } = usePlaybook();
  const location = useLocation();

  const projectSlug = projectName || "fools";
  const members = useMemo(
    () =>
      [
        ...(projectOwner?.email
          ? [{ email: projectOwner.email, displayName: projectOwner.displayName ?? null }]
          : []),
        ...(projectMembers ?? []).map((m) => ({
          email: m.user.email,
          displayName: m.user.displayName ?? null,
        })),
      ],
    [projectMembers, projectOwner?.displayName, projectOwner?.email],
  );

  const [calendarState, setCalendarState] = useState<CalendarSectionState>(() => {
    const now = new Date();
    const monthStartDate = dayjs(now).startOf("month").toDate();
    const monthEndDate = dayjs(now).endOf("month").toDate();
    return {
      currentMonth: now,
      selectedDate: isoDate(now),
      monthStartDate,
      monthEndDate,
      fromIso: monthStartDate.toISOString(),
      toIso: monthEndDate.toISOString(),
    };
  });
  const [calendarError, setCalendarError] = useState<string | null>(null);

  const listArgs = useMemo(
    () => ({
      projectSlug,
      from: calendarState.fromIso,
      to: calendarState.toIso,
    }),
    [projectSlug, calendarState.fromIso, calendarState.toIso],
  );

  const {
    data: listData,
    isLoading: loading,
    isError: listIsError,
  } = useListRehearsalsQuery(listArgs, { skip: !accessToken || !projectSlug });

  const rehearsals = listData?.rehearsals ?? [];
  const error = listIsError ? "Не удалось загрузить репетиции" : null;

  useEffect(() => {
    if (listIsError) {
      setCalendarError("Не удалось загрузить события репетиций");
    } else {
      setCalendarError(null);
    }
  }, [listIsError]);

  const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(null);
  const activeRehearsal = useMemo(
    () => rehearsals.find((r) => r.id === activeRehearsalId) ?? rehearsals[0] ?? null,
    [activeRehearsalId, rehearsals],
  );

  const deepLinkedRehearsalId = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const v = String(sp.get("rehearsalId") ?? "").trim();
    return v || null;
  }, [location.search]);

  useEffect(() => {
    if (!deepLinkedRehearsalId) return;
    if (!rehearsals.some((r) => r.id === deepLinkedRehearsalId)) return;
    setActiveRehearsalId(deepLinkedRehearsalId);
  }, [deepLinkedRehearsalId, rehearsals]);

  useEffect(() => {
    if (activeRehearsalId) return;
    if (rehearsals.length === 0) return;
    setActiveRehearsalId(rehearsals[0]?.id ?? null);
  }, [activeRehearsalId, rehearsals]);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [selectedScenes, setSelectedScenes] = useState<RehearsalSelectedScene[]>([]);
  const lastScenesRehearsalIdRef = useRef<string | null>(null);

  const {
    data: scenesData,
    isLoading: scenesLoading,
    isError: scenesIsError,
  } = useRehearsalScenesQuery(activeRehearsal?.id ?? "", {
    skip: !accessToken || !activeRehearsal?.id,
  });
  const sceneOptions = scenesData?.playbooks ?? [];
  const scenesError = scenesIsError ? "Не удалось загрузить список сцен" : null;

  useEffect(() => {
    const rid = activeRehearsal?.id ?? null;
    if (!rid) {
      setSelectedScenes([]);
      lastScenesRehearsalIdRef.current = null;
      return;
    }
    if (lastScenesRehearsalIdRef.current !== rid && scenesData?.selectedScenes) {
      setSelectedScenes(scenesData.selectedScenes);
      lastScenesRehearsalIdRef.current = rid;
    }
  }, [activeRehearsal?.id, scenesData?.selectedScenes]);

  const [createRehearsalMut] = useCreateRehearsalMutation();
  const [updateRehearsalMut] = useUpdateRehearsalMutation();
  const [publishRehearsalMut] = usePublishRehearsalMutation();
  const [fetchRehearsal] = useLazyGetRehearsalQuery();
  const [savingScenes, setSavingScenes] = useState(false);
  const [saveScenesError, setSaveScenesError] = useState<string | null>(null);

  const [metaTitle, setMetaTitle] = useState("");
  const [metaStartsAtLocal, setMetaStartsAtLocal] = useState("");
  const [metaEndsAtLocal, setMetaEndsAtLocal] = useState("");
  const [metaDurationMin, setMetaDurationMin] = useState<string>("");
  const [metaEndTouched, setMetaEndTouched] = useState(false);
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaveError, setMetaSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRehearsal) {
      setMetaTitle("");
      setMetaStartsAtLocal("");
      setMetaEndsAtLocal("");
      setMetaDurationMin("");
      setMetaEndTouched(false);
      setMetaSaveError(null);
      return;
    }
    setMetaTitle(activeRehearsal.title ?? "");
    const startLocal = dayjs(activeRehearsal.startsAt).format("YYYY-MM-DDTHH:mm");
    setMetaStartsAtLocal(startLocal);
    const dur =
      activeRehearsal.durationMin != null ? Math.max(0, Math.floor(activeRehearsal.durationMin)) : null;
    setMetaDurationMin(dur != null ? String(dur) : "");
    setMetaEndsAtLocal(
      dur != null ? dayjs(activeRehearsal.startsAt).add(dur, "minute").format("YYYY-MM-DDTHH:mm") : "",
    );
    setMetaEndTouched(false);
    setMetaSaveError(null);
  }, [activeRehearsal?.id]);

  const computedDuration = useMemo(() => {
    const startSrc = metaStartsAtLocal.trim();
    const endSrc = metaEndsAtLocal.trim();
    if (!startSrc || !endSrc) return null;
    const start = dayjs(startSrc);
    const end = dayjs(endSrc);
    if (!start.isValid() || !end.isValid()) return null;
    return Math.max(0, end.diff(start, "minute"));
  }, [metaEndsAtLocal, metaStartsAtLocal]);

  const computedDurationLabel = useMemo(() => {
    const m = computedDuration;
    if (m == null) return "—";
    const h = Math.floor(m / 60);
    const mm = m % 60;
    if (h <= 0) return `${mm} мин`;
    if (mm === 0) return `${h} ч`;
    return `${h} ч ${mm} мин`;
  }, [computedDuration]);

  const onChangeStart = (next: string) => {
    setMetaStartsAtLocal(next);
    const start = dayjs(next);
    if (!start.isValid()) return;

    if (!metaEndTouched) {
      const raw = metaDurationMin.trim();
      const dur = raw === "" ? null : Math.max(0, Math.floor(Number(raw)));
      if (dur != null) {
        setMetaEndsAtLocal(start.add(dur, "minute").format("YYYY-MM-DDTHH:mm"));
      }
    } else {
      const endSrc = metaEndsAtLocal.trim();
      if (!endSrc) return;
      const end = dayjs(endSrc);
      if (!end.isValid()) return;
      const diff = Math.max(0, end.diff(start, "minute"));
      setMetaDurationMin(String(diff));
    }
  };

  const onChangeEnd = (next: string) => {
    setMetaEndTouched(true);
    setMetaEndsAtLocal(next);
    const startSrc = metaStartsAtLocal.trim();
    if (!startSrc || !next.trim()) return;
    const start = dayjs(startSrc);
    const end = dayjs(next);
    if (!start.isValid() || !end.isValid()) return;
    const diff = Math.max(0, end.diff(start, "minute"));
    setMetaDurationMin(String(diff));
  };

  const applyPresetDuration = (minutes: number) => {
    const startSrc = metaStartsAtLocal.trim();
    if (!startSrc) return;
    const start = dayjs(startSrc);
    if (!start.isValid()) return;
    const dur = Math.max(0, Math.floor(minutes));
    setMetaDurationMin(String(dur));
    setMetaEndTouched(false);
    setMetaEndsAtLocal(start.add(dur, "minute").format("YYYY-MM-DDTHH:mm"));
  };

  const saveMeta = async () => {
    if (!accessToken || !activeRehearsal) return;
    setMetaSaving(true);
    setMetaSaveError(null);
    try {
      const startLocal = metaStartsAtLocal.trim();
      const endLocal = metaEndsAtLocal.trim();

      const nextStartsAt =
        startLocal === "" ? activeRehearsal.startsAt : dayjs(startLocal).toDate().toISOString();

      const duration =
        endLocal !== "" && dayjs(startLocal || activeRehearsal.startsAt).isValid() && dayjs(endLocal).isValid()
          ? Math.max(0, dayjs(endLocal).diff(dayjs(startLocal || activeRehearsal.startsAt), "minute"))
          : metaDurationMin.trim() === ""
            ? null
            : Math.max(0, Math.floor(Number(metaDurationMin)));
      await updateRehearsalMut({
        rehearsalId: activeRehearsal.id,
        projectSlug,
        patch: {
          title: metaTitle.trim() || "Репетиция",
          startsAt: nextStartsAt,
          durationMin: duration,
        },
      }).unwrap();
    } catch {
      setMetaSaveError("Не удалось сохранить параметры репетиции");
    } finally {
      setMetaSaving(false);
    }
  };

  const rehearsalsByDate = useMemo(() => {
    const grouped = new Map<string, Rehearsal[]>();
    for (const rehearsal of rehearsals) {
      const date = isoDate(new Date(rehearsal.startsAt));
      const arr = grouped.get(date);
      if (arr) arr.push(rehearsal);
      else grouped.set(date, [rehearsal]);
    }
    return grouped;
  }, [rehearsals]);

  const dotsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [date, list] of rehearsalsByDate.entries()) out[date] = list.length;
    return out;
  }, [rehearsalsByDate]);

  const rehearsalsForSelectedDay = rehearsalsByDate.get(calendarState.selectedDate) ?? [];

  const { data: myProfile = null } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });

  const myMember = useMemo(() => {
    const email = String(myProfile?.email ?? "").trim();
    if (!email) return null;
    return { email, displayName: myProfile?.displayName ?? null };
  }, [myProfile?.displayName, myProfile?.email]);

  const membersWithMe = useMemo(() => {
    const map = new Map<string, { email: string; displayName?: string | null }>();
    const add = (m: { email: string; displayName?: string | null } | null) => {
      if (!m?.email) return;
      const e = normalizeEmail(m.email);
      if (!e) return;
      if (!map.has(e)) map.set(e, { email: m.email, displayName: m.displayName ?? null });
    };
    (members ?? []).forEach((m) => add(m));
    add(myMember);
    return Array.from(map.values());
  }, [members, myMember]);

  const scriptSceneById = useMemo(() => {
    const map = new Map<number, (typeof scriptScenes)[number]>();
    for (const scene of scriptScenes ?? []) {
      if (typeof scene?.id !== "number") continue;
      map.set(scene.id, scene);
    }
    return map;
  }, [scriptScenes]);

  const profileEmails = useMemo(
    () => membersWithMe.map((m) => normalizeEmail(m.email)).filter(Boolean).sort(),
    [membersWithMe],
  );

  const { data: teamProfiles = [] } = useProfilesBatchQuery(profileEmails, {
    skip: !accessToken || profileEmails.length === 0,
  });

  const teamProfileByEmail = useMemo(() => {
    const map = new Map<string, TeamProfile>();
    for (const p of teamProfiles ?? []) {
      const e = normalizeEmail(p.email);
      if (!e) continue;
      map.set(e, p);
    }
    const me = myProfile?.email ? normalizeEmail(myProfile.email) : "";
    // Всегда подмешиваем myProfile поверх: это даёт актуальную доступность для себя,
    // даже если батч профилей лагнул/не включил некоторые поля.
    if (me && myProfile) {
      const existing = map.get(me);
      map.set(me, {
        email: existing?.email ?? myProfile.email,
        displayName: existing?.displayName ?? myProfile.displayName ?? null,
        firstName: existing?.firstName ?? myProfile.firstName ?? null,
        lastName: existing?.lastName ?? myProfile.lastName ?? null,
        telegramId: existing?.telegramId ?? myProfile.telegramId ?? null,
        availabilityCalendar:
          existing?.availabilityCalendar ?? myProfile.availabilityCalendar ?? null,
      });
    }
    return map;
  }, [myProfile, teamProfiles]);

  const {
    data: rolesData,
    isLoading: rolesLoading,
    isError: rolesIsError,
  } = useProjectRolesQuery(projectSlug, { skip: !accessToken || !projectSlug });

  const projectRoles = rolesData?.roles ?? [];
  const rolesError = rolesIsError ? "Не удалось загрузить роли проекта" : null;

  const roleByNorm = useMemo(() => {
    const map = new Map<string, { title: string; emails: string[] }>();
    for (const r of projectRoles ?? []) {
      const key = normalizeRoleName((r as any)?.key ?? (r as any)?.title);
      if (key) {
        map.set(key, {
          title: String((r as any)?.title ?? key).trim() || key,
          emails: Array.isArray((r as any)?.emails) ? (r as any).emails : [],
        });
      }
      const aliases = Array.isArray((r as any)?.aliases) ? (r as any).aliases : [];
      for (const a of aliases) {
        const ak = normalizeRoleName(a);
        if (!ak) continue;
        if (!map.has(ak)) {
          map.set(ak, {
            title: String((r as any)?.title ?? ak).trim() || ak,
            emails: Array.isArray((r as any)?.emails) ? (r as any).emails : [],
          });
        }
      }
    }
    return map;
  }, [projectRoles]);

  const availableEmailSetForSelectedDate = useMemo(() => {
    const dateKey = calendarState.selectedDate;
    const set = new Set<string>();
    for (const m of membersWithMe) {
      const email = normalizeEmail(m.email);
      if (!email) continue;
      const prof = teamProfileByEmail.get(email);
      const availability = (prof?.availabilityCalendar as any)?.[dateKey];
      if (availability === "present") set.add(email);
    }
    return set;
  }, [calendarState.selectedDate, membersWithMe, teamProfileByEmail]);

  const freeActorsForSelectedDate = useMemo(() => {
    const dateKey = calendarState.selectedDate;
    const out: Array<{
      email: string;
      displayName?: string | null;
      avatarUrl?: string | null;
      roles: string[];
    }> = [];

    for (const m of membersWithMe) {
      const email = normalizeEmail(m.email);
      if (!email) continue;
      const prof = teamProfileByEmail.get(email);
      const availability = (prof?.availabilityCalendar as any)?.[dateKey];
      if (availability !== "present") continue;

      const roles = (projectRoles ?? [])
        .filter((r) =>
          (Array.isArray((r as any)?.emails) ? (r as any).emails : [])
            .map(normalizeEmail)
            .includes(email),
        )
        .map((r) => String((r as any)?.title ?? "").trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru"));

      out.push({
        email: m.email,
        displayName: m.displayName ?? null,
        avatarUrl: String((prof as any)?.avatarUrl ?? "").trim() || null,
        roles,
      });
    }

    out.sort((a, b) => formatMemberLabel(a).localeCompare(formatMemberLabel(b), "ru"));
    return out;
  }, [calendarState.selectedDate, membersWithMe, projectRoles, teamProfileByEmail]);

  const dispatch = useAppDispatch();
  const planIds = useMemo(() => rehearsals.slice(0, 20).map((r) => r.id), [rehearsals]);

  useEffect(() => {
    if (!accessToken) return;
    const subs = planIds.map((id) => dispatch(rehearsalsApi.endpoints.rehearsalPlan.initiate(id)));
    return () => {
      for (const sub of subs) sub.unsubscribe();
    };
  }, [accessToken, dispatch, planIds]);

  const planCache = useAppSelector((state) => {
    const out: Record<string, { notReady: number }> = {};
    for (const id of planIds) {
      const data = rehearsalsApi.endpoints.rehearsalPlan.select(id)(state).data as
        | RehearsalPlanResponse
        | undefined;
      if (!data) continue;
      const items = data.items ?? [];
      const notReady = data.selectionRequired
        ? 1
        : items.filter((item) => !item.ready).length;
      out[id] = { notReady };
    }
    return out;
  });

  const createForSelectedDate = async () => {
    if (!accessToken) return;
    const startsAt = new Date(`${calendarState.selectedDate}T19:00:00`).toISOString();
    const created = await createRehearsalMut({
      projectSlug,
      title: "Репетиция",
      startsAt,
      durationMin: 120,
    }).unwrap();
    setActiveRehearsalId(created.id);
  };

  const doPublish = async () => {
    if (!accessToken || !activeRehearsal) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await publishRehearsalMut(activeRehearsal.id).unwrap();

      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((r) => setTimeout(r, 1200));
        const fresh = await fetchRehearsal(activeRehearsal.id).unwrap();
        if (fresh.telegramMessageId || fresh.publishedAt) break;
      }
    } catch {
      setPublishError("Не удалось опубликовать репетицию в чат");
    } finally {
      setPublishing(false);
    }
  };

  const toggleScene = (playbookId: string, sceneId: number) => {
    setSelectedScenes((prev) => {
      const key = `${playbookId}:${sceneId}`;
      const has = prev.some((x) => `${x.playbookId}:${x.sceneId}` === key);
      if (has) return prev.filter((x) => `${x.playbookId}:${x.sceneId}` !== key);
      return [...prev, { playbookId, sceneId }];
    });
  };

  const saveSelectedScenes = async () => {
    if (!accessToken || !activeRehearsal) return;
    setSavingScenes(true);
    setSaveScenesError(null);
    try {
      await updateRehearsalMut({
        rehearsalId: activeRehearsal.id,
        projectSlug,
        patch: { selectedScenes },
      }).unwrap();
    } catch {
      setSaveScenesError("Не удалось сохранить выбранные сцены");
    } finally {
      setSavingScenes(false);
    }
  };

  const sceneAvailabilityByKey = useMemo(() => {
    const out = new Map<
      string,
      {
        ok: boolean;
        unknown: boolean;
        requiredRoles: string[];
        missingRoles: string[];
        assignedRoles: string[];
      }
    >();

    for (const sc of sceneOptions ?? []) {
      for (const st of sc.scenes ?? []) {
        const key = `${sc.id}:${st.id}`;
        const full = scriptSceneById.get(st.id);
        const unknown = !full || rolesLoading;
        const text = (full?.playMarkdown ?? full?.markdown ?? "") as string;
        const requiredRolesRaw = extractRolesSmart(text);
        const requiredNorms: Array<{ norm: string; display: string; emails: string[] }> = [];
        const seen = new Set<string>();
        for (const r of requiredRolesRaw) {
          const nr = normalizeRoleName(r);
          if (!nr || seen.has(nr)) continue;
          seen.add(nr);
          const info = roleByNorm.get(nr) ?? null;
          const disp = info?.title ? String(info.title).trim() : String(r ?? "").trim();
          const emails = Array.isArray(info?.emails) ? info!.emails : [];
          requiredNorms.push({ norm: nr, display: disp || nr, emails });
        }

        const assignedRoles: string[] = [];
        const missingRoles: string[] = [];
        if (!unknown) {
          for (const role of requiredNorms) {
            const hasActor =
              (role.emails ?? [])
                .map((e) => normalizeEmail(e))
                .filter(Boolean)
                .some((e) => availableEmailSetForSelectedDate.has(e));
            if (hasActor) {
              assignedRoles.push(role.display);
            } else {
              missingRoles.push(role.display);
            }
          }
        }

        const ok = unknown ? true : missingRoles.length === 0;
        out.set(key, {
          ok,
          unknown,
          requiredRoles: requiredNorms.map((x) => x.display),
          missingRoles,
          assignedRoles,
        });
      }
    }

    return out;
  }, [availableEmailSetForSelectedDate, roleByNorm, rolesLoading, scriptSceneById, sceneOptions]);

  return {
    accessToken,
    activeRehearsal,
    activeRehearsalId,
    applyPresetDuration,
    availableEmailSetForSelectedDate,
    calendarError,
    calendarState,
    computedDuration,
    computedDurationLabel,
    createForSelectedDate,
    deepLinkedRehearsalId,
    doPublish,
    dotsByDate,
    error,
    freeActorsForSelectedDate,
    loading,
    location,
    members,
    membersWithMe,
    metaDurationMin,
    metaEndTouched,
    metaEndsAtLocal,
    metaSaveError,
    metaSaving,
    metaStartsAtLocal,
    metaTitle,
    myMember,
    myProfile,
    onChangeEnd,
    onChangeStart,
    planCache,
    projectMembers,
    projectName,
    projectOwner,
    projectRoles,
    projectSlug,
    publishError,
    publishing,
    rehearsals,
    rehearsalsByDate,
    rehearsalsForSelectedDay,
    roleByNorm,
    rolesError,
    rolesLoading,
    saveMeta,
    saveSelectedScenes,
    saveScenesError,
    savingScenes,
    scriptSceneById,
    selectedScenes,
    setActiveRehearsalId,
    setCalendarError,
    setCalendarState,
    setMetaDurationMin,
    setMetaEndTouched,
    setMetaEndsAtLocal,
    setMetaSaveError,
    setMetaSaving,
    setMetaStartsAtLocal,
    setMetaTitle,
    setPublishError,
    setPublishing,
    setSaveScenesError,
    setSavingScenes,
    setSelectedScenes,
    sceneAvailabilityByKey,
    scenesError,
    scenesLoading,
    sceneOptions,
    teamProfileByEmail,
    teamProfiles,
    toggleScene,
    needsAuth: !accessToken,
  };
}
