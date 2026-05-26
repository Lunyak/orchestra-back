import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { FormInlineRow } from "@shared/core/form-inline-row/FormInlineRow";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import {
  Fragment,
  useMemo,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import {
  getTroupeNarrowLayoutSnapshot,
  isoDate,
  memberLabel,
  monthKey,
  subscribeTroupeNarrowLayout,
  useTroupePage,
} from "../../features/troupe";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import "./style.css";

dayjs.locale("ru");

export function TroupePage() {
  const narrowLayout = useSyncExternalStore(
    subscribeTroupeNarrowLayout,
    getTroupeNarrowLayoutSnapshot,
    () => false,
  );

  const {
    accessToken,
    adding,
    addError,
    addMemberByEmail,
    canManageProjectTroupe,
    currentMonth,
    days,
    email,
    error,
    inviteErrorByMemberId,
    inviteSelectedToProject,
    invitingIds,
    loading,
    members,
    onProjectChange,
    patchTitleError,
    patchingTitle,
    projectName,
    projects,
    projectsLoading,
    projectMembersLoading,
    removeSelectedFromTroupe,
    removingIds,
    saveTitle,
    scheduleRefreshing,
    selectedDayIso,
    selectedMember,
    selectedMemberId,
    selectedMemberInProject,
    setCurrentMonth,
    setEmail,
    setSelectedDayIso,
    setSelectedMemberId,
    setTitleDraft,
    titleDraft,
    todayIso,
    troupe,
  } = useTroupePage();

  const projectSelectOptions = useMemo(
    () => projects.map((slug) => ({ value: slug, label: slug })),
    [projects],
  );

  if (!accessToken)
    return <div>Нужно войти, чтобы открыть страницу труппы.</div>;

  return (
    <div className="app-layout troupe-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="troupe-view">
            <div className="troupe-header">
              <div>
                <h2 className="troupe-header__title">Труппа</h2>
                <p className="premises-troupe-link">
                  <Link to="/premises">Помещения и аренда →</Link>
                </p>
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
                    onClick={() => void saveTitle()}
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
                  {canManageProjectTroupe ? (
                    <>
                      <label className="troupe-project-field">
                        <span className="troupe-project-field__label">
                          Проект
                        </span>
                        <CustomSelect
                          value={projects.length > 0 ? projectName : ""}
                          options={projectSelectOptions}
                          onChange={onProjectChange}
                          placeholder="Выберите проект"
                          noOptionsLabel="Проектов нет"
                          disabled={projects.length === 0 || projectsLoading}
                          triggerClassName="troupe-project-select"
                          aria-label="Проект для добавления участника"
                        />
                      </label>
                      <Button
                        className="primary"
                        type="button"
                        disabled={
                          !projectName ||
                          !selectedMember ||
                          projectMembersLoading ||
                          selectedMemberInProject ||
                          !!invitingIds[selectedMember.id]
                        }
                        onClick={() => {
                          void inviteSelectedToProject();
                        }}
                        title={
                          !projectName
                            ? "Выберите проект"
                            : projectMembersLoading
                              ? "Проверяем участников проекта"
                            : selectedMember
                              ? selectedMemberInProject
                                ? "Этот человек уже есть в проекте"
                                : `Добавить в проект «${projectName}»`
                              : "Выбери участника"
                        }
                      >
                        {selectedMember && invitingIds[selectedMember.id]
                          ? "…"
                          : projectMembersLoading
                            ? "Проверка…"
                            : selectedMemberInProject
                              ? "Уже в проекте"
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
                          if (!confirm("Удалить участника из труппы?")) return;
                          void removeSelectedFromTroupe();
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
              {selectedMember && selectedMemberInProject ? (
                <div className="troupe-hint troupe-hint--after-form">
                  {memberLabel(selectedMember)} уже есть в проекте «{projectName}».
                </div>
              ) : null}
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
                    onClick={() => {
                      void addMemberByEmail();
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
