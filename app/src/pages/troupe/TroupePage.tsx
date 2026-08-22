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
import { useParams } from "react-router-dom";
import { TheaterSectionNav } from "../../features/organizations/ui/TheaterSectionNav";
import {
  getTroupeNarrowLayoutSnapshot,
  isoDate,
  memberLabel,
  monthLabel,
  subscribeTroupeNarrowLayout,
  useTroupePage,
} from "../../features/troupe";
import type {
  TroupeMemberKind,
} from "../../features/troupe/api/troupe-api";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import { profileListAvatarSrc } from "../../sync/api/profile";
import { AdminSectionChrome } from "../../shared/components/admin/AdminSectionChrome";
import "../../features/rehearsals/ui/rehearsals.css";
import "../../features/director-sessions/ui/director-sessions.css";
import "../../features/organizations/ui/organizations.css";
import "./style.css";

dayjs.locale("ru");

export function TroupePage() {
  const { theaterId = "" } = useParams();
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
    canManageTroupe,
    canManageProjectTroupe,
    currentMonth,
    days,
    email,
    error,
    guestTroupeMembers,
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
    regularTroupeMembers,
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
    updateSelectedTroupeMemberKind,
    projectItems,
    currentProjectDisplayName,
  } = useTroupePage();

  const projectSelectOptions = useMemo(
    () =>
      projectItems.map((project) => ({
        value: project.slug,
        label: project.name || project.slug,
      })),
    [projectItems],
  );
  const troupeMemberKindOptions = [
    { value: "regular", label: "Основной" },
    { value: "guest", label: "Приходящий" },
  ];

  const renderScheduleGrid = (
    scheduleMembers: typeof members,
    emptyText: string,
    ariaLabel: string,
    rowsSelectable: boolean,
  ) => (
    <div
      className={cn(
        "troupe-schedule",
        scheduleRefreshing && "troupe-schedule--refreshing",
      )}
      role="region"
      aria-label={ariaLabel}
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

        {scheduleMembers.length === 0 ? (
          <div className="troupe-cell troupe-empty">{emptyText}</div>
        ) : (
          scheduleMembers.map((m) => {
            const label = memberLabel(m);
            const isSelected = rowsSelectable && m.id === selectedMemberId;
            return (
              <Fragment key={m.id}>
                <div
                  key={`${m.id}:label`}
                  className={cn(
                    "troupe-cell troupe-sticky troupe-actor-cell",
                    isSelected && "selected",
                    !rowsSelectable && "troupe-actor-cell--readonly",
                  )}
                  role={rowsSelectable ? "button" : undefined}
                  tabIndex={rowsSelectable ? 0 : undefined}
                  aria-pressed={rowsSelectable ? isSelected : undefined}
                  onClick={
                    rowsSelectable
                      ? () =>
                          setSelectedMemberId((prev) =>
                            prev === m.id ? null : m.id,
                          )
                      : undefined
                  }
                  onKeyDown={
                    rowsSelectable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setSelectedMemberId((prev) =>
                              prev === m.id ? null : m.id,
                            );
                          }
                        }
                      : undefined
                  }
                  title={`${label} • ${m.email}`}
                >
                  <div className="troupe-actor-row">
                    <MiniAvatar
                      src={profileListAvatarSrc(m.profile)}
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
                    (m.profile?.availabilityTimeRanges ?? {})[day] ?? [];
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
  );

  if (!accessToken)
    return <div>Нужно войти, чтобы открыть страницу труппы.</div>;

  return (
    <div className="app-layout troupe-layout">
      <div className="app-content">
        {theaterId ? (
          <TheaterSectionNav theaterId={theaterId} active="troupe" />
        ) : null}
        <main className="main-content">
          <div className="troupe-view">
            <AdminSectionChrome activeSection="team">
            {canManageTroupe ? (
              <div className="troupe-card">
                {!loading && !troupe ? (
                  <p className="troupe-hint">
                    Труппа театра пока пуста — добавьте первого участника по email
                    в блоке ниже.
                  </p>
                ) : null}
                <FormInlineRow className="troupe-form-row">
                  <InlineTextField
                    className="troupe-title-field"
                    value={titleDraft}
                    onChange={(e) => setTitleDraft(e.target.value)}
                    placeholder="Название труппы"
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
                    Месяц: <b>{monthLabel(currentMonth)}</b>
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
                      <label className="troupe-project-field troupe-member-kind-field">
                        <span className="troupe-project-field__label">
                          Тип
                        </span>
                        <CustomSelect
                          value={selectedMember?.kind ?? "regular"}
                          options={troupeMemberKindOptions}
                          onChange={(kind) => {
                            void updateSelectedTroupeMemberKind(
                              kind as TroupeMemberKind,
                            );
                          }}
                          disabled={!selectedMember?.troupeMemberId}
                          triggerClassName="troupe-member-kind-select"
                          aria-label="Тип актёра в составе труппы"
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

              {renderScheduleGrid(
                regularTroupeMembers,
                "В основном составе пока никого нет — добавьте участника по email ниже.",
                "График занятости основного состава труппы",
                true,
              )}
            </div>

            <div className="troupe-card troupe-schedule-card troupe-schedule-card--guest">
              <div className="troupe-scale-head">
                <div className="troupe-scale-head__titleblock">
                  <div className="troupe-scale-head__title">
                    Приходящие актёры
                  </div>
                  <div className="troupe-scale-head__subtitle">
                    Отдельный график для актёров, которые не входят в основной состав.
                  </div>
                </div>
              </div>
              {renderScheduleGrid(
                guestTroupeMembers,
                "Приходящих актёров пока нет — выберите актёра и смените тип на «Приходящий».",
                "График занятости приходящих актёров",
                true,
              )}
            </div>

            {error ? <div className="troupe-error">{error}</div> : null}

            {canManageTroupe ? (
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
                    disabled={adding || !email.trim()}
                    onClick={() => {
                      void addMemberByEmail();
                    }}
                  >
                    {adding ? "Отправка…" : "Пригласить"}
                  </button>
                </FormInlineRow>
                {addError ? <div className="troupe-error">{addError}</div> : null}
              </div>
            ) : null}
            </AdminSectionChrome>
          </div>
        </main>
      </div>
    </div>
  );
}