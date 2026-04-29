import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@shared/core/button/Button";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
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
  profileAvailabilityCacheKey,
  selectAvailabilityFlags,
  selectAvailabilitySessionsForActiveRange,
  selectProfileCalendarState,
} from "../../../features/profile/model/profileAvailabilitySlice";
import type { DirectorSession } from "../../../sync/api";
import { DirectorSessionDetailModal } from "../../../features/director-session-detail/DirectorSessionDetailModal";

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

  const selectedDate = calendarState.selectedDate;
  const [dayPanelOpen, setDayPanelOpen] = useState(false);
  const dayPanelRef = useRef<HTMLDivElement | null>(null);
  const [sessionDetailModalId, setSessionDetailModalId] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyProfileThunk({ accessToken }));
  }, [accessToken, dispatch]);

  /** Сессии: свои (режиссёр) + приглашения (GET /director-sessions/invitations) — после развёртывания дня или модалки. */
  useEffect(() => {
    if (!accessToken) return;
    if (!dayPanelOpen && !sessionDetailModalId) return;
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
        value: profileAvailabilityCacheKey(calendarState.fromIso, calendarState.toIso),
      }),
    );
  }, [
    accessToken,
    calendarState.fromIso,
    calendarState.toIso,
    dayPanelOpen,
    sessionDetailModalId,
    dispatch,
  ]);

  const availabilityCalendar = useMemo(
    () => (((form as any).availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>),
    [form],
  );

  const availabilityTimeRanges = useMemo(
    () => (((form as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>),
    [form],
  );

  const availabilitySignature = useMemo(() => {
    // Only the fields used by session scheduling / troupe availability.
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
  /** Все сессии из GET /director-sessions — проект текущего пользователя (режиссёр); показываем в календаре целиком. */
  const directorMonthSessions = useMemo(() => {
    return (sessions ?? [])
      .slice()
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [sessions]);

  const dotsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const s of directorMonthSessions) {
      const date = isoDate(new Date(s.startsAt));
      out[date] = (out[date] ?? 0) + 1;
    }
    return out;
  }, [directorMonthSessions]);

  useEffect(() => {
    if (!dayPanelOpen) return;
    dayPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [selectedDate, dayPanelOpen]);
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
      <div className="profile-availability-head">
        <div className="profile-availability-title">Календарь занятости</div>
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

      <div className="profile-availability-intro">
        <strong>Как отметить занятость</strong>
        <ol>
          <li>Выберите день в сетке календаря ниже (активный день подсвечен).</li>
          <li>В блоке «День» укажите статус: «Занят» — весь день недоступен, «Свободен» — доступны сессии.</li>
          <li>
            Чтобы ограничить <strong>часы</strong>, когда вы на сессии: статус «Свободен», затем кнопка «+ Добавить
            диапазон» и поля времени «с — по». Если диапазонов нет, считается, что свободны весь день.
          </li>
        </ol>
      </div>

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
        <div className="profile-availability-toolbar">
          <div className="profile-availability-date-line">
            Выбранный день в календаре: <b>{selectedDate}</b> ({dayjs(selectedDate).format("D MMMM YYYY")})
          </div>
          <Button className="secondary" type="button" onClick={() => setDayPanelOpen((v) => !v)}>
            {dayPanelOpen ? "Свернуть блок дня" : "Развернуть блок дня"}
          </Button>
        </div>
        {!dayPanelOpen && !sessionDetailModalId ? (
          <div className="profile-availability-hint" style={{ marginTop: 6 }}>
            Список сессий не запрашивается, пока вы не развернёте блок дня, не выберете день в календаре или не
            откроете карточку сессии. Сюда попадают ваши сессии как у режиссёра и{" "}
            <strong>опубликованные</strong> сессии, куда вас вызвал другой пользователь (ваш email в плане вызова
            или в списке участников). Это не значит, что вы режиссёр — просто вы приглашены в чужую карточку
            сессии.
          </div>
        ) : null}

        {dayPanelOpen && (
          <div ref={dayPanelRef} className="profile-availability-panel">
            <div className="profile-availability-panel-title">
              {dayjs(selectedDate).format("D MMMM YYYY")} — занятость
            </div>

            <div>
              <div className="profile-availability-section-label">Статус дня</div>
              <div className="profile-availability-status-row">
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
              <div className="profile-availability-hint">
                Диапазоны времени учитываются при планировании слотов сессии. Время указано в вашем локальном часовом
                поясе.
              </div>
            </div>

            <div className="profile-availability-time-block">
              <div className="profile-availability-section-label">Окна доступности для сессий</div>
              {selectedStatus !== "present" ? (
                <div className="profile-availability-hint">
                  Поля времени появляются после выбора «Свободен»: так вы задаёте один или несколько интервалов
                  доступности в этот день. Если весь день занят — выберите «Занят».
                </div>
              ) : selectedRanges.length === 0 ? (
                <div className="profile-availability-hint">
                  Интервалы не заданы — вы считаетесь доступным весь этот день. Нажмите «+ Добавить диапазон», если
                  свободны только часть дня.
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
                          dispatch(profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }));
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
                          dispatch(profileDataActions.setTimeRangesForDate({ date: selectedDate, ranges: next }));
                        }}
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
                <div className="profile-availability-time-actions">
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

            <div className="profile-availability-sessions-title">Режиссёрские сессии на {selectedDate}:</div>
            <div className="profile-availability-sessions">
              {selectedDaySessionsAll.length === 0 ? (
                <div className="profile-availability-hint">Нет сессий в этот день.</div>
              ) : (
                selectedDaySessionsAll.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="profile-availability-session-link"
                    onClick={() => setSessionDetailModalId(s.id)}
                  >
                    <div className="profile-availability-session-title">{s.title}</div>
                    <div className="profile-availability-session-meta">
                      {new Date(s.startsAt).toLocaleString("ru-RU")}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="profile-availability-month-sessions">Режиссёрские сессии в этом месяце:</div>
      <div className="profile-availability-sessions">
        {directorMonthSessions.length === 0 ? (
          <div className="profile-availability-hint">Пока нет сессий в этом месяце.</div>
        ) : (
          directorMonthSessions.slice(0, 40).map((s) => (
            <button
              key={s.id}
              type="button"
              className="profile-availability-session-link profile-availability-session-link--muted"
              onClick={() => setSessionDetailModalId(s.id)}
            >
              <div className="profile-availability-session-title">{s.title}</div>
              <div className="profile-availability-session-meta">{new Date(s.startsAt).toLocaleString("ru-RU")}</div>
            </button>
          ))
        )}
      </div>

      {flags.loading ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Загрузка сессий…</div> : null}

      <DirectorSessionDetailModal
        isOpen={!!sessionDetailModalId}
        sessionId={sessionDetailModalId}
        accessToken={accessToken}
        onClose={() => setSessionDetailModalId(null)}
      />
    </div>
  );
}

