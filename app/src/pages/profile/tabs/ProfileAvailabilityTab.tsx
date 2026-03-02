import dayjs from "dayjs";
import "dayjs/locale/ru";
import isoWeek from "dayjs/plugin/isoWeek";
import { useCallback, useEffect, useMemo } from "react";
import { Button } from "@shared/core/button/Button";
import { CalendarSection } from "../../../shared/components/calendar/CalendarSection";
import { useAuth } from "../../../features/auth";
import { useProject } from "../../../features/project";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  fetchMyProfileThunk,
  profileDataActions,
  selectMyProfile,
  selectProfileForm,
} from "../../../features/profile/model/profileDataSlice";
import {
  loadRehearsalsForRangeThunk,
  profileAvailabilityActions,
  selectAvailabilityFlags,
  selectAvailabilityRehearsalsForActiveRange,
  selectProfileCalendarState,
} from "../../../features/profile/model/profileAvailabilitySlice";
import type { Rehearsal } from "../../../sync/api";

dayjs.extend(isoWeek);
dayjs.locale("ru");

type AvailabilityStatus = "present" | "absent";
type AvailabilityTimeRange = { from: string; to: string };

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

export function ProfileAvailabilityTab() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const dispatch = useAppDispatch();
  const profile = useAppSelector(selectMyProfile);
  const form = useAppSelector(selectProfileForm);

  const calendarState = useAppSelector(selectProfileCalendarState);
  const rehearsals = useAppSelector(selectAvailabilityRehearsalsForActiveRange);
  const flags = useAppSelector(selectAvailabilityFlags);

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyProfileThunk({ accessToken }));
  }, [accessToken, dispatch]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    dispatch(profileAvailabilityActions.clearAvailabilityError());
    dispatch(
      loadRehearsalsForRangeThunk({
        accessToken,
        projectName,
        fromIso: calendarState.fromIso,
        toIso: calendarState.toIso,
      }),
    );
    dispatch(
      profileAvailabilityActions.setActiveRangeKey({
        value: [projectName, calendarState.fromIso, calendarState.toIso].join("|"),
      }),
    );
  }, [accessToken, calendarState.fromIso, calendarState.toIso, dispatch, projectName]);

  const availabilityCalendar = useMemo(
    () => (((form as any).availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>),
    [form],
  );

  const availabilityTimeRanges = useMemo(
    () => (((form as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>),
    [form],
  );

  const rehearsalsByDate = useMemo(() => {
    const grouped = new Map<string, Rehearsal[]>();
    for (const rehearsal of rehearsals) {
      const date = isoDate(new Date(rehearsal.startsAt));
      const arr = grouped.get(date);
      if (arr) arr.push(rehearsal);
      else grouped.set(date, [rehearsal]);
    }
    return grouped;
  }, [rehearsals]);

  const selectedDayRehearsalsAll = rehearsalsByDate.get(calendarState.selectedDate) ?? [];
  const selectedDayRehearsalsMy = useMemo(() => {
    const email = String(profile?.email ?? "").trim().toLowerCase();
    if (!email) return [];
    return selectedDayRehearsalsAll.filter((r) =>
      (r.participants ?? []).some((p) => String(p.email ?? "").trim().toLowerCase() === email),
    );
  }, [profile?.email, selectedDayRehearsalsAll]);

  const myMonthRehearsals = useMemo(() => {
    const email = String(profile?.email ?? "").trim().toLowerCase();
    if (!email) return [];
    return (rehearsals ?? [])
      .filter((r) =>
        (r.participants ?? []).some((p) => String(p.email ?? "").trim().toLowerCase() === email),
      )
      .slice()
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [profile?.email, rehearsals]);

  const dotsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [date, list] of rehearsalsByDate.entries()) {
      out[date] = list.length;
    }
    return out;
  }, [rehearsalsByDate]);

  const selectedDate = calendarState.selectedDate;
  const selectedRanges = availabilityTimeRanges[selectedDate] ?? [];

  const onCalendarStateChange = useCallback(
    (next: any) => {
      dispatch(profileAvailabilityActions.setProfileCalendarState({ value: next }));
    },
    [dispatch],
  );

  const onCalendarDayClick = useCallback(
    (date: string) => {
      dispatch(profileDataActions.toggleAvailabilityDayStatus({ date }));
    },
    [dispatch],
  );

  if (!accessToken) return <div>Нужно войти, чтобы управлять занятостью.</div>;

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Календарь занятости</div>
      <p style={{ margin: "0 0 10px", opacity: 0.75, fontSize: 12 }}>
        Клик по дню: свободен → занят → не отмечено. Репетиции показываются точками.
      </p>

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

      <div style={{ marginTop: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Свободное время на {selectedDate}</div>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
          Если указать диапазоны — они будут учитываться при планировании слотов сессии. Время локальное (как
          на твоём компьютере).
        </div>

        {selectedRanges.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>
            Не задано (если день “свободен” — считается весь день).
          </div>
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
      </div>

      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>Мои репетиции на {calendarState.selectedDate}:</div>
      <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
        {selectedDayRehearsalsMy.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Нет репетиций в этот день.</div>
        ) : (
          selectedDayRehearsalsMy.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>{r.title}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>{new Date(r.startsAt).toLocaleString("ru-RU")}</div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>Мои репетиции в этом месяце:</div>
      <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
        {myMonthRehearsals.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7 }}>Пока нет репетиций в этом месяце.</div>
        ) : (
          myMonthRehearsals.slice(0, 40).map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 10,
                padding: "8px 10px",
                background: "rgba(255,255,255,0.04)",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700 }}>{r.title}</div>
              <div style={{ fontSize: 11, opacity: 0.75 }}>{new Date(r.startsAt).toLocaleString("ru-RU")}</div>
            </div>
          ))
        )}
      </div>

      {flags.loading ? <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Загрузка репетиций…</div> : null}
    </div>
  );
}

