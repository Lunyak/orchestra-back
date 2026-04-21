import { Button } from "@shared/core/button/Button";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Fragment, useEffect, useMemo, useState } from "react";
import { useProject } from "../../features/project";
import {
  fetchMyTroupe,
  troupeAddMember,
  troupeInviteMemberToProject,
  troupeRemoveMember,
} from "../../features/troupe/model/troupe-slice";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import "./style.css";
import { div } from "three/tsl";

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
  const { projectName, projects } = useProject();
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
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const inviteProjectStorageKey = "troupe-invite-project";
  const [inviteProjectSlug, setInviteProjectSlug] = useState<string>(() => {
    try {
      return (typeof window !== "undefined" ? localStorage.getItem(inviteProjectStorageKey) : null) || "";
    } catch {
      return "";
    }
  });
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

  const availableProjects = useMemo(() => (Array.isArray(projects) ? projects : []).filter(Boolean), [projects]);
  useEffect(() => {
    const preferred =
      (inviteProjectSlug && availableProjects.includes(inviteProjectSlug) ? inviteProjectSlug : "") ||
      (projectName && availableProjects.includes(projectName) ? projectName : "") ||
      availableProjects[0] ||
      "";
    if (preferred !== inviteProjectSlug) setInviteProjectSlug(preferred);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectName, availableProjects.join("|")]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!inviteProjectSlug) return;
      localStorage.setItem(inviteProjectStorageKey, inviteProjectSlug);
    } catch {
      // ignore
    }
  }, [inviteProjectSlug]);

  const selectedMember = useMemo(
    () => (selectedMemberId ? members.find((m) => m.id === selectedMemberId) ?? null : null),
    [members, selectedMemberId],
  );

  useEffect(() => {
    if (!selectedMemberId) return;
    if (!members.some((m) => m.id === selectedMemberId)) setSelectedMemberId(null);
  }, [members, selectedMemberId]);

  if (!accessToken) return <div>Нужно войти, чтобы открыть страницу труппы.</div>;

  return (
    <div className="app-layout troupe-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="troupe-view">
            <div className="troupe-header">
              <div>
                <h2 className="troupe-header__title">Труппа</h2>
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

              <div className="troupe-actions">
                <div className="troupe-actions-left">
                  <span className="troupe-actions-label">Выбран:</span>{" "}
                  {selectedMember ? (
                    <span className="troupe-actions-selected" title={selectedMember.email}>
                      {memberLabel(selectedMember)}
                    </span>
                  ) : (
                    <span className="troupe-actions-selected muted">—</span>
                  )}
                </div>
                <div className="troupe-actions-right">
                  <select
                    className="troupe-project-select"
                    value={inviteProjectSlug}
                    onChange={(e) => setInviteProjectSlug(e.target.value)}
                    disabled={availableProjects.length === 0}
                    title={availableProjects.length === 0 ? "Нет доступных проектов" : "Выбрать проект"}
                  >
                    {availableProjects.length === 0 ? (
                      <option value="">Нет проектов</option>
                    ) : (
                      availableProjects.map((p) => (
                        <option key={p} value={p}>
                          {p === projectName ? `${p} (активный)` : p}
                        </option>
                      ))
                    )}
                  </select>
                  {inviteProjectSlug ? (
                    <Button
                      className="primary"
                      type="button"

                      disabled={!selectedMember || !!invitingIds[selectedMember.id]}
                      onClick={() => {
                        if (!selectedMember) return;
                        dispatch(
                          troupeInviteMemberToProject({
                            memberId: selectedMember.id,
                            email: selectedMember.email,
                            projectSlug: inviteProjectSlug,
                            role: "viewer",
                          }),
                        );
                      }}
                      title={
                        selectedMember
                          ? `Добавить в проект`
                          : "Выбери участника"
                      }
                    >
                      {selectedMember && invitingIds[selectedMember.id] ? "…" : `Добавить в проект`}
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    className="danger"
                    disabled={!selectedMember || !!removingIds[selectedMember.id]}
                    onClick={() => {
                      if (!selectedMember) return;
                      if (!confirm("Удалить участника из труппы?")) return;
                      dispatch(troupeRemoveMember({ memberId: selectedMember.id }));
                    }}
                    title={selectedMember ? "Удалить из труппы" : "Сначала выбери участника в таблице"}
                  >
                    {selectedMember && removingIds[selectedMember.id] ? "…" : "Удалить из труппы"}
                  </Button>
                  <Button
                    type="button"
                    className="primary"
                    disabled={!selectedMemberId}
                    onClick={() => setSelectedMemberId(null)}
                    title="Снять выделение"
                  >
                    Снять выделение
                  </Button>
                </div>
              </div>
              {selectedMember && inviteErrorByMemberId[selectedMember.id] ? (
                <div className="troupe-error">{inviteErrorByMemberId[selectedMember.id]}</div>
              ) : null}

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
                      const isSelected = m.id === selectedMemberId;
                      return (
                        <Fragment key={m.id}>
                          <div
                            key={`${m.id}:label`}
                            className={`troupe-cell troupe-sticky troupe-actor-cell ${isSelected ? "selected" : ""}`}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            onClick={() => setSelectedMemberId((prev) => (prev === m.id ? null : m.id))}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedMemberId((prev) => (prev === m.id ? null : m.id));
                              }
                            }}
                            title={isSelected ? "Снять выделение" : "Выбрать"}
                          >
                            <div style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "center" }}>
                              <MiniAvatar
                                src={String(m.profile?.avatarUrl ?? "").trim() || null}
                                label={label || m.email}
                                size={22}
                              />
                              <div style={{ display: "flex", flexDirection: "column", gap: 2, justifyContent: "center", minWidth: 0 }}>
                                <div className="troupe-actor-name" title={label}>
                                  {label}
                                </div>
                                <div className="troupe-actor-email" title={m.email}>
                                  {m.email}
                                </div>
                              </div>
                            </div>
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
                                className={`troupe-cell troupe-day-cell ${cls} ${isSelected ? "selected" : ""}`}
                                data-selected={isSelected ? "true" : "false"}
                                title={`${day} • ${tooltip}`}
                              />
                            );
                          })}
                        </Fragment>
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
      </div >
    </div >
  );
}

