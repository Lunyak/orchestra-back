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

type AvailabilityStatus = "present" | "absent";

function isoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function startOfWeekMonday(now: Date): Date {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const jsDay = d.getDay();
  const diff = jsDay === 0 ? -6 : 1 - jsDay;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export function ProfilePage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [form, setForm] = useState<Partial<MyProfile>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [calendarWeekStart, setCalendarWeekStart] = useState(() =>
    isoDate(startOfWeekMonday(new Date())),
  );
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));
  const [weekRehearsals, setWeekRehearsals] = useState<Rehearsal[]>([]);
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

  const weekStartDate = useMemo(() => {
    const [y, m, d] = calendarWeekStart.split("-").map((x) => Number(x));
    const dt = y && m && d ? new Date(y, m - 1, d) : startOfWeekMonday(new Date());
    dt.setHours(0, 0, 0, 0);
    return dt;
  }, [calendarWeekStart]);

  const fromIso = useMemo(() => weekStartDate.toISOString(), [weekStartDate]);
  const toIso = useMemo(() => addDays(weekStartDate, 7).toISOString(), [weekStartDate]);

  useEffect(() => {
    if (!accessToken || !projectName) {
      setWeekRehearsals([]);
      return;
    }
    setCalendarError(null);
    listRehearsals(accessToken, projectName, fromIso, toIso)
      .then((res) => setWeekRehearsals(res.rehearsals ?? []))
      .catch(() => {
        setWeekRehearsals([]);
        setCalendarError("Не удалось загрузить события репетиций");
      });
  }, [accessToken, fromIso, projectName, toIso]);

  const availabilityCalendar = useMemo(
    () => (form.availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>,
    [form.availabilityCalendar],
  );

  const rehearsalsByDate = useMemo(() => {
    const grouped = new Map<string, Rehearsal[]>();
    for (const rehearsal of weekRehearsals) {
      const date = isoDate(new Date(rehearsal.startsAt));
      const arr = grouped.get(date);
      if (arr) arr.push(rehearsal);
      else grouped.set(date, [rehearsal]);
    }
    return grouped;
  }, [weekRehearsals]);

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
            Клик по дню: свободен → занят → не отмечено. События репетиций подтягиваются снизу.
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <label style={{ display: "grid", gap: 4, fontSize: 12, opacity: 0.8 }}>
              <span>Неделя с</span>
              <input
                className="settings-invite-input"
                value={calendarWeekStart}
                onChange={(e) => setCalendarWeekStart(e.target.value)}
                style={{ maxWidth: 180 }}
              />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, minmax(0, 1fr))", gap: 8 }}>
            {Array.from({ length: 7 }, (_, idx) => {
              const dateObj = addDays(weekStartDate, idx);
              const date = isoDate(dateObj);
              const status = availabilityCalendar[date];
              const dayRehearsals = rehearsalsByDate.get(date) ?? [];
              const active = date === selectedDate;
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
                    borderRadius: 10,
                    border: active ? "1px solid rgba(120, 180, 255, 0.7)" : "1px solid rgba(255, 255, 255, 0.14)",
                    padding: "8px 6px",
                    background: baseBg,
                    color: "inherit",
                    cursor: "pointer",
                    display: "grid",
                    gap: 4,
                    textAlign: "center",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{formatDateLabel(dateObj)}</div>
                  <div style={{ fontSize: 11, opacity: 0.85 }}>
                    {status === "present" ? "свободен" : status === "absent" ? "занят" : "—"}
                  </div>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>
                    {dayRehearsals.length ? `репетиций: ${dayRehearsals.length}` : "репетиций нет"}
                  </div>
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

