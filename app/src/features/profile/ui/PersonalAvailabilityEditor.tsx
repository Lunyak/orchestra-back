import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import {
  CalendarSection,
  type CalendarSectionState,
} from "../../../shared/components/calendar/CalendarSection";
import type { AvailabilityStatus } from "../model/availability-calendar";
import { useAvailabilityAutoSave } from "../model/useAvailabilityAutoSave";
import {
  fetchMyProfileThunk,
  profileDataActions,
} from "../model/profileDataSlice";
import {
  loadSessionsForRangeThunk,
  profileAvailabilityActions,
  selectAvailabilityFlags,
  selectProfileCalendarState,
} from "../model/profileAvailabilitySlice";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { AvailabilityDayModal } from "./AvailabilityDayModal";
import "../../../pages/profile/style.css";

dayjs.extend(isoWeek);
dayjs.locale("ru");

const MAX_AVAILABILITY_RANGE_DAYS = 366;

function countIsoDatesInRange(fromIso: string, toIso: string): number {
  const from = fromIso.trim();
  const to = toIso.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return 0;
  }
  if (from > to) return 0;
  const start = dayjs(from, "YYYY-MM-DD", true);
  const end = dayjs(to, "YYYY-MM-DD", true);
  if (!start.isValid() || !end.isValid()) return 0;
  const dayCount = end.diff(start, "day") + 1;
  if (dayCount <= 0 || dayCount > MAX_AVAILABILITY_RANGE_DAYS) return 0;
  return dayCount;
}

type PersonalAvailabilityEditorProps = {
  accessToken: string;
  title: string;
  hint: string;
  storageMonthKey: string;
};

export function PersonalAvailabilityEditor({
  accessToken,
  title,
  hint,
  storageMonthKey,
}: PersonalAvailabilityEditorProps) {
  const dispatch = useAppDispatch();
  const { availabilityCalendar, saving, error: saveError, ok } =
    useAvailabilityAutoSave(accessToken);
  const calendarState = useAppSelector(selectProfileCalendarState);
  const flags = useAppSelector(selectAvailabilityFlags);
  const selectedDate = calendarState.selectedDate;
  const [dayModalOpen, setDayModalOpen] = useState(false);
  const [rangeFromDate, setRangeFromDate] = useState(selectedDate);
  const [rangeToDate, setRangeToDate] = useState(selectedDate);
  const [rangeError, setRangeError] = useState<string | null>(null);

  useEffect(() => {
    setRangeFromDate(selectedDate);
    setRangeToDate(selectedDate);
  }, [selectedDate]);

  useEffect(() => {
    dispatch(fetchMyProfileThunk({ accessToken }));
  }, [accessToken, dispatch]);

  useEffect(() => {
    dispatch(profileAvailabilityActions.clearAvailabilityError());
    dispatch(
      loadSessionsForRangeThunk({
        accessToken,
        fromIso: calendarState.fromIso,
        toIso: calendarState.toIso,
      }),
    );
  }, [accessToken, calendarState.fromIso, calendarState.toIso, dispatch]);

  const rangeDayCount = useMemo(
    () => countIsoDatesInRange(rangeFromDate, rangeToDate),
    [rangeFromDate, rangeToDate],
  );
  const rangeIsValid = rangeDayCount > 0;

  const onCalendarStateChange = useCallback(
    (next: CalendarSectionState) => {
      dispatch(profileAvailabilityActions.setProfileCalendarState({ value: next }));
    },
    [dispatch],
  );

  const applyRangeStatus = useCallback(
    (status: AvailabilityStatus | null) => {
      if (!rangeIsValid) {
        setRangeError(
          "Укажите корректный диапазон: дата «С» не позже «По», не больше года.",
        );
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

  return (
    <div className="profile-tab-page profile-availability-page">
      <div className="profile-tab-head">
        <div className="profile-tab-title">{title}</div>
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
      <p className="profile-availability-hint">{hint}</p>

      {flags.error ? (
        <div className="settings-invite-error profile-availability-load-error">
          {flags.error}
        </div>
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
              onChange={(event) => {
                setRangeFromDate(event.target.value);
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
              onChange={(event) => {
                setRangeToDate(event.target.value);
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
          <div className="settings-invite-error profile-availability-range__error">
            {rangeError}
          </div>
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
          storageMonthKey={storageMonthKey}
          initialSelectedDate={calendarState.selectedDate}
          onStateChange={onCalendarStateChange}
          onDayClick={() => setDayModalOpen(true)}
          statusByDate={availabilityCalendar}
          dotsByDate={{}}
          eventsByDate={{}}
          showStatusMarks={false}
          title="Занятость"
          subtitle="Клик по дню — отметить занятость"
        />
      </div>

      <AvailabilityDayModal
        isOpen={dayModalOpen}
        dateIso={selectedDate}
        onClose={() => setDayModalOpen(false)}
      />
    </div>
  );
}
