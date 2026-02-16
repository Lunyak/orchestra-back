import { useEffect, useMemo, useState } from "react";
import {
  createRehearsal,
  getRehearsal,
  getRehearsalSteps,
  listRehearsals,
  getProfilesBatch,
  planRehearsal,
  publishRehearsal,
  updateRehearsal,
  type Rehearsal,
  type TeamProfile,
  type RehearsalSelectedStep,
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
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);
  const [stepsOptions, setStepsOptions] = useState<
    Array<{ id: string; name: string; steps: Array<{ id: number; title: string }> }>
  >([]);
  const [selectedSteps, setSelectedSteps] = useState<RehearsalSelectedStep[]>([]);
  const [savingSteps, setSavingSteps] = useState(false);
  const [saveStepsError, setSaveStepsError] = useState<string | null>(null);

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

  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    const emails = members.map((m) => normalizeEmail(m.email)).filter(Boolean);
    if (emails.length === 0) {
      setTeamProfiles([]);
      return;
    }
    let cancelled = false;
    getProfilesBatch(accessToken, emails)
      .then((rows) => {
        if (cancelled) return;
        setTeamProfiles(rows ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setTeamProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, members]);

  const teamProfileByEmail = useMemo(() => {
    const map = new Map<string, TeamProfile>();
    for (const p of teamProfiles ?? []) {
      const e = normalizeEmail(p.email);
      if (!e) continue;
      map.set(e, p);
    }
    return map;
  }, [teamProfiles]);

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
        const notReady = data?.selectionRequired
          ? 1
          : (data.items ?? []).filter((x: any) => !x.ready).length;
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

  useEffect(() => {
    if (!accessToken || !activeRehearsal?.id) {
      setStepsOptions([]);
      setSelectedSteps([]);
      return;
    }
    setStepsLoading(true);
    setStepsError(null);
    let cancelled = false;
    getRehearsalSteps(accessToken, activeRehearsal.id)
      .then((res) => {
        if (cancelled) return;
        setStepsOptions(res.scenes ?? []);
        setSelectedSteps(res.selectedSteps ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setStepsOptions([]);
        setSelectedSteps([]);
        setStepsError("Не удалось загрузить список сцен");
      })
      .finally(() => {
        if (!cancelled) setStepsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, activeRehearsal?.id]);

  const toggleStep = (sceneId: string, stepId: number) => {
    setSelectedSteps((prev) => {
      const key = `${sceneId}:${stepId}`;
      const has = prev.some((x) => `${x.sceneId}:${x.stepId}` === key);
      if (has) return prev.filter((x) => `${x.sceneId}:${x.stepId}` !== key);
      return [...prev, { sceneId, stepId }];
    });
  };

  const saveSelectedSteps = async () => {
    if (!accessToken || !activeRehearsal) return;
    setSavingSteps(true);
    setSaveStepsError(null);
    try {
      const updated = await updateRehearsal(accessToken, activeRehearsal.id, {
        selectedSteps,
      });
      setRehearsals((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      setPlanCache((p) => {
        const next = { ...p };
        delete next[activeRehearsal.id];
        return next;
      });
    } catch {
      setSaveStepsError("Не удалось сохранить выбранные сцены");
    } finally {
      setSavingSteps(false);
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
                  <div className="rehearsals-muted" style={{ fontSize: 12 }}>
                    Сначала выбери сцены (шаги) для репетиции. В опрос попадут только те актёры, которые нужны по выбранным сценам и отметили «свободен» в профиле.
                  </div>
                  <button
                    type="button"
                    onClick={doPublish}
                    disabled={
                      publishing ||
                      !!activeRehearsal.telegramMessageId ||
                      !(activeRehearsal.selectedSteps?.length ?? 0)
                    }
                    title={
                      activeRehearsal.telegramMessageId
                        ? "Уже опубликовано"
                        : !(activeRehearsal.selectedSteps?.length ?? 0)
                          ? "Сначала выберите и сохраните сцены (шаги)"
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
                <div className="rehearsals-section-title">Сцены на репетицию</div>
                {stepsLoading ? (
                  <div className="rehearsals-muted">Загрузка…</div>
                ) : stepsError ? (
                  <div className="rehearsals-error">{stepsError}</div>
                ) : stepsOptions.length === 0 ? (
                  <div className="rehearsals-muted">Сцен пока нет.</div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    <div className="rehearsals-muted" style={{ fontSize: 12 }}>
                      Выбрано: {selectedSteps.length}
                    </div>
                    <div style={{ maxHeight: 220, overflow: "auto", paddingRight: 6 }}>
                      {stepsOptions.slice(0, 10).map((sc) => (
                        <div key={sc.id} style={{ marginBottom: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                            {sc.name}
                          </div>
                          <div style={{ display: "grid", gap: 6 }}>
                            {sc.steps.slice(0, 200).map((st) => {
                              const checked = selectedSteps.some(
                                (x) => x.sceneId === sc.id && x.stepId === st.id,
                              );
                              return (
                                <label
                                  key={`${sc.id}:${st.id}`}
                                  style={{ display: "flex", gap: 8, alignItems: "flex-start" }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleStep(sc.id, st.id)}
                                  />
                                  <span style={{ fontSize: 12, lineHeight: 1.2 }}>
                                    {st.id}. {st.title}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={saveSelectedSteps} disabled={savingSteps}>
                      {savingSteps ? "Сохраняю…" : "Сохранить сцены"}
                    </button>
                    {saveStepsError && <div className="rehearsals-error">{saveStepsError}</div>}
                  </div>
                )}
              </div>

              <div className="rehearsals-section">
                <div className="rehearsals-section-title">Кто придёт</div>
                <div className="rehearsals-people">
                  {members.map((m) => {
                    const meta = (activeRehearsal.participants ?? []).find(
                      (p) => normalizeEmail(p.email) === normalizeEmail(m.email),
                    );
                    const dateKey = isoDate(new Date(activeRehearsal.startsAt));
                    const prof = teamProfileByEmail.get(normalizeEmail(m.email));
                    const availability =
                      (prof?.availabilityCalendar as any)?.[dateKey] === "present"
                        ? ("present" as const)
                        : (prof?.availabilityCalendar as any)?.[dateKey] === "absent"
                          ? ("absent" as const)
                          : ("unknown" as const);
                    return (
                      <div key={m.email} className="rehearsals-person">
                        <div className="rehearsals-person-label">{formatMemberLabel(m)}</div>
                        <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                          занятость:{" "}
                          {availability === "present"
                            ? "свободен"
                            : availability === "absent"
                              ? "занят"
                              : "не отмечено"}
                        </div>
                        {meta?.respondedAt && (
                          <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                            ответ: {dayjs(meta.respondedAt).format("DD.MM HH:mm")}
                          </div>
                        )}
                        {meta?.status === "late" && meta?.lateTime && (
                          <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                            будет к: {meta.lateTime}
                          </div>
                        )}
                        {meta?.status && meta.status !== "unknown" && (
                          <div className="rehearsals-muted" style={{ fontSize: 11 }}>
                            по вызову: {meta.status === "present" ? "буду" : meta.status === "absent" ? "не буду" : "свое время"}
                          </div>
                        )}
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
  if (data?.selectionRequired) {
    return <div className="rehearsals-muted">Сначала выбери сцены (шаги) для этой репетиции.</div>;
  }
  const items = (data?.items ?? []) as Array<{
    ready: boolean;
    stepTitle: string;
    sceneName?: string;
    missing: string[];
    availableFromTime?: string;
    lateConstraints?: Array<{ role: string; email: string; availableFromTime: string }>;
    durationMin?: number | null;
  }>;
  const bad = items.filter((x) => !x.ready);
  const good = items
    .filter((x) => x.ready)
    .sort((a, b) => String(a.availableFromTime ?? "").localeCompare(String(b.availableFromTime ?? "")));

  const timeline = data?.timeline as
    | {
        rehearsalStartTime: string;
        rehearsalEndTime: string;
        durationMin: number;
        scheduledMin: number;
        steps: Array<{
          sceneName: string;
          stepTitle: string;
          startTime: string;
          endTime: string;
          durationMin: number;
        }>;
      }
    | null
    | undefined;

  if (bad.length === 0 && good.length === 0) return <div className="rehearsals-muted">Собирается.</div>;
  return (
    <div className="rehearsals-plan">
      {timeline?.steps?.length ? (
        <div style={{ marginBottom: 12 }}>
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Таймлайн ({timeline.rehearsalStartTime}–{timeline.rehearsalEndTime}, всего {timeline.durationMin} мин, запланировано{" "}
            {timeline.scheduledMin} мин):
          </div>
          {timeline.steps.slice(0, 50).map((t, idx) => (
            <div key={`tl-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {t.startTime}–{t.endTime} · {t.sceneName}: {t.stepTitle}
              </div>
              <div className="rehearsals-problem-meta">{t.durationMin} мин</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rehearsals-muted" style={{ marginBottom: 12 }}>
          Таймлайн появится, когда у готовых шагов будет задана длительность (мин).
        </div>
      )}

      {good.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Готовые шаги (с какого времени можно):
          </div>
          {good.slice(0, 20).map((x, idx) => (
            <div key={`g-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {x.availableFromTime ? `с ${x.availableFromTime} · ` : ""}
                {(x.sceneName ? `${x.sceneName}: ` : "") + x.stepTitle}
              </div>
              {!!x.lateConstraints?.length && (
                <div className="rehearsals-problem-meta">
                  {x.lateConstraints
                    .slice(0, 2)
                    .map((c) => `${c.role}: ${c.availableFromTime}`)
                    .join(" · ")}
                </div>
              )}
              {x.durationMin ? (
                <div className="rehearsals-problem-meta">длительность: {x.durationMin} мин</div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {bad.length > 0 && (
        <div>
          <div className="rehearsals-muted" style={{ marginBottom: 6 }}>
            Не собирается:
          </div>
          {bad.slice(0, 30).map((x, idx) => (
            <div key={`b-${idx}`} className="rehearsals-problem">
              <div className="rehearsals-problem-title">
                {(x.sceneName ? `${x.sceneName}: ` : "") + x.stepTitle}
              </div>
              <div className="rehearsals-problem-meta">{x.missing.slice(0, 2).join(" · ")}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

