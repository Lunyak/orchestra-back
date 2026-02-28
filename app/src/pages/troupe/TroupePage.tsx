import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import {
  fetchMyTroupe,
  troupeAddMember,
  troupeInviteMemberToProject,
  troupeRemoveMember,
} from "../../features/troupe/model/troupe-slice";
import { useProject } from "../../features/project";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import "./style.css";

dayjs.locale("ru");

function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

function monthKey(d: Date): string {
  return dayjs(d).format("YYYY-MM");
}

function memberLabel(m: {
  email: string;
  profile: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
}): string {
  const p = m.profile;
  const display = String(p?.displayName ?? "").trim();
  if (display) return display;
  const full = `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim();
  if (full) return full;
  return m.email;
}

export function TroupePage() {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const troupe = useAppSelector((s) => s.troupe.troupe);
  const members = useAppSelector((s) => s.troupe.members);
  const loading = useAppSelector((s) => s.troupe.loading);
  const error = useAppSelector((s) => s.troupe.error);
  const adding = useAppSelector((s) => s.troupe.adding);
  const addError = useAppSelector((s) => s.troupe.addError);
  const removingIds = useAppSelector((s) => s.troupe.removingIds);
  const invitingIds = useAppSelector((s) => s.troupe.invitingIds);
  const inviteErrorByMemberId = useAppSelector((s) => s.troupe.inviteErrorByMemberId);

  const [email, setEmail] = useState("");
  const [currentMonth, setCurrentMonth] = useState<Date>(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("troupe-month") : null;
    if (saved) {
      const d = new Date(saved);
      if (!isNaN(d.getTime())) return d;
    }
    return new Date();
  });

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyTroupe());
  }, [accessToken, dispatch]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem("troupe-month", currentMonth.toISOString());
    } catch {
      // ignore
    }
  }, [currentMonth]);

  const days = useMemo(() => {
    const start = dayjs(currentMonth).startOf("month");
    const n = start.daysInMonth();
    return Array.from({ length: n }, (_v, i) => start.add(i, "day").toDate());
  }, [currentMonth]);

  const gridTemplateColumns = useMemo(() => {
    // 240px for actor label + fixed day cell widths
    return `240px repeat(${days.length}, 28px)`;
  }, [days.length]);

  if (!accessToken) return <div>Нужно войти, чтобы открыть страницу труппы.</div>;

  return (
    <div className="app-layout troupe-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="troupe-view">
            <div className="troupe-header">
              <div>
                <h2 style={{ margin: 0 }}>Труппа</h2>
                <div style={{ opacity: 0.75, fontSize: 12, marginTop: 4 }}>
                  {troupe ? (
                    <>
                      {troupe.title} • {members.length} участн.
                    </>
                  ) : (
                    "Загрузка…"
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => dispatch(fetchMyTroupe())} disabled={loading}>
                  {loading ? "Обновление…" : "Обновить"}
                </button>
              </div>
            </div>

            <div className="troupe-card">
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Добавить в труппу по email</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <input
                  className="settings-invite-input"
                  placeholder="actor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  style={{ maxWidth: 360 }}
                />
                <button
                  type="button"
                  disabled={adding || !email.trim()}
                  onClick={async () => {
                    const value = email.trim();
                    if (!value) return;
                    const res = await dispatch(troupeAddMember({ email: value }));
                    if (troupeAddMember.fulfilled.match(res)) setEmail("");
                  }}
                >
                  {adding ? "Добавление…" : "Добавить"}
                </button>
              </div>
              {addError ? <div className="troupe-error">{addError}</div> : null}
              {error ? <div className="troupe-error">{error}</div> : null}
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
                Занятость берётся из профиля актёра: календарь (свободен/занят) + при желании интервалы времени.
              </div>
            </div>

            <div className="troupe-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Шкала занятости</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Месяц: <b>{monthKey(currentMonth)}</b>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(dayjs(currentMonth).subtract(1, "month").toDate())}
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrentMonth(dayjs(currentMonth).add(1, "month").toDate())}
                  >
                    →
                  </button>
                  <div className="troupe-legend">
                    <span className="troupe-legend-item">
                      <span className="troupe-dot free" /> свободен
                    </span>
                    <span className="troupe-legend-item">
                      <span className="troupe-dot partial" /> свободен (время)
                    </span>
                    <span className="troupe-legend-item">
                      <span className="troupe-dot busy" /> занят
                    </span>
                    <span className="troupe-legend-item">
                      <span className="troupe-dot unknown" /> не отмечено
                    </span>
                  </div>
                </div>
              </div>

              <div className="troupe-schedule" role="region" aria-label="График занятости труппы">
                <div className="troupe-grid" style={{ gridTemplateColumns }}>
                  <div className="troupe-cell troupe-sticky troupe-header-cell">Актёр</div>
                  {days.map((d) => {
                    const n = dayjs(d).date();
                    const wd = dayjs(d).format("dd");
                    return (
                      <div key={isoDate(d)} className="troupe-cell troupe-header-cell" title={isoDate(d)}>
                        <div style={{ fontSize: 12, fontWeight: 700, lineHeight: "14px" }}>{n}</div>
                        <div style={{ fontSize: 10, opacity: 0.7, lineHeight: "12px" }}>{wd}</div>
                      </div>
                    );
                  })}

                  {members.length === 0 ? (
                    <div className="troupe-cell troupe-empty" style={{ gridColumn: `1 / span ${days.length + 1}` }}>
                      В труппе пока никого нет. Добавьте актёров по email.
                    </div>
                  ) : (
                    members.map((m) => {
                      const label = memberLabel(m);
                      const inviteError = inviteErrorByMemberId[m.id];
                      return (
                        <>
                          <div key={`${m.id}:label`} className="troupe-cell troupe-sticky troupe-actor-cell">
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                              <div style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "center" }}>
                                <MiniAvatar
                                  src={String(m.profile?.avatarUrl ?? "").trim() || null}
                                  label={label || m.email}
                                  size={22}
                                />
                                <div className="troupe-actor-name" title={label}>
                                  {label}
                                </div>
                                <div className="troupe-actor-email" title={m.email}>
                                  {m.email}
                                </div>
                              </div>
                              <div style={{ display: "grid", gap: 6, justifyItems: "end" }}>
                                {projectName ? (
                                  <button
                                    type="button"
                                    className="troupe-mini-btn"
                                    disabled={!!invitingIds[m.id]}
                                    onClick={() =>
                                      dispatch(
                                        troupeInviteMemberToProject({
                                          memberId: m.id,
                                          email: m.email,
                                          projectSlug: projectName,
                                          role: "viewer",
                                        }),
                                      )
                                    }
                                    title={`Добавить в проект ${projectName}`}
                                  >
                                    {invitingIds[m.id] ? "…" : `+ в ${projectName}`}
                                  </button>
                                ) : null}
                                <button
                                  type="button"
                                  className="troupe-mini-btn danger"
                                  disabled={!!removingIds[m.id]}
                                  onClick={() => {
                                    if (!confirm("Удалить участника из труппы?")) return;
                                    dispatch(troupeRemoveMember({ memberId: m.id }));
                                  }}
                                  title="Удалить из труппы"
                                >
                                  {removingIds[m.id] ? "…" : "×"}
                                </button>
                              </div>
                            </div>
                            {inviteError ? <div className="troupe-error" style={{ marginTop: 6 }}>{inviteError}</div> : null}
                          </div>
                          {days.map((d) => {
                            const day = isoDate(d);
                            const cal = m.profile?.availabilityCalendar ?? {};
                            const ranges = (m.profile?.availabilityTimeRanges ?? {})[day] ?? [];
                            const status = (cal as any)?.[day] as "present" | "absent" | undefined;

                            const cls =
                              status === "absent"
                                ? "busy"
                                : ranges.length > 0
                                  ? "partial"
                                  : status === "present"
                                    ? "free"
                                    : "unknown";

                            const tooltip =
                              status === "absent"
                                ? "Занят"
                                : ranges.length > 0
                                  ? `Свободен: ${ranges.map((r) => `${r.from}–${r.to}`).join(", ")}`
                                  : status === "present"
                                    ? "Свободен"
                                    : "Не отмечено";

                            return (
                              <div
                                key={`${m.id}:${day}`}
                                className={`troupe-cell troupe-day-cell ${cls}`}
                                title={`${day} • ${tooltip}`}
                              />
                            );
                          })}
                        </>
                      );
                    })
                  )}
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
                Подсказка: наведите на день, чтобы увидеть детали (занят / свободен / интервалы).
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

