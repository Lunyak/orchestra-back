import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@shared/core/button/Button";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { Modal } from "@shared/core/modal/Modal";
import { CalendarSection } from "../../../shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "../../../shared/components/calendar/MonthCalendar";
import {
  formatTimeHHMM,
  getSessionStartLocalMinutes,
} from "../../../features/director-sessions/model/session-page-utils";
import { useAuth } from "../../../features/auth";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  fetchMyProfileThunk,
  profileDataActions,
  saveMyProfileThunk,
  selectMyProfile,
  selectProfileDataFlags,
  selectProfileForm,
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

dayjs.extend(isoWeek);
dayjs.locale("ru");

type AvailabilityStatus = "present" | "absent";
type AvailabilityTimeRange = { from: string; to: string };

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
  const profile = useAppSelector(selectMyProfile);
  const form = useAppSelector(selectProfileForm);
  const profileFlags = useAppSelector(selectProfileDataFlags);

  const calendarState = useAppSelector(selectProfileCalendarState);
  const sessions = useAppSelector(selectAvailabilitySessionsForActiveRange);
  const flags = useAppSelector(selectAvailabilityFlags);

  const autoSaveBaselineRef = useRef<string | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);

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

  const availabilityCalendar = useMemo(
    () => (((form as any).availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>),
    [form],
  );

  const availabilityTimeRanges = useMemo(
    () => (((form as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>),
    [form],
  );

  const availabilitySignature = useMemo(() => {
    return JSON.stringify({
      availabilityCalendar,
      availabilityTimeRanges,
    });
  }, [availabilityCalendar, availabilityTimeRanges]);

  useEffect(() => {
    if (!accessToken) {
      autoSaveBaselineRef.current = null;
      if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
      return;
    }

    if (!profile?.email) return;

    if (autoSaveBaselineRef.current == null) {
      autoSaveBaselineRef.current = availabilitySignature;
      return;
    }

    if (availabilitySignature === autoSaveBaselineRef.current) return;

    if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(async () => {
      if (!accessToken) return;
      if (profileFlags.saving) return;
      if (autoSaveBaselineRef.current == null) return;
      if (availabilitySignature === autoSaveBaselineRef.current) return;

      const res = await dispatch(saveMyProfileThunk({ accessToken }));
      if (saveMyProfileThunk.fulfilled.match(res)) {
        autoSaveBaselineRef.current = JSON.stringify({
          availabilityCalendar: (res.payload as any)?.availabilityCalendar ?? {},
          availabilityTimeRanges: (res.payload as any)?.availabilityTimeRanges ?? {},
        });
      }
    }, 800);

    return () => {
      if (autoSaveTimerRef.current != null) window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    };
  }, [accessToken, availabilitySignature, dispatch, profile?.email, profileFlags.saving]);

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

  const calendarSelectedDateLabel = useMemo(
    () => dayjs(calendarState.selectedDate).format("D MMMM YYYY"),
    [calendarState.selectedDate],
  );

  const selectedStatus = (availabilityCalendar[selectedDate] ?? null) as AvailabilityStatus | null;
  const selectedRanges = availabilityTimeRanges[selectedDate] ?? [];

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
        {profileFlags.saving ? (
          <div className="profile-save-hint">Автосохранение…</div>
        ) : profileFlags.error ? (
          <div className="settings-invite-error settings-invite-error--flush">
            {profileFlags.error}
          </div>
        ) : profileFlags.ok ? (
          <div className="profile-save-hint profile-save-hint--ok">{profileFlags.ok}</div>
        ) : null}
      </div>

      {flags.error ? (
        <div className="settings-invite-error profile-availability-load-error">{flags.error}</div>
      ) : null}
      {flags.loading ? <div className="profile-save-hint">Загрузка сессий…</div> : null}

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

      <Modal
        isOpen={dayModalOpen}
        onClose={() => setDayModalOpen(false)}
        panelClassName="profile-availability-day-modal"
        ariaLabelledBy="profile-availability-day-modal-title"
      >
        <div className="profile-availability-day-modal__header">
          <h3 id="profile-availability-day-modal-title" className="profile-availability-day-modal__title">
            {calendarSelectedDateLabel}
          </h3>
          <button
            type="button"
            className="profile-availability-day-modal__close"
            onClick={() => setDayModalOpen(false)}
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>

        <div className="profile-availability-day-modal__body">
          <div className="profile-availability-section-label">Статус дня</div>
          <div className="profile-availability-status-row">
            <Button
              className={cn(selectedStatus == null ? "button--active" : "secondary")}
              type="button"
              onClick={() =>
                dispatch(
                  profileDataActions.setAvailabilityDayStatus({ date: selectedDate, status: null }),
                )
              }
            >
              Не отмечено
            </Button>
            <Button
              className={cn(selectedStatus === "present" ? "button--active" : "secondary")}
              type="button"
              onClick={() =>
                dispatch(
                  profileDataActions.setAvailabilityDayStatus({ date: selectedDate, status: "present" }),
                )
              }
            >
              Свободен
            </Button>
            <Button
              className={cn(
                selectedStatus === "absent" && "danger",
                selectedStatus === "absent" ? "button--active" : "secondary",
              )}
              type="button"
              onClick={() =>
                dispatch(
                  profileDataActions.setAvailabilityDayStatus({ date: selectedDate, status: "absent" }),
                )
              }
            >
              Занят
            </Button>
          </div>

          <div className="profile-availability-time-block">
            <div className="profile-availability-section-label">Окна доступности для сессий</div>
            {selectedStatus !== "present" ? (
              <div className="profile-availability-hint">
                Поля времени появляются после выбора «Свободен». Если весь день занят — выберите «Занят».
              </div>
            ) : selectedRanges.length === 0 ? (
              <div className="profile-availability-hint">
                Интервалы не заданы — доступен весь день. «+ Добавить диапазон», если свободны только часть дня.
              </div>
            ) : (
              <div className="profile-availability-time-ranges">
                {selectedRanges.map((r, idx) => (
                  <div key={`${selectedDate}:${idx}`} className="profile-availability-time-row">
                    <InlineTextField
                      className="profile-availability-time-input"
                      type="time"
                      value={r.from}
                      onChange={(e) => {
                        const next = selectedRanges.slice();
                        next[idx] = { ...next[idx]!, from: e.target.value };
                        dispatch(
                          profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }),
                        );
                      }}
                    />
                    <div className="profile-availability-time-sep">—</div>
                    <InlineTextField
                      className="profile-availability-time-input"
                      type="time"
                      value={r.to}
                      onChange={(e) => {
                        const next = selectedRanges.slice();
                        next[idx] = { ...next[idx]!, to: e.target.value };
                        dispatch(
                          profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }),
                        );
                      }}
                    />
                    <Button
                      className="danger"
                      type="button"
                      onClick={() => {
                        const next = selectedRanges.slice();
                        next.splice(idx, 1);
                        dispatch(
                          profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }),
                        );
                      }}
                    >
                      Удалить
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {selectedStatus === "present" && (
              <div className="profile-availability-time-actions">
                <Button
                  className="primary"
                  type="button"
                  onClick={() => {
                    const next = [...selectedRanges, { from: "19:00", to: "21:00" }];
                    dispatch(
                      profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }),
                    );
                  }}
                >
                  + Добавить диапазон
                </Button>
                {selectedRanges.length > 0 ? (
                  <Button
                    className="danger"
                    type="button"
                    onClick={() =>
                      dispatch(
                        profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: [] }),
                      )
                    }
                  >
                    Очистить время
                  </Button>
                ) : null}
              </div>
            )}
          </div>

          <div className="profile-availability-sessions-title">Сессии в этот день</div>
          <div className="profile-availability-day-sessions__list profile-availability-day-sessions__list--modal">
            {selectedDaySessionsAll.length === 0 ? (
              <div className="profile-availability-hint">Нет сессий в этот день.</div>
            ) : (
              selectedDaySessionsAll.map((s) => {
                const time = formatTimeHHMM(getSessionStartLocalMinutes(s.startsAt));
                return (
                  <button
                    key={s.id}
                    type="button"
                    className="profile-availability-day-session"
                    onClick={() => setSessionDetailModalId(s.id)}
                  >
                    <span className="profile-availability-day-session__time">{time}</span>
                    <span className="profile-availability-day-session__title">{s.title}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="profile-availability-day-modal__foot">
          <Button type="button" onClick={() => setDayModalOpen(false)}>
            Готово
          </Button>
        </div>
      </Modal>

      <DirectorSessionDetailModal
        isOpen={!!sessionDetailModalId}
        sessionId={sessionDetailModalId}
        accessToken={accessToken}
        onClose={() => setSessionDetailModalId(null)}
      />
    </div>
  );
}
