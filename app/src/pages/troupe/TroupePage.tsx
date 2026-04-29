import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { Fragment, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { useProject } from "../../features/project";
import {
  fetchMyTroupe,
  troupeAddMember,
  troupeInviteMemberToProject,
  troupePatchTitle,
  troupeRemoveMember,
} from "../../features/troupe/model/troupe-slice";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
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

const TROUPE_NARROW_MQ = "(max-width: 720px)";

function useTroupeNarrowLayout(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia(TROUPE_NARROW_MQ);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => (typeof window !== "undefined" ? window.matchMedia(TROUPE_NARROW_MQ).matches : false),
    () => false,
  );
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
  const patchingTitle = useAppSelector((s) => s.troupe.patchingTitle);
  const patchTitleError = useAppSelector((s) => s.troupe.patchTitleError);

  const [titleDraft, setTitleDraft] = useState("");
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

  const narrowLayout = useTroupeNarrowLayout();

  useEffect(() => {
    if (!accessToken) return;
    dispatch(fetchMyTroupe());
  }, [accessToken, dispatch]);

  useEffect(() => {
    if (troupe?.title != null) setTitleDraft(troupe.title);
  }, [troupe?.id, troupe?.title]);

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

  const gridTemplateColumns = useMemo(
    () => `var(--troupe-label-w, 240px) repeat(${days.length}, var(--troupe-day-w, 28px))`,
    [days.length],
  );

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
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Название труппы</div>
              {!loading && !troupe ? (
                <p className="troupe-hint">
                  Своей труппы пока нет — запись и чат появятся после того, как вы добавите первого участника по
                  email в блоке ниже. Чаты трупп, куда вас пригласили другие, доступны сразу.
                </p>
              ) : (
                <p className="troupe-hint">
                  Так же подписывается чат труппы в панели справа.
                </p>
              )}
              <FormInlineRow className="troupe-form-row">
                <InlineTextField
                  className="troupe-title-field"
                  value={titleDraft}
                  onChange={(e) => setTitleDraft(e.target.value)}
                  placeholder="Например, Студия «Гоголь-центр»"
                  maxLength={120}
                  disabled={loading || !troupe}
                  aria-label="Название труппы"
                />
                <Button
                  type="button"
                  variant="primary"
                  disabled={
                    patchingTitle ||
                    !troupe ||
                    !titleDraft.trim() ||
                    titleDraft.trim() === (troupe?.title ?? "").trim()
                  }
                  onClick={() => void dispatch(troupePatchTitle({ title: titleDraft }))}
                >
                  {patchingTitle ? "Сохранение…" : "Сохранить"}
                </Button>
              </FormInlineRow>
              {patchTitleError ? <div className="troupe-error">{patchTitleError}</div> : null}
            </div>

            <div className="troupe-card troupe-invite-card">
              <div className="troupe-invite-card__title">
                <span className="troupe-invite-card__title-desktop">Добавить в труппу по email</span>
                <span className="troupe-invite-card__title-mobile">Пригласить по email</span>
              </div>
              <FormInlineRow className="troupe-form-row troupe-form-row--invite-email">
                <InlineTextField
                  className="troupe-invite-email-field"
                  placeholder="actor@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  inputMode="email"
                  autoComplete="email"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  className="troupe-form-row__btn troupe-invite-card__submit"
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
              </FormInlineRow>
              {addError ? <div className="troupe-error">{addError}</div> : null}
              {error ? <div className="troupe-error">{error}</div> : null}
              <p className="troupe-hint troupe-hint--after-form troupe-invite-card__hint">
                Занятость берётся из профиля актёра: календарь (свободен/занят) + при желании интервалы времени.
              </p>
            </div>

            <div className="troupe-card troupe-schedule-card">
              <div className="troupe-scale-head">
                <div className="troupe-scale-head__titleblock">
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Шкала занятости</div>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>
                    Месяц: <b>{monthKey(currentMonth)}</b>
                  </div>
                </div>
                <div className="troupe-scale-toolbar">
                  <div className="troupe-month-nav">
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
                  </div>
                  <div className="troupe-legend">
                    <span className="troupe-legend-item">
                      <span className="troupe-dot free" /> свободен
                    </span>
                    <span className="troupe-legend-item">
                      <span className="troupe-dot partial" />
                      <span className="troupe-legend-desktop">свободен (время)</span>
                      <span className="troupe-legend-mobile">по времени</span>
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
                      {selectedMember && invitingIds[selectedMember.id]
                        ? "…"
                        : narrowLayout
                          ? "В проект"
                          : "Добавить в проект"}
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
                    {selectedMember && removingIds[selectedMember.id]
                      ? "…"
                      : narrowLayout
                        ? "Удалить"
                        : "Удалить из труппы"}
                  </Button>
                  <Button
                    type="button"
                    className="primary"
                    disabled={!selectedMemberId}
                    onClick={() => setSelectedMemberId(null)}
                    title="Снять выделение"
                  >
                    {narrowLayout ? "Сбросить" : "Снять выделение"}
                  </Button>
                </div>
              </div>
              {selectedMember && inviteErrorByMemberId[selectedMember.id] ? (
                <div className="troupe-error">{inviteErrorByMemberId[selectedMember.id]}</div>
              ) : null}

              <p className="troupe-schedule-scroll-hint">
                Листайте таблицу вправо, чтобы увидеть все дни месяца.
              </p>

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
                            <div className="troupe-actor-row">
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
              <p className="troupe-calendar-hint troupe-calendar-hint--desktop">
                Подсказка: наведите на день, чтобы увидеть детали (занят / свободен / интервалы).
              </p>
              <p className="troupe-calendar-hint troupe-calendar-hint--mobile">
                Подсказка: удерживайте палец на ячейке дня, чтобы увидеть подсказку с деталями.
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

