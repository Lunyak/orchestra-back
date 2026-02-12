import { useEffect, useMemo, useState } from "react";
import { listRehearsals, type MyProfile, type Rehearsal } from "../../sync/api";

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

export function ProfilePage({
  accessToken,
  profile,
  onProfileChange,
  onSave,
  projectSlug,
}: {
  accessToken: string | null;
  profile: MyProfile | null;
  onProfileChange: (p: MyProfile | null) => void;
  onSave: (patch: Partial<MyProfile>) => Promise<void>;
  projectSlug: string;
}) {
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

  const email = profile?.email ?? "";
  const canEdit = Boolean(accessToken);

  const normalizedPatch = useMemo(() => {
    const t = (v: unknown) => String(v ?? "").trim();
    const inputCalendar = form.availabilityCalendar;
    const cleanCalendar: Record<string, AvailabilityStatus> = {};
    if (inputCalendar && typeof inputCalendar === "object") {
      for (const [date, status] of Object.entries(inputCalendar)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
        if (status === "present" || status === "absent") cleanCalendar[date] = status;
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
    if (!accessToken || !projectSlug) {
      setWeekRehearsals([]);
      return;
    }
    setCalendarError(null);
    listRehearsals(accessToken, projectSlug, fromIso, toIso)
      .then((res) => setWeekRehearsals(res.rehearsals ?? []))
      .catch(() => {
        setWeekRehearsals([]);
        setCalendarError("Не удалось загрузить события репетиций");
      });
  }, [accessToken, fromIso, projectSlug, toIso]);

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

  return (
    <section>
      <h2>Профиль</h2>
      {!canEdit && (
        <p>Чтобы редактировать профиль, нужно войти в аккаунт.</p>
      )}

      <div style={{ display: "grid", gap: 12, maxWidth: 520 }}>
        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Email</div>
          <input value={email || "—"} disabled style={{ width: "100%" }} />
        </label>

        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Отображаемое имя</div>
          <input
            value={String(form.displayName ?? "")}
            disabled={!canEdit}
            onChange={(e) => setForm((p) => ({ ...p, displayName: e.target.value }))}
            placeholder="например: Сергей"
            style={{ width: "100%" }}
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Имя</div>
            <input
              value={String(form.firstName ?? "")}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Фамилия</div>
            <input
              value={String(form.lastName ?? "")}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram username</div>
            <input
              value={String(form.telegramUsername ?? "")}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, telegramUsername: e.target.value }))}
              placeholder="@username"
              style={{ width: "100%" }}
            />
          </label>
          <label>
            <div style={{ fontSize: 12, opacity: 0.7 }}>Telegram id</div>
            <input
              value={String(form.telegramId ?? "")}
              disabled={!canEdit}
              onChange={(e) => setForm((p) => ({ ...p, telegramId: e.target.value }))}
              placeholder="123456789"
              style={{ width: "100%" }}
            />
          </label>
        </div>

        <label>
          <div style={{ fontSize: 12, opacity: 0.7 }}>Avatar URL</div>
          <input
            value={String(form.avatarUrl ?? "")}
            disabled={!canEdit}
            onChange={(e) => setForm((p) => ({ ...p, avatarUrl: e.target.value }))}
            placeholder="https://..."
            style={{ width: "100%" }}
          />
        </label>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Календарь занятости</div>
          <p style={{ margin: "0 0 10px", opacity: 0.75, fontSize: 12 }}>
            Клик по дню: свободен → занят → не отмечено. События репетиций подтягиваются снизу.
          </p>
          <label style={{ display: "grid", gap: 4, fontSize: 12, opacity: 0.8, marginBottom: 8 }}>
            <span>Неделя с</span>
            <input
              value={calendarWeekStart}
              onChange={(e) => setCalendarWeekStart(e.target.value)}
              style={{ width: 180 }}
            />
          </label>
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
          {calendarError && <div style={{ color: "crimson", marginTop: 8 }}>{calendarError}</div>}
          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>События на {selectedDate}:</div>
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

        {error && <div style={{ color: "crimson" }}>{error}</div>}
        {ok && <div style={{ color: "green" }}>{ok}</div>}

        <div style={{ display: "flex", gap: 12 }}>
          <button
            type="button"
            disabled={!canEdit || saving}
            onClick={async () => {
              if (!canEdit) return;
              setSaving(true);
              setError(null);
              setOk(null);
              try {
                await onSave(normalizedPatch);
                setOk("Сохранено");
              } catch (e) {
                setError("Не удалось сохранить профиль");
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Сохранение..." : "Сохранить"}
          </button>
          <button
            type="button"
            disabled={!canEdit || saving}
            onClick={() => {
              onProfileChange(profile);
              setOk(null);
              setError(null);
            }}
          >
            Отменить
          </button>
        </div>
      </div>
    </section>
  );
}

