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
import { CalendarSection, type CalendarSectionState } from "../../components/calendar/CalendarSection";

dayjs.extend(isoWeek);
dayjs.locale("ru");

type AvailabilityStatus = "present" | "absent";
type AvailabilityTimeRange = { from: string; to: string };

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function toMinutesHHMM(v: string): number | null {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.floor(min)));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function ProfilePage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<Partial<MyProfile>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [calendarState, setCalendarState] = useState<CalendarSectionState>(() => {
    const now = new Date();
    const monthStartDate = dayjs(now).startOf("month").toDate();
    const monthEndDate = dayjs(now).endOf("month").toDate();
    return {
      currentMonth: now,
      selectedDate: isoDate(now),
      monthStartDate,
      monthEndDate,
      fromIso: monthStartDate.toISOString(),
      toIso: monthEndDate.toISOString(),
    };
  });
  const [monthRehearsals, setMonthRehearsals] = useState<Rehearsal[]>([]);
  const [calendarError, setCalendarError] = useState<string | null>(null);

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
      availabilityTimeRanges: profile?.availabilityTimeRanges ?? {},
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

    const inputRanges = (form as any).availabilityTimeRanges as
      | Record<string, AvailabilityTimeRange[]>
      | undefined;
    const cleanRanges: Record<string, AvailabilityTimeRange[]> = {};
    if (inputRanges && typeof inputRanges === "object") {
      for (const [date, list] of Object.entries(inputRanges)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        if (!Array.isArray(list)) continue;
        const ranges: Array<{ a: number; b: number }> = [];
        for (const it of list.slice(0, 20)) {
          const from = toMinutesHHMM(String((it as any)?.from ?? ""));
          const to = toMinutesHHMM(String((it as any)?.to ?? ""));
          if (from == null || to == null) continue;
          if (from >= to) continue;
          ranges.push({ a: from, b: to });
        }
        if (ranges.length === 0) continue;
        ranges.sort((x, y) => x.a - y.a || x.b - y.b);
        const merged: Array<{ a: number; b: number }> = [];
        for (const r of ranges) {
          const last = merged[merged.length - 1];
          if (!last || r.a > last.b) merged.push({ ...r });
          else last.b = Math.max(last.b, r.b);
        }
        cleanRanges[date] = merged.map((r) => ({ from: minutesToHHMM(r.a), to: minutesToHHMM(r.b) }));
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
      availabilityTimeRanges: cleanRanges,
    } as Partial<MyProfile>;
  }, [form]);

  useEffect(() => {
    if (!accessToken || !projectName) {
      setMonthRehearsals([]);
      return;
    }
    setCalendarError(null);
    listRehearsals(accessToken, projectName, calendarState.fromIso, calendarState.toIso)
      .then((res) => setMonthRehearsals(res.rehearsals ?? []))
      .catch(() => {
        setMonthRehearsals([]);
        setCalendarError("Не удалось загрузить события репетиций");
      });
  }, [accessToken, calendarState.fromIso, projectName, calendarState.toIso]);

  const availabilityCalendar = useMemo(
    () => (form.availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>,
    [form.availabilityCalendar],
  );

  const availabilityTimeRanges = useMemo(
    () =>
      ((form as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>,
    [form],
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
    return (monthRehearsals ?? [])
      .filter((r) =>
        (r.participants ?? []).some((p) => String(p.email ?? "").trim().toLowerCase() === email),
      )
      .slice()
      .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
  }, [monthRehearsals, profile?.email]);

  const dotsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [date, list] of rehearsalsByDate.entries()) {
      out[date] = list.length;
    }
    return out;
  }, [rehearsalsByDate]);

  const toggleDayStatus = (date: string) => {
    const current = availabilityCalendar[date];
    const next: AvailabilityStatus | undefined =
      current === "present" ? "absent" : current === "absent" ? undefined : "present";
    setForm((prev) => {
      const currentCalendar = {
        ...((prev.availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>),
      };
      const currentRanges = {
        ...(((prev as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>),
      };
      if (next) currentCalendar[date] = next;
      else delete currentCalendar[date];
      // If user marks the day as "absent" or clears it — drop time windows to avoid confusion.
      if (next !== "present") delete currentRanges[date];
      return { ...(prev as any), availabilityCalendar: currentCalendar, availabilityTimeRanges: currentRanges };
    });
  };

  const setTimeRangesForDate = (date: string, ranges: AvailabilityTimeRange[]) => {
    setForm((prev) => {
      const currentRanges = {
        ...(((prev as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>),
      };
      if (ranges.length > 0) currentRanges[date] = ranges;
      else delete currentRanges[date];

      // If we have any time windows — day is implicitly "present" (unless explicitly absent by user later).
      const currentCalendar = {
        ...((prev.availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>),
      };
      currentCalendar[date] = "present";
      return { ...(prev as any), availabilityTimeRanges: currentRanges, availabilityCalendar: currentCalendar };
    });
  };

  const selectedDate = calendarState.selectedDate;
  const selectedRanges = availabilityTimeRanges[selectedDate] ?? [];

  if (!accessToken) return <div>Нужно войти, чтобы редактировать профиль.</div>;

  return (
    <div className="app-layout profile-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="profile-view">
            <h2>Профиль</h2>
            <p className="profile-subtitle">
              Email: <b>{profile?.email ?? "—"}</b>
            </p>

            <div className="profile-form">
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

              <div className="profile-form-row">
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

              <div className="profile-form-row">
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

          <CalendarSection
            storageMonthKey="profile-calendar-month"
            onStateChange={setCalendarState}
            onDayClick={(date) => toggleDayStatus(date)}
            statusByDate={availabilityCalendar}
            dotsByDate={dotsByDate}
          />
          {calendarError && <div className="settings-invite-error" style={{ marginTop: 8 }}>{calendarError}</div>}

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
              Свободное время на {selectedDate}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
              Если указать диапазоны — они будут учитываться при планировании слотов сессии.
              Время локальное (как на твоём компьютере).
            </div>
            {selectedRanges.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7 }}>Не задано (если день “свободен” — считается весь день).</div>
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
                        setTimeRangesForDate(selectedDate, next);
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
                        setTimeRangesForDate(selectedDate, next);
                      }}
                      style={{ maxWidth: 140 }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const next = selectedRanges.slice();
                        next.splice(idx, 1);
                        setTimeRangesForDate(selectedDate, next);
                      }}
                    >
                      Удалить
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => {
                  const next = [...selectedRanges, { from: "19:00", to: "21:00" }];
                  setTimeRangesForDate(selectedDate, next);
                }}
              >
                + Добавить диапазон
              </button>
              {selectedRanges.length > 0 ? (
                <button type="button" onClick={() => setTimeRangesForDate(selectedDate, [])}>
                  Очистить время
                </button>
              ) : null}
            </div>
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Мои репетиции на {calendarState.selectedDate}:
          </div>
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
                  <div style={{ fontSize: 11, opacity: 0.75 }}>
                    {new Date(r.startsAt).toLocaleString("ru-RU")}
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.8 }}>
            Мои репетиции в этом месяце:
          </div>
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

              <div className="profile-actions">
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

