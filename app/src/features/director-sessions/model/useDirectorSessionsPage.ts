import type { CalendarSectionState } from "@shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "@shared/components/calendar/MonthCalendar";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import {
  computePlannedEmailsForSession,
  findDirectorSessionParticipant,
  formatSlotTime,
  formatTimeHHMM,
  getSessionStartLocalMinutes,
  getLocalDateTimeParts,
  isDirectorSessionPublished,
  looksLikeEmail,
  normalizeEmail,
  normalizeRoleKey,
  parseEmailFromAccessToken,
  profileHasSpecifiedAvailabilityForDate,
  SESSION_ROW_LONG_PRESS_MS,
  SESSION_ROW_LONG_PRESS_MOVE_PX,
  toDateKey,
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
  type ProjectDataCache,
} from "..";
import { useProfilesBatchQuery } from "../../profile/api/profile-api";
import { useProject } from "../../project";
import {
  useDirectorSessionsBundleQuery,
  useLazyProjectMaterialQuery,
  usePublishDirectorSessionMutation,
  useRemindDirectorSessionMissingAvailabilityMutation,
  useReplaceDirectorSessionsMutation,
} from "../api/director-sessions-api";
import { createId } from "../../../shared/utils/createId";
import type { TeamProfile } from "../../../sync/api/profile";
import {
  getEmailsPlannedForDirectorSlot,
} from "./session-slot-planned";
import {
  buildSessionSlotInsights,
  computeSlotGatherStatus,
} from "./session-slot-insights";
import type { DaySessionPreview, SlotGatherStatus } from "./session-page-types";
import type { SessionsSideCalledStatusTone } from "./session-page-types";

export type DirectorSessionsPageViewModel = ReturnType<typeof useDirectorSessionsPage>;

export function useDirectorSessionsPage() {
  const sessionFormFieldId = useId();
  const sessionDateInputId = `${sessionFormFieldId}-date`;
  const sessionTimeInputId = `${sessionFormFieldId}-time`;

  const { accessToken } = useAuth();
  const selfEmailNorm = useMemo(
    () => parseEmailFromAccessToken(accessToken),
    [accessToken],
  );
  const { projects, projectItems } = useProject();
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

  const {
    data: sessionsBundle,
    isLoading: loading,
    isError: bundleIsError,
    error: bundleError,
  } = useDirectorSessionsBundleQuery(undefined, { skip: !accessToken });

  const error = bundleIsError
    ? (bundleError as { message?: string })?.message || "Не удалось загрузить сессии"
    : null;

  const [replaceDirectorSessionsMut] = useReplaceDirectorSessionsMutation();
  const [publishDirectorSessionMut] = usePublishDirectorSessionMutation();
  const [remindAvailabilityMut] = useRemindDirectorSessionMissingAvailabilityMutation();
  const [fetchProjectMaterial] = useLazyProjectMaterialQuery();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [sendingAvailabilityReminders, setSendingAvailabilityReminders] =
    useState(false);
  const [availabilityReminderMessage, setAvailabilityReminderMessage] = useState<
    string | null
  >(null);

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const [calendarState, setCalendarState] = useState<CalendarSectionState>(() => {
    const today = toDateKey(new Date());
    const d = new Date(`${today}T12:00:00`);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
    const monthEnd = new Date(
      d.getFullYear(),
      d.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );
    return {
      currentMonth: d,
      selectedDate: today,
      monthStartDate: monthStart,
      monthEndDate: monthEnd,
      fromIso: monthStart.toISOString(),
      toIso: monthEnd.toISOString(),
    };
  });
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

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, DirectorRehearsalSession[]>();
    for (const session of sessions ?? []) {
      const d = new Date(session.startsAt);
      if (!Number.isFinite(d.getTime())) continue;
      const key = toDateKey(d);
      const arr = grouped.get(key);
      if (arr) arr.push(session);
      else grouped.set(key, [session]);
    }
    for (const list of grouped.values()) {
      list.sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    }
    return grouped;
  }, [sessions]);

  const dotsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [date, list] of sessionsByDate.entries()) {
      out[date] = list.length;
    }
    return out;
  }, [sessionsByDate]);

  const eventsByDate = useMemo(() => {
    const out: Record<string, MonthCalendarEvent[]> = {};
    for (const [date, list] of sessionsByDate.entries()) {
      out[date] = list.map((s) => ({
        id: s.id,
        time: formatTimeHHMM(getSessionStartLocalMinutes(s.startsAt)),
        title: String(s.title ?? "Сессия").trim() || "Сессия",
        published: isDirectorSessionPublished(s),
      }));
    }
    return out;
  }, [sessionsByDate]);

  const sessionsForSelectedDay =
    sessionsByDate.get(calendarState.selectedDate) ?? [];

  const calendarSelectedDateLabel = useMemo(
    () => dayjs(calendarState.selectedDate).format("D MMMM YYYY"),
    [calendarState.selectedDate],
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
      return null;
    });
  }, [activeSessionId, activeSession, slotIdFromUrl]);

  useEffect(() => {
    if (!activeSession?.startsAt) return;
    const dk = toDateKey(new Date(activeSession.startsAt));
    if (!dk || dk === calendarState.selectedDate) return;
    setCalendarState((prev) => ({ ...prev, selectedDate: dk }));
  }, [activeSessionId, activeSession?.startsAt, calendarState.selectedDate]);

  const calendarSelectedDateRef = useRef(calendarState.selectedDate);
  useEffect(() => {
    const prevSelectedDate = calendarSelectedDateRef.current;
    calendarSelectedDateRef.current = calendarState.selectedDate;
    if (prevSelectedDate === calendarState.selectedDate) return;
    if (activeSessionId == null) return;
    const daySessions = sessionsByDate.get(calendarState.selectedDate) ?? [];
    if (!daySessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(null);
    }
  }, [calendarState.selectedDate, sessionsByDate, activeSessionId]);

  const sessionDateKey = useMemo(() => {
    if (!activeSession?.startsAt) return null;
    const d = new Date(activeSession.startsAt);
    return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
  }, [activeSession?.startsAt]);

  useEffect(() => {
    if (!sessionsBundle?.sessions) return;
    const list = attachKnownPublishedAt(sessionsBundle.sessions);
    setSessions(list);
    const ids = new Set(list.map((s) => String(s?.id ?? "")).filter(Boolean));
    setActiveSessionId((prev) => {
      if (sessionIdFromUrl && ids.has(sessionIdFromUrl)) return sessionIdFromUrl;
      if (prev && ids.has(prev)) return prev;
      return null;
    });
  }, [sessionsBundle?.sessions, sessionIdFromUrl]);

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
      await replaceDirectorSessionsMut({ sessions: merged }).unwrap();
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

  const createSessionAtDate = async (dateKey: string, timeLocal = "20:00") => {
    const dk = String(dateKey ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dk)) return;
    const nowIso = new Date().toISOString();
    const startsAt = new Date(`${dk}T${timeLocal}:00`).toISOString();
    const next: DirectorRehearsalSession = {
      id: createId(),
      title: `Сессия ${dayjs(dk).format("D MMM")}`,
      startsAt,
      slots: [{ id: createId(), offsetMin: 0, durationMin: 30 }],
      updatedAt: nowIso,
    };
    const merged = [next, ...sessions];
    setActiveSessionId(next.id);
    setCalendarState((prev) => ({ ...prev, selectedDate: dk }));
    await persist(merged);
  };

  const createSession = async () => {
    await createSessionAtDate(calendarState.selectedDate);
  };

  const createSessionForSelectedDate = async () => {
    await createSessionAtDate(calendarState.selectedDate);
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
    const nextWithPlanned: DirectorRehearsalSession =
      computed.complete || rawPlanned.length > 0
        ? { ...nextActive, plannedEmails: rawPlanned }
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
      const pub = await publishDirectorSessionMut({
        sessionId: activeSession.id,
        comment: sessionCommentDraft ?? "",
      }).unwrap();
      if (pub?.session && String(pub.session.id ?? "") === activeSession.id) {
        setSessions((prev) =>
          prev.map((s) =>
            s.id === activeSession.id
              ? ({ ...s, ...pub.session } as DirectorRehearsalSession)
              : s,
          ),
        );
      }
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
  const [scenesLoading, setScenesLoading] = useState(false);

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );

  const projectLabelBySlug = useMemo(
    () =>
      new Map(
        projectItems.map((project) => [
          project.slug,
          project.name || project.slug,
        ]),
      ),
    [projectItems],
  );

  const loadProjectData = async (slug: string) => {
    if (!accessToken) return;
    if (!slug || dataCache[slug]) return;
    setScenesLoading(true);
    try {
      const data = await fetchProjectMaterial(slug).unwrap();
      setDataCache((p) => ({ ...p, [slug]: data }));
    } catch (e) {
      console.error("loadProjectData failed:", slug, e);
      setDataCache((p) => ({
        ...p,
        [slug]: {
          scenes: [],
          roleEmailsByKey: {},
          roleTitleByKey: {},
          sceneRoles: null,
        },
      }));
    } finally {
      setScenesLoading(false);
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
    if (scenesLoading) return;

    let cancelled = false;

    void (async () => {
      const list = sessions ?? [];
      const rawBySessionId = new Map<string, string[]>();

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
      }

      if (cancelled) return;

      let changed = false;
      const nextSessions = list.map((session) => {
        if (!rawBySessionId.has(session.id)) return session;
        const raw = rawBySessionId.get(session.id) ?? [];
        if (
          plannedEmailsFingerprint(session.plannedEmails) ===
          plannedEmailsFingerprint(raw)
        ) {
          return session;
        }
        changed = true;
        return { ...session, plannedEmails: raw };
      });
      if (!changed) return;
      void persist(nextSessions);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- persist меняется каждый рендер; достаточно dataCache/sessions
  }, [accessToken, dataCache, sessions, scenesLoading]);

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

  useEffect(() => {
    const slugs = new Set<string>();
    for (const session of sessionsForSelectedDay) {
      for (const sl of session.slots ?? []) {
        const slug = sl.ref?.projectSlug;
        if (slug) slugs.add(slug);
      }
    }
    slugs.forEach((slug) => {
      if (!dataCache[slug]) void loadProjectData(slug);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionsForSelectedDay]);

  const slotById = useMemo(() => {
    const map = new Map<string, DirectorSessionSlot>();
    (activeSession?.slots ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [activeSession?.slots]);

  const activeSlot = activeSlotId ? (slotById.get(activeSlotId) ?? null) : null;

  const slotInsights = useMemo(() => {
    if (!activeSession) return [];
    return buildSessionSlotInsights(activeSession, dataCache, projectLabelBySlug);
  }, [activeSession, dataCache, projectLabelBySlug]);

  /** Все email, отмеченные в слотах как участники репетиции (для панели без выбранного слота). */
  const sessionPickedActorEmails = useMemo(() => {
    if (!activeSession) return new Set<string>();
    const set = new Set<string>();
    for (const sl of activeSession.slots ?? []) {
      const ref = sl.ref;
      if (!ref?.projectSlug || ref.sceneId == null) continue;
      const data = dataCache[ref.projectSlug];
      if (!data) continue;
      for (const e of getEmailsPlannedForDirectorSlot(
        ref.projectSlug,
        ref.sceneId,
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

  const profileEmailsSorted = useMemo(
    () => Array.from(new Set(actorEmails)).filter(Boolean).sort(),
    [actorEmails],
  );

  const dayPreviewActorEmails = useMemo(() => {
    const set = new Set<string>();
    for (const session of sessionsForSelectedDay) {
      for (const insight of buildSessionSlotInsights(session, dataCache)) {
        for (const actor of insight.actors) {
          const normalized = normalizeEmail(String(actor ?? ""));
          if (normalized) set.add(normalized);
        }
      }
    }
    return Array.from(set);
  }, [sessionsForSelectedDay, dataCache]);

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

  const slotGatherStatusBySlotId = useMemo(() => {
    const out = new Map<string, SlotGatherStatus>();
    if (!activeSession) return out;
    for (const insight of slotInsights) {
      const slot = slotById.get(insight.slotId);
      out.set(
        insight.slotId,
        computeSlotGatherStatus(activeSession, insight, slot),
      );
    }
    return out;
  }, [activeSession, slotInsights, slotById]);

  const daySessionPreviewsById = useMemo(() => {
    const out = new Map<string, DaySessionPreview>();
    for (const session of sessionsForSelectedDay) {
      const insights = buildSessionSlotInsights(session, dataCache, projectLabelBySlug);
      const slotsById = new Map(
        (session.slots ?? []).map((slot) => [slot.id, slot]),
      );
      const slots = insights.map((insight) => {
        const slot = slotsById.get(insight.slotId);
        const gatherStatus = computeSlotGatherStatus(session, insight, slot);
        return {
          slotId: insight.slotId,
          time: insight.time,
          projectLabel: insight.projectLabel,
          sceneLabel: insight.sceneLabel,
          gatherStatus,
          durationMin: slot?.durationMin ?? 0,
        };
      });
      const slotsWithMaterial = slots.filter((slot) => slot.gatherStatus !== "none");
      const slotsOkCount = slotsWithMaterial.filter(
        (slot) => slot.gatherStatus === "ok",
      ).length;
      const commentRaw = String(session.comment ?? "").trim();
      out.set(session.id, {
        sessionId: session.id,
        slots,
        slotsOkCount,
        slotsWithMaterialCount: slotsWithMaterial.length,
        commentPreview:
          commentRaw.length > 72 ? `${commentRaw.slice(0, 72)}…` : commentRaw,
      });
    }
    return out;
  }, [sessionsForSelectedDay, dataCache, projectLabelBySlug]);

  const sessionsSideCalledRowsBySlotId = useMemo(() => {
    const formatShortName = (profile: TeamProfile | undefined, fallback: string) => {
      const firstName = String(profile?.firstName ?? "").trim();
      const lastName = String(profile?.lastName ?? "").trim();
      if (firstName && lastName) return `${firstName} ${lastName[0]}.`;
      if (firstName) return firstName;

      const displayName = String(profile?.displayName ?? "").trim();
      const [firstPart, secondPart] = displayName.split(/\s+/).filter(Boolean);
      if (firstPart && secondPart) return `${firstPart} ${secondPart[0]}.`;
      return displayName || fallback;
    };

    const out = new Map<
      string,
      Array<{
        key: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        avatarLabel: string;
        statusLabel: string;
        statusTone: SessionsSideCalledStatusTone;
      }>
    >();
    if (!activeSession) return out;

    const rowForEmail = (raw: string) => {
      const emailNorm = normalizeEmail(String(raw ?? ""));
      const prof = emailNorm ? profilesByEmail.get(emailNorm) : undefined;
      const displayName = String((prof as TeamProfile)?.displayName ?? "").trim();
      const fallbackName = displayName || String(raw ?? "").trim() || emailNorm;
      const name = formatShortName(prof as TeamProfile | undefined, fallbackName);
      const avatarUrl = String((prof as TeamProfile)?.avatarUrl ?? "").trim() || null;
      let statusLabel = "";
      let statusTone: SessionsSideCalledStatusTone = "muted";

      const published = isDirectorSessionPublished(activeSession);
      const participants = activeSession.participants ?? [];
      const hasCallTable = published && participants.length > 0;

      if (!sessionDateKey) {
        statusLabel = "Сначала укажи дату сессии";
        statusTone = "warn";
      } else if (!hasCallTable) {
        statusLabel = "Ждём публикации";
        statusTone = "warn";
      } else {
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
        } else {
          statusLabel = "Вызов не подтверждён";
          statusTone = "warn";
        }
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

    for (const insight of slotInsights) {
      const emails = insight.actors ?? [];
      if (emails.length === 0) {
        out.set(insight.slotId, []);
        continue;
      }
      out.set(
        insight.slotId,
        emails.map((raw) => rowForEmail(raw)),
      );
    }

    return out;
  }, [activeSession, slotInsights, profilesByEmail, sessionDateKey]);

  const sessionsSideCalledRows = useMemo(() => {
    if (!activeSlotId) return [];
    return sessionsSideCalledRowsBySlotId.get(activeSlotId) ?? [];
  }, [activeSlotId, sessionsSideCalledRowsBySlotId]);

  const sessionMissingAvailabilityEmails = useMemo(() => {
    if (!activeSession || !sessionDateKey) return [] as string[];
    const source = new Set<string>();
    for (const email of activeSession.plannedEmails ?? []) {
      const normalized = normalizeEmail(String(email ?? ""));
      if (normalized) source.add(normalized);
    }
    sessionPickedActorEmails.forEach((email) => source.add(email));
    return Array.from(source).filter((email) => {
      if (selfEmailNorm && email === selfEmailNorm) return false;
      const profile = profilesByEmail.get(email);
      return !profileHasSpecifiedAvailabilityForDate(profile, sessionDateKey);
    });
  }, [
    activeSession,
    activeSession?.plannedEmails,
    sessionDateKey,
    sessionPickedActorEmails,
    profilesByEmail,
    selfEmailNorm,
  ]);

  const activeSlotInsight = useMemo(
    () => slotInsights.find((x) => x.slotId === activeSlotId) ?? null,
    [slotInsights, activeSlotId],
  );

  const sendAvailabilityReminders = async () => {
    if (!accessToken || !activeSession) return;
    setSendingAvailabilityReminders(true);
    setAvailabilityReminderMessage(null);
    setPublishError(null);
    try {
      const result = await remindAvailabilityMut(activeSession.id).unwrap();
      const sent = Number(result?.sentCount ?? 0);
      const total = Number(result?.totalWithoutAvailability ?? 0);
      if (total === 0) {
        setAvailabilityReminderMessage("У всех участников занятость уже отмечена.");
      } else if (sent > 0) {
        setAvailabilityReminderMessage(
          `Отправлено напоминаний: ${sent} из ${total}.`,
        );
      } else {
        setAvailabilityReminderMessage(
          "Нет адресатов с Telegram ID: отправка не выполнена.",
        );
      }
    } catch (e: any) {
      setPublishError(
        e?.response?.data?.message || e?.message || "Не удалось отправить напоминания",
      );
    } finally {
      setSendingAvailabilityReminders(false);
    }
  };

  const sessionsCount = sessions?.length ?? 0;
  const activeIndex = (sessions ?? []).findIndex(
    (s) => s.id === activeSessionId,
  );

  return {
    needsAuth: !accessToken,
    loading,
    error,
    sessionsCount,
    activeIndex,
    sessionDateInputId,
    sessionTimeInputId,
    sessions,
    activeSessionId,
    setActiveSessionId,
    draggedSessionId,
    setDraggedSessionId,
    navigateToSessionPage,
    suppressSessionRowClickUntilRef,
    cancelSessionRowLongPress,
    onSessionRowPointerDown,
    onSessionRowPointerMove,
    activeSession,
    activeSessionPublished,
    activeSlotId,
    setActiveSlotId,
    publishing,
    publishError,
    sendingAvailabilityReminders,
    availabilityReminderMessage,
    moveSessionDelta,
    deleteSession,
    createSession,
    createSessionAtDate,
    createSessionForSelectedDate,
    calendarState,
    setCalendarState,
    dotsByDate,
    eventsByDate,
    sessionsForSelectedDay,
    calendarSelectedDateLabel,
    updateActiveSession,
    sessionCommentDraft,
    onSessionCommentChange,
    onSessionCommentBlur,
    publishActiveSession,
    moveSessionBefore,
    slotInsights,
    slotGatherStatusBySlotId,
    daySessionPreviewsById,
    sessionsSideCalledRows,
    sessionsSideCalledRowsBySlotId,
    sessionMissingAvailabilityEmails,
    activeSlotInsight,
    sendAvailabilityReminders,
    formatSlotTime,
    getLocalDateTimeParts,
    toDateKey,
    navigate,
    sessionIdFromUrl,
  };
}
