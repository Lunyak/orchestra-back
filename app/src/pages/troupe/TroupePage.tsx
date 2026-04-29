import { Button } from "@shared/core/button/Button";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import {
  Fragment,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { useProject } from "../../features/project";
import { useTeam } from "../../features/team";
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

function dateFromMonthKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (!Number.isFinite(y) || mo < 0 || mo > 11) return null;
  return new Date(y, mo, 1);
}

function readStoredTroupeMonth(): Date {
  if (typeof window === "undefined") return new Date();
  try {
    const saved = localStorage.getItem("troupe-month");
    if (!saved) return new Date();
    const t = saved.trim();
    const fromKey = dateFromMonthKey(t);
    if (fromKey) return fromKey;
    if (t.includes("T") || t.length > 7) {
      return new Date();
    }
    const legacy = new Date(t);
    return !isNaN(legacy.getTime())
      ? dayjs(legacy).startOf("month").toDate()
      : new Date();
  } catch {
    return new Date();
  }
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
  const full =
    `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim();
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
    () =>
      typeof window !== "undefined"
        ? window.matchMedia(TROUPE_NARROW_MQ).matches
        : false,
    () => false,
  );
}

export function TroupePage() {
  const dispatch = useAppDispatch();
  const { projectName, isProjectsLoaded, projectsLoading } = useProject();
  const { isProjectOwner } = useTeam();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const troupe = useAppSelector((s) => s.troupe.troupe);
  const members = useAppSelector((s) => s.troupe.members);
  const loading = useAppSelector((s) => s.troupe.loading);
  const error = useAppSelector((s) => s.troupe.error);
  const adding = useAppSelector((s) => s.troupe.adding);
  const addError = useAppSelector((s) => s.troupe.addError);
  const removingIds = useAppSelector((s) => s.troupe.removingIds);
  const invitingIds = useAppSelector((s) => s.troupe.invitingIds);
  const inviteErrorByMemberId = useAppSelector(
    (s) => s.troupe.inviteErrorByMemberId,
  );
  const patchingTitle = useAppSelector((s) => s.troupe.patchingTitle);
  const patchTitleError = useAppSelector((s) => s.troupe.patchTitleError);
  const scheduleRefreshing = useAppSelector((s) => s.troupe.scheduleRefreshing);

  const [titleDraft, setTitleDraft] = useState("");
  const [email, setEmail] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedDayIso, setSelectedDayIso] = useState<string | null>(null);
  const [currentMonth, setCurrentMonth] = useState<Date>(() =>
    readStoredTroupeMonth(),
  );

  const narrowLayout = useTroupeNarrowLayout();

  useEffect(() => {
    if (!accessToken) return;
    if (!isProjectsLoaded || projectsLoading) return;
    if (!projectName) return;
    void dispatch(
      fetchMyTroupe({ month: monthKey(currentMonth), project: projectName }),
    );
  }, [
    accessToken,
    currentMonth,
    dispatch,
    isProjectsLoaded,
    projectName,
    projectsLoading,
  ]);

  useEffect(() => {
    if (troupe?.title != null) setTitleDraft(troupe.title);
  }, [troupe?.id, troupe?.title]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      localStorage.setItem("troupe-month", monthKey(currentMonth));
    } catch {
      // ignore
    }
  }, [currentMonth]);

  const days = useMemo(() => {
    const start = dayjs(currentMonth).startOf("month");
    const n = start.daysInMonth();
    return Array.from({ length: n }, (_v, i) => start.add(i, "day").toDate());
  }, [currentMonth]);

  const todayIso = isoDate(new Date());

  useEffect(() => {
    setSelectedDayIso((prev) => {
      if (!prev) return null;
      return days.some((d) => isoDate(d) === prev) ? prev : null;
    });
  }, [currentMonth, days]);

  const selectedMember = useMemo(
    () =>
      selectedMemberId
        ? (members.find((m) => m.id === selectedMemberId) ?? null)
        : null,
    [members, selectedMemberId],
  );

  useEffect(() => {
    if (!selectedMemberId) return;
    if (!members.some((m) => m.id === selectedMemberId))
      setSelectedMemberId(null);
  }, [members, selectedMemberId]);

  if (!accessToken)
    return <div>Нужно войти, чтобы открыть страницу труппы.</div>;

  const canManageProjectTroupe = isProjectOwner === true;

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

            {canManageProjectTroupe ? (
              <div className="troupe-card">
                {!loading && !troupe ? (
                  <p className="troupe-hint">
                    Своей труппы пока нет — запись и чат появятся после того, как
                    вы добавите первого участника по email в блоке ниже. Чаты
                    трупп, куда вас пригласили другие, доступны сразу.
                  </p>
                ) : null}
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
                    onClick={() =>
                      void dispatch(troupePatchTitle({ title: titleDraft }))
                    }
                  >
                    {patchingTitle ? "Сохранение…" : "Сохранить"}
                  </Button>
                </FormInlineRow>
                {patchTitleError ? (
                  <div className="troupe-error">{patchTitleError}</div>
                ) : null}
              </div>
            ) : null}

            <div className="troupe-card troupe-schedule-card">
              <div className="troupe-scale-head">
                <div className="troupe-scale-head__titleblock">
                  <div className="troupe-scale-head__title">
                    Шкала занятости
                  </div>
                  <div className="troupe-scale-head__subtitle">
                    Месяц: <b>{monthKey(currentMonth)}</b>
                    {projectName ? (
                      <>
                        {" "}
                        · проект: <b>{projectName}</b>
                      </>
                    ) : null}
                  </div>
                </div>
                <div className="troupe-scale-toolbar">
                  <div className="troupe-month-nav">
                    <button
                      type="button"
                      aria-label="Предыдущий месяц"
                      onClick={() =>
                        setCurrentMonth(
                          dayjs(currentMonth).subtract(1, "month").toDate(),
                        )
                      }
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      aria-label="Следующий месяц"
                      onClick={() =>
                        setCurrentMonth(
                          dayjs(currentMonth).add(1, "month").toDate(),
                        )
                      }
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
                      <span className="troupe-legend-desktop">
                        свободен (время)
                      </span>
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
                    <span
                      className="troupe-actions-selected"
                      title={selectedMember.email}
                    >
                      {memberLabel(selectedMember)}
                    </span>
                  ) : (
                    <span className="troupe-actions-selected muted">—</span>
                  )}
                </div>
                <div className="troupe-actions-right">
                  {canManageProjectTroupe && projectName ? (
                    <>
                      <Button
                        className="primary"
                        type="button"
                        disabled={
                          !selectedMember || !!invitingIds[selectedMember.id]
                        }
                        onClick={async () => {
                          if (!selectedMember || !projectName) return;
                          const res = await dispatch(
                            troupeInviteMemberToProject({
                              memberId: selectedMember.id,
                              email: selectedMember.email,
                              projectSlug: projectName,
                              role: "viewer",
                            }),
                          );
                          if (
                            troupeInviteMemberToProject.fulfilled.match(res) &&
                            projectName
                          ) {
                            void dispatch(
                              fetchMyTroupe({
                                month: monthKey(currentMonth),
                                project: projectName,
                              }),
                            );
                          }
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
                      <Button
                        type="button"
                        className="danger"
                        disabled={
                          !selectedMember?.troupeMemberId ||
                          !!removingIds[String(selectedMember.troupeMemberId)]
                        }
                        onClick={() => {
                          if (!selectedMember?.troupeMemberId) return;
                          if (!confirm("Удалить участника из труппы?")) return;
                          dispatch(
                            troupeRemoveMember({
                              memberId: selectedMember.troupeMemberId,
                            }),
                          );
                        }}
                        title={
                          selectedMember?.troupeMemberId
                            ? "Удалить из труппы"
                            : "Только участники из вашей труппы, совпадающие с командой проекта"
                        }
                      >
                        {selectedMember?.troupeMemberId &&
                        removingIds[String(selectedMember.troupeMemberId)]
                          ? "…"
                          : narrowLayout
                            ? "Удалить"
                            : "Удалить из труппы"}
                      </Button>
                    </>
                  ) : null}
                  <Button
                    type="button"
                    className="primary"
                    disabled={!selectedMemberId && !selectedDayIso}
                    onClick={() => {
                      setSelectedMemberId(null);
                      setSelectedDayIso(null);
                    }}
                    title="Снять выделение строки и колонки"
                  >
                    {narrowLayout ? "Сбросить" : "Снять выделение"}
                  </Button>
                </div>
              </div>
              {selectedMember && inviteErrorByMemberId[selectedMember.id] ? (
                <div className="troupe-error">
                  {inviteErrorByMemberId[selectedMember.id]}
                </div>
              ) : null}

              <p className="troupe-schedule-scroll-hint">
                Листайте таблицу вправо, чтобы увидеть все дни месяца.
              </p>

              <div
                className={cn(
                  "troupe-schedule",
                  scheduleRefreshing && "troupe-schedule--refreshing",
                )}
                role="region"
                aria-label="График занятости команды проекта"
                aria-busy={scheduleRefreshing}
              >
                <div
                  className="troupe-grid"
                  style={
                    {
                      ["--troupe-day-count" as string]: String(days.length),
                      ["--troupe-grid-span" as string]: String(days.length + 1),
                    } as CSSProperties
                  }
                >
                  <div className="troupe-cell troupe-sticky troupe-header-cell">
                    Актёр
                  </div>
                  {days.map((d) => {
                    const n = dayjs(d).date();
                    const wd = dayjs(d).format("dd");
                    const dayIso = isoDate(d);
                    const isTodayCol = dayIso === todayIso;
                    const isColSelected = selectedDayIso === dayIso;
                    return (
                      <div
                        key={dayIso}
                        role="button"
                        tabIndex={0}
                        aria-pressed={isColSelected}
                        className={cn(
                          "troupe-cell troupe-header-cell troupe-header-cell--day-head",
                          isTodayCol && "troupe-header-cell--today",
                          isColSelected && "troupe-header-cell--col-selected",
                        )}
                        title={dayIso}
                        onClick={() =>
                          setSelectedDayIso((prev) =>
                            prev === dayIso ? null : dayIso,
                          )
                        }
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedDayIso((prev) =>
                              prev === dayIso ? null : dayIso,
                            );
                          }
                        }}
                      >
                        <div className="troupe-header-day-num">{n}</div>
                        <div className="troupe-header-day-wd">{wd}</div>
                      </div>
                    );
                  })}

                  {members.length === 0 ? (
                    <div className="troupe-cell troupe-empty">
                      {projectName
                        ? `В проекте «${projectName}» пока нет участников.`
                        : "Нет активного проекта — выберите проект в шапке приложения."}
                    </div>
                  ) : (
                    members.map((m) => {
                      const label = memberLabel(m);
                      const isSelected = m.id === selectedMemberId;
                      return (
                        <Fragment key={m.id}>
                          <div
                            key={`${m.id}:label`}
                            className={cn(
                              "troupe-cell troupe-sticky troupe-actor-cell",
                              isSelected && "selected",
                            )}
                            role="button"
                            tabIndex={0}
                            aria-pressed={isSelected}
                            onClick={() =>
                              setSelectedMemberId((prev) =>
                                prev === m.id ? null : m.id,
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedMemberId((prev) =>
                                  prev === m.id ? null : m.id,
                                );
                              }
                            }}
                            title={`${label} • ${m.email}`}
                          >
                            <div className="troupe-actor-row">
                              <MiniAvatar
                                src={
                                  String(m.profile?.avatarUrl ?? "").trim() ||
                                  null
                                }
                                label={label || m.email}
                                size={22}
                              />
                              <div className="troupe-actor-meta">
                                <div
                                  className="troupe-actor-name"
                                  title={label}
                                >
                                  {label}
                                </div>
                              </div>
                            </div>
                          </div>
                          {days.map((d) => {
                            const day = isoDate(d);
                            const cal = m.profile?.availabilityCalendar ?? {};
                            const ranges =
                              (m.profile?.availabilityTimeRanges ?? {})[day] ??
                              [];
                            const status = (cal as any)?.[day] as
                              | "present"
                              | "absent"
                              | undefined;

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

                            const isTodayCol = day === todayIso;
                            const isColSelected = selectedDayIso === day;

                            return (
                              <div
                                key={`${m.id}:${day}`}
                                className={cn(
                                  "troupe-cell troupe-day-cell",
                                  cls,
                                  isSelected && "selected",
                                  isColSelected && "day-col-selected",
                                  isTodayCol && "troupe-day-cell--today",
                                )}
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
            </div>

            {error ? <div className="troupe-error">{error}</div> : null}

            {canManageProjectTroupe ? (
              <div className="troupe-card troupe-invite-card">
                <div className="troupe-invite-card__title">
                  <span className="troupe-invite-card__title-desktop">
                    Добавить в труппу по email
                  </span>
                  <span className="troupe-invite-card__title-mobile">
                    Пригласить по email
                  </span>
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
                    disabled={adding || !email.trim() || !projectName}
                    onClick={async () => {
                      const value = email.trim();
                      if (!value) return;
                      const res = await dispatch(
                        troupeAddMember({ email: value }),
                      );
                      if (troupeAddMember.fulfilled.match(res)) setEmail("");
                    }}
                  >
                    {adding ? "Добавление…" : "Добавить"}
                  </button>
                </FormInlineRow>
                {addError ? <div className="troupe-error">{addError}</div> : null}
              </div>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  );
}
