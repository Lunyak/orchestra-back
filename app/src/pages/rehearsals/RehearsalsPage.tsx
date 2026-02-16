import { useEffect, useMemo, useState } from "react";
import {
  createRehearsal,
  listRehearsals,
  planRehearsal,
  setRehearsalParticipants,
  type Rehearsal,
  type RehearsalParticipantStatus,
} from "../../sync/api";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useTeam } from "../../features/team";
import "./style.css";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import "dayjs/locale/ru";

dayjs.extend(isoWeek);
dayjs.locale("ru");

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function ruDateFromIsoYmd(isoYmd: string): string {
  const d = dayjs(isoYmd, "YYYY-MM-DD", true);
  return d.isValid() ? d.format("DD.MM.YYYY") : isoYmd;
}

function ruShortFromIsoYmd(isoYmd: string): string {
  const d = dayjs(isoYmd, "YYYY-MM-DD", true);
  return d.isValid() ? d.format("DD.MM") : isoYmd;
}

function parseRuOrIsoYmdToIsoYmd(input: string): string | null {
  const s = String(input ?? "").trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!yyyy || mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  const iso = `${String(yyyy).padStart(4, "0")}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  const dt = dayjs(iso, "YYYY-MM-DD", true);
  if (!dt.isValid()) return null;
  return dt.format("YYYY-MM-DD");
}

function startOfWeekMonday(now: Date): Date {
  return dayjs(now).startOf("isoWeek").toDate();
}

function addDays(base: Date, days: number): Date {
  return dayjs(base).add(days, "day").toDate();
}

function normalizeEmail(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

function formatMemberLabel(m: { email: string; displayName?: string | null }): string {
  const name = String(m.displayName ?? "").trim();
  return name ? `${name} (${m.email})` : m.email;
}

export function RehearsalsPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { projectMembers } = useTeam();

  const projectSlug = projectName || "fools";
  const members = useMemo(
    () =>
      (projectMembers ?? []).map((m) => ({
        email: m.user.email,
        displayName: m.user.displayName ?? null,
      })),
    [projectMembers],
  );

  const [{ weekStart, weekStartText }, setWeekState] = useState(() => {
    const saved = localStorage.getItem("rehearsals-calendar-week");
    const iso =
      (saved ? parseRuOrIsoYmdToIsoYmd(saved) : null) ??
      isoDate(startOfWeekMonday(new Date()));
    return { weekStart: iso, weekStartText: ruDateFromIsoYmd(iso) };
  });
  const [activeDay, setActiveDay] = useState(0);

  // Сохраняем выбранную неделю в localStorage
  useEffect(() => {
    localStorage.setItem("rehearsals-calendar-week", weekStart);
  }, [weekStart]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(null);
  const activeRehearsal = useMemo(
    () => rehearsals.find((r) => r.id === activeRehearsalId) ?? rehearsals[0] ?? null,
    [activeRehearsalId, rehearsals],
  );

  const weekStartDate = useMemo(() => {
    const [y, m, d] = weekStart.split("-").map((x) => Number(x));
    const dt = y && m && d ? new Date(y, m - 1, d) : startOfWeekMonday(new Date());
    dt.setHours(0, 0, 0, 0);
    return dt;
  }, [weekStart]);

  const fromIso = useMemo(() => new Date(weekStartDate).toISOString(), [weekStartDate]);
  const toIso = useMemo(() => new Date(addDays(weekStartDate, 7)).toISOString(), [weekStartDate]);

  const dayLabels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const rehearsalsForActiveDay = useMemo(() => {
    const dayStart = addDays(weekStartDate, activeDay);
    const nextDay = addDays(weekStartDate, activeDay + 1);
    const a = dayStart.getTime();
    const b = nextDay.getTime();
    return rehearsals.filter((r) => {
      const t = new Date(r.startsAt).getTime();
      return t >= a && t < b;
    });
  }, [activeDay, rehearsals, weekStartDate]);

  const participantsMap = useMemo(() => {
    const map = new Map<string, RehearsalParticipantStatus>();
    const ps = activeRehearsal?.participants ?? [];
    ps.forEach((p) => map.set(normalizeEmail(p.email), p.status));
    return map;
  }, [activeRehearsal]);

  const [planCache, setPlanCache] = useState<Record<string, { notReady: number }>>({});

  useEffect(() => {
    if (!accessToken || !projectSlug) return;
    setLoading(true);
    setError(null);
    listRehearsals(accessToken, projectSlug, fromIso, toIso)
      .then((res) => {
        setRehearsals(res.rehearsals ?? []);
        setActiveRehearsalId((prev) => prev ?? (res.rehearsals?.[0]?.id ?? null));
      })
      .catch(() => setError("Не удалось загрузить репетиции"))
      .finally(() => setLoading(false));
  }, [accessToken, fromIso, projectSlug, toIso]);

  // Ленивая подгрузка плана (для подсветки карточек репетиций)
  useEffect(() => {
    if (!accessToken) return;
    const ids = rehearsals.map((r) => r.id).filter(Boolean);
    const missing = ids.filter((id) => planCache[id] == null);
    if (missing.length === 0) return;
    let cancelled = false;
    Promise.all(
      missing.slice(0, 20).map(async (id) => {
        const data = await planRehearsal(accessToken, id);
        const notReady = (data.items ?? []).filter((x: any) => !x.ready).length;
        return { id, notReady };
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        setPlanCache((p) => {
          const next = { ...p };
          rows.forEach((r) => (next[r.id] = { notReady: r.notReady }));
          return next;
        });
      })
      .catch(() => {})
      .finally(() => {});
    return () => {
      cancelled = true;
    };
  }, [accessToken, planCache, rehearsals]);

  const createForDay = async () => {
    if (!accessToken) return;
    const date = isoDate(addDays(weekStartDate, activeDay));
    const startsAt = new Date(`${date}T19:00:00`).toISOString();
    const created = await createRehearsal(accessToken, {
      projectSlug,
      title: "Репетиция",
      startsAt,
      durationMin: 120,
    });
    setRehearsals((prev) =>
      [...prev, created].sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt)),
    );
    setActiveRehearsalId(created.id);

    await setRehearsalParticipants(accessToken, created.id, {
      participants: members.map((m) => ({ email: m.email, status: "unknown" as const })),
    });
  };

  const setStatus = async (email: string, status: RehearsalParticipantStatus) => {
    if (!accessToken || !activeRehearsal) return;
    const nextParticipants = members.map((m) => {
      const e = normalizeEmail(m.email);
      const current = participantsMap.get(e) ?? "unknown";
      return { email: m.email, status: e === normalizeEmail(email) ? status : current };
    });
    const updated = await setRehearsalParticipants(accessToken, activeRehearsal.id, {
      participants: nextParticipants,
    });
    setRehearsals((prev) => prev.map((r) => (r.id === updated?.id ? (updated as any) : r)));
    setPlanCache((p) => {
      const next = { ...p };
      delete next[activeRehearsal.id];
      return next;
    });
  };

  if (!accessToken) return <div className="rehearsals-muted">Нужно войти.</div>;

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="rehearsals-page">
      <div className="rehearsals-head">
        <h2 className="rehearsals-title">Репетиции</h2>
        <div className="rehearsals-meta">Проект: {projectSlug || "—"}</div>
      </div>

      {error && <div className="rehearsals-error">{error}</div>}

      <div className="rehearsals-layout">
        <div className="rehearsals-main">
          <div className="rehearsals-week">
            {dayLabels.map((lbl, idx) => {
              const date = isoDate(addDays(weekStartDate, idx));
              const count = rehearsals.filter((r) => isoDate(new Date(r.startsAt)) === date).length;
              const active = idx === activeDay;
              return (
                <button
                  key={lbl}
                  type="button"
                  className={`rehearsals-day ${active ? "active" : ""}`}
                  onClick={() => setActiveDay(idx)}
                  title={ruDateFromIsoYmd(date)}
                >
                  <div className="rehearsals-day-top">{lbl}</div>
                  <div className="rehearsals-day-bottom">
                    {ruShortFromIsoYmd(date)}{count ? ` · ${count}` : ""}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="rehearsals-toolbar">
            <label className="rehearsals-tool">
              <span>Неделя с</span>
              <input
                value={weekStartText}
                onChange={(e) => {
                  const raw = e.target.value;
                  const iso = parseRuOrIsoYmdToIsoYmd(raw);
                  setWeekState((prev) => ({
                    weekStart: iso ?? prev.weekStart,
                    weekStartText: iso ? ruDateFromIsoYmd(iso) : raw,
                  }));
                }}
                placeholder="ДД.ММ.ГГГГ"
              />
            </label>
            <button type="button" onClick={createForDay} disabled={loading}>
              + Создать репетицию
            </button>
          </div>

          <div className="rehearsals-list">
            {loading ? (
              <div className="rehearsals-muted">Загрузка…</div>
            ) : rehearsalsForActiveDay.length === 0 ? (
              <div className="rehearsals-muted">На этот день репетиций нет.</div>
            ) : (
              rehearsalsForActiveDay.map((r) => {
                const t = new Date(r.startsAt);
                const hh = String(t.getHours()).padStart(2, "0");
                const mm = String(t.getMinutes()).padStart(2, "0");
                const notReady = planCache[r.id]?.notReady ?? null;
                const isBad = notReady != null && notReady > 0;
                return (
                  <button
                    key={r.id}
                    type="button"
                    className={`rehearsals-item ${activeRehearsal?.id === r.id ? "active" : ""} ${
                      isBad ? "bad" : ""
                    }`}
                    onClick={() => setActiveRehearsalId(r.id)}
                    title={isBad ? `Не собирается шагов: ${notReady}` : undefined}
                  >
                    <div className="rehearsals-item-title">
                      {hh}:{mm} · {r.title}
                    </div>
                    <div className="rehearsals-item-meta">
                      {notReady == null ? "План…" : isBad ? `Не собирается: ${notReady}` : "Собирается"}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <aside className="rehearsals-side">
          {!activeRehearsal ? (
            <div className="rehearsals-card">
              <div className="rehearsals-muted">Выбери репетицию слева.</div>
            </div>
          ) : (
            <div className="rehearsals-card">
              <div className="rehearsals-card-title">{activeRehearsal.title}</div>
              <div className="rehearsals-card-sub">
                {dayjs(activeRehearsal.startsAt).format("DD.MM.YYYY HH:mm")}
              </div>

              <div className="rehearsals-section">
                <div className="rehearsals-section-title">Кто придёт</div>
                <div className="rehearsals-people">
                  {members.map((m) => {
                    const st = participantsMap.get(normalizeEmail(m.email)) ?? "unknown";
                    return (
                      <div key={m.email} className="rehearsals-person">
                        <div className="rehearsals-person-label">{formatMemberLabel(m)}</div>
                        <select
                          value={st}
                          onChange={(e) =>
                            setStatus(m.email, e.target.value as RehearsalParticipantStatus)
                          }
                        >
                          <option value="unknown">?</option>
                          <option value="present">придёт</option>
                          <option value="absent">не придёт</option>
                        </select>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rehearsals-section">
                <div className="rehearsals-section-title">Что не собирается</div>
                <RehearsalPlanBlock accessToken={accessToken} rehearsalId={activeRehearsal.id} />
              </div>
            </div>
          )}
        </aside>
      </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function RehearsalPlanBlock({
  accessToken,
  rehearsalId,
}: {
  accessToken: string | null;
  rehearsalId: string;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken || !rehearsalId) return;
    setLoading(true);
    setError(null);
    planRehearsal(accessToken, rehearsalId)
      .then((res) => setData(res))
      .catch(() => setError("Не удалось посчитать план"))
      .finally(() => setLoading(false));
  }, [accessToken, rehearsalId]);

  if (!accessToken) return <div className="rehearsals-muted">Нужно войти.</div>;
  if (loading) return <div className="rehearsals-muted">Считаю…</div>;
  if (error) return <div className="rehearsals-error">{error}</div>;
  const items = (data?.items ?? []) as Array<{ ready: boolean; stepTitle: string; missing: string[] }>;
  const bad = items.filter((x) => !x.ready);
  if (bad.length === 0) return <div className="rehearsals-muted">Собирается.</div>;
  return (
    <div className="rehearsals-plan">
      {bad.slice(0, 30).map((x, idx) => (
        <div key={idx} className="rehearsals-problem">
          <div className="rehearsals-problem-title">{x.stepTitle}</div>
          <div className="rehearsals-problem-meta">{x.missing.slice(0, 2).join(" · ")}</div>
        </div>
      ))}
    </div>
  );
}

