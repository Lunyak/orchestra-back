import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useScene } from "../../features/scene";
import { useTeam } from "../../features/team";
import { CalendarSection, type CalendarSectionState } from "../../shared/components/calendar/CalendarSection";
import {
  createRehearsal,
  getMyProfile,
  getProfilesBatch,
  getProjectRoles,
  getRehearsal,
  getRehearsalSteps,
  listRehearsals,
  planRehearsal,
  publishRehearsal,
  updateRehearsal,
  type MyProfile,
  type ProjectRoleInfo,
  type Rehearsal,
  type RehearsalSelectedStep,
  type TeamProfile,
} from "../../sync/api";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import "./style.css";

dayjs.extend(isoWeek);
dayjs.locale("ru");

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function normalizeEmail(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

function formatMemberLabel(m: { email: string; displayName?: string | null }): string {
  const name = String(m.displayName ?? "").trim();
  return name ? `${name} (${m.email})` : m.email;
}

function extractRolesBrackets(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const role = (m[1] ?? "").trim();
    if (!role) continue;
    out.push(role);
  }
  return Array.from(new Set(out));
}

function extractSpeakerRolesFromLines(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("==") || line.startsWith("(")) continue;

    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, " ").trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }

    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) {
      out.push(m2[1].trim());
      continue;
    }
  }
  return Array.from(new Set(out));
}

function extractRolesSmart(text?: string): string[] {
  const a = extractRolesBrackets(text);
  const b = extractSpeakerRolesFromLines(text);
  return Array.from(new Set([...a, ...b]));
}

function normalizeRoleName(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function RehearsalsPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { projectMembers, projectOwner } = useTeam();
  const { steps: scriptSteps } = useScene();
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
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (!(rehearsals ?? []).some((r) => r.id === deepLinkedRehearsalId)) return;
    setActiveRehearsalId(deepLinkedRehearsalId);
  }, [deepLinkedRehearsalId, rehearsals]);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [stepsOptions, setStepsOptions] = useState<
    Array<{ id: string; name: string; steps: Array<{ id: number; title: string }> }>
  >([]);
  const [selectedSteps, setSelectedSteps] = useState<RehearsalSelectedStep[]>([]);
  const [savingSteps, setSavingSteps] = useState(false);
  const [saveStepsError, setSaveStepsError] = useState<string | null>(null);

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
      const updated = await updateRehearsal(accessToken, activeRehearsal.id, {
        title: metaTitle.trim() || "Репетиция",
        startsAt: nextStartsAt,
        durationMin: duration,
      });
      setRehearsals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setPlanCache((p) => {
        const next = { ...p };
        delete next[activeRehearsal.id];
        return next;
      });
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

  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);

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

  const scriptStepById = useMemo(() => {
    const map = new Map<number, (typeof scriptSteps)[number]>();
    for (const st of scriptSteps ?? []) {
      if (typeof st?.id !== "number") continue;
      map.set(st.id, st);
    }
    return map;
  }, [scriptSteps]);

  useEffect(() => {
    if (!accessToken) return;
    const emails = membersWithMe.map((m) => normalizeEmail(m.email)).filter(Boolean);
    if (emails.length === 0) {
      setTeamProfiles([]);
      return;
    }
    let cancelled = false;
    getProfilesBatch(accessToken, emails)
      .then((rows) => {
        if (cancelled) return;
        setTeamProfiles(rows ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setTeamProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, membersWithMe]);

  useEffect(() => {
    if (!accessToken) {
      setMyProfile(null);
      return;
    }
    let cancelled = false;
    getMyProfile(accessToken)
      .then((p) => {
        if (!cancelled) setMyProfile(p ?? null);
      })
      .catch(() => {
        if (!cancelled) setMyProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

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

  const [projectRoles, setProjectRoles] = useState<ProjectRoleInfo[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !projectSlug) {
      setProjectRoles([]);
      setRolesLoading(false);
      setRolesError(null);
      return;
    }
    let cancelled = false;
    setRolesLoading(true);
    setRolesError(null);
    getProjectRoles(accessToken, projectSlug)
      .then((res) => {
        if (cancelled) return;
        setProjectRoles(res?.roles ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setProjectRoles([]);
        setRolesError("Не удалось загрузить роли проекта");
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, projectSlug]);

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

  const [planCache, setPlanCache] = useState<Record<string, { notReady: number }>>({});

  useEffect(() => {
    if (!accessToken || !projectSlug) return;
    setLoading(true);
    setError(null);
    setCalendarError(null);
    listRehearsals(accessToken, projectSlug, calendarState.fromIso, calendarState.toIso)
      .then((res) => {
        setRehearsals(res.rehearsals ?? []);
        setActiveRehearsalId((prev) => prev ?? (res.rehearsals?.[0]?.id ?? null));
      })
      .catch(() => {
        setError("Не удалось загрузить репетиции");
        setCalendarError("Не удалось загрузить события репетиций");
      })
      .finally(() => setLoading(false));
  }, [accessToken, calendarState.fromIso, projectSlug, calendarState.toIso]);

  // Ленивая подгрузка плана (для подсветки карточек репетиций)
  useEffect(() => {
    if (!accessToken) return;
    const ids = rehearsals.map((r) => r.id).filter(Boolean);
    const missing = ids.filter((id) => planCache[id] == null);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.slice(0, 20).map(async (id) => {
        const data = await planRehearsal(accessToken, id);
        const notReady = data?.selectionRequired
          ? 1
          : (data.items ?? []).filter((x: any) => !x.ready).length;
        return { id, notReady };
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        setPlanCache((p) => {
          const next = { ...p };
          rows.forEach((r) => (next[r.id] = { notReady: r.notReady }));
          return next;
        });
      })
      .catch(() => { })
      .finally(() => { });
    return () => {
      cancelled = true;
    };
  }, [accessToken, planCache, rehearsals]);

  const createForSelectedDate = async () => {
    if (!accessToken) return;
    const startsAt = new Date(`${calendarState.selectedDate}T19:00:00`).toISOString();
    const created = await createRehearsal(accessToken, {
      projectSlug,
      title: "Репетиция",
      startsAt,
      durationMin: 120,
    });
    setRehearsals((prev) =>
      [...prev, created].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    );
    setActiveRehearsalId(created.id);
  };

  const doPublish = async () => {
    if (!accessToken || !activeRehearsal) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await publishRehearsal(accessToken, activeRehearsal.id);

      // Публикация асинхронная: бот отметит published через /bot/rehearsals/:id/published.
      // Подождём немного и подтянем репетицию с telegramMessageId.
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((r) => setTimeout(r, 1200));
        const fresh = await getRehearsal(accessToken, activeRehearsal.id);
        setRehearsals((prev) => prev.map((x) => (x.id === fresh.id ? fresh : x)));
        if (fresh.telegramMessageId || fresh.publishedAt) break;
      }
    } catch {
      setPublishError("Не удалось опубликовать репетицию в чат");
    } finally {
      setPublishing(false);
    }
  };

  useEffect(() => {
    if (!accessToken || !activeRehearsal?.id) {
      setStepsOptions([]);
      setSelectedSteps([]);
      return;
    }
    setStepsLoading(true);
    setStepsError(null);
    let cancelled = false;
    getRehearsalSteps(accessToken, activeRehearsal.id)
      .then((res) => {
        if (cancelled) return;
        setStepsOptions(res.scenes ?? []);
        setSelectedSteps(res.selectedSteps ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setStepsOptions([]);
        setSelectedSteps([]);
        setStepsError("Не удалось загрузить список сцен");
      })
      .finally(() => {
        if (!cancelled) setStepsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeRehearsal?.id]);

  const toggleStep = (sceneId: string, stepId: number) => {
    setSelectedSteps((prev) => {
      const key = `${sceneId}:${stepId}`;
      const has = prev.some((x) => `${x.sceneId}:${x.stepId}` === key);
      if (has) return prev.filter((x) => `${x.sceneId}:${x.stepId}` !== key);
      return [...prev, { sceneId, stepId }];
    });
  };

  const saveSelectedSteps = async () => {
    if (!accessToken || !activeRehearsal) return;
    setSavingSteps(true);
    setSaveStepsError(null);
    try {
      const updated = await updateRehearsal(accessToken, activeRehearsal.id, {
        selectedSteps,
      });
      setRehearsals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setPlanCache((p) => {
        const next = { ...p };
        delete next[activeRehearsal.id];
        return next;
      });
    } catch {
      setSaveStepsError("Не удалось сохранить выбранные сцены");
    } finally {
      setSavingSteps(false);
    }
  };

  const stepAvailabilityByKey = useMemo(() => {
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

    for (const sc of stepsOptions ?? []) {
      for (const st of sc.steps ?? []) {
        const key = `${sc.id}:${st.id}`;
        const full = scriptStepById.get(st.id);
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
  }, [availableEmailSetForSelectedDate, roleByNorm, rolesLoading, scriptStepById, stepsOptions]);

  if (!accessToken) return <div className="rehearsals-muted">Нужно войти.</div>;

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="rehearsals-page">
            <div className="rehearsals-head">
              <h2 className="rehearsals-title">Репетиции</h2>
              <div className="rehearsals-meta">Проект: {projectSlug || "—"}</div>
            </div>

            {error && <div className="rehearsals-error">{error}</div>}
            {rolesError && <div className="rehearsals-error">{rolesError}</div>}

            <div className="rehearsals-layout">
              <div className="rehearsals-main">
                <div className="rehearsals-toolbar">
                  <button type="button" onClick={createForSelectedDate} disabled={loading}>
                    + Создать репетицию
                  </button>
                </div>

                <CalendarSection
                  storageMonthKey="rehearsals-calendar-month"
                  onStateChange={setCalendarState}
                  dotsByDate={dotsByDate}
                  title="Календарь репетиций"
                  subtitle="Клик по дню: выбрать дату. Репетиции на дате показываются точками."
                />
                {calendarError && (
                  <div className="rehearsals-error" style={{ marginTop: 10 }}>
                    {calendarError}
                  </div>
                )}

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                  Репетиции на {calendarState.selectedDate}:
                </div>
                <div className="rehearsals-list">
                  {loading ? (
                    <div className="rehearsals-muted">Загрузка…</div>
                  ) : rehearsalsForSelectedDay.length === 0 ? (
                    <div className="rehearsals-muted">На этот день репетиций нет.</div>
                  ) : (
                    rehearsalsForSelectedDay.map((r) => {
                      const t = new Date(r.startsAt);
                      const hh = String(t.getHours()).padStart(2, "0");
                      const mm = String(t.getMinutes()).padStart(2, "0");
                      const end = r.durationMin != null ? dayjs(r.startsAt).add(r.durationMin, "minute") : null;
                      const endLabel = end ? end.format("HH:mm") : null;
                      const notReady = planCache[r.id]?.notReady ?? null;
                      const isBad = notReady != null && notReady > 0;
                      return (
                        <button
                          key={r.id}
                          type="button"
                          className={`rehearsals-item ${activeRehearsal?.id === r.id ? "active" : ""} ${isBad ? "bad" : ""
                            }`}
                          onClick={() => setActiveRehearsalId(r.id)}
                          title={isBad ? `Не собирается шагов: ${notReady}` : undefined}
                        >
                          <div className="rehearsals-item-title">
                            {hh}:{mm}
                            {endLabel ? `–${endLabel}` : ""} · {r.title}
                          </div>
                          <div className="rehearsals-item-meta">
                            {notReady == null ? "План…" : isBad ? `Не собирается: ${notReady}` : "Собирается"}
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="rehearsals-panels">
                  <div className="rehearsals-panel">
                    <div className="rehearsals-panel-title">
                      Свободные актёры на {calendarState.selectedDate}
                    </div>
                    {freeActorsForSelectedDate.length === 0 ? (
                      <div className="rehearsals-muted">Никто не отметил «свободен» на эту дату.</div>
                    ) : (
                      <div className="rehearsals-table-wrap">
                        <table className="rehearsals-table">
                          <thead>
                            <tr>
                              <th>Актёр</th>
                              <th>Роли (по назначениям)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {freeActorsForSelectedDate.map((a) => (
                              <tr key={a.email}>
                                <td>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                    <MiniAvatar src={String(a.avatarUrl ?? "").trim() || null} label={formatMemberLabel(a)} size={20} />
                                    <span>{formatMemberLabel(a)}</span>
                                  </span>
                                </td>
                                <td className="rehearsals-td-muted">
                                  {a.roles.length ? a.roles.join(", ") : "—"}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="rehearsals-panel">
                    <div className="rehearsals-panel-title">
                      Сцены, которые можно выбрать (по ролям свободных актёров)
                    </div>
                    {!activeRehearsal ? (
                      <div className="rehearsals-muted">Выбери (или создай) репетицию, чтобы загрузить список сцен.</div>
                    ) : stepsLoading ? (
                      <div className="rehearsals-muted">Загрузка сцен…</div>
                    ) : stepsError ? (
                      <div className="rehearsals-error">{stepsError}</div>
                    ) : stepsOptions.length === 0 ? (
                      <div className="rehearsals-muted">Сцен пока нет.</div>
                    ) : (
                      <div className="rehearsals-table-wrap">
                        <table className="rehearsals-table">
                          <thead>
                            <tr>
                              <th>Сцена</th>
                              <th>Шаг</th>
                              <th>Статус</th>
                              <th>Не хватает ролей</th>
                            </tr>
                          </thead>
                          <tbody>
                            {stepsOptions.flatMap((sc) =>
                              sc.steps.map((st) => {
                                const key = `${sc.id}:${st.id}`;
                                const info = stepAvailabilityByKey.get(key);
                                const unknown = info?.unknown ?? false;
                                const ok = info?.ok ?? true;
                                const missing = info?.missingRoles ?? [];
                                return (
                                  <tr key={`tbl-${key}`} data-ok={!unknown && ok ? "1" : "0"}>
                                    <td>{sc.name}</td>
                                    <td>
                                      {st.id}. {st.title}
                                    </td>
                                    <td
                                      className={
                                        unknown
                                          ? "rehearsals-td-muted"
                                          : ok
                                            ? "rehearsals-td-ok"
                                            : "rehearsals-td-bad"
                                      }
                                    >
                                      {unknown ? "неизвестно" : ok ? "можно" : "нельзя"}
                                    </td>
                                    <td className="rehearsals-td-muted">
                                      {unknown ? "нет данных о ролях/назначениях" : missing.length ? missing.join(", ") : "—"}
                                    </td>
                                  </tr>
                                );
                              }),
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <aside className="rehearsals-side">
                {!activeRehearsal ? (
                  <div className="rehearsals-card">
                    <div className="rehearsals-muted">Выбери репетицию слева.</div>
                  </div>
                ) : (
                  <div className="rehearsals-card">
                    <div className="rehearsals-card-title">{activeRehearsal.title}</div>
                    <div className="rehearsals-card-sub">
                      {(() => {
                        const start = dayjs(activeRehearsal.startsAt);
                        const end =
                          activeRehearsal.durationMin != null
                            ? start.add(activeRehearsal.durationMin, "minute")
                            : null;
                        return `${start.format("DD.MM.YYYY HH:mm")}${end ? `–${end.format("HH:mm")}` : ""}`;
                      })()}
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Параметры</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="rehearsals-muted" style={{ fontSize: 12 }}>
                            Название
                          </span>
                          <input
                            value={metaTitle}
                            onChange={(e) => setMetaTitle(e.target.value)}
                            placeholder="Репетиция"
                          />
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="rehearsals-muted" style={{ fontSize: 12 }}>
                            Дата и время начала
                          </span>
                          <input
                            type="datetime-local"
                            value={metaStartsAtLocal}
                            onChange={(e) => onChangeStart(e.target.value)}
                          />
                        </label>
                        <label style={{ display: "grid", gap: 6 }}>
                          <span className="rehearsals-muted" style={{ fontSize: 12 }}>
                            Дата и время окончания
                          </span>
                          <input
                            type="datetime-local"
                            value={metaEndsAtLocal}
                            onChange={(e) => onChangeEnd(e.target.value)}
                          />
                        </label>
                        <div className="rehearsals-muted" style={{ fontSize: 12 }}>
                          Длительность: {computedDurationLabel}
                        </div>

                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" onClick={() => applyPresetDuration(90)} disabled={metaSaving}>
                            90 мин
                          </button>
                          <button type="button" onClick={() => applyPresetDuration(120)} disabled={metaSaving}>
                            120 мин
                          </button>
                          <button type="button" onClick={() => applyPresetDuration(150)} disabled={metaSaving}>
                            150 мин
                          </button>
                          <button type="button" onClick={saveMeta} disabled={metaSaving}>
                            {metaSaving ? "Сохраняю…" : "Сохранить параметры"}
                          </button>
                        </div>
                        {metaSaveError && <div className="rehearsals-error">{metaSaveError}</div>}
                      </div>
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Публикация в чат</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        <div className="rehearsals-muted" style={{ fontSize: 12 }}>
                          Сначала выбери сцены (шаги) для репетиции. В опрос попадут только те актёры, которые нужны по выбранным сценам и отметили «свободен» в профиле.
                        </div>
                        <button
                          type="button"
                          onClick={doPublish}
                          disabled={
                            publishing ||
                            !!activeRehearsal.telegramMessageId ||
                            !(activeRehearsal.selectedSteps?.length ?? 0)
                          }
                          title={
                            activeRehearsal.telegramMessageId
                              ? "Уже опубликовано"
                              : !(activeRehearsal.selectedSteps?.length ?? 0)
                                ? "Сначала выберите и сохраните сцены (шаги)"
                                : "Опубликовать репетицию в Telegram-чате"
                          }
                        >
                          {activeRehearsal.telegramMessageId
                            ? "Опубликовано"
                            : publishing
                              ? "Публикую…"
                              : "Опубликовать в чат"}
                        </button>
                        {activeRehearsal.publishedAt && (
                          <div className="rehearsals-muted">
                            Опубликовано: {dayjs(activeRehearsal.publishedAt).format("DD.MM.YYYY HH:mm")}
                          </div>
                        )}
                        {publishError && <div className="rehearsals-error">{publishError}</div>}
                      </div>
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Сцены на репетицию</div>
                      {stepsLoading ? (
                        <div className="rehearsals-muted">Загрузка…</div>
                      ) : stepsError ? (
                        <div className="rehearsals-error">{stepsError}</div>
                      ) : stepsOptions.length === 0 ? (
                        <div className="rehearsals-muted">Сцен пока нет.</div>
                      ) : (
                        <div style={{ display: "grid", gap: 10 }}>
                          <div className="rehearsals-muted" style={{ fontSize: 12 }}>
                            Выбрано: {selectedSteps.length}
                          </div>
                          <div style={{ maxHeight: 220, overflow: "auto", paddingRight: 6 }}>
                            {stepsOptions.slice(0, 10).map((sc) => (
                              <div key={sc.id} style={{ marginBottom: 10 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                                  {sc.name}
                                </div>
                                <div style={{ display: "grid", gap: 6 }}>
                                  {sc.steps.slice(0, 200).map((st) => {
                                    const key = `${sc.id}:${st.id}`;
                                    const avail = stepAvailabilityByKey.get(key);
                                    const unknown = avail?.unknown ?? false;
                                    const ok = avail?.ok ?? true;
                                    const missing = avail?.missingRoles ?? [];
                                    const checked = selectedSteps.some(
                                      (x) => x.sceneId === sc.id && x.stepId === st.id,
                                    );
                                    return (
                                      <label
                                        key={`${sc.id}:${st.id}`}
                                        style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={!unknown && !ok}
                                          onChange={() => toggleStep(sc.id, st.id)}
                                          title={
                                            unknown
                                              ? "Нет данных о ролях/назначениях для этого шага"
                                              : ok
                                                ? "Можно выбрать"
                                                : missing.length
                                                  ? `Не хватает ролей (по свободным актёрам): ${missing.join(", ")}`
                                                  : "Не хватает ролей (по свободным актёрам)"
                                          }
                                        />
                                        <span style={{ fontSize: 12, lineHeight: 1.2 }}>
                                          {st.id}. {st.title}
                                          {!unknown && !ok && missing.length > 0 && (
                                            <span className="rehearsals-muted" style={{ display: "block", marginTop: 2 }}>
                                              не хватает: {missing.slice(0, 4).join(", ")}
                                              {missing.length > 4 ? ` +${missing.length - 4}` : ""}
                                            </span>
                                          )}
                                          {unknown && (
                                            <span className="rehearsals-muted" style={{ display: "block", marginTop: 2 }}>
                                              роли: нет данных
                                            </span>
                                          )}
                                        </span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          <button type="button" onClick={saveSelectedSteps} disabled={savingSteps}>
                            {savingSteps ? "Сохраняю…" : "Сохранить сцены"}
                          </button>
                          {saveStepsError && <div className="rehearsals-error">{saveStepsError}</div>}
                        </div>
                      )}
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Вызов актёров</div>
                      <div className="rehearsals-people">
                        {members.map((m) => {
                          const meta = (activeRehearsal.participants ?? []).find(
                            (p) => normalizeEmail(p.email) === normalizeEmail(m.email),
                          );
                          const dateKey = isoDate(new Date(activeRehearsal.startsAt));
                          const prof = teamProfileByEmail.get(normalizeEmail(m.email));
                          const availability =
                            (prof?.availabilityCalendar as any)?.[dateKey] === "present"
                              ? ("present" as const)
                              : (prof?.availabilityCalendar as any)?.[dateKey] === "absent"
                                ? ("absent" as const)
                                : ("unknown" as const);
                          return (
                            <div key={m.email} className="rehearsals-person">
                              <div className="rehearsals-person-label">
                                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                                  <MiniAvatar
                                    src={String((prof as any)?.avatarUrl ?? "").trim() || null}
                                    label={formatMemberLabel(m)}
                                    size={20}
                                  />
                                  <span>{formatMemberLabel(m)}</span>
                                </span>
                              </div>
                              <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                                по календарю:{" "}
                                {availability === "present"
                                  ? "свободен"
                                  : availability === "absent"
                                    ? "занят"
                                    : "не отмечено"}
                              </div>
                              {meta?.respondedAt && (
                                <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                                  ответил: {dayjs(meta.respondedAt).format("DD.MM HH:mm")}
                                </div>
                              )}
                              {meta?.status === "late" && meta?.lateTime && (
                                <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                                  будет к: {meta.lateTime}
                                </div>
                              )}
                              {meta?.status && meta.status !== "unknown" && (
                                <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                                  по вызову:{" "}
                                  {meta.status === "present"
                                    ? "подтвердил"
                                    : meta.status === "absent"
                                      ? "отказался"
                                      : "опоздает"}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rehearsals-section">
                      <div className="rehearsals-section-title">Что не собирается</div>
                      <RehearsalPlanBlock accessToken={accessToken} rehearsalId={activeRehearsal.id} />
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function RehearsalPlanBlock({
  accessToken,
  rehearsalId,
}: {
  accessToken: string | null;
  rehearsalId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !rehearsalId) return;
    setLoading(true);
    setError(null);
    planRehearsal(accessToken, rehearsalId)
      .then((res) => setData(res))
      .catch(() => setError("Не удалось посчитать план"))
      .finally(() => setLoading(false));
  }, [accessToken, rehearsalId]);

  if (!accessToken) return <div className="rehearsals-muted">Нужно войти.</div>;
  if (loading) return <div className="rehearsals-muted">Считаю…</div>;
  if (error) return <div className="rehearsals-error">{error}</div>;
  if (data?.selectionRequired) {
    return <div className="rehearsals-muted">Сначала выбери сцены (шаги) для этой репетиции.</div>;
  }
  const items = (data?.items ?? []) as Array<{
    ready: boolean;
    stepTitle: string;
    sceneName?: string;
    missing: string[];
    availableFromTime?: string;
    lateConstraints?: Array<{ role: string; email: string; availableFromTime: string }>;
    durationMin?: number | null;
  }>;
  const bad = items.filter((x) => !x.ready);
  const good = items
    .filter((x) => x.ready)
    .sort((a, b) => String(a.availableFromTime ?? "").localeCompare(String(b.availableFromTime ?? "")));

  const timeline = data?.timeline as
    | {
      rehearsalStartTime: string;
      rehearsalEndTime: string;
      durationMin: number;
      scheduledMin: number;
      steps: Array<{
        sceneName: string;
        stepTitle: string;
        startTime: string;
        endTime: string;
        durationMin: number;
      }>;
    }
    | null
    | undefined;

  if (bad.length === 0 && good.length === 0) return <div className="rehearsals-muted">Собирается.</div>;
  return (
    <div className="rehearsals-plan">
      {timeline?.steps?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Таймлайн ({timeline.rehearsalStartTime}–{timeline.rehearsalEndTime}, всего {timeline.durationMin} мин, запланировано{" "}
            {timeline.scheduledMin} мин):
          </div>
          {timeline.steps.slice(0, 50).map((t, idx) => (
            <div key={`tl-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {t.startTime}–{t.endTime} · {t.sceneName}: {t.stepTitle}
              </div>
              <div className="rehearsals-problem-meta">{t.durationMin} мин</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rehearsals-muted" style={{ marginBottom: 12 }}>
          Таймлайн появится, когда у готовых шагов будет задана длительность (мин).
        </div>
      )}

      {good.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Готовые шаги (с какого времени можно):
          </div>
          {good.slice(0, 20).map((x, idx) => (
            <div key={`g-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {x.availableFromTime ? `с ${x.availableFromTime} · ` : ""}
                {(x.sceneName ? `${x.sceneName}: ` : "") + x.stepTitle}
              </div>
              {!!x.lateConstraints?.length && (
                <div className="rehearsals-problem-meta">
                  {x.lateConstraints
                    .slice(0, 2)
                    .map((c) => `${c.role}: ${c.availableFromTime}`)
                    .join(" · ")}
                </div>
              )}
              {x.durationMin ? (
                <div className="rehearsals-problem-meta">длительность: {x.durationMin} мин</div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {bad.length > 0 && (
        <div>
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Не собирается:
          </div>
          {bad.slice(0, 30).map((x, idx) => (
            <div key={`b-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {(x.sceneName ? `${x.sceneName}: ` : "") + x.stepTitle}
              </div>
              <div className="rehearsals-problem-meta">{x.missing.slice(0, 2).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

