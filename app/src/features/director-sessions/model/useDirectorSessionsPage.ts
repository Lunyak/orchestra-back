import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useAuth } from "../../auth";
import type { DirectorRehearsalSession } from "../directorSessionsSync";
import {
  formatSlotTime,
  getLocalDateTimeParts,
  parseEmailFromAccessToken,
  toDateKey,
} from "./session-page-utils";
import { useProject } from "../../project";
import { useDirectorSessionsBundleQuery } from "../api/director-sessions-api";
import { useDirectorSessionsMaterialPicker } from "./useDirectorSessionsMaterialPicker";
import type { ProjectDataCache } from "./session-page-types";
import type { DirectorSessionsPageOptions } from "./director-sessions-page-types";
import {
  attachKnownPublishedAt,
  rememberPublishedAt,
  sessionUsesProject,
} from "./director-sessions-page-helpers";
import { useDirectorSessionsBrowse } from "./useDirectorSessionsBrowse";
import { useDirectorSessionsActions } from "./useDirectorSessionsActions";
import { useDirectorSessionsPanelData } from "./useDirectorSessionsPanelData";

export type DirectorSessionsPageViewModel = ReturnType<
  typeof useDirectorSessionsPage
>;

export function useDirectorSessionsPage(
  options: DirectorSessionsPageOptions = {},
) {
  const sessionFormFieldId = useId();
  const sessionDateInputId = `${sessionFormFieldId}-date`;
  const sessionTimeInputId = `${sessionFormFieldId}-time`;

  const { accessToken } = useAuth();
  const selfEmailNorm = useMemo(
    () => parseEmailFromAccessToken(accessToken),
    [accessToken],
  );
  const projectContext = useProject();
  const projectName = options.projectSlug || projectContext.projectName;
  const { projects, projectItems } = projectContext;

  const {
    data: sessionsBundle,
    isLoading: loading,
    isError: bundleIsError,
    error: bundleError,
    refetch: refetchSessionsBundle,
  } = useDirectorSessionsBundleQuery(undefined, { skip: !accessToken });

  const error = bundleIsError
    ? (bundleError as { message?: string })?.message ||
      "Не удалось загрузить сессии"
    : null;

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const publishedAtBySessionIdRef = useRef<Map<string, string>>(new Map());
  const visibleSessions = useMemo(() => {
    if (!options.filterByProject || !projectName) return sessions;
    return sessions.filter((session) =>
      sessionUsesProject(session, projectName),
    );
  }, [options.filterByProject, projectName, sessions]);

  const browse = useDirectorSessionsBrowse({
    projectName,
    visibleSessions,
  });

  const dataCacheRef = useRef<ProjectDataCache>({});

  const actions = useDirectorSessionsActions({
    accessToken,
    projectName,
    sessions,
    setSessions,
    activeSessionId: browse.activeSessionId,
    setActiveSessionId: browse.setActiveSessionId,
    activeSession: browse.activeSession,
    calendarSelectedDate: browse.calendarState.selectedDate,
    setCalendarSelectedDate: (dateKey) => {
      browse.setCalendarState((prev) => ({ ...prev, selectedDate: dateKey }));
    },
    dataCacheRef,
    publishedAtBySessionIdRef,
    refetchSessionsBundle,
  });

  useEffect(() => {
    rememberPublishedAt(sessions ?? [], publishedAtBySessionIdRef.current);
  }, [sessions]);

  const sessionIdFromUrl = browse.sessionIdFromUrl;
  const setActiveSessionId = browse.setActiveSessionId;

  useEffect(() => {
    if (!sessionsBundle?.sessions) return;
    const list = attachKnownPublishedAt(
      sessionsBundle.sessions,
      publishedAtBySessionIdRef.current,
    );
    setSessions(list);
    const visibleList =
      options.filterByProject && projectName
        ? list.filter((session) => sessionUsesProject(session, projectName))
        : list;
    const ids = new Set(
      visibleList.map((s) => String(s?.id ?? "")).filter(Boolean),
    );
    setActiveSessionId((prev) => {
      if (sessionIdFromUrl && ids.has(sessionIdFromUrl)) {
        return sessionIdFromUrl;
      }
      if (prev && ids.has(prev)) return prev;
      return null;
    });
  }, [
    options.filterByProject,
    projectName,
    sessionsBundle?.sessions,
    sessionIdFromUrl,
    setActiveSessionId,
  ]);

  const { dataCache, projectLabelBySlug } = useDirectorSessionsMaterialPicker({
    accessToken,
    projects,
    projectItems,
    sessions,
    activeSession: browse.activeSession,
    sessionsForSelectedDay: browse.sessionsForSelectedDay,
    persist: async (next) => {
      await actions.persist(next);
    },
  });

  dataCacheRef.current = dataCache;

  const panel = useDirectorSessionsPanelData({
    accessToken,
    activeSession: browse.activeSession,
    activeSlotId: browse.activeSlotId,
    sessionDateKey: browse.sessionDateKey,
    sessionsForSelectedDay: browse.sessionsForSelectedDay,
    dataCache,
    projectLabelBySlug,
    selfEmailNorm,
  });

  const sessionsCount = visibleSessions.length;
  const activeIndex = visibleSessions.findIndex(
    (s) => s.id === browse.activeSessionId,
  );

  return {
    projectName,
    needsAuth: !accessToken,
    loading,
    error,
    sessionsCount,
    activeIndex,
    sessionDateInputId,
    sessionTimeInputId,
    sessions: visibleSessions,
    activeSessionId: browse.activeSessionId,
    setActiveSessionId: browse.setActiveSessionId,
    draggedSessionId: browse.draggedSessionId,
    setDraggedSessionId: browse.setDraggedSessionId,
    navigateToSessionPage: browse.navigateToSessionPage,
    suppressSessionRowClickUntilRef: browse.suppressSessionRowClickUntilRef,
    cancelSessionRowLongPress: browse.cancelSessionRowLongPress,
    onSessionRowPointerDown: browse.onSessionRowPointerDown,
    onSessionRowPointerMove: browse.onSessionRowPointerMove,
    activeSession: browse.activeSession,
    activeSessionPublished: browse.activeSessionPublished,
    activeSlotId: browse.activeSlotId,
    setActiveSlotId: browse.setActiveSlotId,
    publishing: actions.publishing,
    publishError: actions.publishError,
    includeUnavailableInCall: actions.includeUnavailableInCall,
    setIncludeUnavailableInCall: actions.setIncludeUnavailableInCall,
    saveError: actions.saveError,
    sendingAvailabilityReminders: actions.sendingAvailabilityReminders,
    availabilityReminderMessage: actions.availabilityReminderMessage,
    moveSessionDelta: actions.moveSessionDelta,
    deleteSession: actions.deleteSession,
    createSession: actions.createSession,
    createSessionAtDate: actions.createSessionAtDate,
    createSessionForSelectedDate: actions.createSessionForSelectedDate,
    calendarState: browse.calendarState,
    setCalendarState: browse.setCalendarState,
    dotsByDate: browse.dotsByDate,
    eventsByDate: browse.eventsByDate,
    sessionsForSelectedDay: browse.sessionsForSelectedDay,
    calendarSelectedDateLabel: browse.calendarSelectedDateLabel,
    updateActiveSession: actions.updateActiveSession,
    sessionCommentDraft: actions.sessionCommentDraft,
    onSessionCommentChange: actions.onSessionCommentChange,
    onSessionCommentBlur: actions.onSessionCommentBlur,
    publishActiveSession: actions.publishActiveSession,
    moveSessionBefore: actions.moveSessionBefore,
    slotInsights: panel.slotInsights,
    slotGatherStatusBySlotId: panel.slotGatherStatusBySlotId,
    daySessionPreviewsById: panel.daySessionPreviewsById,
    sessionsSideCalledRows: panel.sessionsSideCalledRows,
    sessionsSideCalledRowsBySlotId: panel.sessionsSideCalledRowsBySlotId,
    sessionMissingAvailabilityEmails: panel.sessionMissingAvailabilityEmails,
    activeSlotInsight: panel.activeSlotInsight,
    sendAvailabilityReminders: actions.sendAvailabilityReminders,
    formatSlotTime,
    getLocalDateTimeParts,
    toDateKey,
    navigate: browse.navigate,
    sessionIdFromUrl: browse.sessionIdFromUrl,
  };
}
