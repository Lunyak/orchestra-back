import { useEffect, useMemo, useState } from "react";
import {
  createRehearsal,
  getRehearsal,
  getRehearsalSteps,
  listRehearsals,
  getProfilesBatch,
  getMyProfile,
  planRehearsal,
  publishRehearsal,
  updateRehearsal,
  type Rehearsal,
  type MyProfile,
  type TeamProfile,
  type RehearsalSelectedStep,
} from "../../sync/api";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useTeam } from "../../features/team";
import { useScene } from "../../features/scene";
import "./style.css";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/ru";
import { CalendarSection, type CalendarSectionState } from "../../components/calendar/CalendarSection";

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

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

function extractEmailFromText(raw: string): string | null {
  const m = String(raw ?? "").match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m?.[0] ? normalizeEmail(m[0]) : null;
}

function normalizePersonName(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

function isAllCapsRole(raw: string): boolean {
  const s = String(raw ?? "").trim();
  if (!s) return false;
  // Есть буквы, и все буквы — в верхнем регистре (RU/EN)
  const hasLetters = /[A-Za-zА-ЯЁ]/.test(s);
  if (!hasLetters) return false;
  return !/[a-zа-яё]/.test(s);
}

function titleCaseRole(raw: string): string {
  const s = String(raw ?? "").trim().replace(/\s+/g, " ");
  if (!s) return s;
  return s
    .split(" ")
    .map((w) => {
      const t = w.trim();
      if (!t) return t;
      const first = t.slice(0, 1).toUpperCase();
      const rest = t.slice(1).toLowerCase();
      return first + rest;
    })
    .join(" ");
}

function parseCharacters(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((x) => String(x ?? "").trim())
      .filter((x) => x.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((x) => String(x ?? "").trim())
            .filter((x) => x.length > 0);
        }
      } catch {
        // fallthrough
      }
    }
    return [trimmed];
  }
  return [];
}

function resolveActorEmail(
  value: string,
  members: Array<{ email: string; displayName?: string | null }>,
): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const fromText = extractEmailFromText(raw);
  if (fromText) return fromText;

  if (looksLikeEmail(raw)) return normalizeEmail(raw);

  const q = normalizePersonName(raw);
  if (!q) return null;

  const exact = members.filter((m) => normalizePersonName(m.displayName ?? "") === q);
  if (exact.length === 1) return normalizeEmail(exact[0].email);

  // Частичное совпадение (например, "Алёна" vs "Алёна Иванова") — только если уникально.
  const partial = members.filter((m) => {
    const n = normalizePersonName(m.displayName ?? "");
    if (!n) return false;
    return n.includes(q) || q.includes(n);
  });
  if (partial.length === 1) return normalizeEmail(partial[0].email);

  return null;
}

export function RehearsalsPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { projectMembers, projectOwner } = useTeam();
  const { steps: scriptSteps } = useScene();

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
  const [metaDurationMin, setMetaDurationMin] = useState<string>("");
  const [metaSaving, setMetaSaving] = useState(false);
  const [metaSaveError, setMetaSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeRehearsal) {
      setMetaTitle("");
      setMetaStartsAtLocal("");
      setMetaDurationMin("");
      setMetaSaveError(null);
      return;
    }
    setMetaTitle(activeRehearsal.title ?? "");
    setMetaStartsAtLocal(dayjs(activeRehearsal.startsAt).format("YYYY-MM-DDTHH:mm"));
    setMetaDurationMin(
      activeRehearsal.durationMin != null ? String(activeRehearsal.durationMin) : "",
    );
    setMetaSaveError(null);
  }, [activeRehearsal?.id]);

  const saveMeta = async () => {
    if (!accessToken || !activeRehearsal) return;
    setMetaSaving(true);
    setMetaSaveError(null);
    try {
      const durationRaw = metaDurationMin.trim();
      const duration =
        durationRaw === "" ? null : Math.max(0, Math.floor(Number(durationRaw)));
      const nextStartsAt =
        metaStartsAtLocal.trim() === ""
          ? activeRehearsal.startsAt
          : new Date(metaStartsAtLocal).toISOString();
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

  const knownPeople = useMemo(() => {
    const map = new Map<string, { email: string; displayName?: string | null }>();
    for (const m of members) {
      const e = normalizeEmail(m.email);
      if (!e) continue;
      map.set(e, { email: m.email, displayName: m.displayName ?? null });
    }
    for (const p of teamProfiles ?? []) {
      const e = normalizeEmail(p.email);
      if (!e) continue;
      const existing = map.get(e);
      if (existing) {
        map.set(e, {
          email: existing.email,
          displayName: existing.displayName ?? p.displayName ?? null,
        });
      } else {
        map.set(e, { email: p.email, displayName: p.displayName ?? null });
      }
    }
    if (myProfile?.email) {
      const e = normalizeEmail(myProfile.email);
      if (e && !map.has(e)) {
        map.set(e, { email: myProfile.email, displayName: myProfile.displayName ?? null });
      }
    }
    return Array.from(map.values());
  }, [members, myProfile?.displayName, myProfile?.email, teamProfiles]);

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
    // Важно: batch может вернуть профиль без characters (если бэк не перезапущен / старая схема select).
    // Поэтому всегда подмешиваем myProfile поверх, чтобы хотя бы для себя роли работали.
    if (me && myProfile) {
      const existing = map.get(me);
      map.set(me, {
        email: existing?.email ?? myProfile.email,
        displayName: existing?.displayName ?? myProfile.displayName ?? null,
        firstName: existing?.firstName ?? myProfile.firstName ?? null,
        lastName: existing?.lastName ?? myProfile.lastName ?? null,
        telegramId: existing?.telegramId ?? myProfile.telegramId ?? null,
        characters:
          (existing as any)?.characters != null
            ? (existing as any).characters
            : (myProfile as any)?.characters ?? null,
        availabilityCalendar:
          existing?.availabilityCalendar ?? myProfile.availabilityCalendar ?? null,
      });
    }
    return map;
  }, [myProfile, teamProfiles]);

  const freeRolesNormSetForSelectedDate = useMemo(() => {
    const dateKey = calendarState.selectedDate;
    const set = new Set<string>();
    for (const m of membersWithMe) {
      const email = normalizeEmail(m.email);
      if (!email) continue;
      const prof = teamProfileByEmail.get(email);
      const availability = (prof?.availabilityCalendar as any)?.[dateKey];
      if (availability !== "present") continue;
      const chars = parseCharacters((prof as any)?.characters);
      for (const ch of chars) {
        const norm = normalizeRoleName(String(ch ?? ""));
        if (norm) set.add(norm);
      }
    }
    return set;
  }, [calendarState.selectedDate, membersWithMe, teamProfileByEmail]);

  const freeActorsForSelectedDate = useMemo(() => {
    const dateKey = calendarState.selectedDate;
    const out: Array<{
      email: string;
      displayName?: string | null;
      roles: string[];
    }> = [];

    for (const m of membersWithMe) {
      const email = normalizeEmail(m.email);
      if (!email) continue;
      const prof = teamProfileByEmail.get(email);
      const availability = (prof?.availabilityCalendar as any)?.[dateKey];
      if (availability !== "present") continue;
      const chars = parseCharacters((prof as any)?.characters);
      const roles = chars
        .map((x) => String(x ?? "").trim())
        .filter((x) => x.length > 0)
        .map((x) => (isAllCapsRole(x) ? titleCaseRole(x) : x));
      roles.sort((a, b) => a.localeCompare(b, "ru"));
      out.push({ email: m.email, displayName: m.displayName ?? null, roles });
    }

    out.sort((a, b) =>
      formatMemberLabel(a).localeCompare(formatMemberLabel(b), "ru"),
    );
    return out;
  }, [calendarState.selectedDate, membersWithMe, teamProfileByEmail]);

  const freeActorEmailSetForSelectedDate = useMemo(() => {
    return new Set(freeActorsForSelectedDate.map((a) => normalizeEmail(a.email)));
  }, [freeActorsForSelectedDate]);

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
      .catch(() => {})
      .finally(() => {});
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
        const unknown = !full;
        const text = (full?.playMarkdown ?? full?.markdown ?? "") as string;
        const requiredRolesRaw = extractRolesSmart(text);
        const requiredNorms: Array<{ norm: string; display: string }> = [];
        const seen = new Set<string>();
        for (const r of requiredRolesRaw) {
          const nr = normalizeRoleName(r);
          if (!nr || seen.has(nr)) continue;
          seen.add(nr);
          const disp = isAllCapsRole(r) ? titleCaseRole(r) : String(r ?? "").trim();
          requiredNorms.push({ norm: nr, display: disp });
        }

        const assignedRoles: string[] = [];
        const missingRoles: string[] = [];
        if (!unknown) {
          for (const role of requiredNorms) {
            if (freeRolesNormSetForSelectedDate.has(role.norm)) {
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
  }, [freeRolesNormSetForSelectedDate, scriptStepById, stepsOptions]);

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
                const notReady = planCache[r.id]?.notReady ?? null;
                const isBad = notReady != null && notReady > 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`rehearsals-item ${activeRehearsal?.id === r.id ? "active" : ""} ${
                      isBad ? "bad" : ""
                    }`}
                    onClick={() => setActiveRehearsalId(r.id)}
                    title={isBad ? `Не собирается шагов: ${notReady}` : undefined}
                  >
                    <div className="rehearsals-item-title">
                      {hh}:{mm} · {r.title}
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
                          <td>{formatMemberLabel(a)}</td>
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
                {dayjs(activeRehearsal.startsAt).format("DD.MM.YYYY HH:mm")}
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
                      onChange={(e) => setMetaStartsAtLocal(e.target.value)}
                    />
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span className="rehearsals-muted" style={{ fontSize: 12 }}>
                      Длительность (мин)
                    </span>
                    <input
                      type="number"
                      min={0}
                      step={5}
                      value={metaDurationMin}
                      onChange={(e) => setMetaDurationMin(e.target.value)}
                      placeholder="например, 90"
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" onClick={() => setMetaDurationMin("90")} disabled={metaSaving}>
                      90 мин
                    </button>
                    <button type="button" onClick={() => setMetaDurationMin("120")} disabled={metaSaving}>
                      120 мин
                    </button>
                    <button type="button" onClick={() => setMetaDurationMin("150")} disabled={metaSaving}>
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
                        <div className="rehearsals-person-label">{formatMemberLabel(m)}</div>
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

