import type { CalendarSectionState } from "@shared/components/calendar/CalendarSection";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { theaterRehearsalSessionPath } from "../../../app/router/paths";
import { createId } from "../../../shared/utils/createId";
import { useAppDispatch } from "../../../shared/store/hooks";
import {
  fetchTheaterRehearsals,
  type TheaterRehearsalsResponse,
} from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import {
  directorSessionsApi,
  findDirectorSessionBusyConflict,
  formatDirectorSessionBusyConflictMessage,
  formatTimeHHMM,
  getSessionStartLocalMinutes,
  type DirectorRehearsalSession,
  useDirectorSessionsBundleQuery,
  usePublishDirectorSessionMutation,
  useReplaceDirectorSessionsMutation,
} from "../../director-sessions";
import {
  collectBusyRanges,
  CREATE_TIME_STEP_MIN,
  DEFAULT_CREATE_DURATION_MIN,
  DEFAULT_REHEARSAL_TIME,
  dotsFromRehearsalsByDate,
  eventsFromRehearsalsByDate,
  groupRehearsalsByDate,
  isStartBlockedByRanges,
  nextFreeRehearsalTime,
  parseTimeToMinutes,
  rehearsalDetailsPath,
  rehearsalRange,
  sessionSpanMin,
} from "./theater-rehearsals-helpers";

dayjs.locale("ru");

export function useTheaterRehearsalsPage() {
  const { theaterId = "" } = useParams();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [data, setData] = useState<TheaterRehearsalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editTitle, setEditTitle] = useState("");
  const [createTime, setCreateTime] = useState(DEFAULT_REHEARSAL_TIME);
  const [calendarState, setCalendarState] =
    useState<CalendarSectionState | null>(null);
  const [selectedRehearsalId, setSelectedRehearsalId] = useState<string | null>(
    null,
  );
  const [includeUnavailableInCall, setIncludeUnavailableInCall] =
    useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState("");

  const { data: sessionsBundle } = useDirectorSessionsBundleQuery(undefined, {
    skip: !accessToken,
  });
  const [replaceSessions] = useReplaceDirectorSessionsMutation();
  const [publishSession] = usePublishDirectorSessionMutation();

  const loadRehearsals = useCallback(async () => {
    if (!accessToken || !theaterId) return;
    const range = rehearsalRange();
    setLoading(true);
    setError("");
    try {
      const response = await fetchTheaterRehearsals(
        accessToken,
        theaterId,
        range.from,
        range.to,
      );
      setData(response);
    } catch {
      setError("Не удалось загрузить репетиции театра");
    } finally {
      setLoading(false);
    }
  }, [accessToken, theaterId]);

  useEffect(() => {
    void loadRehearsals();
  }, [loadRehearsals]);

  const rehearsals = data?.rehearsals ?? [];
  const canCreateRehearsal =
    data?.theater.myRole === "OWNER" || data?.theater.myRole === "ADMIN";
  const bundleSessions = sessionsBundle?.sessions ?? [];

  const rehearsalsByDate = useMemo(
    () => groupRehearsalsByDate(rehearsals),
    [rehearsals],
  );
  const dotsByDate = useMemo(
    () => dotsFromRehearsalsByDate(rehearsalsByDate),
    [rehearsalsByDate],
  );
  const eventsByDate = useMemo(
    () => eventsFromRehearsalsByDate(rehearsalsByDate),
    [rehearsalsByDate],
  );

  const selectedDate =
    calendarState?.selectedDate ?? dayjs().format("YYYY-MM-DD");
  const selectedDateLabel = dayjs(selectedDate).format("D MMMM YYYY");
  const dayRehearsals = rehearsalsByDate.get(selectedDate) ?? [];

  useEffect(() => {
    if (!selectedRehearsalId) return;
    const stillOnDay = dayRehearsals.some(
      (rehearsal) => rehearsal.id === selectedRehearsalId,
    );
    if (!stillOnDay) setSelectedRehearsalId(null);
  }, [dayRehearsals, selectedRehearsalId]);

  const selectedRehearsal =
    dayRehearsals.find((rehearsal) => rehearsal.id === selectedRehearsalId) ??
    null;
  const selectedDirectorSession =
    selectedRehearsal?.source === "director-session"
      ? (sessionsBundle?.sessions ?? []).find(
          (session) => session.id === selectedRehearsal.id,
        ) ?? null
      : null;
  const selectedCanPublish = selectedRehearsal?.source === "director-session";
  const selectedCanManage =
    canCreateRehearsal && selectedRehearsal?.source === "director-session";
  const selectedPublished = Boolean(
    String(selectedRehearsal?.publishedAt ?? "").trim(),
  );
  const editingSessionId =
    modalMode === "edit" && selectedCanManage
      ? (selectedRehearsal?.id ?? null)
      : null;
  const modalDurationMin =
    modalMode === "edit" && selectedDirectorSession
      ? sessionSpanMin(selectedDirectorSession)
      : DEFAULT_CREATE_DURATION_MIN;

  const busyRanges = useMemo(
    () =>
      collectBusyRanges(
        dayRehearsals,
        sessionsBundle?.sessions ?? [],
        theaterId,
        selectedDate,
        editingSessionId,
      ),
    [
      dayRehearsals,
      sessionsBundle?.sessions,
      theaterId,
      selectedDate,
      editingSessionId,
    ],
  );
  const suggestedCreateTime = useMemo(
    () =>
      nextFreeRehearsalTime(
        busyRanges,
        DEFAULT_REHEARSAL_TIME,
        DEFAULT_CREATE_DURATION_MIN,
      ),
    [busyRanges],
  );
  const createStartMin = parseTimeToMinutes(createTime);
  const createTimeTaken =
    createStartMin != null &&
    isStartBlockedByRanges(createStartMin, modalDurationMin, busyRanges);
  const canSubmitCreate =
    canCreateRehearsal &&
    !creating &&
    createStartMin != null &&
    !createTimeTaken &&
    (modalMode === "create" || Boolean(editTitle.trim()));

  useEffect(() => {
    setCreateError("");
    setCreateTime(suggestedCreateTime);
    // Только смена дня: подставляем ближайшее свободное время.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const handleCreateRehearsal = async () => {
    if (!canCreateRehearsal || creating || !theaterId) return;
    const timeLocal = createTime.trim() || suggestedCreateTime;
    const startMin = parseTimeToMinutes(timeLocal);
    if (
      startMin == null ||
      isStartBlockedByRanges(
        startMin,
        DEFAULT_CREATE_DURATION_MIN,
        busyRanges,
      )
    ) {
      setCreateError(
        `Время ${timeLocal} пересекается с уже запланированной репетицией. Выберите другое.`,
      );
      return;
    }
    setCreating(true);
    setCreateError("");
    const startsAt = new Date(`${selectedDate}T${timeLocal}:00`).toISOString();
    const nowIso = new Date().toISOString();
    const session: DirectorRehearsalSession = {
      id: createId(),
      title: `Репетиция ${dayjs(selectedDate).format("D MMM")}`,
      startsAt,
      theaterId,
      slots: [
        {
          id: createId(),
          offsetMin: 0,
          durationMin: DEFAULT_CREATE_DURATION_MIN,
        },
      ],
      updatedAt: nowIso,
    };

    try {
      const existingSessions = sessionsBundle?.sessions ?? [];
      const conflict = findDirectorSessionBusyConflict(
        session,
        existingSessions,
      );
      if (conflict) {
        setCreateError(formatDirectorSessionBusyConflictMessage(conflict));
        return;
      }
      await replaceSessions({
        sessions: [session, ...existingSessions],
      }).unwrap();
      dispatch(
        directorSessionsApi.util.invalidateTags([
          { type: "DirectorSessions", id: "BUNDLE" },
        ]),
      );
      setCreateModalOpen(false);
      navigate(theaterRehearsalSessionPath(theaterId, session.id));
    } catch {
      setCreateError("Не удалось создать репетицию");
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateRehearsal = async () => {
    if (!selectedCanManage || creating || !theaterId || !selectedRehearsal)
      return;
    const base = selectedDirectorSession;
    if (!base) {
      setCreateError("Сессия репетиции не найдена");
      return;
    }
    const nextTitle = editTitle.trim();
    if (!nextTitle) {
      setCreateError("Укажите название репетиции");
      return;
    }
    const timeLocal = createTime.trim();
    const startMin = parseTimeToMinutes(timeLocal);
    const durationMin = sessionSpanMin(base);
    if (
      startMin == null ||
      isStartBlockedByRanges(startMin, durationMin, busyRanges)
    ) {
      setCreateError(
        `Время ${timeLocal} пересекается с уже запланированной репетицией. Выберите другое.`,
      );
      return;
    }
    setCreating(true);
    setCreateError("");
    const startsAt = new Date(`${selectedDate}T${timeLocal}:00`).toISOString();
    const nowIso = new Date().toISOString();
    const nextSession: DirectorRehearsalSession = {
      ...base,
      title: nextTitle,
      startsAt,
      theaterId,
      updatedAt: nowIso,
    };
    try {
      const existingSessions = sessionsBundle?.sessions ?? [];
      const conflict = findDirectorSessionBusyConflict(
        nextSession,
        existingSessions,
      );
      if (conflict) {
        setCreateError(formatDirectorSessionBusyConflictMessage(conflict));
        return;
      }
      await replaceSessions({
        sessions: existingSessions.map((session) =>
          session.id === nextSession.id ? nextSession : session,
        ),
      }).unwrap();
      dispatch(
        directorSessionsApi.util.invalidateTags([
          { type: "DirectorSessions", id: "BUNDLE" },
        ]),
      );
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          rehearsals: current.rehearsals.map((rehearsal) =>
            rehearsal.id === nextSession.id
              ? { ...rehearsal, title: nextTitle, startsAt }
              : rehearsal,
          ),
        };
      });
      setCreateModalOpen(false);
      void loadRehearsals();
    } catch {
      setCreateError("Не удалось сохранить репетицию");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRehearsal = async () => {
    if (!selectedCanManage || creating || !selectedRehearsal) return;
    const title = selectedRehearsal.title.trim() || "Без названия";
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm(`Удалить репетицию «${title}»?`)
        : true;
    if (!confirmed) return;
    setCreating(true);
    setPublishError("");
    try {
      const existingSessions = sessionsBundle?.sessions ?? [];
      await replaceSessions({
        sessions: existingSessions.filter(
          (session) => session.id !== selectedRehearsal.id,
        ),
      }).unwrap();
      dispatch(
        directorSessionsApi.util.invalidateTags([
          { type: "DirectorSessions", id: "BUNDLE" },
        ]),
      );
      setSelectedRehearsalId(null);
      setData((current) => {
        if (!current) return current;
        return {
          ...current,
          rehearsals: current.rehearsals.filter(
            (rehearsal) => rehearsal.id !== selectedRehearsal.id,
          ),
        };
      });
      void loadRehearsals();
    } catch {
      setPublishError("Не удалось удалить репетицию");
    } finally {
      setCreating(false);
    }
  };

  const openCreateModal = () => {
    setModalMode("create");
    setEditTitle("");
    setCreateTime(suggestedCreateTime);
    setCreateError("");
    setCreateModalOpen(true);
  };

  const openEditModal = () => {
    if (!selectedCanManage || !selectedRehearsal) return;
    const startMin = getSessionStartLocalMinutes(selectedRehearsal.startsAt);
    setModalMode("edit");
    setEditTitle(selectedRehearsal.title);
    setCreateTime(
      Number.isFinite(startMin)
        ? formatTimeHHMM(startMin)
        : suggestedCreateTime,
    );
    setCreateError("");
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setCreateModalOpen(false);
    setCreateError("");
    setModalMode("create");
    setEditTitle("");
  };

  const confirmModal = () => {
    if (modalMode === "edit") {
      void handleUpdateRehearsal();
      return;
    }
    void handleCreateRehearsal();
  };

  const publishSelectedRehearsal = async () => {
    if (!selectedCanPublish || !selectedRehearsal || publishing) return;
    setPublishing(true);
    setPublishError("");
    try {
      const response = await publishSession({
        sessionId: selectedRehearsal.id,
        comment: selectedDirectorSession?.comment ?? null,
        includeUnavailable: includeUnavailableInCall,
      }).unwrap();
      const publishedAt = response.session?.publishedAt ?? null;
      if (publishedAt) {
        setData((current) => {
          if (!current) return current;
          return {
            ...current,
            rehearsals: current.rehearsals.map((rehearsal) =>
              rehearsal.id === selectedRehearsal.id
                ? { ...rehearsal, publishedAt }
                : rehearsal,
            ),
          };
        });
      }
      if (response.telegramSent === false) {
        setPublishError(
          "Сессия сохранена, но сообщение в Telegram не отправилось. Проверьте бота и настройки группы.",
        );
      }
      dispatch(
        directorSessionsApi.util.invalidateTags([
          { type: "DirectorSessions", id: "BUNDLE" },
        ]),
      );
      void loadRehearsals();
    } catch (publishFailure: unknown) {
      const apiError = publishFailure as {
        message?: string;
        data?: { message?: string };
      };
      setPublishError(
        apiError.data?.message ??
          apiError.message ??
          "Не удалось опубликовать репетицию",
      );
    } finally {
      setPublishing(false);
    }
  };

  const selectRehearsal = (rehearsalId: string) => {
    setSelectedRehearsalId(rehearsalId);
    setPublishError("");
  };

  const openRehearsalDetails = (rehearsalId: string) => {
    const rehearsal =
      dayRehearsals.find((item) => item.id === rehearsalId) ?? selectedRehearsal;
    if (!rehearsal || !theaterId) return;
    navigate(rehearsalDetailsPath(theaterId, rehearsal));
  };

  const dayMetaLabel = dayRehearsals.length
    ? `${dayRehearsals.length} репетиций`
    : "Нет репетиций";

  return {
    theaterId,
    loading,
    error,
    canCreateRehearsal,
    dotsByDate,
    eventsByDate,
    setCalendarState,
    selectedDateLabel,
    dayMetaLabel,
    dayRehearsals,
    bundleSessions,
    selectedRehearsalId,
    selectRehearsal,
    openRehearsalDetails,
    openCreateModal,
    selectedRehearsal,
    selectedCanManage,
    selectedCanPublish,
    selectedPublished,
    publishError,
    creating,
    publishing,
    includeUnavailableInCall,
    setIncludeUnavailableInCall,
    openEditModal,
    handleDeleteRehearsal,
    publishSelectedRehearsal,
    createModalOpen,
    closeCreateModal,
    modalMode,
    editTitle,
    setEditTitle,
    createTime,
    setCreateTime,
    createError,
    setCreateError,
    canSubmitCreate,
    createTimeTaken,
    confirmModal,
    createTimeStepMin: CREATE_TIME_STEP_MIN,
  };
}
