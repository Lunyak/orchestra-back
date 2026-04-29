import { Buttons } from "@shared/components/buttons/Buttons";
import { ListItem } from "@shared/components/list-item/ListItem";
import { Button } from "@shared/core/button/Button";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import cn from "classnames";
import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import "../../features/director-session-detail/director-session-detail.css";
import {
  loadDirectorSessions,
  saveDirectorSessions,
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
} from "../../features/director-sessions/directorSessionsSync";
import { useProject } from "../../features/project";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import type { SceneRolesDataV1 } from "../../features/scene";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import type { ScriptStep } from "../../shared/types/script";
import { createId } from "../../shared/utils/createId";
import {
  getProfilesBatch,
  getProjectRoles,
  publishDirectorSession,
  syncPull,
  type DirectorSessionParticipant,
  type TeamProfile,
} from "../../sync/api";
import "../rehearsals/style.css";
import {
  getEmailsPlannedForDirectorSlot,
  getNormalizedRoleKeysForSlotStep,
} from "./sessionSlotPlanned";
import "./style.css";

type ProjectDataCache = Record<
  string,
  {
    steps: ScriptStep[];
    roleEmailsByKey: Record<string, string[]>;
    roleTitleByKey: Record<string, string>;
    sceneRoles?: SceneRolesDataV1 | null;
  }
>;

type AvailabilityTimeRange = { from: string; to: string };

type SessionsSideCalledStatusTone =
  | "muted"
  | "ok"
  | "warn"
  | "bad"
  | "confirmed";

const SESSION_ROW_LONG_PRESS_MS = 520;
const SESSION_ROW_LONG_PRESS_MOVE_PX = 12;

function parseTimeHHMM(src: string): number | null {
  const s = String(src ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function formatTimeHHMM(totalMin: number): string {
  const m = ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getSessionStartLocalMinutes(startsAtIso: string): number {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

function formatSlotTime(startsAtIso: string, offsetMin: number): string {
  const base = getSessionStartLocalMinutes(startsAtIso);
  return formatTimeHHMM(base + Math.max(0, Math.floor(offsetMin)));
}

function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

function normalizeEmail(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/** Email из JWT accessToken (для учёта собственной явки режиссёра). */
function parseEmailFromAccessToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = JSON.parse(atob(b64)) as { email?: string; sub?: string };
    const raw =
      typeof json.email === "string" && json.email.trim()
        ? json.email
        : typeof json.sub === "string" && json.sub.includes("@")
          ? json.sub
          : "";
    const n = normalizeEmail(raw);
    return n && looksLikeEmail(n) ? n : null;
  } catch {
    return null;
  }
}

function isDirectorSessionPublished(
  session: DirectorRehearsalSession,
): boolean {
  return Boolean(String(session.publishedAt ?? "").trim());
}

function findDirectorSessionParticipant(
  session: DirectorRehearsalSession,
  emailNorm: string,
): DirectorSessionParticipant | undefined {
  const list = (session.participants ?? []) as DirectorSessionParticipant[];
  return list.find((p) => normalizeEmail(String(p.email ?? "")) === emailNorm);
}

/**
 * Явка на вызов (после «Опубликовать»): только status участника из participants.
 * До публикации — зелёный слот по календарю: явная отметка дня/интервалов + «приду»; для себя (JWT) — как исключение для режиссёра.
 */
function actorCalendarPresentStrictForDraft(
  emailNorm: string,
  sessionDateKey: string,
  profilesByEmail: Map<string, TeamProfile>,
  selfEmailNorm: string | null,
): boolean {
  if (selfEmailNorm && emailNorm === selfEmailNorm) return true;
  const p = profilesByEmail.get(emailNorm);
  if (!p) return false;
  if (!profileHasSpecifiedAvailabilityForDate(p, sessionDateKey)) return false;
  const cal = (p as any)?.availabilityCalendar?.[sessionDateKey] as
    | string
    | undefined;
  return cal === "present";
}

function getRangesForDateMinutes(
  prof: TeamProfile | null | undefined,
  dateKey: string | null,
): Array<{ fromMin: number; toMin: number }> {
  if (!prof || !dateKey) return [];
  const raw = (prof as any)?.availabilityTimeRanges as
    | Record<string, AvailabilityTimeRange[]>
    | null
    | undefined;
  const list = raw?.[dateKey];
  if (!Array.isArray(list) || list.length === 0) return [];
  const out: Array<{ fromMin: number; toMin: number }> = [];
  for (const it of list.slice(0, 20)) {
    const fromMin = parseTimeHHMM(String((it as any)?.from ?? ""));
    const toMin = parseTimeHHMM(String((it as any)?.to ?? ""));
    if (fromMin == null || toMin == null) continue;
    if (fromMin >= toMin) continue;
    out.push({ fromMin, toMin });
  }
  out.sort((a, b) => a.fromMin - b.fromMin || a.toMin - b.toMin);
  return out;
}

function isSlotInsideRanges(
  slotStartMin: number,
  slotEndMin: number,
  ranges: Array<{ fromMin: number; toMin: number }>,
): boolean {
  if (ranges.length === 0) return false;
  const a = Math.max(0, Math.floor(slotStartMin));
  const b = Math.max(0, Math.floor(slotEndMin));
  for (const r of ranges) {
    if (a >= r.fromMin && b <= r.toMin) return true;
  }
  return false;
}

type SlotActorAvailability = "free" | "busy" | "unknown";

function classifyActorSlotAvailability(
  prof: TeamProfile | undefined,
  sessionDateKey: string,
  startMin: number,
  endMin: number,
): SlotActorAvailability {
  if (!prof) return "unknown";
  const cal = (prof as any)?.availabilityCalendar as
    | Record<string, string>
    | undefined;
  const st =
    cal?.[sessionDateKey] === "present"
      ? "present"
      : cal?.[sessionDateKey] === "absent"
        ? "absent"
        : "unknown";
  if (st === "absent") return "busy";
  const ranges = getRangesForDateMinutes(prof, sessionDateKey);
  if (ranges.length > 0) {
    return isSlotInsideRanges(startMin, endMin, ranges) ? "free" : "busy";
  }
  if (st === "present") return "free";
  return "unknown";
}

/** Есть явная отметка на день или заданы интервалы — иначе в план вызова не попадаем. */
function profileHasSpecifiedAvailabilityForDate(
  prof: TeamProfile | null | undefined,
  dateKey: string | null,
): boolean {
  if (!prof || !dateKey) return false;
  const cal = (prof as any)?.availabilityCalendar as
    | Record<string, string>
    | undefined;
  const dayMark = cal?.[dateKey];
  if (dayMark === "present" || dayMark === "absent") return true;
  return getRangesForDateMinutes(prof, dateKey).length > 0;
}

function sessionStartsDateKey(
  session: DirectorRehearsalSession,
): string | null {
  const d = new Date(session.startsAt);
  return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
}

function filterPlannedEmailsBySpecifiedAvailability(
  emails: string[],
  dateKey: string | null,
  profileByEmail: Map<string, TeamProfile>,
): string[] {
  if (!dateKey || emails.length === 0) return emails;
  return emails.filter((e) =>
    profileHasSpecifiedAvailabilityForDate(
      profileByEmail.get(normalizeEmail(e)),
      dateKey,
    ),
  );
}

function normalizeRoleKey(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computePlannedEmailsForSession(
  session: DirectorRehearsalSession,
  dataCache: ProjectDataCache,
): { emails: string[]; complete: boolean } {
  const out = new Set<string>();
  let complete = true;
  const slots = session?.slots ?? [];
  for (const sl of slots) {
    const ref = (sl as any)?.ref as
      | { projectSlug?: string; stepId?: number }
      | undefined;
    const slug = String(ref?.projectSlug ?? "").trim();
    const stepId = typeof ref?.stepId === "number" ? ref.stepId : null;
    if (!slug || stepId == null) continue;
    const data = dataCache[slug];
    if (!data) {
      complete = false;
      continue;
    }
    const slotEmails = getEmailsPlannedForDirectorSlot(
      slug,
      stepId,
      data,
      (sl as any)?.roleRehearsalPicks,
    );
    for (const norm of slotEmails) {
      out.add(norm);
      if (out.size >= 500) break;
    }
    if (out.size >= 500) break;
  }
  return { emails: Array.from(out), complete };
}

function getLocalDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { date: "", time: "" };
  const date = toDateKey(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date, time: `${hh}:${mm}` };
}

export function DirectorSessionsPage() {
  const sessionFormFieldId = useId();
  const sessionDateInputId = `${sessionFormFieldId}-date`;
  const sessionTimeInputId = `${sessionFormFieldId}-time`;

  const { accessToken } = useAuth();
  const selfEmailNorm = useMemo(
    () => parseEmailFromAccessToken(accessToken),
    [accessToken],
  );
  const { projects } = useProject();
  const location = useLocation();
  const navigate = useNavigate();
  const { sessionId: paramSessionId, slotId: paramSlotId } = useParams<{
    sessionId?: string;
    slotId?: string;
  }>();

  const sessionIdFromQuery = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    return String(sp.get("sessionId") ?? "").trim() || null;
  }, [location.search]);

  const sessionIdFromUrl = useMemo(() => {
    const fromPath = String(paramSessionId ?? "").trim();
    if (fromPath) return fromPath;
    return sessionIdFromQuery;
  }, [paramSessionId, sessionIdFromQuery]);

  const slotIdFromUrl = useMemo(
    () => String(paramSlotId ?? "").trim() || null,
    [paramSlotId],
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  /** Любой PUT без publishedAt в payload не должен «снимать» публикацию в UI; сервер уже мержит, клиент тоже. */
  const publishedAtBySessionIdRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    for (const s of sessions ?? []) {
      const id = String(s?.id ?? "").trim();
      const p = String(s.publishedAt ?? "").trim();
      if (id && p)
        publishedAtBySessionIdRef.current.set(id, String(s.publishedAt));
    }
  }, [sessions]);

  function attachKnownPublishedAt(
    list: DirectorRehearsalSession[],
  ): DirectorRehearsalSession[] {
    const m = publishedAtBySessionIdRef.current;
    return list.map((s) => {
      const id = String(s?.id ?? "").trim();
      if (!id) return s;
      if (String(s.publishedAt ?? "").trim()) return s;
      const prev = m.get(id);
      return prev && String(prev).trim() ? { ...s, publishedAt: prev } : s;
    });
  }

  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);

  const navigateToSessionPage = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      navigate(`/sessions/${encodeURIComponent(sessionId)}`);
    },
    [navigate],
  );

  const sessionRowLongPressRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null;
    sessionId: string | null;
    startX: number;
    startY: number;
  }>({ timer: null, sessionId: null, startX: 0, startY: 0 });
  const suppressSessionRowClickUntilRef = useRef(0);

  const cancelSessionRowLongPress = useCallback(() => {
    const st = sessionRowLongPressRef.current;
    if (st.timer) clearTimeout(st.timer);
    st.timer = null;
    st.sessionId = null;
  }, []);

  useEffect(
    () => () => {
      cancelSessionRowLongPress();
    },
    [cancelSessionRowLongPress],
  );

  const onSessionRowPointerDown = useCallback(
    (e: React.PointerEvent, sessionId: string) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      cancelSessionRowLongPress();
      const st = sessionRowLongPressRef.current;
      st.sessionId = sessionId;
      st.startX = e.clientX;
      st.startY = e.clientY;
      st.timer = setTimeout(() => {
        st.timer = null;
        st.sessionId = null;
        suppressSessionRowClickUntilRef.current = Date.now() + 450;
        navigateToSessionPage(sessionId);
      }, SESSION_ROW_LONG_PRESS_MS);
    },
    [cancelSessionRowLongPress, navigateToSessionPage],
  );

  const onSessionRowPointerMove = useCallback(
    (e: React.PointerEvent, sessionId: string) => {
      const st = sessionRowLongPressRef.current;
      if (!st.timer || st.sessionId !== sessionId) return;
      const dx = e.clientX - st.startX;
      const dy = e.clientY - st.startY;
      if (
        dx * dx + dy * dy >
        SESSION_ROW_LONG_PRESS_MOVE_PX * SESSION_ROW_LONG_PRESS_MOVE_PX
      ) {
        cancelSessionRowLongPress();
      }
    },
    [cancelSessionRowLongPress],
  );

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  const activeSessionPublished = Boolean(
    String(
      (activeSession as DirectorRehearsalSession | null)?.publishedAt ?? "",
    ).trim(),
  );

  // minimal UX: selected slot (для блока «кто вызван»)
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSession) {
      setActiveSlotId(null);
      return;
    }
    const slots = activeSession.slots ?? [];
    if (slotIdFromUrl && slots.some((sl) => sl.id === slotIdFromUrl)) {
      setActiveSlotId(slotIdFromUrl);
      return;
    }
    setActiveSlotId((prev) => {
      if (prev && slots.some((sl) => sl.id === prev)) return prev;
      return slots[0]?.id ?? null;
    });
  }, [activeSessionId, activeSession, slotIdFromUrl]);

  const sessionDateKey = useMemo(() => {
    if (!activeSession?.startsAt) return null;
    const d = new Date(activeSession.startsAt);
    return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
  }, [activeSession?.startsAt]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDirectorSessions(accessToken)
      .then((res) => {
        if (cancelled) return;
        setSessions(res.sessions ?? []);
        const ids = new Set(
          (res.sessions ?? [])
            .map((s: any) => String(s?.id ?? ""))
            .filter(Boolean),
        );
        setActiveSessionId((prev) => {
          if (sessionIdFromUrl && ids.has(sessionIdFromUrl))
            return sessionIdFromUrl;
          return prev ?? res.sessions?.[0]?.id ?? null;
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Не удалось загрузить сессии");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, sessionIdFromUrl]);

  // Диплинк /sessions/:id/slots/:slotId — та же страница списка сессий; индекс /sessions — ?sessionId=
  useEffect(() => {
    if (!activeSessionId) return;

    const deepMatch = /^\/sessions\/([^/]+)\/slots\/([^/]+)\/?$/.exec(
      location.pathname,
    );

    if (deepMatch) {
      const urlSid = deepMatch[1];
      const urlSlot = deepMatch[2];

      if (urlSid !== activeSessionId) {
        const sess = sessions.find((s) => s.id === activeSessionId);
        const first = sess?.slots?.[0]?.id ?? null;
        if (first) {
          navigate(
            `/sessions/${encodeURIComponent(activeSessionId)}/slots/${encodeURIComponent(first)}`,
            { replace: true },
          );
        } else {
          navigate(
            {
              pathname: "/sessions",
              search: `?sessionId=${encodeURIComponent(activeSessionId)}`,
            },
            { replace: true },
          );
        }
        return;
      }

      const sess = sessions.find((s) => s.id === activeSessionId);
      const slots = sess?.slots ?? [];
      if (slots.length === 0) {
        navigate(
          {
            pathname: "/sessions",
            search: `?sessionId=${encodeURIComponent(activeSessionId)}`,
          },
          { replace: true },
        );
        return;
      }
      if (
        activeSlotId &&
        slots.some((sl) => sl.id === activeSlotId) &&
        urlSlot !== activeSlotId
      ) {
        navigate(
          `/sessions/${encodeURIComponent(activeSessionId)}/slots/${encodeURIComponent(activeSlotId)}`,
          { replace: true },
        );
      }
      return;
    }

    if (location.pathname !== "/sessions") return;
    if (sessionIdFromQuery === activeSessionId) return;
    const search = `?sessionId=${encodeURIComponent(activeSessionId)}`;
    navigate({ pathname: "/sessions", search }, { replace: true });
  }, [
    activeSessionId,
    activeSlotId,
    location.pathname,
    navigate,
    sessionIdFromQuery,
    sessions,
  ]);

  const persist = async (next: DirectorRehearsalSession[]) => {
    if (!accessToken) return;
    const merged = attachKnownPublishedAt(next);
    setSessions(merged);
    try {
      await saveDirectorSessions(accessToken, { sessions: merged });
    } catch (e) {
      console.error("saveDirectorSessions failed:", e);
    }
  };

  const moveSessionBefore = async (dragId: string, beforeId: string) => {
    if (dragId === beforeId) return;
    const fromIndex = (sessions ?? []).findIndex((s) => s.id === dragId);
    const toIndex = (sessions ?? []).findIndex((s) => s.id === beforeId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...sessions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await persist(next);
  };

  const moveSessionDelta = async (id: string, delta: -1 | 1) => {
    const idx = (sessions ?? []).findIndex((s) => s.id === id);
    if (idx === -1) return;
    const nextIndex = idx + delta;
    if (nextIndex < 0 || nextIndex >= (sessions ?? []).length) return;
    const next = [...sessions];
    const tmp = next[idx];
    next[idx] = next[nextIndex];
    next[nextIndex] = tmp;
    await persist(next);
  };

  const deleteSession = async (sessionId: string) => {
    const s = (sessions ?? []).find((x) => x.id === sessionId) ?? null;
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`Удалить сессию “${s?.title ?? "Без названия"}”?`)
        : true;
    if (!ok) return;
    const idx = (sessions ?? []).findIndex((x) => x.id === sessionId);
    const next = (sessions ?? []).filter((x) => x.id !== sessionId);
    const nextActive =
      activeSessionId === sessionId
        ? (next[Math.min(idx, Math.max(0, next.length - 1))]?.id ??
          next[0]?.id ??
          null)
        : activeSessionId;
    setActiveSessionId(nextActive);
    publishedAtBySessionIdRef.current.delete(sessionId);
    await persist(next);
  };

  const createSession = async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const next: DirectorRehearsalSession = {
      id: createId(),
      title: `Сессия ${now.toLocaleDateString()}`,
      startsAt: nowIso,
      slots: [{ id: createId(), offsetMin: 0, durationMin: 30 }],
      updatedAt: nowIso,
    };
    const merged = [next, ...sessions];
    setActiveSessionId(next.id);
    await persist(merged);
  };

  const updateSessionById = async (
    sessionId: string,
    patch: Partial<DirectorRehearsalSession>,
  ) => {
    const base = (sessions ?? []).find((x) => x.id === sessionId) ?? null;
    if (!base) return;
    const nowIso = new Date().toISOString();
    const nextActive: DirectorRehearsalSession = {
      ...base,
      ...patch,
      updatedAt: nowIso,
    };
    const computed = computePlannedEmailsForSession(nextActive, dataCache);
    const rawPlanned = computed.emails;
    const dk = sessionStartsDateKey(nextActive);
    let plannedEmails = rawPlanned;
    if (accessToken && dk && rawPlanned.length > 0) {
      try {
        const list = await getProfilesBatch(accessToken, rawPlanned);
        const byEmail = new Map<string, TeamProfile>();
        (list ?? []).forEach((p) => {
          const e = normalizeEmail((p as any)?.email);
          if (e) byEmail.set(e, p);
        });
        plannedEmails = filterPlannedEmailsBySpecifiedAvailability(
          rawPlanned,
          dk,
          byEmail,
        );
      } catch (_) {
        plannedEmails = rawPlanned;
      }
    }
    const nextWithPlanned: DirectorRehearsalSession =
      computed.complete || rawPlanned.length > 0
        ? { ...nextActive, plannedEmails }
        : nextActive;

    const nextSessions = sessions.map((s) =>
      s.id === sessionId ? nextWithPlanned : s,
    );
    await persist(nextSessions);
  };

  const updateActiveSession = async (
    patch: Partial<DirectorRehearsalSession>,
  ) => {
    if (!activeSession) return;
    await updateSessionById(activeSession.id, patch);
  };

  const {
    draft: sessionCommentDraft,
    onChange: onSessionCommentChange,
    onBlur: onSessionCommentBlur,
  } = useDebouncedSyncedText(
    activeSession?.id,
    activeSession?.comment,
    (sessionId, comment) => {
      void updateSessionById(sessionId, { comment });
    },
  );

  const publishActiveSession = async () => {
    if (!accessToken || !activeSession) return;
    setPublishing(true);
    setPublishError(null);
    try {
      const pub = await publishDirectorSession(accessToken, activeSession.id, {
        comment: sessionCommentDraft ?? "",
      });
      if (
        pub?.session &&
        String((pub.session as any)?.id ?? "") === activeSession.id
      ) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? ({ ...s, ...(pub.session as any) } as DirectorRehearsalSession)
              : s,
          ),
        );
      }
      const res = await loadDirectorSessions(accessToken);
      setSessions(res.sessions ?? []);
    } catch (e: any) {
      setPublishError(
        e?.response?.data?.message ||
          e?.message ||
          "Не удалось опубликовать или обновить публикацию сессии",
      );
    } finally {
      setPublishing(false);
    }
  };

  // ---- Material picker (from "kanban" data via syncPull) ----
  const projectFilterStorageKey = "directorSessions:materialsProject";
  const [projectFilter, setProjectFilter] = useState<string>(() => {
    try {
      return (
        (typeof window !== "undefined"
          ? localStorage.getItem(projectFilterStorageKey)
          : null) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("selectedProject")
          : null) ||
        ""
      );
    } catch (_) {
      return "";
    }
  });
  const [dataCache, setDataCache] = useState<ProjectDataCache>({});
  const [stepsLoading, setStepsLoading] = useState(false);

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );

  const loadProjectData = async (slug: string) => {
    if (!accessToken) return;
    if (!slug || dataCache[slug]) return;
    setStepsLoading(true);
    try {
      const pull = await syncPull(accessToken, null, slug, { steps: true });
      const rolesRes = await getProjectRoles(accessToken, slug).catch(
        () => null,
      );
      const roleEmailsByKey: Record<string, string[]> = {};
      const roleTitleByKey: Record<string, string> = {};
      (rolesRes?.roles ?? []).forEach((r: any) => {
        const key = normalizeRoleKey(String(r?.key ?? r?.title ?? ""));
        if (!key) return;
        const emails = Array.isArray(r?.emails)
          ? r.emails.map((e: any) => normalizeEmail(e)).filter(Boolean)
          : [];
        roleEmailsByKey[key] = Array.from(new Set(emails));
        roleTitleByKey[key] = String(r?.title ?? r?.key ?? key).trim() || key;
      });
      // у вас обычно одна сцена на проект (script); берём первую по projectId
      const proj = (pull.projects ?? []).find((p: any) => p.slug === slug);
      const scene = proj
        ? (pull.scenes ?? []).find(
            (s: any) => String(s?.id ?? "") === `${proj.id}:script`,
          )
        : null;
      const sceneId = String(scene?.id ?? "");
      const steps = (
        Array.isArray((pull as any)?.steps) ? (pull as any).steps : []
      )
        .filter((st: any) => String(st?.sceneId ?? "") === sceneId)
        .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
        .map((st: any) => ({
          id: Number(st?.sourceId ?? 0),
          title: String(st?.title ?? ""),
          markdown: String(st?.markdown ?? ""),
          playMarkdown: st?.playMarkdown ?? undefined,
          explicationMarkdown: st?.explicationMarkdown ?? undefined,
          durationMin: st?.durationMin ?? undefined,
          kanbanStatus: st?.kanbanStatus ?? undefined,
          kanbanOrder: st?.kanbanOrder ?? undefined,
        }))
        .filter((x: any) => Number.isFinite(x.id) && x.id > 0);
      const sceneRoles = ((scene as any)?.sceneRoles ??
        null) as SceneRolesDataV1 | null;
      setDataCache((p) => ({
        ...p,
        [slug]: { steps, roleEmailsByKey, roleTitleByKey, sceneRoles },
      }));
    } catch (e) {
      console.error("loadProjectData failed:", slug, e);
      setDataCache((p) => ({
        ...p,
        [slug]: {
          steps: [],
          roleEmailsByKey: {},
          roleTitleByKey: {},
          sceneRoles: null,
        },
      }));
    } finally {
      setStepsLoading(false);
    }
  };

  function plannedEmailsFingerprint(emails: string[] | undefined): string {
    return [
      ...(emails ?? []).map((e) => normalizeEmail(String(e))).filter(Boolean),
    ]
      .sort()
      .join("|");
  }

  // После подгрузки script/sceneRoles в dataCache пересчитываем plannedEmails (раньше слот мог сохраниться до загрузки кэша).
  useEffect(() => {
    if (!accessToken) return;
    if ((sessions ?? []).length === 0) return;
    if (stepsLoading) return;

    let cancelled = false;

    void (async () => {
      const list = sessions ?? [];
      const rawBySessionId = new Map<string, string[]>();
      const dateKeyBySessionId = new Map<string, string | null>();
      const allEmails = new Set<string>();

      for (const session of list) {
        const slugs = Array.from(
          new Set(
            (session.slots ?? [])
              .map((s) => String((s as any)?.ref?.projectSlug ?? "").trim())
              .filter(Boolean),
          ),
        );
        const cacheReady =
          slugs.length === 0 ||
          slugs.every((slug) =>
            Object.prototype.hasOwnProperty.call(dataCache, slug),
          );
        if (!cacheReady) continue;

        const computed = computePlannedEmailsForSession(session, dataCache);
        const raw = computed.emails;
        rawBySessionId.set(session.id, raw);
        dateKeyBySessionId.set(session.id, sessionStartsDateKey(session));
        for (const e of raw) {
          const ne = normalizeEmail(e);
          if (ne) allEmails.add(ne);
        }
      }

      let profileByEmail = new Map<string, TeamProfile>();
      let profilesFetchOk = false;
      if (allEmails.size > 0) {
        try {
          const profs = await getProfilesBatch(
            accessToken,
            Array.from(allEmails),
          );
          if (cancelled) return;
          profilesFetchOk = true;
          profileByEmail = new Map();
          (profs ?? []).forEach((p) => {
            const e = normalizeEmail((p as any)?.email);
            if (e) profileByEmail.set(e, p);
          });
        } catch (_) {
          profilesFetchOk = false;
          profileByEmail = new Map();
        }
      }

      if (cancelled) return;

      let changed = false;
      const nextSessions = list.map((session) => {
        if (!rawBySessionId.has(session.id)) return session;
        const raw = rawBySessionId.get(session.id) ?? [];
        const dk = dateKeyBySessionId.get(session.id) ?? null;
        const nextEmails =
          profilesFetchOk && dk
            ? filterPlannedEmailsBySpecifiedAvailability(
                raw,
                dk,
                profileByEmail,
              )
            : raw;
        if (
          plannedEmailsFingerprint(session.plannedEmails) ===
          plannedEmailsFingerprint(nextEmails)
        ) {
          return session;
        }
        changed = true;
        return { ...session, plannedEmails: nextEmails };
      });
      if (!changed) return;
      void persist(nextSessions);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist меняется каждый рендер; достаточно dataCache/sessions
  }, [accessToken, dataCache, sessions, stepsLoading]);

  useEffect(() => {
    const first =
      (projectFilter && visibleProjects.includes(projectFilter)
        ? projectFilter
        : "") ||
      visibleProjects[0] ||
      "";
    if (first && first !== projectFilter) setProjectFilter(first);
  }, [projectFilter, visibleProjects]);

  useEffect(() => {
    if (!projectFilter) return;
    try {
      localStorage.setItem(projectFilterStorageKey, projectFilter);
    } catch (_) {}
  }, [projectFilter]);

  useEffect(() => {
    if (!projectFilter) return;
    void loadProjectData(projectFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  // Подгружаем данные проектов, которые уже используются в слотах (чтобы показывать названия/аналитику)
  useEffect(() => {
    if (!activeSession) return;
    const slugs = Array.from(
      new Set(
        (activeSession.slots ?? [])
          .map((s) => s.ref?.projectSlug)
          .filter(Boolean) as string[],
      ),
    );
    slugs.forEach((slug) => {
      if (!dataCache[slug]) void loadProjectData(slug);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, activeSession?.slots?.length]);

  const slotById = useMemo(() => {
    const map = new Map<string, DirectorSessionSlot>();
    (activeSession?.slots ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [activeSession?.slots]);

  const activeSlot = activeSlotId ? (slotById.get(activeSlotId) ?? null) : null;

  const slotInsights = useMemo(() => {
    if (!activeSession) return [];
    return [...(activeSession.slots ?? [])]
      .sort((a, b) => a.offsetMin - b.offsetMin)
      .map((sl) => {
        const ref = sl.ref;
        if (!ref) {
          return {
            slotId: sl.id,
            time: formatSlotTime(activeSession.startsAt, sl.offsetMin),
            title: "Материал не выбран",
            ready: false,
            missingRoles: [] as string[],
            actors: [] as string[],
          };
        }
        const data = dataCache[ref.projectSlug];
        const step = data?.steps?.find((x) => x.id === ref.stepId) ?? null;
        const roleKeys = getNormalizedRoleKeysForSlotStep(
          step ?? null,
          data?.sceneRoles,
          ref.stepId,
        );
        const missingRoles = roleKeys
          .filter((key) => !key || !(data?.roleEmailsByKey ?? {})[key]?.length)
          .map(
            (key) =>
              String(data?.roleTitleByKey?.[key ?? ""] ?? key ?? "").trim() ||
              key,
          );
        /** Кто вызван на репетицию в слоте: чекбоксы «кто репетирует», иначе весь состав ролей. */
        const actors = getEmailsPlannedForDirectorSlot(
          ref.projectSlug,
          ref.stepId,
          data,
          (sl as DirectorSessionSlot).roleRehearsalPicks,
        );
        return {
          slotId: sl.id,
          time: formatSlotTime(activeSession.startsAt, sl.offsetMin),
          title:
            `${ref.projectSlug} · #${ref.stepId} ${step?.title ?? ""}`.trim(),
          ready: roleKeys.length === 0 ? true : missingRoles.length === 0,
          missingRoles,
          actors: Array.from(
            new Set(actors.map((x) => String(x ?? "").trim()).filter(Boolean)),
          ),
        };
      });
  }, [activeSession, dataCache]);

  /** Все email, отмеченные в слотах как участники репетиции (для панели без выбранного слота). */
  const sessionPickedActorEmails = useMemo(() => {
    if (!activeSession) return new Set<string>();
    const set = new Set<string>();
    for (const sl of activeSession.slots ?? []) {
      const ref = sl.ref;
      if (!ref?.projectSlug || ref.stepId == null) continue;
      const data = dataCache[ref.projectSlug];
      if (!data) continue;
      for (const e of getEmailsPlannedForDirectorSlot(
        ref.projectSlug,
        ref.stepId,
        data,
        (sl as DirectorSessionSlot).roleRehearsalPicks,
      )) {
        const n = normalizeEmail(String(e ?? ""));
        if (n) set.add(n);
      }
    }
    return set;
  }, [activeSession?.id, activeSession?.slots, dataCache]);

  const actorsSummary = useMemo(() => {
    const map = new Map<string, { actor: string; slots: number }>();
    for (const s of slotInsights) {
      for (const a of s.actors) {
        const key = String(a ?? "").trim();
        if (!key) continue;
        map.set(key, { actor: key, slots: (map.get(key)?.slots ?? 0) + 1 });
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => b.slots - a.slots || a.actor.localeCompare(b.actor, "ru"),
    );
  }, [slotInsights]);

  const actorEmails = useMemo(() => {
    const set = new Set<string>();
    for (const x of actorsSummary) {
      const raw = String(x.actor ?? "").trim();
      if (!looksLikeEmail(raw)) continue;
      const n = normalizeEmail(raw);
      if (n) set.add(n);
    }
    for (const p of activeSession?.plannedEmails ?? []) {
      const raw = String(p ?? "").trim();
      if (!looksLikeEmail(raw)) continue;
      const n = normalizeEmail(raw);
      if (n) set.add(n);
    }
    return Array.from(set);
  }, [actorsSummary, activeSession?.plannedEmails, activeSession?.id]);

  const [profilesByEmail, setProfilesByEmail] = useState<
    Map<string, TeamProfile>
  >(new Map());
  useEffect(() => {
    if (!accessToken) return;
    if (!sessionDateKey) return;
    const uniq = Array.from(new Set(actorEmails)).filter(Boolean);
    if (uniq.length === 0) {
      setProfilesByEmail(new Map());
      return;
    }
    let cancelled = false;
    getProfilesBatch(accessToken, uniq)
      .then((list) => {
        if (cancelled) return;
        const map = new Map<string, TeamProfile>();
        (list ?? []).forEach((p) => {
          const e = normalizeEmail((p as any)?.email);
          if (e) map.set(e, p);
        });
        setProfilesByEmail(map);
      })
      .catch(() => {
        if (!cancelled) setProfilesByEmail(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, actorEmails.join("|"), sessionDateKey]);

  const slotAvailabilityById = useMemo(() => {
    if (!activeSession || !sessionDateKey)
      return new Map<
        string,
        { free: string[]; busy: string[]; unknown: string[] }
      >();
    const base = getSessionStartLocalMinutes(activeSession.startsAt);
    const slotActorsById = new Map<string, string[]>();
    for (const s of slotInsights) slotActorsById.set(s.slotId, s.actors ?? []);

    const out = new Map<
      string,
      { free: string[]; busy: string[]; unknown: string[] }
    >();
    for (const sl of activeSession.slots ?? []) {
      const actors = slotActorsById.get(sl.id) ?? [];
      if (actors.length === 0) continue;

      const startMin = base + Math.max(0, Math.floor(sl.offsetMin || 0));
      const endMin = startMin + Math.max(1, Math.floor(sl.durationMin || 1));

      const free: string[] = [];
      const busy: string[] = [];
      const unknown: string[] = [];

      for (const actorRaw of actors) {
        const actor = normalizeEmail(actorRaw);
        if (!actor) continue;
        const prof = profilesByEmail.get(actor);
        const st = classifyActorSlotAvailability(
          prof,
          sessionDateKey,
          startMin,
          endMin,
        );
        if (st === "free") free.push(actorRaw);
        else if (st === "busy") busy.push(actorRaw);
        else unknown.push(actorRaw);
      }

      out.set(sl.id, { free, busy, unknown });
    }
    return out;
  }, [
    activeSessionId,
    activeSession?.startsAt,
    activeSession?.slots,
    profilesByEmail,
    sessionDateKey,
    slotInsights,
  ]);

  const sessionsSideCalledRows = useMemo(() => {
    if (!activeSession) return [];

    const rowForEmail = (
      raw: string,
      opts: {
        freeSet: Set<string> | null;
        busySet: Set<string> | null;
      },
    ) => {
      const emailNorm = normalizeEmail(String(raw ?? ""));
      const prof = emailNorm ? profilesByEmail.get(emailNorm) : undefined;
      const displayName = String((prof as any)?.displayName ?? "").trim();
      const name = displayName || String(raw ?? "").trim() || emailNorm;
      const avatarUrl = String((prof as any)?.avatarUrl ?? "").trim() || null;
      let statusLabel = "";
      let statusTone: SessionsSideCalledStatusTone = "muted";
      const cal =
        sessionDateKey && prof
          ? (
              (prof as any)?.availabilityCalendar as
                | Record<string, string>
                | undefined
            )?.[sessionDateKey]
          : undefined;

      const published = isDirectorSessionPublished(activeSession);
      const participants = activeSession.participants ?? [];
      const hasCallTable = published && participants.length > 0;

      if (!sessionDateKey) {
        statusLabel = "Сначала укажи дату сессии";
        statusTone = "warn";
      } else if (opts.busySet?.has(emailNorm)) {
        statusLabel = "Занят на это время";
        statusTone = "bad";
      } else if (hasCallTable) {
        const part = findDirectorSessionParticipant(activeSession, emailNorm);
        if (part?.status === "present") {
          statusLabel = "Подтвердил явку";
          statusTone = "confirmed";
        } else if (part?.status === "absent") {
          statusLabel = "Отметил «не приду»";
          statusTone = "bad";
        } else if (part?.status === "late") {
          statusLabel = "Опоздает";
          statusTone = "warn";
        } else if (part) {
          statusLabel = "Вызов не подтверждён";
          statusTone = "warn";
        } else {
          statusLabel = "Вызов не подтверждён";
          statusTone = "warn";
        }
      } else if (selfEmailNorm && emailNorm === selfEmailNorm) {
        statusLabel = "Подтвердил явку";
        statusTone = "confirmed";
      } else if (opts.freeSet && opts.freeSet.has(emailNorm)) {
        statusLabel = "Свободен";
        statusTone = "ok";
      } else if (!opts.freeSet) {
        if (cal === "absent") {
          statusLabel = "Занят (календарь)";
          statusTone = "bad";
        } else {
          statusLabel = "Свободен";
          statusTone = "ok";
        }
      } else {
        statusLabel = "Занятость не отмечена";
        statusTone = "warn";
      }

      return {
        key: emailNorm || String(raw),
        email: String(raw ?? "").trim(),
        name,
        avatarUrl,
        avatarLabel: name,
        statusLabel,
        statusTone,
      };
    };

    if (!activeSlotId) {
      const emailSet = new Set<string>();
      for (const p of activeSession.plannedEmails ?? []) {
        const n = normalizeEmail(String(p ?? ""));
        if (n) emailSet.add(n);
      }
      sessionPickedActorEmails.forEach((n) => emailSet.add(n));
      const sorted = Array.from(emailSet).sort((a, b) =>
        a.localeCompare(b, "ru"),
      );
      return sorted.map((emailNorm) =>
        rowForEmail(emailNorm, { freeSet: null, busySet: null }),
      );
    }

    const insight = slotInsights.find((x) => x.slotId === activeSlotId);
    if (!insight) return [];
    const emails = insight.actors ?? [];
    if (emails.length === 0) return [];
    const avail = slotAvailabilityById.get(activeSlotId) ?? {
      free: [] as string[],
      busy: [] as string[],
      unknown: [] as string[],
    };
    const freeSet = new Set(
      avail.free.map((x) => normalizeEmail(String(x ?? ""))),
    );
    const busySet = new Set(
      avail.busy.map((x) => normalizeEmail(String(x ?? ""))),
    );
    return emails.map((raw) => rowForEmail(raw, { freeSet, busySet }));
  }, [
    activeSession,
    activeSlotId,
    slotInsights,
    sessionPickedActorEmails,
    slotAvailabilityById,
    profilesByEmail,
    sessionDateKey,
    selfEmailNorm,
  ]);

  /**
   * Список сессий: зелёный слот — кастинг готов и у каждого вызванного «явка на вызов»:
   * после публикации — participants.status === "present"; до публикации — явная отметка дня + «приду» (или JWT для себя).
   */
  const slotRowToneClassBySlotId = useMemo(() => {
    const out = new Map<string, string>();
    if (!activeSession || !sessionDateKey) return out;

    const published = isDirectorSessionPublished(activeSession);
    const participants = activeSession.participants ?? [];
    const hasCallTable = published && participants.length > 0;

    for (const insight of slotInsights) {
      const sl = slotById.get(insight.slotId);
      if (!sl?.ref) continue;

      if (!insight.ready) {
        out.set(
          insight.slotId,
          "sessions-slots-readonly__row--tone-roles-not-covered",
        );
        continue;
      }

      const actors = insight.actors ?? [];
      const normActors = actors
        .map((a) => normalizeEmail(String(a ?? "")))
        .filter(Boolean);
      if (normActors.length === 0) continue;

      let allConfirmedPresent = true;
      for (const e of normActors) {
        if (hasCallTable) {
          const st = findDirectorSessionParticipant(activeSession, e)?.status;
          if (st !== "present") {
            allConfirmedPresent = false;
            break;
          }
        } else if (
          !actorCalendarPresentStrictForDraft(
            e,
            sessionDateKey,
            profilesByEmail,
            selfEmailNorm,
          )
        ) {
          allConfirmedPresent = false;
          break;
        }
      }

      out.set(
        insight.slotId,
        allConfirmedPresent
          ? "sessions-slots-readonly__row--tone-all-free"
          : "sessions-slots-readonly__row--tone-roles-not-covered",
      );
    }
    return out;
  }, [
    activeSession,
    sessionDateKey,
    slotInsights,
    slotById,
    profilesByEmail,
    selfEmailNorm,
  ]);

  const activeSlotInsight = useMemo(
    () => slotInsights.find((x) => x.slotId === activeSlotId) ?? null,
    [slotInsights, activeSlotId],
  );

  if (!accessToken) return <div className="rehearsals-muted">Нужно войти.</div>;
  if (loading) return <div className="rehearsals-muted">Загрузка сессий…</div>;
  if (error) return <div className="rehearsals-error">{error}</div>;

  const sessionsCount = sessions?.length ?? 0;
  const activeIndex = (sessions ?? []).findIndex(
    (s) => s.id === activeSessionId,
  );

  return (
    <>
      <div className="rehearsals-page sessions-page">
        <div className="rehearsals-head">
          <div className="rehearsals-meta">Сессии</div>
        </div>

        <div className="sessions-layout">
          <aside className="sessions-side">
            <RehearsalsCard>
              <div className="sessions-actions">
                <Button
                  type="button"
                  onClick={() =>
                    activeSessionId &&
                    void moveSessionDelta(activeSessionId, -1)
                  }
                  disabled={activeIndex <= 0}
                  title="Переместить выбранную сессию вверх"
                >
                  ↑
                </Button>
                <Button
                  type="button"
                  onClick={() =>
                    activeSessionId && void moveSessionDelta(activeSessionId, 1)
                  }
                  disabled={
                    activeIndex < 0 || activeIndex === sessionsCount - 1
                  }
                  title="Переместить выбранную сессию вниз"
                >
                  ↓
                </Button>
                <Buttons.DeleteButton
                  type="button"
                  className="sessions-actions__btn-delete"
                  onClick={() =>
                    activeSessionId && void deleteSession(activeSessionId)
                  }
                  disabled={activeIndex < 0}
                  title="Удалить выбранную сессию"
                />
              </div>
              <div className="sessions-list">
                {(sessions ?? []).map((s, index) => (
                  <div
                    key={s.id}
                    className={`sessions-sessionRow ${s.id === activeSessionId ? "active" : ""}`}
                    title="Выбор: клик · открыть сессию: двойной клик или долгое нажатие"
                    onClick={() => {
                      if (Date.now() < suppressSessionRowClickUntilRef.current)
                        return;
                      setActiveSessionId(s.id);
                    }}
                    onDoubleClick={() => navigateToSessionPage(s.id)}
                    onPointerDown={(e) => onSessionRowPointerDown(e, s.id)}
                    onPointerMove={(e) => onSessionRowPointerMove(e, s.id)}
                    onPointerUp={cancelSessionRowLongPress}
                    onPointerCancel={cancelSessionRowLongPress}
                    onContextMenu={(e) => e.preventDefault()}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      const dragId =
                        e.dataTransfer.getData("text/plain") ||
                        draggedSessionId;
                      if (!dragId) return;
                      void moveSessionBefore(dragId, s.id);
                    }}
                  >
                    <ListItem
                      className={`sessions-listItem-row ${s.id === activeSessionId ? "active" : ""} ${draggedSessionId === s.id ? "dragging" : ""}`}
                    >
                      <span
                        className="sessions-sessionRow__dragHandle"
                        draggable
                        title="Перетащи за ручку, чтобы изменить порядок"
                        role="presentation"
                        onPointerDown={(e) => e.stopPropagation()}
                        onDragStart={(e) => {
                          cancelSessionRowLongPress();
                          e.dataTransfer.setData("text/plain", s.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedSessionId(s.id);
                        }}
                        onDragEnd={() => setDraggedSessionId(null)}
                      >
                        ⋮⋮
                      </span>
                      <button
                        type="button"
                        className="rehearsals-item"
                        title="Выбор — клик · страница сессии — двойной клик или долгое нажатие"
                      >
                        <div className="rehearsals-item-title">{s.title}</div>
                      </button>
                    </ListItem>
                  </div>
                ))}
                <Buttons.AddButton
                  type="button"
                  onClick={createSession}
                  title="Новая сессия"
                  aria-label="Добавить сессию"
                />
              </div>
            </RehearsalsCard>
          </aside>

          <div className="sessions-main">
            {!activeSession ? (
              <div className="rehearsals-muted">Выбери или создай сессию.</div>
            ) : (
              <div className="sessions-panels">
                <RehearsalsCard fluid>
                  <div className="form-textarea sessions-slots__title">
                    <input
                      className="native-text-input"
                      type="text"
                      aria-label="Название сессии"
                      value={activeSession.title}
                      onChange={(e) =>
                        void updateActiveSession({ title: e.target.value })
                      }
                    />
                  </div>

                  <div className="sessions-row">
                    <div
                      className={cn(
                        "form-textarea",
                        "form-textarea--with-label",
                      )}
                    >
                      <input
                        id={sessionDateInputId}
                        className="native-text-input"
                        type="date"
                        value={
                          getLocalDateTimeParts(activeSession.startsAt).date
                        }
                        onChange={(e) => {
                          const { time } = getLocalDateTimeParts(
                            activeSession.startsAt,
                          );
                          const next = `${e.target.value}T${time || "20:00"}:00`;
                          const d = new Date(next);
                          if (Number.isFinite(d.getTime()))
                            void updateActiveSession({
                              startsAt: d.toISOString(),
                            });
                        }}
                      />
                    </div>
                    <div
                      className={cn(
                        "form-textarea",
                        "form-textarea--with-label",
                      )}
                    >
                      <input
                        id={sessionTimeInputId}
                        className="native-text-input"
                        type="time"
                        value={
                          getLocalDateTimeParts(activeSession.startsAt).time
                        }
                        onChange={(e) => {
                          const { date } = getLocalDateTimeParts(
                            activeSession.startsAt,
                          );
                          const next = `${date || toDateKey(new Date())}T${e.target.value}:00`;
                          const d = new Date(next);
                          if (Number.isFinite(d.getTime()))
                            void updateActiveSession({
                              startsAt: d.toISOString(),
                            });
                        }}
                      />
                    </div>
                  </div>

                  <div className="sessions-slots-readonly">
                    <div className="sessions-slots-readonly__head">
                      <span className="rehearsals-muted">Слоты (обзор)</span>
                    </div>
                    {(!activeSession.slots ||
                      activeSession.slots.length === 0) && (
                      <div className="sessions-slots-empty rehearsals-muted">
                        Слотов пока нет — задай план на странице сессии (кнопка
                        выше).
                      </div>
                    )}
                    {[...(activeSession.slots ?? [])]
                      .sort((a, b) => a.offsetMin - b.offsetMin)
                      .map((sl) => (
                        <button
                          key={sl.id}
                          type="button"
                          className={`sessions-slots-readonly__row ${sl.id === activeSlotId ? "active" : ""} ${slotRowToneClassBySlotId.get(sl.id) ?? ""}`.trim()}
                          onClick={() => setActiveSlotId(sl.id)}
                        >
                          <div className="sessions-slots-readonly__time">
                            {formatSlotTime(
                              activeSession.startsAt,
                              sl.offsetMin,
                            )}{" "}
                            · {sl.durationMin} мин
                          </div>
                          <div className="sessions-slots-readonly__meta">
                            {slotInsights.find((x) => x.slotId === sl.id)
                              ?.title ??
                              (sl.ref
                                ? `${sl.ref.projectSlug} · шаг #${sl.ref.stepId}`
                                : "Материал не выбран")}
                          </div>
                          {String(sl.notes ?? "").trim() ? (
                            <div
                              className="sessions-slots-readonly__notes"
                              title={String(sl.notes).trim()}
                            >
                              {String(sl.notes).trim()}
                            </div>
                          ) : null}
                          {(() => {
                            const av = slotAvailabilityById.get(sl.id);
                            if (!av) return null;
                            const total =
                              av.free.length +
                              av.busy.length +
                              av.unknown.length;
                            if (total === 0) return null;
                            return (
                              <div className="rehearsals-muted sessions-slots-readonly__avail">
                                по доступности: свободны <b>{av.free.length}</b>{" "}
                                / {total}
                                {av.unknown.length ? (
                                  <>
                                    {" "}
                                    · не отмечено: <b>{av.unknown.length}</b>
                                  </>
                                ) : null}
                                {av.busy.length ? (
                                  <>
                                    {" "}
                                    · заняты: <b>{av.busy.length}</b>
                                  </>
                                ) : null}
                              </div>
                            );
                          })()}
                          {(() => {
                            const info = slotInsights.find(
                              (x) => x.slotId === sl.id,
                            );
                            if (!info || !sl.ref) return null;
                            if (info.ready) {
                              return (
                                <div className="rehearsals-muted sessions-slot-ok">
                                  Собирается
                                </div>
                              );
                            }
                            if (info.missingRoles.length) {
                              return (
                                <div className="rehearsals-error sessions-slot-bad">
                                  Не собирается: нет назначений для{" "}
                                  {info.missingRoles.slice(0, 4).join(", ")}
                                  {info.missingRoles.length > 4
                                    ? ` +${info.missingRoles.length - 4}`
                                    : ""}
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </button>
                      ))}
                  </div>
                  {publishError && (
                    <div className="rehearsals-error">{publishError}</div>
                  )}

                  <FormTextarea
                    rootClassName="form-textarea--section"
                    rows={3}
                    value={sessionCommentDraft}
                    onChange={(e) => onSessionCommentChange(e.target.value)}
                    onBlur={onSessionCommentBlur}
                    placeholder="Комментарий к сессии"
                  />

                  <div className="sessions-slots__container-btns">
                    <Button
                      type="button"
                      onClick={() => void publishActiveSession()}
                      disabled={publishing}
                      title={
                        activeSessionPublished
                          ? "Пересобрать список участников по календарю, обновить комментарий; при подключённом боте — обновить или отправить сообщение в Telegram"
                          : "Помечает сессию опубликованной; при подключённом боте — дублирует вызов в Telegram"
                      }
                    >
                      {publishing
                        ? "Публикую…"
                        : activeSessionPublished
                          ? "Обновить публикацию"
                          : "Опубликовать"}
                    </Button>

                    <Button
                      className="sessions-field__plan"
                      type="button"
                      onClick={() =>
                        navigate(
                          `/sessions/${encodeURIComponent(activeSession.id)}`,
                        )
                      }
                      title="Создавать, наполнять и менять порядок слотов — на странице сессии"
                    >
                      План и материалы
                    </Button>
                  </div>
                </RehearsalsCard>

                {activeSession ? (
                  <div
                    className="sessions-side-called"
                    style={{ marginTop: 12 }}
                  >
                    <div className="rehearsals-section-title">
                      {activeSlotId ? "В выбранном слоте" : "Участники сессии"}
                      {activeSlotInsight ? (
                        <span
                          className="rehearsals-muted"
                          style={{ fontWeight: 600 }}
                        >
                          {" "}
                          · {activeSlotInsight.time}
                        </span>
                      ) : null}
                    </div>
                    {sessionsSideCalledRows.length === 0 ? (
                      <div
                        className="rehearsals-muted"
                        style={{ fontSize: 12 }}
                      >
                        {activeSlotId
                          ? "Нет актёров по ролям (выбери материал в слоте или назначь роли в проекте)."
                          : "Нет участников: опубликуй сессию или назначь материалы в слотах."}
                      </div>
                    ) : (
                      <div className="director-session-page__called-scroll">
                        <ul className="director-session-page__called-list">
                          {sessionsSideCalledRows.map((row) => (
                            <li
                              key={row.key}
                              className={cn(
                                "director-session-page__called-item",
                                row.statusTone === "confirmed" &&
                                  "director-session-page__called-item--confirmed",
                              )}
                            >
                              <MiniAvatar
                                src={row.avatarUrl}
                                label={row.avatarLabel}
                                title={row.email}
                                size={22}
                              />
                              <div className="director-session-page__called-item-main">
                                <span
                                  className="director-session-page__called-name"
                                  title={row.email}
                                >
                                  {row.name}
                                </span>
                                {row.statusLabel ? (
                                  <span
                                    className={
                                      row.statusTone === "confirmed"
                                        ? "director-session-page__called-status director-session-page__called-status--confirmed"
                                        : `director-session-page__called-status director-session-page__called-status--${row.statusTone}`
                                    }
                                  >
                                    {row.statusLabel}
                                  </span>
                                ) : null}
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : null}

                {/* <RehearsalsCard fluid title="Материалы">
                <div className="sessions-row sessions-material-controls">
                  <select
                    className="native-select"
                    value={projectFilter}
                    onChange={(e) => setProjectFilter(e.target.value)}
                  >
                    {visibleProjects.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                  <input
                    className="native-text-input"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="поиск по названию/тексту"
                  />
                </div>
                <div className="sessions-material-subtools">
                  <label className="sessions-check">
                    <input
                      type="checkbox"
                      checked={onlySelectable}
                      onChange={(e) => setOnlySelectable(e.target.checked)}
                    />
                    <span className="rehearsals-muted">
                      только сцены, которые можно выбрать (по ролям свободных
                      актёров)
                    </span>
                  </label>
                  {membersLoading && (
                    <span className="rehearsals-muted">
                      загружаю участников…
                    </span>
                  )}
                </div>

                {stepsLoading && (
                  <div className="rehearsals-muted sessions-help">
                    Загружаю шаги…
                  </div>
                )}

                <div className="sessions-material-list">
                  {filteredStepsForList.slice(0, 200).map((s) => (
                    <ListItem
                      key={`${projectFilter}:${s.id}`}
                      className="sessions-listItem-row"
                      draggable
                      onDragStart={(e) => {
                        const payload: DragStepRefPayload = {
                          kind: "stepRef",
                          projectSlug: projectFilter,
                          stepId: s.id,
                          durationMin:
                            s.durationMin == null
                              ? undefined
                              : Math.max(
                                  1,
                                  Math.floor(Number(s.durationMin) || 1),
                                ),
                        };
                        e.dataTransfer.setData(
                          DND_MIME_STEP_REF,
                          JSON.stringify(payload),
                        );
                        e.dataTransfer.effectAllowed = "copy";
                        setMaterialDragPayload(payload);
                      }}
                      onDragEnd={() => setMaterialDragPayload(null)}
                    >
                      <button
                        type="button"
                        className="rehearsals-item"
                        title="Открыть текст и выбрать (или перетащи в слот)"
                        onClick={() => {
                          setMaterialPreview({
                            projectSlug: projectFilter,
                            step: s,
                          });
                        }}
                      >
                        <div className="rehearsals-item-title">
                          #{s.id} {s.title}
                        </div>
                      </button>
                    </ListItem>
                  ))}
                  {filteredStepsForList.length === 0 && (
                    <div className="rehearsals-muted">Ничего не найдено.</div>
                  )}
                </div>

                {materialPreview && (
                  <div
                    className="sessions-modal-backdrop"
                    role="presentation"
                    onClick={() => setMaterialPreview(null)}
                  >
                    <div
                      className="sessions-modal"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Материал"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="sessions-modal-head">
                        <div>
                          <div className="sessions-modal-title">
                            {materialPreview.projectSlug} · #
                            {materialPreview.step.id}{" "}
                            {materialPreview.step.title}
                          </div>
                          <div className="rehearsals-muted">
                            кликни “Назначить”, чтобы положить в выбранный слот
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setMaterialPreview(null)}
                        >
                          ×
                        </button>
                      </div>
                      <div className="sessions-modal-actions">
                        <Button
                          type="button"
                          disabled={!activeSlotId}
                          onClick={() => {
                            if (!activeSlotId) return;
                            void attachToSlot(activeSlotId, {
                              projectSlug: materialPreview.projectSlug,
                              stepId: materialPreview.step.id,
                            });
                            setMaterialPreview(null);
                          }}
                        >
                          Назначить в выбранный слот
                        </Button>
                        {!activeSlotId && (
                          <div className="rehearsals-muted">
                            Сначала выбери слот слева
                          </div>
                        )}
                      </div>
                      <pre className="sessions-modal-text">
                        {markdownToPlainText(
                          String(
                            materialPreview.step.playMarkdown ??
                              materialPreview.step.markdown ??
                              "",
                          ),
                        )}
                      </pre>
                    </div>
                  </div>
                )}

                <div className="rehearsals-section">
                  <div className="rehearsals-section-title">
                    График актёров на {sessionDateKey ?? "—"}
                  </div>
                  {!sessionDateKey ? (
                    <div className="rehearsals-muted">
                      Сначала выбери дату сессии.
                    </div>
                  ) : (
                    <>
                      <div
                        className="rehearsals-muted"
                        style={{ marginTop: 6 }}
                      >
                        Месяц: <b>{troupeScheduleMonthKey}</b> · выбранный день
                        подсвечен
                      </div>
                      <div className="troupe-legend" style={{ marginTop: 8 }}>
                        <span className="troupe-legend-item">
                          <span className="troupe-dot free" /> свободен
                        </span>
                        <span className="troupe-legend-item">
                          <span className="troupe-dot partial" /> свободен
                          (время)
                        </span>
                        <span className="troupe-legend-item">
                          <span className="troupe-dot busy" /> занят
                        </span>
                        <span className="troupe-legend-item">
                          <span className="troupe-dot unknown" /> не отмечено
                        </span>
                      </div>

                      <div
                        className="troupe-schedule"
                        role="region"
                        aria-label="График занятости актёров"
                      >
                        <div
                          className="troupe-grid"
                          style={{
                            gridTemplateColumns:
                              troupeScheduleGridTemplateColumns,
                            minWidth: 240 + troupeScheduleDays.length * 28,
                          }}
                        >
                          <div className="troupe-cell troupe-sticky troupe-header-cell"></div>
                          {troupeScheduleDays.map((d) => {
                            const dayKey = toDateKey(d);
                            const isFocus = dayKey === sessionDateKey;
                            const n = d.toLocaleDateString("ru-RU", {
                              day: "numeric",
                            });
                            const wd = d.toLocaleDateString("ru-RU", {
                              weekday: "short",
                            });
                            return (
                              <div
                                key={dayKey}
                                className={`troupe-cell troupe-header-cell ${isFocus ? "focus" : ""}`}
                                title={dayKey}
                              >
                                <div
                                  style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    lineHeight: "14px",
                                  }}
                                >
                                  {n}
                                </div>
                                <div
                                  style={{
                                    fontSize: 10,
                                    opacity: 0.7,
                                    lineHeight: "12px",
                                  }}
                                >
                                  {wd}
                                </div>
                              </div>
                            );
                          })}

                          {troupeScheduleActors.length === 0 ? (
                            <div
                              className="troupe-cell troupe-empty"
                              style={{
                                gridColumn: `1 / span ${troupeScheduleDays.length + 1}`,
                              }}
                            >
                              Нет данных по участникам проекта (или нет
                              профилей).
                            </div>
                          ) : (
                            troupeScheduleActors.slice(0, 200).map((a) => {
                              const label = a.displayName
                                ? `${a.displayName} (${a.email})`
                                : a.email;
                              return (
                                <React.Fragment key={a.email}>
                                  <div
                                    className="troupe-cell troupe-sticky troupe-actor-cell"
                                    title={label}
                                  >
                                    <div
                                      style={{
                                        minWidth: 0,
                                        display: "flex",
                                        gap: 10,
                                        alignItems: "center",
                                      }}
                                    >
                                      <MiniAvatar
                                        src={
                                          String(a.avatarUrl ?? "").trim() ||
                                          null
                                        }
                                        label={label}
                                        size={22}
                                      />
                                      <div
                                        style={{
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: 2,
                                          justifyContent: "center",
                                          minWidth: 0,
                                        }}
                                      >
                                        <div
                                          className="troupe-actor-name"
                                          title={label}
                                        >
                                          {a.displayName
                                            ? a.displayName
                                            : a.email}
                                        </div>
                                        <div
                                          className="troupe-actor-email"
                                          title={a.email}
                                        >
                                          {a.email}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  {troupeScheduleDays.map((d) => {
                                    const dayKey = toDateKey(d);
                                    const cal = a.availabilityCalendar ?? {};
                                    const ranges =
                                      (a.availabilityTimeRanges ?? {})[
                                        dayKey
                                      ] ?? [];
                                    const st =
                                      cal?.[dayKey] === "present"
                                        ? "present"
                                        : cal?.[dayKey] === "absent"
                                          ? "absent"
                                          : "unknown";
                                    const cls =
                                      st === "absent"
                                        ? "busy"
                                        : ranges.length > 0
                                          ? "partial"
                                          : st === "present"
                                            ? "free"
                                            : "unknown";
                                    const tooltip =
                                      st === "absent"
                                        ? "Занят"
                                        : ranges.length > 0
                                          ? `Свободен: ${ranges.map((r) => `${r.from}–${r.to}`).join(", ")}`
                                          : st === "present"
                                            ? "Свободен"
                                            : "Не отмечено";
                                    const isFocus = dayKey === sessionDateKey;
                                    return (
                                      <div
                                        key={`${a.email}:${dayKey}`}
                                        className={`troupe-cell troupe-day-cell ${cls} ${isFocus ? "focus" : ""}`}
                                        title={`${dayKey} • ${tooltip}`}
                                      />
                                    );
                                  })}
                                </React.Fragment>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </RehearsalsCard> */}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
