import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import {
  actorCalendarPresentStrictForDraft,
  classifyActorSlotAvailability,
  computePlannedEmailsForSession,
  findDirectorSessionParticipant,
  formatSlotTime,
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
  getNormalizedRoleKeysForSlotStep,
} from "./session-slot-planned";
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
    if (!sessionsBundle?.sessions) return;
    const list = attachKnownPublishedAt(sessionsBundle.sessions);
    setSessions(list);
    const ids = new Set(list.map((s) => String(s?.id ?? "")).filter(Boolean));
    setActiveSessionId((prev) => {
      if (sessionIdFromUrl && ids.has(sessionIdFromUrl)) return sessionIdFromUrl;
      return prev ?? list[0]?.id ?? null;
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
      const data = await fetchProjectMaterial(slug).unwrap();
      setDataCache((p) => ({ ...p, [slug]: data }));
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

  const profileEmailsSorted = useMemo(
    () => Array.from(new Set(actorEmails)).filter(Boolean).sort(),
    [actorEmails],
  );

  const { data: profilesList = [] } = useProfilesBatchQuery(profileEmailsSorted, {
    skip: !accessToken || !sessionDateKey || profileEmailsSorted.length === 0,
  });

  const profilesByEmail = useMemo(() => {
    const map = new Map<string, TeamProfile>();
    for (const p of profilesList) {
      const e = normalizeEmail(p.email);
      if (e) map.set(e, p);
    }
    return map;
  }, [profilesList]);

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
    updateActiveSession,
    sessionCommentDraft,
    onSessionCommentChange,
    onSessionCommentBlur,
    publishActiveSession,
    moveSessionBefore,
    slotInsights,
    slotAvailabilityById,
    slotRowToneClassBySlotId,
    sessionsSideCalledRows,
    sessionMissingAvailabilityEmails,
    activeSlotInsight,
    sendAvailabilityReminders,
    formatSlotTime,
    getLocalDateTimeParts,
    toDateKey,
    navigate,
  };
}
