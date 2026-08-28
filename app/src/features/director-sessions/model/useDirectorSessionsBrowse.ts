import type { CalendarSectionState } from "@shared/components/calendar/CalendarSection";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { projectSessionPath } from "../../../app/router/paths";
import type { DirectorRehearsalSession } from "../directorSessionsSync";
import {
  SESSION_ROW_LONG_PRESS_MS,
  SESSION_ROW_LONG_PRESS_MOVE_PX,
  toDateKey,
} from "./session-page-utils";
import {
  buildDotsByDate,
  buildEventsByDate,
  createInitialCalendarState,
  formatCalendarSelectedDateLabel,
  groupSessionsByDate,
  sessionDateKeyFromStartsAt,
} from "./director-sessions-page-helpers";

type UseDirectorSessionsBrowseParams = {
  projectName: string;
  visibleSessions: DirectorRehearsalSession[];
};

export function useDirectorSessionsBrowse({
  projectName,
  visibleSessions,
}: UseDirectorSessionsBrowseParams) {
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

  const [calendarState, setCalendarState] = useState<CalendarSectionState>(
    createInitialCalendarState,
  );
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);

  const navigateToSessionPage = useCallback(
    (sessionId: string) => {
      setActiveSessionId(sessionId);
      navigate(projectSessionPath(projectName, sessionId));
    },
    [navigate, projectName],
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
    () => visibleSessions.find((s) => s.id === activeSessionId) ?? null,
    [activeSessionId, visibleSessions],
  );

  const sessionsByDate = useMemo(
    () => groupSessionsByDate(visibleSessions),
    [visibleSessions],
  );

  const dotsByDate = useMemo(
    () => buildDotsByDate(sessionsByDate),
    [sessionsByDate],
  );

  const eventsByDate = useMemo(
    () => buildEventsByDate(sessionsByDate),
    [sessionsByDate],
  );

  const sessionsForSelectedDay =
    sessionsByDate.get(calendarState.selectedDate) ?? [];

  const calendarSelectedDateLabel = useMemo(
    () => formatCalendarSelectedDateLabel(calendarState.selectedDate),
    [calendarState.selectedDate],
  );

  const activeSessionPublished = Boolean(
    String(activeSession?.publishedAt ?? "").trim(),
  );

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

  const sessionDateKey = useMemo(
    () => sessionDateKeyFromStartsAt(activeSession?.startsAt),
    [activeSession?.startsAt],
  );

  useEffect(() => {
    if (!activeSessionId) return;

    const deepMatch = /\/sessions\/([^/]+)\/slots\/([^/]+)\/?$/.exec(
      location.pathname,
    );

    if (deepMatch) {
      const urlSid = deepMatch[1];
      const urlSlot = deepMatch[2];

      if (urlSid !== activeSessionId) {
        const sess = visibleSessions.find((s) => s.id === activeSessionId);
        const first = sess?.slots?.[0]?.id ?? null;
        if (first) {
          navigate(
            projectSessionPath(projectName, activeSessionId, first),
            { replace: true },
          );
        } else {
          navigate(
            {
              pathname: projectSessionPath(projectName),
              search: `?sessionId=${encodeURIComponent(activeSessionId)}`,
            },
            { replace: true },
          );
        }
        return;
      }

      const sess = visibleSessions.find((s) => s.id === activeSessionId);
      const slots = sess?.slots ?? [];
      if (slots.length === 0) {
        navigate(
          {
            pathname: projectSessionPath(projectName),
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
          projectSessionPath(projectName, activeSessionId, activeSlotId),
          { replace: true },
        );
      }
      return;
    }

    if (location.pathname !== projectSessionPath(projectName)) return;
    if (sessionIdFromQuery === activeSessionId) return;
    const search = `?sessionId=${encodeURIComponent(activeSessionId)}`;
    navigate({ pathname: projectSessionPath(projectName), search }, { replace: true });
  }, [
    activeSessionId,
    activeSlotId,
    location.pathname,
    navigate,
    projectName,
    sessionIdFromQuery,
    visibleSessions,
  ]);

  return {
    navigate,
    sessionIdFromUrl,
    sessionIdFromQuery,
    calendarState,
    setCalendarState,
    activeSessionId,
    setActiveSessionId,
    activeSlotId,
    setActiveSlotId,
    draggedSessionId,
    setDraggedSessionId,
    navigateToSessionPage,
    suppressSessionRowClickUntilRef,
    cancelSessionRowLongPress,
    onSessionRowPointerDown,
    onSessionRowPointerMove,
    activeSession,
    activeSessionPublished,
    sessionsByDate,
    dotsByDate,
    eventsByDate,
    sessionsForSelectedDay,
    calendarSelectedDateLabel,
    sessionDateKey,
  };
}
