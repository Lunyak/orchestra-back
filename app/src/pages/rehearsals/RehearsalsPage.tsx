import { useEffect, useMemo, useState } from "react";
import {
  createRehearsal,
  getRehearsal,
  listRehearsals,
  planRehearsal,
  publishRehearsal,
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
import { CalendarSection, type CalendarSectionState } from "../../components/calendar/CalendarSection";

dayjs.extend(isoWeek);
dayjs.locale("ru");

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
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
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeRehearsalId, setActiveRehearsalId] = useState<string | null>(null);
  const activeRehearsal = useMemo(
    () => rehearsals.find((r) => r.id === activeRehearsalId) ?? rehearsals[0] ?? null,
    [activeRehearsalId, rehearsals],
  );

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

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

  const dotsByDate = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [date, list] of rehearsalsByDate.entries()) out[date] = list.length;
    return out;
  }, [rehearsalsByDate]);

  const rehearsalsForSelectedDay = rehearsalsByDate.get(calendarState.selectedDate) ?? [];

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
    setCalendarError(null);
    listRehearsals(accessToken, projectSlug, calendarState.fromIso, calendarState.toIso)
      .then((res) => {
        setRehearsals(res.rehearsals ?? []);
        setActiveRehearsalId((prev) => prev ?? (res.rehearsals?.[0]?.id ?? null));
      })
      .catch(() => {
        setError("Не удалось загрузить репетиции");
        setCalendarError("Не удалось загрузить события репетиций");
      })
      .finally(() => setLoading(false));
  }, [accessToken, calendarState.fromIso, projectSlug, calendarState.toIso]);

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

  const createForSelectedDate = async () => {
    if (!accessToken) return;
    const startsAt = new Date(`${calendarState.selectedDate}T19:00:00`).toISOString();
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

  const doPublish = async () => {
    if (!accessToken || !activeRehearsal) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await publishRehearsal(accessToken, activeRehearsal.id);

      // Публикация асинхронная: бот отметит published через /bot/rehearsals/:id/published.
      // Подождём немного и подтянем репетицию с telegramMessageId.
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((r) => setTimeout(r, 1200));
        const fresh = await getRehearsal(accessToken, activeRehearsal.id);
        setRehearsals((prev) => prev.map((x) => (x.id === fresh.id ? fresh : x)));
        if (fresh.telegramMessageId || fresh.publishedAt) break;
      }
    } catch {
      setPublishError("Не удалось опубликовать репетицию в чат");
    } finally {
      setPublishing(false);
    }
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
          <div className="rehearsals-toolbar">
            <button type="button" onClick={createForSelectedDate} disabled={loading}>
              + Создать репетицию
            </button>
          </div>

          <CalendarSection
            storageMonthKey="rehearsals-calendar-month"
            onStateChange={setCalendarState}
            dotsByDate={dotsByDate}
            title="Календарь репетиций"
            subtitle="Клик по дню: выбрать дату. Репетиции на дате показываются точками."
          />
          {calendarError && (
            <div className="rehearsals-error" style={{ marginTop: 10 }}>
              {calendarError}
            </div>
          )}

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
            Репетиции на {calendarState.selectedDate}:
          </div>
          <div className="rehearsals-list">
            {loading ? (
              <div className="rehearsals-muted">Загрузка…</div>
            ) : rehearsalsForSelectedDay.length === 0 ? (
              <div className="rehearsals-muted">На этот день репетиций нет.</div>
            ) : (
              rehearsalsForSelectedDay.map((r) => {
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
                <div className="rehearsals-section-title">Публикация в чат</div>
                <div style={{ display: "grid", gap: 8 }}>
                  <button
                    type="button"
                    onClick={doPublish}
                    disabled={publishing || !!activeRehearsal.telegramMessageId}
                    title={
                      activeRehearsal.telegramMessageId
                        ? "Уже опубликовано"
                        : "Опубликовать репетицию в Telegram-чате"
                    }
                  >
                    {activeRehearsal.telegramMessageId
                      ? "Опубликовано"
                      : publishing
                        ? "Публикую…"
                        : "Опубликовать в чат"}
                  </button>
                  {activeRehearsal.publishedAt && (
                    <div className="rehearsals-muted">
                      Опубликовано: {dayjs(activeRehearsal.publishedAt).format("DD.MM.YYYY HH:mm")}
                    </div>
                  )}
                  {publishError && <div className="rehearsals-error">{publishError}</div>}
                </div>
              </div>

              <div className="rehearsals-section">
                <div className="rehearsals-section-title">Кто придёт</div>
                <div className="rehearsals-people">
                  {members.map((m) => {
                    const st = participantsMap.get(normalizeEmail(m.email)) ?? "unknown";
                    const meta = (activeRehearsal.participants ?? []).find(
                      (p) => normalizeEmail(p.email) === normalizeEmail(m.email),
                    );
                    return (
                      <div key={m.email} className="rehearsals-person">
                        <div className="rehearsals-person-label">{formatMemberLabel(m)}</div>
                        {meta?.respondedAt && (
                          <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                            ответ: {dayjs(meta.respondedAt).format("DD.MM HH:mm")}
                          </div>
                        )}
                        <select
                          value={st}
                          onChange={(e) =>
                            setStatus(m.email, e.target.value as RehearsalParticipantStatus)
                          }
                        >
                          <option value="unknown">?</option>
                          <option value="present">придёт</option>
                          <option value="absent">не придёт</option>
                          <option value="late">свое время</option>
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

