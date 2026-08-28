import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import dayjs from "dayjs";
import { useState } from "react";
import { createId } from "../../../shared/utils/createId";
import type { DirectorRehearsalSession } from "../directorSessionsSync";
import { isDirectorSessionsSlug } from "../directorSessionsSync";
import {
  computePlannedEmailsForSession,
  findBusyConflictForChangedSessions,
  formatDirectorSessionBusyConflictMessage,
} from "./session-page-utils";
import {
  usePublishDirectorSessionMutation,
  useRemindDirectorSessionMissingAvailabilityMutation,
  useReplaceDirectorSessionsMutation,
} from "../api/director-sessions-api";
import type { ProjectDataCache } from "./session-page-types";
import {
  attachKnownPublishedAt,
  extractMutationErrorMessage,
  extractPersistErrorMessage,
  resolveCreateSessionTime,
} from "./director-sessions-page-helpers";

type UseDirectorSessionsActionsParams = {
  accessToken: string | null | undefined;
  projectName: string;
  sessions: DirectorRehearsalSession[];
  setSessions: React.Dispatch<React.SetStateAction<DirectorRehearsalSession[]>>;
  activeSessionId: string | null;
  setActiveSessionId: React.Dispatch<React.SetStateAction<string | null>>;
  activeSession: DirectorRehearsalSession | null;
  calendarSelectedDate: string;
  setCalendarSelectedDate: (dateKey: string) => void;
  dataCacheRef: React.MutableRefObject<ProjectDataCache>;
  publishedAtBySessionIdRef: React.MutableRefObject<Map<string, string>>;
  refetchSessionsBundle: () => { unwrap: () => Promise<unknown> };
};

export function useDirectorSessionsActions({
  accessToken,
  projectName,
  sessions,
  setSessions,
  activeSessionId,
  setActiveSessionId,
  activeSession,
  calendarSelectedDate,
  setCalendarSelectedDate,
  dataCacheRef,
  publishedAtBySessionIdRef,
  refetchSessionsBundle,
}: UseDirectorSessionsActionsParams) {
  const [replaceDirectorSessionsMut] = useReplaceDirectorSessionsMutation();
  const [publishDirectorSessionMut] = usePublishDirectorSessionMutation();
  const [remindAvailabilityMut] =
    useRemindDirectorSessionMissingAvailabilityMutation();

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [includeUnavailableInCall, setIncludeUnavailableInCall] =
    useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sendingAvailabilityReminders, setSendingAvailabilityReminders] =
    useState(false);
  const [availabilityReminderMessage, setAvailabilityReminderMessage] =
    useState<string | null>(null);

  const persist = async (next: DirectorRehearsalSession[]) => {
    if (!accessToken) return false;
    const busyConflict = findBusyConflictForChangedSessions(sessions, next);
    if (busyConflict) {
      setSaveError(formatDirectorSessionBusyConflictMessage(busyConflict));
      return false;
    }
    const previous = sessions;
    const merged = attachKnownPublishedAt(
      next,
      publishedAtBySessionIdRef.current,
    );
    setSessions(merged);
    setSaveError(null);
    try {
      await replaceDirectorSessionsMut({ sessions: merged }).unwrap();
      await refetchSessionsBundle().unwrap();
      return true;
    } catch (e) {
      console.error("saveDirectorSessions failed:", e);
      setSessions(previous);
      setSaveError(extractPersistErrorMessage(e));
      return false;
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
    const projectSlugs =
      projectName && !isDirectorSessionsSlug(projectName)
        ? [projectName]
        : undefined;
    const resolved = resolveCreateSessionTime({
      dateKey: dk,
      preferredTime: timeLocal,
      sessions,
      projectSlugs,
    });
    if ("error" in resolved) {
      setSaveError(resolved.error);
      return null;
    }
    const time = resolved.time;
    const nowIso = new Date().toISOString();
    const startsAt = new Date(`${dk}T${time}:00`).toISOString();
    const next: DirectorRehearsalSession = {
      id: createId(),
      title: `Сессия ${dayjs(dk).format("D MMM")}`,
      startsAt,
      projectSlugs,
      slots: [{ id: createId(), offsetMin: 0, durationMin: 30 }],
      updatedAt: nowIso,
    };
    const merged = [next, ...sessions];
    const saved = await persist(merged);
    if (!saved) return null;
    setActiveSessionId(next.id);
    setCalendarSelectedDate(dk);
    return next;
  };

  const createSession = async () => {
    return createSessionAtDate(calendarSelectedDate);
  };

  const createSessionForSelectedDate = async () => {
    return createSessionAtDate(calendarSelectedDate);
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
    const computed = computePlannedEmailsForSession(
      nextActive,
      dataCacheRef.current,
    );
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
        includeUnavailable: includeUnavailableInCall,
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
      if (pub?.telegramDeferred) {
        setPublishError(null);
      } else if (pub?.telegramSent === false) {
        setPublishError(
          "Сессия сохранена, но сообщение в Telegram не отправилось. Проверьте бота и настройки группы.",
        );
      }
    } catch (e) {
      setPublishError(
        extractMutationErrorMessage(
          e,
          "Не удалось опубликовать или обновить публикацию сессии",
        ),
      );
    } finally {
      setPublishing(false);
    }
  };

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
        setAvailabilityReminderMessage(
          "У всех участников занятость уже отмечена.",
        );
      } else if (sent > 0) {
        setAvailabilityReminderMessage(
          `Отправлено напоминаний: ${sent} из ${total}.`,
        );
      } else {
        setAvailabilityReminderMessage(
          "Нет адресатов с Telegram ID: отправка не выполнена.",
        );
      }
    } catch (e) {
      setPublishError(
        extractMutationErrorMessage(e, "Не удалось отправить напоминания"),
      );
    } finally {
      setSendingAvailabilityReminders(false);
    }
  };

  return {
    publishing,
    publishError,
    includeUnavailableInCall,
    setIncludeUnavailableInCall,
    saveError,
    sendingAvailabilityReminders,
    availabilityReminderMessage,
    persist,
    moveSessionBefore,
    moveSessionDelta,
    deleteSession,
    createSession,
    createSessionAtDate,
    createSessionForSelectedDate,
    updateActiveSession,
    sessionCommentDraft,
    onSessionCommentChange,
    onSessionCommentBlur,
    publishActiveSession,
    sendAvailabilityReminders,
  };
}
