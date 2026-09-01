import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { CalendarSection } from "../../../shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "../../../shared/components/calendar/MonthCalendar";
import {
  formatTimeHHMM,
  getSessionStartLocalMinutes,
} from "../../../features/director-sessions/model/session-page-utils";
import { useAuth } from "../../../features/auth";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import type { AvailabilityStatus } from "../../../features/profile/model/availability-calendar";
import { useAvailabilityAutoSave } from "../../../features/profile/model/useAvailabilityAutoSave";
import {
  fetchMyProfileThunk,
  profileDataActions,
} from "../../../features/profile/model/profileDataSlice";
import {
  loadSessionsForRangeThunk,
  profileAvailabilityActions,
  selectAvailabilityFlags,
  selectAvailabilitySessionsForActiveRange,
  selectProfileCalendarState,
} from "../../../features/profile/model/profileAvailabilitySlice";
import type { DirectorSession } from "../../../sync/api/director-sessions";
import { DirectorSessionDetailModal } from "../../../features/director-session-detail/DirectorSessionDetailModal";
import { AvailabilityDayModal } from "../../../features/profile/ui/AvailabilityDayModal";

dayjs.extend(isoWeek);
dayjs.locale("ru");

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

const MAX_AVAILABILITY_RANGE_DAYS = 366;

function countIsoDatesInRange(fromIso: string, toIso: string): number {
  const from = fromIso.trim();
  const to = toIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return 0;
  if (from > to) return 0;

  const start = dayjs(from, "YYYY-MM-DD", true);
  const end = dayjs(to, "YYYY-MM-DD", true);
  if (!start.isValid() || !end.isValid()) return 0;

  const dayCount = end.diff(start, "day") + 1;
  if (dayCount <= 0 || dayCount > MAX_AVAILABILITY_RANGE_DAYS) return 0;
  return dayCount;
}

export function ProfileAvailabilityTab() {
  const { accessToken } = useAuth();
  const dispatch = useAppDispatch();
  const { availabilityCalendar, saving, error: saveError, ok } =
    useAvailabilityAutoSave(accessToken);

  const calendarState = useAppSelector(selectProfileCalendarState);
  const sessions = useAppSelector(selectAvailabilitySessionsForActiveRange);
  const flags = useAppSelector(selectAvailabilityFlags);

  const selectedDate = calendarState.selectedDate;
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [sessionDetailModalId, setSessionDetailModalId] = useState<string | null>(null);
  const [rangeFromDate, setRangeFromDate] = useState(selectedDate);
  const [rangeToDate, setRangeToDate] = useState(selectedDate);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    setRangeFromDate(selectedDate);
    setRangeToDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyProfileThunk({ accessToken }));
  }, [accessToken, dispatch]);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(profileAvailabilityActions.clearAvailabilityError());
    dispatch(
      loadSessionsForRangeThunk({
        accessToken,
        fromIso: calendarState.fromIso,
        toIso: calendarState.toIso,
      }),
    );
  }, [accessToken, calendarState.fromIso, calendarState.toIso, dispatch]);

  const sessionsByDate = useMemo(() => {
    const grouped = new Map<string, DirectorSession[]>();
    for (const s of sessions) {
      const date = isoDate(new Date(s.startsAt));
      const arr = grouped.get(date);
      if (arr) arr.push(s);
      else grouped.set(date, [s]);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
    }
    return grouped;
  }, [sessions]);

  const selectedDaySessionsAll = sessionsByDate.get(calendarState.selectedDate) ?? [];

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
      }));
    }
    return out;
  }, [sessionsByDate]);

  const dayModalSessions = useMemo(
    () =>
      selectedDaySessionsAll.map((s) => ({
        id: s.id,
        timeLabel: formatTimeHHMM(getSessionStartLocalMinutes(s.startsAt)),
        title: String(s.title ?? "Сессия").trim() || "Сессия",
      })),
    [selectedDaySessionsAll],
  );

  const onCalendarStateChange = useCallback(
    (next: any) => {
      dispatch(profileAvailabilityActions.setProfileCalendarState({ value: next }));
    },
    [dispatch],
  );

  const onCalendarDayClick = useCallback(() => {
    setDayModalOpen(true);
  }, []);

  const rangeDayCount = useMemo(
    () => countIsoDatesInRange(rangeFromDate, rangeToDate),
    [rangeFromDate, rangeToDate],
  );

  const rangeIsValid = rangeDayCount > 0;

  const applyRangeStatus = useCallback(
    (status: AvailabilityStatus | null) => {
      if (!rangeIsValid) {
        setRangeError("Укажите корректный диапазон: дата «С» не позже «По», не больше года.");
        return;
      }

      setRangeError(null);
      dispatch(
        profileDataActions.setAvailabilityRangeStatus({
          fromDate: rangeFromDate,
          toDate: rangeToDate,
          status,
        }),
      );
    },
    [dispatch, rangeFromDate, rangeIsValid, rangeToDate],
  );

  if (!accessToken) {
    return <div className="profile-tab-page profile-hint">Нужно войти, чтобы управлять занятостью.</div>;
  }

  return (
    <div className="profile-tab-page profile-availability-page">
      <div className="profile-tab-head">
        <div className="profile-tab-title">Календарь занятости</div>
        {saving ? (
          <div className="profile-save-hint">Автосохранение…</div>
        ) : saveError ? (
          <div className="settings-invite-error settings-invite-error--flush">
            {saveError}
          </div>
        ) : ok ? (
          <div className="profile-save-hint profile-save-hint--ok">{ok}</div>
        ) : null}
      </div>
      <p className="profile-availability-hint">
        Основное место — занятость театра или проекта, куда вас добавили.
        Здесь тот же календарь, если нужно отметить диапазон дней сразу.
      </p>

      {flags.error ? (
        <div className="settings-invite-error profile-availability-load-error">{flags.error}</div>
      ) : null}
      {flags.loading ? (
        <PageLoader variant="view" label="Загрузка сессий…" />
      ) : null}

      <section className="profile-availability-range">
        <div className="profile-availability-section-label">Диапазон дней</div>
        <div className="profile-availability-range__fields">
          <label className="profile-field profile-availability-range__field">
          
            <InlineTextField
              className="profile-availability-date-input"
              type="date"
              value={rangeFromDate}
              onChange={(e) => {
                setRangeFromDate(e.target.value);
                setRangeError(null);
              }}
            />
          </label>
          <span className="profile-availability-range__sep">—</span>
          <label className="profile-field profile-availability-range__field">
          
            <InlineTextField
              className="profile-availability-date-input"
              type="date"
              value={rangeToDate}
              onChange={(e) => {
                setRangeToDate(e.target.value);
                setRangeError(null);
              }}
            />
          </label>
        </div>
        {rangeIsValid ? (
          <div className="profile-availability-hint profile-availability-range__hint">
            Будет затронуто {rangeDayCount}{" "}
            {rangeDayCount === 1 ? "день" : rangeDayCount < 5 ? "дня" : "дней"}.
          </div>
        ) : null}
        {rangeError ? (
          <div className="settings-invite-error profile-availability-range__error">{rangeError}</div>
        ) : null}
        <div className="profile-availability-status-row profile-availability-range__actions">
          <Button
            className="secondary"
            type="button"
            disabled={!rangeIsValid}
            onClick={() => applyRangeStatus(null)}
          >
            Сбросить
          </Button>
          <Button
            type="button"
            disabled={!rangeIsValid}
            onClick={() => applyRangeStatus("present")}
          >
            Свободен
          </Button>
          <Button
            className="danger"
            type="button"
            disabled={!rangeIsValid}
            onClick={() => applyRangeStatus("absent")}
          >
            Занят
          </Button>
        </div>
      </section>

      <div className="profile-availability-calendar-wrap">
        <CalendarSection
          className="profile-availability-calendar"
          storageMonthKey="profile-calendar-month"
          initialSelectedDate={calendarState.selectedDate}
          onStateChange={onCalendarStateChange}
          onDayClick={onCalendarDayClick}
          statusByDate={availabilityCalendar}
          dotsByDate={dotsByDate}
          eventsByDate={eventsByDate}
          showStatusMarks={false}
          title="Занятость и сессии"
          subtitle="Клик по дню — отметить занятость"
        />
      </div>

      <AvailabilityDayModal
        isOpen={dayModalOpen}
        dateIso={selectedDate}
        onClose={() => setDayModalOpen(false)}
        sessions={dayModalSessions}
        onSessionClick={setSessionDetailModalId}
      />

      <DirectorSessionDetailModal
        isOpen={!!sessionDetailModalId}
        sessionId={sessionDetailModalId}
        accessToken={accessToken}
        onClose={() => setSessionDetailModalId(null)}
      />
    </div>
  );
}
