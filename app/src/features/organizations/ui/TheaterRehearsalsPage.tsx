import {
  CalendarSection,
  type CalendarSectionState,
} from "@shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "@shared/components/calendar/MonthCalendar";
import { Button } from "@shared/core/button/Button";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import {
  projectSessionPath,
  theaterOrganizationPath,
  theaterRehearsalSessionPath,
} from "../../../app/router/paths";
import { createId } from "../../../shared/utils/createId";
import { useAppDispatch } from "../../../shared/store/hooks";
import {
  fetchTheaterRehearsals,
  type TheaterRehearsal,
  type TheaterRehearsalsResponse,
} from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import {
  directorSessionsApi,
  directorSessionBusySpanMin,
  findDirectorSessionBusyConflict,
  formatDirectorSessionBusyConflictMessage,
  formatTimeHHMM,
  getSessionStartLocalMinutes,
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
  useDirectorSessionsBundleQuery,
  usePublishDirectorSessionMutation,
  useReplaceDirectorSessionsMutation,
} from "../../director-sessions";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import "../../director-sessions/ui/director-sessions.css";
import "../../rehearsals/ui/rehearsals.css";
import { TheaterSectionNav } from "./TheaterSectionNav";
import { TheaterCreateRehearsalModal } from "./TheaterCreateRehearsalModal";
import "./organizations.css";
import "./theater-rehearsals.css";

dayjs.locale("ru");

const REHEARSAL_HISTORY_DAYS = 30;
const REHEARSAL_FUTURE_DAYS = 180;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_REHEARSAL_TIME = "20:00";
const CREATE_TIME_STEP_MIN = 5;
const CREATE_TIME_MIN = 8 * 60;
const CREATE_TIME_MAX = 23 * 60 + 30;
/** Длительность новой репетиции (первый слот). */
const DEFAULT_CREATE_DURATION_MIN = 30;
/** Если нет duration/слотов — минимальный блок занятости. */
const FALLBACK_BUSY_DURATION_MIN = 30;

type BusyRange = {
  startMin: number;
  endMin: number;
};

function rehearsalRange() {
  const now = Date.now();
  return {
    from: new Date(
      now - REHEARSAL_HISTORY_DAYS * DAY_IN_MILLISECONDS,
    ).toISOString(),
    to: new Date(
      now + REHEARSAL_FUTURE_DAYS * DAY_IN_MILLISECONDS,
    ).toISOString(),
  };
}

function dateKey(value: string) {
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD") : "";
}

function parseTimeToMinutes(time: string): number | null {
  const match = String(time ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

function formatMinutesToTime(totalMin: number): string {
  const normalized =
    ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function formatDurationLabel(durationMin: number): string {
  const total = Math.max(1, Math.floor(durationMin));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours > 0 && minutes > 0) return `${hours} ч ${minutes} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${minutes} мин`;
}

function sessionSpanMin(session: DirectorRehearsalSession): number {
  return directorSessionBusySpanMin(session);
}

function rehearsalSpanMin(
  rehearsal: TheaterRehearsal,
  bundleSessions: DirectorRehearsalSession[],
): number {
  if (rehearsal.source === "director-session") {
    const session = bundleSessions.find((item) => item.id === rehearsal.id);
    if (session) return sessionSpanMin(session);
  }
  const fromApi = Math.floor(Number(rehearsal.durationMin) || 0);
  if (fromApi > 0) return fromApi;
  return FALLBACK_BUSY_DURATION_MIN;
}

function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA;
}

function collectBusyRanges(
  dayRehearsals: TheaterRehearsal[],
  bundleSessions: DirectorRehearsalSession[],
  theaterId: string,
  selectedDate: string,
  excludeSessionId?: string | null,
): BusyRange[] {
  const ranges: BusyRange[] = [];
  const seenSessionIds = new Set<string>();
  const excludedId = String(excludeSessionId ?? "").trim();

  for (const rehearsal of dayRehearsals) {
    if (excludedId && rehearsal.id === excludedId) continue;
    const startMin = getSessionStartLocalMinutes(rehearsal.startsAt);
    if (!Number.isFinite(startMin)) continue;
    const span = rehearsalSpanMin(rehearsal, bundleSessions);
    ranges.push({ startMin, endMin: startMin + span });
    if (rehearsal.source === "director-session") {
      seenSessionIds.add(rehearsal.id);
    }
  }

  for (const session of bundleSessions) {
    if (excludedId && session.id === excludedId) continue;
    if (String(session.theaterId ?? "").trim() !== theaterId) continue;
    if (dateKey(session.startsAt) !== selectedDate) continue;
    if (seenSessionIds.has(session.id)) continue;
    const startMin = getSessionStartLocalMinutes(session.startsAt);
    if (!Number.isFinite(startMin)) continue;
    const span = sessionSpanMin(session);
    ranges.push({ startMin, endMin: startMin + span });
  }

  return ranges;
}

function isStartBlockedByRanges(
  startMin: number,
  durationMin: number,
  ranges: BusyRange[],
): boolean {
  const endMin = startMin + Math.max(1, durationMin);
  return ranges.some((range) =>
    rangesOverlap(startMin, endMin, range.startMin, range.endMin),
  );
}

function nextFreeRehearsalTime(
  ranges: BusyRange[],
  preferred = DEFAULT_REHEARSAL_TIME,
  durationMin = DEFAULT_CREATE_DURATION_MIN,
): string {
  const preferredMin = parseTimeToMinutes(preferred) ?? CREATE_TIME_MIN;
  const duration = Math.max(1, durationMin);
  for (
    let minute = preferredMin;
    minute <= CREATE_TIME_MAX;
    minute += CREATE_TIME_STEP_MIN
  ) {
    if (!isStartBlockedByRanges(minute, duration, ranges)) {
      return formatMinutesToTime(minute);
    }
  }
  for (
    let minute = CREATE_TIME_MIN;
    minute < preferredMin;
    minute += CREATE_TIME_STEP_MIN
  ) {
    if (!isStartBlockedByRanges(minute, duration, ranges)) {
      return formatMinutesToTime(minute);
    }
  }
  return preferred;
}

function rehearsalDetailsPath(theaterId: string, rehearsal: TheaterRehearsal) {
  if (rehearsal.source === "director-session") {
    return theaterRehearsalSessionPath(theaterId, rehearsal.id);
  }
  return projectSessionPath(rehearsal.project.slug);
}

function rehearsalProjectsLabel(rehearsal: TheaterRehearsal) {
  const projects = rehearsal.projects.length
    ? rehearsal.projects
    : [rehearsal.project];
  return projects
    .map((project) => project.name)
    .filter(Boolean)
    .join(" · ");
}

type RehearsalSlotPreview = {
  id: string;
  time: string;
  label: string;
};

function slotPreviewLabel(slot: DirectorSessionSlot): string {
  const customTitle = String(slot.title ?? "").trim();
  if (customTitle) return customTitle;
  const projectSlug = String(slot.ref?.projectSlug ?? "").trim();
  const sceneId = Number(slot.ref?.sceneId);
  if (projectSlug && Number.isFinite(sceneId) && sceneId > 0) {
    return `${projectSlug} · сцена #${sceneId}`;
  }
  if (projectSlug) return projectSlug;
  return "Слот без названия";
}

function rehearsalSlotPreviews(
  rehearsal: TheaterRehearsal,
  bundleSessions: DirectorRehearsalSession[],
): RehearsalSlotPreview[] {
  if (rehearsal.source !== "director-session") return [];
  const session = bundleSessions.find((item) => item.id === rehearsal.id);
  if (!session) return [];
  const baseMin = getSessionStartLocalMinutes(session.startsAt);
  return [...(session.slots ?? [])]
    .sort(
      (a, b) =>
        Math.floor(Number(a.offsetMin) || 0) -
        Math.floor(Number(b.offsetMin) || 0),
    )
    .map((slot) => {
      const offset = Math.max(0, Math.floor(Number(slot.offsetMin) || 0));
      return {
        id: slot.id,
        time: formatTimeHHMM(baseMin + offset),
        label: slotPreviewLabel(slot),
      };
    });
}

export function TheaterRehearsalsPage() {
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

  const rehearsalsByDate = useMemo(() => {
    const grouped = new Map<string, TheaterRehearsal[]>();
    for (const rehearsal of rehearsals) {
      const key = dateKey(rehearsal.startsAt);
      if (!key) continue;
      const list = grouped.get(key);
      if (list) list.push(rehearsal);
      else grouped.set(key, [rehearsal]);
    }
    for (const list of grouped.values()) {
      list.sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    }
    return grouped;
  }, [rehearsals]);

  const dotsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [date, list] of rehearsalsByDate.entries()) {
      out[date] = list.length;
    }
    return out;
  }, [rehearsalsByDate]);

  const eventsByDate = useMemo(() => {
    const out: Record<string, MonthCalendarEvent[]> = {};
    for (const [date, list] of rehearsalsByDate.entries()) {
      out[date] = list.map((rehearsal) => {
        const startMin = getSessionStartLocalMinutes(rehearsal.startsAt);
        return {
          id: `${rehearsal.source}:${rehearsal.id}`,
          time: formatTimeHHMM(startMin),
          title: rehearsal.title,
          published: Boolean(rehearsal.publishedAt),
        };
      });
    }
    return out;
  }, [rehearsalsByDate]);

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
    modalMode === "edit" && selectedCanManage ? selectedRehearsal?.id ?? null : null;
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
    if (!selectedCanManage || creating || !theaterId || !selectedRehearsal) return;
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

  if (!theaterId) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="sessions-page rehearsals-page theater-rehearsals-page">
          <div className="theater-rehearsals-page__head">
            <div className="theater-rehearsals-page__title-row">
              <TheaterSectionNav
                theaterId={theaterId}
                active="rehearsals"
                variant="inline"
              />
              <h1 className="rehearsals-title">Репетиции</h1>
            </div>
          </div>

          {error ? (
            <div className="rehearsals-error" role="alert">
              {error}
            </div>
          ) : null}

          <div className="sessions-layout theater-rehearsals-page__layout">
            <div className="sessions-flow">
              <RehearsalsCard className="sessions-calendar-card">
                <CalendarSection
                  className="sessions-calendar"
                  storageMonthKey={`theater-${theaterId}-rehearsals-month`}
                  onStateChange={setCalendarState}
                  dotsByDate={dotsByDate}
                  eventsByDate={eventsByDate}
                  title=""
                  subtitle=""
                />
              </RehearsalsCard>
            </div>

            <RehearsalsCard fluid className="sessions-day-stage">
              <div className="sessions-nav-head">
                <span className="sessions-nav-head__title">
                  {selectedDateLabel}
                </span>
                <span className="sessions-nav-head__meta rehearsals-muted">
                  {dayRehearsals.length
                    ? `${dayRehearsals.length} репетиций`
                    : "Нет репетиций"}
                </span>
              </div>

              {canCreateRehearsal ? (
                <div className="sessions-day-toolbar">
                  <Button
                    type="button"
                    title={`Создать репетицию на ${selectedDateLabel}`}
                    onClick={openCreateModal}
                  >
                    Создать репетицию
                  </Button>
                </div>
              ) : null}

              {loading ? (
                <div className="rehearsals-muted sessions-day-list__empty">
                  Загрузка репетиций…
                </div>
              ) : null}

              <div className="sessions-day-list">
                {!loading && dayRehearsals.length === 0 ? (
                  <div className="rehearsals-muted sessions-day-list__empty">
                    На этот день репетиций нет. Создайте репетицию и заполните
                    слоты.
                  </div>
                ) : null}

                {dayRehearsals.map((rehearsal) => {
                  const detailsPath = rehearsalDetailsPath(
                    theaterId,
                    rehearsal,
                  );
                  const startMin = getSessionStartLocalMinutes(
                    rehearsal.startsAt,
                  );
                  const spanMin = rehearsalSpanMin(
                    rehearsal,
                    sessionsBundle?.sessions ?? [],
                  );
                  const timeLabel = `${formatTimeHHMM(startMin)}–${formatMinutesToTime(startMin + spanMin)}`;
                  const durationLabel = formatDurationLabel(spanMin);
                  const published = Boolean(
                    String(rehearsal.publishedAt ?? "").trim(),
                  );
                  const projectsLabel = rehearsalProjectsLabel(rehearsal);
                  const placeLabel = rehearsal.place?.trim() ?? "";
                  const slotPreviews = rehearsalSlotPreviews(
                    rehearsal,
                    sessionsBundle?.sessions ?? [],
                  );
                  const isSelected = rehearsal.id === selectedRehearsalId;

                  return (
                    <div
                      key={`${rehearsal.source}:${rehearsal.id}`}
                      className={cn(
                        "sessions-day-item",
                        isSelected && "sessions-day-item--active",
                      )}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="sessions-day-item__main"
                        title="Клик — выбрать · двойной клик — открыть"
                        onClick={() => {
                          setSelectedRehearsalId(rehearsal.id);
                          setPublishError("");
                        }}
                        onDoubleClick={() => navigate(detailsPath)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            navigate(detailsPath);
                            return;
                          }
                          if (event.key !== " ") return;
                          event.preventDefault();
                          setSelectedRehearsalId(rehearsal.id);
                          setPublishError("");
                        }}
                      >
                        <span className="sessions-day-item__header">
                          <span
                            className="sessions-day-item__time"
                            title={durationLabel}
                          >
                            {timeLabel}
                          </span>
                          <span className="sessions-day-item__header-body">
                            <span className="sessions-day-item__title">
                              {rehearsal.title}
                            </span>
                            <span className="sessions-day-item__meta">
                              {durationLabel}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "sessions-day-item__badge",
                              published &&
                                "sessions-day-item__badge--published",
                            )}
                          >
                            {published ? "опубликована" : "черновик"}
                          </span>
                        </span>
                        {slotPreviews.length > 0 ? (
                          <ul className="sessions-day-item__slots">
                            {slotPreviews.map((slot) => (
                              <li key={slot.id}>
                                <div className="sessions-slot-row">
                                  <span className="sessions-slot-row__time">
                                    {slot.time}
                                  </span>
                                  <span
                                    className="sessions-slot-row__label"
                                    title={slot.label}
                                  >
                                    {slot.label}
                                  </span>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : rehearsal.source === "director-session" ? (
                          <p className="sessions-day-item__comment rehearsals-muted">
                            Слотов пока нет
                          </p>
                        ) : null}
                        {projectsLabel || placeLabel ? (
                          <div className="sessions-day-item__comment">
                            {[projectsLabel, placeLabel]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>

              {selectedRehearsal ? (
                <div className="sessions-session-footer theater-rehearsals-page__call-footer">
                  {publishError ? (
                    <div className="rehearsals-error" role="alert">
                      {publishError}
                    </div>
                  ) : null}
                  <div className="theater-rehearsals-page__footer-actions">
                    {selectedCanManage ? (
                      <div className="theater-rehearsals-page__footer-row">
                        <Button
                          type="button"
                          onClick={openEditModal}
                          disabled={creating}
                          title="Изменить название и время"
                        >
                          Изменить
                        </Button>
                        <Button
                          type="button"
                          onClick={() => void handleDeleteRehearsal()}
                          disabled={creating}
                          title="Удалить репетицию"
                        >
                          Удалить
                        </Button>
                      </div>
                    ) : null}
                    {selectedCanPublish ? (
                      <LabeledCheckbox
                        className="sessions-session-footer__call-toggle"
                        checked={includeUnavailableInCall}
                        onChange={setIncludeUnavailableInCall}
                      >
                        Звать без занятости / с отрицательной
                      </LabeledCheckbox>
                    ) : (
                      <p className="rehearsals-muted theater-rehearsals-page__call-hint">
                        Публикация вызова доступна для репетиций театра.
                      </p>
                    )}
                    <div className="theater-rehearsals-page__footer-row">
                      {selectedCanPublish ? (
                        <Button
                          type="button"
                          onClick={() => void publishSelectedRehearsal()}
                          disabled={publishing || creating}
                          title={
                            selectedPublished
                              ? "Пересобрать список участников по календарю; при подключённом боте — обновить или отправить сообщение в Telegram"
                              : "Помечает репетицию опубликованной; при подключённом боте — дублирует вызов в Telegram"
                          }
                        >
                          {publishing
                            ? "Публикую…"
                            : selectedPublished
                              ? "Обновить публикацию"
                              : "Опубликовать"}
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        onClick={() =>
                          navigate(
                            rehearsalDetailsPath(theaterId, selectedRehearsal),
                          )
                        }
                      >
                        Открыть репетицию
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </RehearsalsCard>
          </div>
        </main>
      </div>

      <TheaterCreateRehearsalModal
        isOpen={createModalOpen}
        onClose={closeCreateModal}
        mode={modalMode}
        dateLabel={selectedDateLabel}
        title={editTitle}
        onTitleChange={(nextTitle) => {
          setEditTitle(nextTitle);
          setCreateError("");
        }}
        createTime={createTime}
        timeStepMin={CREATE_TIME_STEP_MIN}
        onCreateTimeChange={(time) => {
          setCreateTime(time);
          setCreateError("");
        }}
        createError={createError}
        creating={creating}
        canSubmit={canSubmitCreate}
        createTimeTaken={createTimeTaken}
        onConfirm={confirmModal}
      />
    </div>
  );
}
