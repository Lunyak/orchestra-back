import {
  CalendarSection,
  type CalendarSectionState,
} from "@shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "@shared/components/calendar/MonthCalendar";
import { Button } from "@shared/core/button/Button";
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
  formatTimeHHMM,
  getSessionStartLocalMinutes,
  type DirectorRehearsalSession,
  useDirectorSessionsBundleQuery,
  useReplaceDirectorSessionsMutation,
} from "../../director-sessions";
import { RehearsalsCard } from "../../rehearsals-card/RehearsalsCard";
import "../../director-sessions/ui/director-sessions.css";
import "../../rehearsals/ui/rehearsals.css";
import { TheaterSectionNav } from "./TheaterSectionNav";
import "./organizations.css";
import "./theater-rehearsals.css";

dayjs.locale("ru");

const REHEARSAL_HISTORY_DAYS = 30;
const REHEARSAL_FUTURE_DAYS = 180;
const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const DEFAULT_REHEARSAL_TIME = "20:00";

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

function formatRehearsalTime(startsAt: string) {
  const date = dayjs(startsAt);
  return date.isValid() ? date.format("HH:mm") : "";
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
  const [calendarState, setCalendarState] =
    useState<CalendarSectionState | null>(null);

  const { data: sessionsBundle } = useDirectorSessionsBundleQuery(undefined, {
    skip: !accessToken,
  });
  const [replaceSessions] = useReplaceDirectorSessionsMutation();

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
      out[date] = list.map((rehearsal) => ({
        id: `${rehearsal.source}:${rehearsal.id}`,
        time: formatRehearsalTime(rehearsal.startsAt),
        title: rehearsal.title,
        published: Boolean(rehearsal.publishedAt),
      }));
    }
    return out;
  }, [rehearsalsByDate]);

  const selectedDate =
    calendarState?.selectedDate ?? dayjs().format("YYYY-MM-DD");
  const selectedDateLabel = dayjs(selectedDate).format("D MMMM YYYY");
  const dayRehearsals = rehearsalsByDate.get(selectedDate) ?? [];
  const canSubmitCreate = canCreateRehearsal && !creating;

  const handleCreateRehearsal = async () => {
    if (!canSubmitCreate || !theaterId) return;
    setCreating(true);
    setCreateError("");
    const startsAt = new Date(
      `${selectedDate}T${DEFAULT_REHEARSAL_TIME}:00`,
    ).toISOString();
    const nowIso = new Date().toISOString();
    const session: DirectorRehearsalSession = {
      id: createId(),
      title: `Репетиция ${dayjs(selectedDate).format("D MMM")}`,
      startsAt,
      theaterId,
      slots: [{ id: createId(), offsetMin: 0, durationMin: 30 }],
      updatedAt: nowIso,
    };

    try {
      const existingSessions = sessionsBundle?.sessions ?? [];
      await replaceSessions({
        sessions: [session, ...existingSessions],
      }).unwrap();
      dispatch(
        directorSessionsApi.util.invalidateTags([
          { type: "DirectorSessions", id: "BUNDLE" },
        ]),
      );
      navigate(theaterRehearsalSessionPath(theaterId, session.id));
    } catch {
      setCreateError("Не удалось создать репетицию");
    } finally {
      setCreating(false);
    }
  };

  if (!theaterId) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  return (
    <div className="app-layout">
      <div className="app-content">
        <TheaterSectionNav theaterId={theaterId} active="rehearsals" />
        <main className="sessions-page rehearsals-page theater-rehearsals-page">
          <div className="theater-rehearsals-page__head">
            <h1 className="rehearsals-title">
              {data?.theater.title ?? "Репетиции"}
            </h1>
            <p className="rehearsals-muted">
              Репетиции проектов в календаре театра.
            </p>
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
                  title="Календарь"
                  subtitle="Клик — репетиции выбранного дня"
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
                    disabled={!canSubmitCreate}
                    title={`Создать репетицию на ${selectedDateLabel}, ${DEFAULT_REHEARSAL_TIME}`}
                    onClick={() => {
                      void handleCreateRehearsal();
                    }}
                  >
                    {creating ? "Создание…" : "Создать репетицию"}
                  </Button>
                </div>
              ) : null}

              {createError ? (
                <div className="rehearsals-error" role="alert">
                  {createError}
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
                  const time = formatTimeHHMM(
                    getSessionStartLocalMinutes(rehearsal.startsAt),
                  );
                  const published = Boolean(
                    String(rehearsal.publishedAt ?? "").trim(),
                  );
                  const projectsLabel = rehearsalProjectsLabel(rehearsal);
                  const placeLabel = rehearsal.place?.trim() ?? "";

                  return (
                    <div
                      key={`${rehearsal.source}:${rehearsal.id}`}
                      className="sessions-day-item"
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        className="sessions-day-item__main"
                        onClick={() => navigate(detailsPath)}
                        onKeyDown={(event) => {
                          if (event.key !== "Enter" && event.key !== " ")
                            return;
                          event.preventDefault();
                          navigate(detailsPath);
                        }}
                      >
                        <span className="sessions-day-item__header">
                          <span className="sessions-day-item__time">{time}</span>
                          <span className="sessions-day-item__header-body">
                            <span className="sessions-day-item__title">
                              {rehearsal.title}
                            </span>
                            {published ? (
                              <span className="sessions-day-item__badge sessions-day-item__badge--published">
                                опубликована
                              </span>
                            ) : (
                              <span className="sessions-day-item__badge">
                                черновик
                              </span>
                            )}
                          </span>
                        </span>
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
            </RehearsalsCard>
          </div>
        </main>
      </div>
    </div>
  );
}
