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
          <div className="settings-invite-error" style={{ margin: 0 }}>
            {profileFlags.error}
          </div>
        ) : profileFlags.ok ? (
          <div className="profile-save-hint profile-save-hint--ok">{profileFlags.ok}</div>
        ) : null}
      </div>

      <div className="profile-intro profile-availability-intro">
        <strong>Как отметить занятость</strong>
        <ol>
          <li>Нажмите день в календаре — откроется окно настройки.</li>
          <li>Выберите «Занят», «Свободен» или «Не отмечено».</li>
          <li>
            При «Свободен» можно задать <strong>часы</strong> кнопкой «+ Добавить диапазон».
          </li>
        </ol>
        <div className="profile-availability-legend">
          <span className="profile-availability-legend-item">
            <span className="profile-availability-legend-swatch profile-availability-legend-swatch--present" />
            свободен
          </span>
          <span className="profile-availability-legend-item">
            <span className="profile-availability-legend-swatch profile-availability-legend-swatch--absent" />
            занят
          </span>
          <span className="profile-availability-legend-item">
            <span className="profile-availability-legend-swatch profile-availability-legend-swatch--session" />
            сессия
          </span>
        </div>
      </div>

      {flags.error ? (
        <div className="settings-invite-error profile-availability-load-error">{flags.error}</div>
      ) : null}
      {flags.loading ? <div className="profile-save-hint">Загрузка сессий…</div> : null}

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
        <div className="profile-availability-day-modal__head">
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
              className={selectedStatus == null ? "is-active" : "secondary"}
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
              className={selectedStatus === "present" ? "is-active" : "secondary"}
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
              className={selectedStatus === "absent" ? "danger is-active" : "secondary"}
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
