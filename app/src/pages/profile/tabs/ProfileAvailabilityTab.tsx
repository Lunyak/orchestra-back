import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import {
  CalendarSection,
  type CalendarSectionState,
} from "../../../shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "../../../shared/components/calendar/MonthCalendar";
import {
  formatTimeHHMM,
  getSessionStartLocalMinutes,
} from "../../../features/director-sessions/model/session-page-utils";
import { DirectorSessionDetailModal } from "../../../features/director-session-detail/DirectorSessionDetailModal";
import { readTheaterPoster } from "../../../features/organizations/model/theater-poster-storage";
import { readStudioPoster } from "../../../features/organizations/model/studio-poster-storage";
import { readProjectPoster } from "../../../features/project/model/project-poster-storage";
import projectPosterPlaceholder from "../../../features/project/assets/project-poster-placeholder.png";
import { StudioLogo } from "../../../pages/studio/StudioLogo";
import {
  dayStatusLabel,
  matchesOccupancyContextQuery,
  OCCUPANCY_KIND_LABEL,
  type OccupancyContextCard,
} from "../../../features/profile/model/availability-overview";
import { getAvailabilityDayVisual } from "../../../features/profile/model/availability-calendar";
import { profileAvailabilityActions } from "../../../features/profile/model/profileAvailabilitySlice";
import { useProfileAvailabilityOverview } from "../../../features/profile/model/useProfileAvailabilityOverview";
import type { DirectorSession } from "../../../sync/api/director-sessions";

dayjs.extend(isoWeek);
dayjs.locale("ru");

function isoDate(value: Date): string {
  return dayjs(value).format("YYYY-MM-DD");
}

function ruCountLabel(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function fillPercent(ratio: number) {
  return `${Math.round(ratio * 100)}%`;
}

function contextPosterSrc(context: OccupancyContextCard): string | null {
  if (context.kind === "project") {
    return readProjectPoster(context.id) ?? projectPosterPlaceholder;
  }
  if (context.kind === "theater") {
    return readTheaterPoster(context.id);
  }
  if (context.kind === "studio") {
    return readStudioPoster(context.id);
  }
  return null;
}

function OccupancyContextPoster({ context }: { context: OccupancyContextCard }) {
  const posterSrc = contextPosterSrc(context);
  const initial = context.title.trim().slice(0, 1).toUpperCase() || "?";

  if (posterSrc) {
    return (
      <span className="profile-occupancy__context-poster">
        <img
          className="profile-occupancy__context-image"
          src={posterSrc}
          alt=""
        />
      </span>
    );
  }

  if (context.kind === "studio" && context.studioImageUrl) {
    return (
      <span className="profile-occupancy__context-poster">
        <StudioLogo
          className="profile-occupancy__context-image"
          imageUrl={context.studioImageUrl}
          title={context.title}
          size="tile"
        />
      </span>
    );
  }

  return (
    <span
      className={cn(
        "profile-occupancy__context-poster",
        "profile-occupancy__context-poster--empty",
      )}
    >
      {initial}
    </span>
  );
}

export function ProfileAvailabilityTab() {
  const {
    accessToken,
    availabilityCalendar,
    availabilityTimeRanges,
    calendarState,
    contexts,
    contextsError,
    contextsLoading,
    dispatch,
    flags,
    pulse,
    sessions,
  } = useProfileAvailabilityOverview();
  const [sessionDetailModalId, setSessionDetailModalId] = useState<string | null>(
    null,
  );
  const [contextQuery, setContextQuery] = useState("");

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, DirectorSession[]>();
    for (const session of sessions) {
      const date = isoDate(new Date(session.startsAt));
      const list = grouped.get(date);
      if (list) list.push(session);
      else grouped.set(date, [session]);
    }
    for (const list of grouped.values()) {
      list.sort((left, right) => +new Date(left.startsAt) - +new Date(right.startsAt));
    }
    return grouped;
  }, [sessions]);

  const selectedDaySessions = sessionsByDate.get(calendarState.selectedDate) ?? [];
  const selectedVisual = getAvailabilityDayVisual(
    availabilityCalendar,
    availabilityTimeRanges,
    calendarState.selectedDate,
  );
  const selectedStatusLabel = dayStatusLabel(
    availabilityCalendar,
    availabilityTimeRanges,
    calendarState.selectedDate,
  );

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
      out[date] = list.map((session) => ({
        id: session.id,
        time: formatTimeHHMM(getSessionStartLocalMinutes(session.startsAt)),
        title: String(session.title ?? "Сессия").trim() || "Сессия",
      }));
    }
    return out;
  }, [sessionsByDate]);

  const onCalendarStateChange = useCallback(
    (next: CalendarSectionState) => {
      dispatch(profileAvailabilityActions.setProfileCalendarState({ value: next }));
    },
    [dispatch],
  );

  const selectedDateLabel = dayjs(calendarState.selectedDate).format("D MMMM");
  const monthLabel = dayjs(calendarState.monthStartIso).format("MMMM YYYY");
  const hasContexts = contexts.length > 0;
  const showContextSearch = contexts.length > 2;
  const visibleContexts = useMemo(
    () =>
      showContextSearch
        ? contexts.filter((context) =>
            matchesOccupancyContextQuery(context, contextQuery),
          )
        : contexts,
    [contextQuery, contexts, showContextSearch],
  );
  const firstContext = visibleContexts[0] ?? contexts[0] ?? null;
  const hasVisibleContexts = visibleContexts.length > 0;

  if (!accessToken) {
    return (
      <div className="profile-tab-page profile-hint">
        Нужно войти, чтобы открыть занятость.
      </div>
    );
  }

  return (
    <div className="profile-tab-page profile-occupancy">
      <header className="profile-occupancy__hero">
        <div className="profile-occupancy__hero-copy">
          <p className="profile-occupancy__eyebrow">Все площадки</p>
          <h2 className="profile-occupancy__title">Занятость</h2>
          <p className="profile-occupancy__lead">
            Сводка по театрам, проектам и студиям. Отметки ставятся там, куда вас
            добавили.
          </p>
        </div>
        <div className="profile-occupancy__pulse" aria-label={`Месяц ${monthLabel}`}>
          <div className="profile-occupancy__pulse-month">{monthLabel}</div>
          <div className="profile-occupancy__pulse-fill">{fillPercent(pulse.fillRatio)}</div>
          <div className="profile-occupancy__pulse-caption">месяца отмечено</div>
        </div>
      </header>

      <div className="profile-occupancy__stats" role="list">
        <div className="profile-occupancy__stat" role="listitem">
          <span className="profile-occupancy__stat-value">{pulse.free}</span>
          <span className="profile-occupancy__stat-label">свободен</span>
        </div>
        <div
          className={cn(
            "profile-occupancy__stat",
            "profile-occupancy__stat--partial",
          )}
          role="listitem"
        >
          <span className="profile-occupancy__stat-value">{pulse.partial}</span>
          <span className="profile-occupancy__stat-label">по времени</span>
        </div>
        <div
          className={cn("profile-occupancy__stat", "profile-occupancy__stat--busy")}
          role="listitem"
        >
          <span className="profile-occupancy__stat-value">{pulse.busy}</span>
          <span className="profile-occupancy__stat-label">занят</span>
        </div>
        <div className="profile-occupancy__stat" role="listitem">
          <span className="profile-occupancy__stat-value">{pulse.unknown}</span>
          <span className="profile-occupancy__stat-label">пусто</span>
        </div>
        <div className="profile-occupancy__stat" role="listitem">
          <span className="profile-occupancy__stat-value">{sessions.length}</span>
          <span className="profile-occupancy__stat-label">
            {ruCountLabel(sessions.length, "сессия", "сессии", "сессий")}
          </span>
        </div>
      </div>

      <section className="profile-occupancy__contexts" aria-label="Где отметить">
        <div className="profile-occupancy__section-head">
          <h3 className="profile-occupancy__section-title">Где отметить</h3>
          {showContextSearch ? (
            <label className="profile-occupancy__search">
              <InlineTextField
                className="profile-occupancy__search-input"
                type="search"
                value={contextQuery}
                onChange={(event) => setContextQuery(event.target.value)}
                placeholder="Найти по названию"
              />
            </label>
          ) : null}
          {firstContext ? (
            <Link className="profile-occupancy__jump" to={firstContext.href}>
              Открыть график
            </Link>
          ) : null}
        </div>
        {contextsError ? (
          <div className="settings-invite-error">{contextsError}</div>
        ) : null}
        {contextsLoading ? (
          <PageLoader variant="view" label="Загрузка площадок…" />
        ) : hasContexts ? (
          hasVisibleContexts ? (
            <ul className="profile-occupancy__context-list">
              {visibleContexts.map((context) => (
                <li key={`${context.kind}:${context.id}`}>
                  <Link className="profile-occupancy__context" to={context.href}>
                    <OccupancyContextPoster context={context} />
                    <span className="profile-occupancy__context-body">
                      <span className="profile-occupancy__context-kind">
                        {OCCUPANCY_KIND_LABEL[context.kind]}
                      </span>
                      <span className="profile-occupancy__context-title">
                        {context.title}
                      </span>
                      <span className="profile-occupancy__context-meta">
                        {context.sessionCount > 0
                          ? `${context.sessionCount} ${ruCountLabel(
                              context.sessionCount,
                              "сессия",
                              "сессии",
                              "сессий",
                            )}`
                          : "Отметить"}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="profile-occupancy__empty">Ничего не нашлось.</p>
          )
        ) : (
          <p className="profile-occupancy__empty">
            Вас ещё не добавили в театр, проект или студию. Когда добавят —
            занятость отмечается там, а здесь появится сводка.
          </p>
        )}
      </section>

      {flags.error ? (
        <div className="settings-invite-error">{flags.error}</div>
      ) : null}
      {flags.loading ? (
        <PageLoader variant="view" label="Загрузка сессий…" />
      ) : null}

      <div className="profile-occupancy__board">
        <div className="profile-occupancy__calendar">
          <CalendarSection
            className="profile-availability-calendar"
            storageMonthKey="profile-calendar-month"
            initialSelectedDate={calendarState.selectedDate}
            onStateChange={onCalendarStateChange}
            statusByDate={availabilityCalendar}
            dotsByDate={dotsByDate}
            eventsByDate={eventsByDate}
            showStatusMarks
            title="Сводка месяца"
            subtitle="Календарь только для просмотра"
          />
        </div>

        <aside className="profile-occupancy__day" aria-live="polite">
          <div className="profile-occupancy__day-date">{selectedDateLabel}</div>
          <div
            className={cn(
              "profile-occupancy__day-status",
              `profile-occupancy__day-status--${selectedVisual.cls}`,
            )}
          >
            {selectedStatusLabel}
          </div>
          <div className="profile-occupancy__day-sessions-title">Сессии</div>
          {selectedDaySessions.length === 0 ? (
            <p className="profile-occupancy__empty">В этот день сессий нет.</p>
          ) : (
            <ul className="profile-occupancy__session-list">
              {selectedDaySessions.map((session) => (
                <li key={session.id}>
                  <button
                    type="button"
                    className="profile-occupancy__session"
                    onClick={() => setSessionDetailModalId(session.id)}
                  >
                    <span className="profile-occupancy__session-time">
                      {formatTimeHHMM(getSessionStartLocalMinutes(session.startsAt))}
                    </span>
                    <span className="profile-occupancy__session-title">
                      {String(session.title ?? "Сессия").trim() || "Сессия"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {hasContexts ? (
            <p className="profile-occupancy__day-hint">
              Чтобы поставить отметку, откройте график театра, проекта или студии.
            </p>
          ) : null}
        </aside>
      </div>

      <DirectorSessionDetailModal
        isOpen={!!sessionDetailModalId}
        sessionId={sessionDetailModalId}
        accessToken={accessToken}
        onClose={() => setSessionDetailModalId(null)}
      />
    </div>
  );
}
