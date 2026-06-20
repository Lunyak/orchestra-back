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
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import { Link } from "react-router-dom";
import {
  useCreateTeamRoleMutation,
  useTeamRolesQuery,
  type TeamRoleDefinitionItem,
} from "../../features/troupe/api/troupe-api";
import { useListPremisesQuery } from "../../features/premises";
import {
  getTroupeNarrowLayoutSnapshot,
  isoDate,
  memberLabel,
  monthKey,
  subscribeTroupeNarrowLayout,
  useTroupePage,
} from "../../features/troupe";
import type {
  TroupeMemberKind,
} from "../../features/troupe/api/troupe-api";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import { PremisesIndexPanel } from "../premises/PremisesIndexPanel";
import "../premises/style.css";
import "../../pages/rehearsals/style.css";
import "../../pages/sessions/style.css";
import "./style.css";

dayjs.locale("ru");

export function TroupePage() {
  const [newTeamRoleTitle, setNewTeamRoleTitle] = useState("");
  const [newTeamRoleParentId, setNewTeamRoleParentId] = useState("");
  const narrowLayout = useSyncExternalStore(
    subscribeTroupeNarrowLayout,
    getTroupeNarrowLayoutSnapshot,
    () => false,
  );

  const {
    accessToken,
    activeTab,
    adding,
    addError,
    addMemberByEmail,
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
    projectCastMembers,
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
    setActiveTab,
    setCurrentMonth,
    setEmail,
    setSelectedDayIso,
    setSelectedMemberId,
    setTitleDraft,
    titleDraft,
    todayIso,
    troupe,
    troupeMembers,
    updateSelectedTroupeMemberKind,
    projectItems,
    currentProjectDisplayName,
  } = useTroupePage();

  const {
    data: teamRoles = [],
    isLoading: teamRolesLoading,
    error: teamRolesError,
  } = useTeamRolesQuery(undefined, { skip: !accessToken });
  const [createTeamRole, { isLoading: creatingTeamRole }] =
    useCreateTeamRoleMutation();
  const { data: premisesData } = useListPremisesQuery(undefined, {
    skip: !accessToken,
  });
  const premisesCount = premisesData?.premises.length ?? 0;

  const projectSelectOptions = useMemo(
    () =>
      projectItems.map((project) => ({
        value: project.slug,
        label: project.name || project.slug,
      })),
    [projectItems],
  );
  const isTeamTab = activeTab === "team";
  const isTroupeTab = activeTab === "troupe";
  const isProjectTab = activeTab === "project";
  const isPremisesTab = activeTab === "premises";
  const teamRolesByParentId = useMemo(() => {
    const groups = new Map<string, TeamRoleDefinitionItem[]>();
    for (const role of teamRoles) {
      const key = role.parentId ?? "root";
      groups.set(key, [...(groups.get(key) ?? []), role]);
    }
    for (const roles of groups.values()) {
      roles.sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
    }
    return groups;
  }, [teamRoles]);
  const teamRoleParentOptions = useMemo(
    () => [
      { value: "", label: "Верхний уровень" },
      ...teamRoles.map((role) => ({
        value: role.id,
        label: role.title,
      })),
    ],
    [teamRoles],
  );
  const troupeMemberKindOptions = [
    { value: "regular", label: "Основной" },
    { value: "guest", label: "Приходящий" },
  ];

  const handleCreateTeamRole = async () => {
    const title = newTeamRoleTitle.trim();
    if (!title) return;
    try {
      await createTeamRole({
        title,
        parentId: newTeamRoleParentId || null,
      }).unwrap();
      setNewTeamRoleTitle("");
      setNewTeamRoleParentId("");
    } catch {
      alert("Не удалось создать должность");
    }
  };

  const renderTeamRoleCards = (parentId: string | null = null, depth = 0) => {
    const roles = teamRolesByParentId.get(parentId ?? "root") ?? [];
    if (roles.length === 0) return null;
    return (
      <div
        className={cn(
          "troupe-role-tree-level",
          depth > 0 && "troupe-role-tree-level--nested",
        )}
      >
        {roles.map((role) => {
          const childNodes = renderTeamRoleCards(role.id, depth + 1);
          const description = role.description.trim();
          return (
            <div key={role.id} className="troupe-role-node">
              <Link to={`/troupe/roles/${role.id}`} className="troupe-role-card">
                <div className="troupe-role-card__top">
                  <div>
                    <div className="troupe-role-card__title">{role.title}</div>
                  </div>
                  <div className="troupe-role-card__count">
                    {role.assignmentCount}
                  </div>
                </div>
                <div className="troupe-role-card__description">
                  {description || "Инструкция пока не заполнена."}
                </div>
                <div className="troupe-role-card__assignees">
                  {role.assignees.length === 0 ? (
                    <span className="troupe-role-card__empty">Никто не назначен</span>
                  ) : (
                    role.assignees.slice(0, 4).map((member) => {
                      const label = memberLabel(member);
                      return (
                        <MiniAvatar
                          key={member.id}
                          src={String(member.profile?.avatarUrl ?? "").trim() || null}
                          label={label || member.email}
                          size={22}
                        />
                      );
                    })
                  )}
                  {role.assignees.length > 4 ? (
                    <span className="troupe-role-card__more">
                      +{role.assignees.length - 4}
                    </span>
                  ) : null}
                </div>
              </Link>
              {childNodes}
            </div>
          );
        })}
      </div>
    );
  };

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
                      src={String(m.profile?.avatarUrl ?? "").trim() || null}
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
        <main className="main-content">
          <div className="troupe-view">

            <div className="troupe-tabs" role="tablist" aria-label="Разделы труппы">
              <button
                type="button"
                role="tab"
                aria-selected={isTeamTab}
                className={cn("troupe-tab", isTeamTab && "troupe-tab--active")}
                onClick={() => setActiveTab("team")}
              >
                Команда
                <span className="troupe-tab__count">{teamRoles.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isTroupeTab}
                className={cn("troupe-tab", isTroupeTab && "troupe-tab--active")}
                onClick={() => setActiveTab("troupe")}
              >
                Состав труппы
                <span className="troupe-tab__count">{troupeMembers.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isProjectTab}
                className={cn("troupe-tab", isProjectTab && "troupe-tab--active")}
                onClick={() => setActiveTab("project")}
              >
                Состав проекта
                <span className="troupe-tab__count">{projectCastMembers.length}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={isPremisesTab}
                className={cn("troupe-tab", isPremisesTab && "troupe-tab--active")}
                onClick={() => setActiveTab("premises")}
              >
                Помещения
                <span className="troupe-tab__count">{premisesCount}</span>
              </button>
            </div>

            {isTeamTab ? (
              <div className="troupe-card troupe-team-card troupe-role-tree-card">
                <div className="troupe-team-head">
                  <div>
                    <div className="troupe-team-title">Команда</div>
                    <div className="troupe-team-subtitle">
                      Дерево должностей труппы. Откройте карточку, чтобы назначить людей и заполнить инструкцию.
                    </div>
                  </div>
                </div>
                <FormInlineRow className="troupe-form-row troupe-team-form">
                  <InlineTextField
                    className="troupe-title-field"
                    placeholder="Новая должность"
                    value={newTeamRoleTitle}
                    onChange={(e) => setNewTeamRoleTitle(e.target.value)}
                    maxLength={80}
                  />
                  <CustomSelect
                    value={newTeamRoleParentId}
                    options={teamRoleParentOptions}
                    onChange={setNewTeamRoleParentId}
                    triggerClassName="troupe-role-parent-select"
                    aria-label="Родительская должность"
                  />
                  <button
                    type="button"
                    className="troupe-form-row__btn troupe-invite-card__submit"
                    disabled={creatingTeamRole || !newTeamRoleTitle.trim()}
                    onClick={() => {
                      void handleCreateTeamRole();
                    }}
                  >
                    {creatingTeamRole ? "Создание…" : "Создать должность"}
                  </button>
                </FormInlineRow>
                {teamRolesError ? (
                  <div className="troupe-error">Не удалось загрузить должности</div>
                ) : null}
                {teamRolesLoading ? (
                  <div className="troupe-team-empty">Загружаем дерево должностей…</div>
                ) : teamRoles.length === 0 ? (
                  <div className="troupe-team-empty">
                    Должностей пока нет — создайте первую карточку.
                  </div>
                ) : (
                  <div className="troupe-role-tree">{renderTeamRoleCards()}</div>
                )}
              </div>
            ) : null}

            {canManageProjectTroupe && isTroupeTab ? (
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

            {isTroupeTab ? (
            <div className="troupe-card troupe-schedule-card">
              <div className="troupe-scale-head">
                <div className="troupe-scale-head__titleblock">
                  <div className="troupe-scale-head__title">
                    Шкала занятости
                  </div>
                  <div className="troupe-scale-head__subtitle">
                    Месяц: <b>{monthKey(currentMonth)}</b>
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
                        title={
                          !projectName
                            ? "Выберите проект"
                            : projectMembersLoading
                              ? "Проверяем участников проекта"
                            : selectedMember
                              ? selectedMemberInProject
                                ? "Этот человек уже есть в проекте"
                                : `Добавить в проект «${currentProjectDisplayName}»`
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
            ) : null}

            {isTroupeTab ? (
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
            ) : null}

            {error ? <div className="troupe-error">{error}</div> : null}

            {isProjectTab ? (
              <div className="troupe-card troupe-project-cast-card">
                <div className="troupe-project-cast-head">
                  <div>
                    <div className="troupe-project-cast-title">Состав проекта</div>
                    <div className="troupe-project-cast-subtitle">
                      {projectName
                        ? currentProjectDisplayName
                        : "Нет активного проекта"}
                    </div>
                  </div>
                  <div className="troupe-project-cast-tools">
                    {canManageProjectTroupe ? (
                      <label className="troupe-project-field">
                        <span className="troupe-project-field__label">Проект</span>
                        <CustomSelect
                          value={projects.length > 0 ? projectName : ""}
                          options={projectSelectOptions}
                          onChange={onProjectChange}
                          placeholder="Выберите проект"
                          noOptionsLabel="Проектов нет"
                          disabled={projects.length === 0 || projectsLoading}
                          triggerClassName="troupe-project-select"
                          aria-label="Проект для просмотра состава"
                        />
                      </label>
                    ) : null}
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
                  </div>
                </div>
                <div className="troupe-project-cast-schedule-head">
                  <div className="troupe-scale-head__subtitle">
                    Месяц: <b>{monthKey(currentMonth)}</b>
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
                <p className="troupe-schedule-scroll-hint">
                  Листайте таблицу вправо, чтобы увидеть все дни месяца.
                </p>
                {renderScheduleGrid(
                  projectCastMembers,
                  projectName
                    ? `В проекте «${currentProjectDisplayName}» пока нет участников.`
                    : "Нет активного проекта — выберите проект в шапке приложения.",
                  "График занятости состава проекта",
                  false,
                )}
              </div>
            ) : null}

            {isPremisesTab ? (
              <div className="troupe-card troupe-premises-card">
                <div className="troupe-project-cast-head">
                  <div>
                    <div className="troupe-project-cast-title">Помещения</div>
                    <div className="troupe-project-cast-subtitle">
                      Календарь аренды и субаренды залов и студий
                    </div>
                  </div>
                </div>
                <div className="troupe-premises-panel premises-layout">
                  <div className="sessions-page rehearsals-page">
                    <PremisesIndexPanel skip={!accessToken} />
                  </div>
                </div>
              </div>
            ) : null}

            {canManageProjectTroupe && isTroupeTab ? (
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
