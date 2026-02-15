import { useEffect, useMemo, useState } from "react";
import {
  getMyProfile,
  listRehearsals,
  updateMyProfile,
  type MyProfile,
  type Rehearsal,
} from "../../sync/api";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import "./style.css";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/ru";

dayjs.extend(isoWeek);
dayjs.locale("ru");

type AvailabilityStatus = "present" | "absent";

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function startOfMonth(date: Date): Date {
  return dayjs(date).startOf("month").toDate();
}

function endOfMonth(date: Date): Date {
  return dayjs(date).endOf("month").toDate();
}

function addMonths(base: Date, months: number): Date {
  return dayjs(base).add(months, "month").toDate();
}

function addDays(base: Date, days: number): Date {
  return dayjs(base).add(days, "day").toDate();
}

function getMonthCalendarDays(date: Date): Date[] {
  const start = dayjs(date).startOf("month");
  const end = dayjs(date).endOf("month");
  
  // Начинаем с понедельника недели, в которой начинается месяц
  const startDay = start.startOf("isoWeek");
  // Заканчиваем воскресеньем недели, в которой заканчивается месяц
  const endDay = end.endOf("isoWeek");
  
  const days: Date[] = [];
  let current = startDay;
  
  while (current.isBefore(endDay) || current.isSame(endDay, "day")) {
    days.push(current.toDate());
    current = current.add(1, "day");
  }
  
  return days;
}

export function ProfilePage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<Partial<MyProfile>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState(() => {
    const saved = localStorage.getItem("profile-calendar-month");
    if (saved) {
      try {
        const date = new Date(saved);
        if (!isNaN(date.getTime())) return date;
      } catch {
        // ignore
      }
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [monthRehearsals, setMonthRehearsals] = useState<Rehearsal[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);

  // Сохраняем выбранный месяц в localStorage
  useEffect(() => {
    localStorage.setItem("profile-calendar-month", currentMonth.toISOString());
  }, [currentMonth]);

  useEffect(() => {
    if (!accessToken) return;
    getMyProfile(accessToken)
      .then((p) => setProfile(p))
      .catch(() => setProfile(null));
  }, [accessToken]);

  useEffect(() => {
    setForm({
      displayName: profile?.displayName ?? "",
      firstName: profile?.firstName ?? "",
      lastName: profile?.lastName ?? "",
      telegramUsername: profile?.telegramUsername ?? "",
      telegramId: profile?.telegramId ?? "",
      avatarUrl: profile?.avatarUrl ?? "",
      availabilityCalendar: profile?.availabilityCalendar ?? {},
    });
  }, [profile]);

  const normalizedPatch = useMemo(() => {
    const t = (v: unknown) => String(v ?? "").trim();
    const inputCalendar = form.availabilityCalendar;
    const cleanCalendar: Record<string, AvailabilityStatus> = {};
    if (inputCalendar && typeof inputCalendar === "object") {
      for (const [date, status] of Object.entries(inputCalendar)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        if (status === "present" || status === "absent") {
          cleanCalendar[date] = status;
        }
      }
    }
    return {
      displayName: t(form.displayName),
      firstName: t(form.firstName),
      lastName: t(form.lastName),
      telegramUsername: t(form.telegramUsername),
      telegramId: t(form.telegramId),
      avatarUrl: t(form.avatarUrl),
      availabilityCalendar: cleanCalendar,
    } as Partial<MyProfile>;
  }, [form]);

  const monthStartDate = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEndDate = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  
  const fromIso = useMemo(() => monthStartDate.toISOString(), [monthStartDate]);
  const toIso = useMemo(() => monthEndDate.toISOString(), [monthEndDate]);
  
  const calendarDays = useMemo(() => getMonthCalendarDays(currentMonth), [currentMonth]);

  useEffect(() => {
    if (!accessToken || !projectName) {
      setMonthRehearsals([]);
      return;
    }
    setCalendarError(null);
    listRehearsals(accessToken, projectName, fromIso, toIso)
      .then((res) => setMonthRehearsals(res.rehearsals ?? []))
      .catch(() => {
        setMonthRehearsals([]);
        setCalendarError("Не удалось загрузить события репетиций");
      });
  }, [accessToken, fromIso, projectName, toIso]);

  const availabilityCalendar = useMemo(
    () => (form.availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>,
    [form.availabilityCalendar],
  );

  const rehearsalsByDate = useMemo(() => {
    const grouped = new Map<string, Rehearsal[]>();
    for (const rehearsal of monthRehearsals) {
      const date = isoDate(new Date(rehearsal.startsAt));
      const arr = grouped.get(date);
      if (arr) arr.push(rehearsal);
      else grouped.set(date, [rehearsal]);
    }
    return grouped;
  }, [monthRehearsals]);

  const selectedDayRehearsals = rehearsalsByDate.get(selectedDate) ?? [];

  const toggleDayStatus = (date: string) => {
    const current = availabilityCalendar[date];
    const next: AvailabilityStatus | undefined =
      current === "present" ? "absent" : current === "absent" ? undefined : "present";
    setForm((prev) => {
      const currentCalendar = {
        ...((prev.availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>),
      };
      if (next) currentCalendar[date] = next;
      else delete currentCalendar[date];
      return { ...prev, availabilityCalendar: currentCalendar };
    });
  };

  if (!accessToken) return <div>Нужно войти, чтобы редактировать профиль.</div>;

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="profile-view">
            <h2>Профиль</h2>
      <p style={{ opacity: 0.8, fontSize: 13, marginTop: 6 }}>
        Email: <b>{profile?.email ?? "—"}</b>
      </p>

      <div style={{ display: "grid", gap: 12, maxWidth: 520, marginTop: 12 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Отображаемое имя</div>
          <input
            className="settings-invite-input"
            value={String(form.displayName ?? "")}
            onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
            placeholder="например: Сергей"
            style={{ maxWidth: "unset" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Имя</div>
            <input
              className="settings-invite-input"
              value={String(form.firstName ?? "")}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              style={{ maxWidth: "unset" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Фамилия</div>
            <input
              className="settings-invite-input"
              value={String(form.lastName ?? "")}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              style={{ maxWidth: "unset" }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram username</div>
            <input
              className="settings-invite-input"
              value={String(form.telegramUsername ?? "")}
              onChange={(e) =>
                setForm((p) => ({ ...p, telegramUsername: e.target.value }))
              }
              placeholder="@username"
              style={{ maxWidth: "unset" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram id</div>
            <input
              className="settings-invite-input"
              value={String(form.telegramId ?? "")}
              onChange={(e) => setForm((p) => ({ ...p, telegramId: e.target.value }))}
              placeholder="123456789"
              style={{ maxWidth: "unset" }}
            />
          </label>
        </div>

        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Avatar URL</div>
          <input
            className="settings-invite-input"
            value={String(form.avatarUrl ?? "")}
            onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))}
            placeholder="https://..."
            style={{ maxWidth: "unset" }}
          />
        </label>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Календарь занятости</div>
          <p style={{ margin: "0 0 10px", opacity: 0.75, fontSize: 12 }}>
            Клик по дню: свободен → занят → не отмечено. Репетиции показываются точками.
          </p>
          
          {/* Навигация по месяцам */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.14)",
                background: "rgba(255, 255, 255, 0.04)",
                color: "inherit",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              ← Назад
            </button>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {dayjs(currentMonth).format("MMMM YYYY")}
            </div>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              style={{
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid rgba(255, 255, 255, 0.14)",
                background: "rgba(255, 255, 255, 0.04)",
                color: "inherit",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Вперед →
            </button>
          </div>

          {/* Заголовки дней недели */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6, marginBottom: 6 }}>
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
              <div
                key={day}
                style={{
                  textAlign: "center",
                  fontSize: 11,
                  fontWeight: 600,
                  opacity: 0.6,
                  padding: "4px 0",
                }}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Сетка календаря */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 6 }}>
            {calendarDays.map((dateObj) => {
              const date = isoDate(dateObj);
              const status = availabilityCalendar[date];
              const dayRehearsals = rehearsalsByDate.get(date) ?? [];
              const active = date === selectedDate;
              const isCurrentMonth = dayjs(dateObj).month() === dayjs(currentMonth).month();
              const isToday = date === isoDate(new Date());
              
              const baseBg =
                status === "present"
                  ? "rgba(96, 255, 140, 0.15)"
                  : status === "absent"
                    ? "rgba(255, 120, 120, 0.16)"
                    : "rgba(255, 255, 255, 0.04)";
              
              return (
                <button
                  key={date}
                  type="button"
                  onClick={() => {
                    setSelectedDate(date);
                    toggleDayStatus(date);
                  }}
                  title={date}
                  style={{
                    borderRadius: 8,
                    border: active 
                      ? "2px solid rgba(120, 180, 255, 0.8)" 
                      : isToday
                        ? "2px solid rgba(120, 180, 255, 0.4)"
                        : "1px solid rgba(255, 255, 255, 0.1)",
                    padding: "6px 4px",
                    background: baseBg,
                    color: isCurrentMonth ? "inherit" : "rgba(255, 255, 255, 0.3)",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 2,
                    minHeight: 50,
                    position: "relative",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: isToday ? 700 : 600 }}>
                    {dayjs(dateObj).date()}
                  </div>
                  {dayRehearsals.length > 0 && (
                    <div style={{ 
                      display: "flex", 
                      gap: 2,
                      flexWrap: "wrap",
                      justifyContent: "center",
                    }}>
                      {Array.from({ length: Math.min(dayRehearsals.length, 3) }).map((_, i) => (
                        <div
                          key={i}
                          style={{
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            background: "rgba(120, 180, 255, 0.8)",
                          }}
                        />
                      ))}
                    </div>
                  )}
                  {status && (
                    <div style={{ 
                      fontSize: 9, 
                      opacity: 0.7,
                      position: "absolute",
                      bottom: 2,
                    }}>
                      {status === "present" ? "✓" : "✗"}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {calendarError && <div className="settings-invite-error" style={{ marginTop: 8 }}>{calendarError}</div>}
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            События на {selectedDate}:
          </div>
          <div style={{ marginTop: 6, display: "grid", gap: 6 }}>
            {selectedDayRehearsals.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Нет репетиций в этот день.</div>
            ) : (
              selectedDayRehearsals.map((r) => (
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
                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                    {new Date(r.startsAt).toLocaleString("ru-RU")}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {error && <div className="settings-invite-error">{error}</div>}
        {ok && <div style={{ color: "#7ee787", fontSize: 13 }}>{ok}</div>}

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={async () => {
              if (!accessToken) return;
              setSaving(true);
              setError(null);
              setOk(null);
              try {
                const next = await updateMyProfile(accessToken, normalizedPatch);
                setProfile(next);
                setOk("Сохранено");
              } catch {
                setError("Не удалось сохранить профиль");
              } finally {
                setSaving(false);
              }
            }}
            disabled={saving}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
        </div>
      </div>
          </div>
        </main>
      </div>
    </div>
  );
}

