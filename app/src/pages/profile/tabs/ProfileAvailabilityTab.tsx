import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@shared/core/button/Button";
import { CalendarSection } from "../../../shared/components/calendar/CalendarSection";
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
import type { DirectorSession } from "../../../sync/api";

dayjs.extend(isoWeek);
dayjs.locale("ru");

type AvailabilityStatus = "present" | "absent";
type AvailabilityTimeRange = { from: string; to: string };

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
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
    dispatch(
      profileAvailabilityActions.setActiveRangeKey({
        value: [calendarState.fromIso, calendarState.toIso].join("|"),
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
    // Only the fields used by rehearsal planning / troupe availability.
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

    // Wait for the initial profile load to set the baseline.
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
    return grouped;
  }, [sessions]);

  const selectedDaySessionsAll = sessionsByDate.get(calendarState.selectedDate) ?? [];
  const isMyPlannedSession = useCallback(
    (s: DirectorSession) => {
      const email = normalizeEmail(profile?.email);
      if (!email) return false;
      const planned = Array.isArray((s as any)?.plannedEmails) ? ((s as any).plannedEmails as any[]) : [];
      if (planned.some((e) => normalizeEmail(e) === email)) return true;
      return (s.participants ?? []).some((p) => normalizeEmail(p.email) === email);
    },
    [profile?.email],
  );
  const selectedDaySessionsMy = useMemo(() => {
    return selectedDaySessionsAll.filter(isMyPlannedSession);
  }, [isMyPlannedSession, selectedDaySessionsAll]);

  const myMonthSessions = useMemo(() => {
    return (sessions ?? [])
      .filter(isMyPlannedSession)
      .slice()
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [isMyPlannedSession, sessions]);

  const dotsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of myMonthSessions) {
      const date = isoDate(new Date(s.startsAt));
      out[date] = (out[date] ?? 0) + 1;
    }
    return out;
  }, [myMonthSessions]);

  const selectedDate = calendarState.selectedDate;
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const selectedStatus = (availabilityCalendar[selectedDate] ?? null) as AvailabilityStatus | null;
  const selectedRanges = availabilityTimeRanges[selectedDate] ?? [];

  const onCalendarStateChange = useCallback(
    (next: any) => {
      dispatch(profileAvailabilityActions.setProfileCalendarState({ value: next }));
    },
    [dispatch],
  );

  const onCalendarDayClick = useCallback(
    (date: string) => {
      // MonthCalendar already selects date on click; we just раскрываем панель деталей.
      void date;
      setDayPanelOpen(true);
    },
    [],
  );

  if (!accessToken) return <div>Нужно войти, чтобы управлять занятостью.</div>;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "baseline", flexWrap: "wrap", marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Календарь занятости</div>
        {profileFlags.saving ? (
          <div style={{ fontSize: 12, opacity: 0.75 }}>Автосохранение…</div>
        ) : profileFlags.error ? (
          <div className="settings-invite-error" style={{ margin: 0 }}>
            {profileFlags.error}
          </div>
        ) : profileFlags.ok ? (
          <div style={{ color: "#7ee787", fontSize: 12 }}>{profileFlags.ok}</div>
        ) : null}
      </div>
      <p style={{ margin: "0 0 10px", opacity: 0.75, fontSize: 12 }}>Клик по дню — редактировать статус и время.</p>

      <CalendarSection
        storageMonthKey="profile-calendar-month"
        initialSelectedDate={calendarState.selectedDate}
        onStateChange={onCalendarStateChange}
        onDayClick={onCalendarDayClick}
        statusByDate={availabilityCalendar}
        dotsByDate={dotsByDate}
      />

      {flags.error ? (
        <div className="settings-invite-error" style={{ marginTop: 8 }}>
          {flags.error}
        </div>
      ) : null}

      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            Выбранная дата: <span style={{ fontWeight: 700 }}>{selectedDate}</span>
          </div>
          <Button
            className="secondary"
            type="button"
            onClick={() => setDayPanelOpen((v) => !v)}
          >
            {dayPanelOpen ? "Скрыть детали дня" : "Показать детали дня"}
          </Button>
        </div>

        {dayPanelOpen && (
          <div
            style={{
              marginTop: 8,
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              padding: 12,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 8 }}>
              {dayjs(selectedDate).format("D MMMM YYYY")} · занятость
            </div>

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Статус дня</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Button
                  className={selectedStatus == null ? "is-active" : "secondary"}
                  type="button"
                  onClick={() => dispatch(profileDataActions.setAvailabilityDayStatus({ date: selectedDate, status: null }))}
                >
                  Не отмечено
                </Button>
                <Button
                  className={selectedStatus === "present" ? "is-active" : "secondary"}
                  type="button"
                  onClick={() =>
                    dispatch(profileDataActions.setAvailabilityDayStatus({ date: selectedDate, status: "present" }))
                  }
                >
                  Свободен
                </Button>
                <Button
                  className={selectedStatus === "absent" ? "danger is-active" : "secondary"}
                  type="button"
                  onClick={() =>
                    dispatch(profileDataActions.setAvailabilityDayStatus({ date: selectedDate, status: "absent" }))
                  }
                >
                  Занят
                </Button>
              </div>
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                Диапазоны времени учитываются при планировании слотов сессии. Время локальное.
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Время, когда можешь быть на репетиции</div>
              {selectedStatus !== "present" ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Доступно только если день отмечен как «Свободен».</div>
              ) : selectedRanges.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Не задано (значит можно весь день).</div>
              ) : (
                <div style={{ display: "grid", gap: 6 }}>
                  {selectedRanges.map((r, idx) => (
                    <div key={`${selectedDate}:${idx}`} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <input
                        className="settings-invite-input"
                        type="time"
                        value={r.from}
                        onChange={(e) => {
                          const next = selectedRanges.slice();
                          next[idx] = { ...next[idx]!, from: e.target.value };
                          dispatch(profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }));
                        }}
                        style={{ maxWidth: 140 }}
                      />
                      <div style={{ opacity: 0.7, fontSize: 12 }}>—</div>
                      <input
                        className="settings-invite-input"
                        type="time"
                        value={r.to}
                        onChange={(e) => {
                          const next = selectedRanges.slice();
                          next[idx] = { ...next[idx]!, to: e.target.value };
                          dispatch(profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }));
                        }}
                        style={{ maxWidth: 140 }}
                      />
                      <Button
                        className="danger"
                        type="button"
                        onClick={() => {
                          const next = selectedRanges.slice();
                          next.splice(idx, 1);
                          dispatch(profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }));
                        }}
                      >
                        Удалить
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              {selectedStatus === "present" && (
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <Button
                    className="primary"
                    type="button"
                    onClick={() => {
                      const next = [...selectedRanges, { from: "19:00", to: "21:00" }];
                      dispatch(profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }));
                    }}
                  >
                    + Добавить диапазон
                  </Button>
                  {selectedRanges.length > 0 ? (
                    <Button
                      className="danger"
                      type="button"
                      onClick={() => dispatch(profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: [] }))}
                    >
                      Очистить время
                    </Button>
                  ) : null}
                </div>
              )}
            </div>

            <div style={{ marginTop: 14, fontSize: 12, opacity: 0.8 }}>Мои сессии на {selectedDate}:</div>
            <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
              {selectedDaySessionsMy.length === 0 ? (
                <div style={{ fontSize: 12, opacity: 0.7 }}>Нет сессий в этот день.</div>
              ) : (
                selectedDaySessionsMy.map((s) => (
                  <Link
                    key={s.id}
                    to={`/sessions/${encodeURIComponent(s.id)}`}
                    style={{
                      border: "1px solid rgba(255,255,255,0.12)",
                      borderRadius: 10,
                      padding: "8px 10px",
                      background: "rgba(0,0,0,0.10)",
                      textDecoration: "none",
                      color: "inherit",
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{s.title}</div>
                    <div style={{ fontSize: 11, opacity: 0.75 }}>{new Date(s.startsAt).toLocaleString("ru-RU")}</div>
                  </Link>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>Мои сессии в этом месяце:</div>
      <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
        {myMonthSessions.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Пока нет сессий в этом месяце.</div>
        ) : (
          myMonthSessions.slice(0, 40).map((s) => (
            <Link
              key={s.id}
              to={`/sessions/${encodeURIComponent(s.id)}`}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.04)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>{s.title}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>{new Date(s.startsAt).toLocaleString("ru-RU")}</div>
            </Link>
          ))
        )}
      </div>

      {flags.loading ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Загрузка репетиций…</div> : null}
    </div>
  );
}

