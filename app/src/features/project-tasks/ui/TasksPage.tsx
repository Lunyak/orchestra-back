import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import cn from "classnames";
import type { FormEvent, KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { PersonSelectPreview } from "../../../shared/components/person-select/PersonSelectPreview";
import { RehearsalPlanSectionChrome } from "../../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import {
  PROJECT_TASK_CATEGORY_LABELS,
  PROJECT_TASK_STATUS_LABELS,
  formatProjectTaskDueDate,
  isProjectTaskOverdue,
} from "../model/project-task-labels";
import { buildTaskPath } from "../model/task-path";
import {
  useProjectTasksPage,
  type ProjectTasksPageViewModel,
} from "../model/useProjectTasksPage";
import type {
  ProjectTaskCategory,
  ProjectTaskItem,
  ProjectTaskStatus,
} from "../../../sync/api/project-tasks";
import "../../director-sessions/ui/director-sessions.css";
import "./tasks.css";

const STATUS_OPTIONS: ProjectTaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
];

const STATUS_CYCLE: ProjectTaskStatus[] = [
  "todo",
  "in_progress",
  "done",
  "blocked",
];

const CATEGORY_OPTIONS: ProjectTaskCategory[] = [
  "props",
  "costume",
  "light",
  "sound",
  "admin",
  "production",
  "other",
];

function nextStatus(status: ProjectTaskStatus): ProjectTaskStatus {
  const index = STATUS_CYCLE.indexOf(status);
  const safeIndex = index >= 0 ? index : 0;
  return STATUS_CYCLE[(safeIndex + 1) % STATUS_CYCLE.length] ?? "todo";
}

function TasksPageView({ vm }: { vm: ProjectTasksPageViewModel }) {
  const {
    accessToken,
    filter,
    setFilter,
    newTitle,
    setNewTitle,
    newDescription,
    setNewDescription,
    newAssigneeEmail,
    setNewAssigneeEmail,
    newCategory,
    setNewCategory,
    newDueDate,
    setNewDueDate,
    assigneeMemberByEmail,
    assigneeSelectOptions,
    tasks,
    totalTasksCount,
    openTasksCount,
    myOpenTasksCount,
    requisiteImportCount,
    loading,
    creating,
    importingRequisites,
    error,
    handleCreateTask,
    handleUpdateTaskStatus,
    handleUpdateTaskAssignee,
    handleDeleteTask,
    handleImportRequisites,
  } = vm;

  const renderAssigneePerson = (
    email: string | null | undefined,
    placeholder = "Исполнитель",
    compact = false,
  ) => {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const person = normalizedEmail
      ? assigneeMemberByEmail.get(normalizedEmail) ?? {
          email: normalizedEmail,
          profile: null,
        }
      : null;

    return (
      <PersonSelectPreview
        person={person}
        placeholder={placeholder}
        compact={compact}
      />
    );
  };

  const categorySelectOptions = CATEGORY_OPTIONS.map((category) => ({
    value: category,
    label: PROJECT_TASK_CATEGORY_LABELS[category],
  }));

  const assigneeOptionsWithEmpty = [
    { value: "", label: "Без исполнителя", searchText: "без исполнителя" },
    ...assigneeSelectOptions,
  ];

  const isCreateDisabled = creating || !newTitle.trim();
  const showImport = requisiteImportCount > 0;

  const handleCreateSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isCreateDisabled) return;
    void handleCreateTask();
  };

  const handleTitleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    if (isCreateDisabled) return;
    void handleCreateTask();
  };

  if (!accessToken) {
    return (
      <div className="tasks-page">
        <RehearsalPlanSectionChrome activeTab="tasks">
          <div className="tasks-page__content">
            <div className="tasks-page__panel">
              <p className="tasks-page__hint">
                Войдите, чтобы работать с задачами проекта.
              </p>
            </div>
          </div>
        </RehearsalPlanSectionChrome>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <RehearsalPlanSectionChrome activeTab="tasks">
        <div className="tasks-page__content">
          <div className="tasks-page__toolbar">
            <div
              className="tasks-page__filters"
              role="tablist"
              aria-label="Фильтр задач"
            >
              <button
                type="button"
                role="tab"
                aria-selected={filter === "open"}
                className={cn(
                  "tasks-page__filter",
                  filter === "open" && "tasks-page__filter--active",
                )}
                onClick={() => setFilter("open")}
              >
                Открытые
                <span className="tasks-page__filter-count">{openTasksCount}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === "mine"}
                className={cn(
                  "tasks-page__filter",
                  filter === "mine" && "tasks-page__filter--active",
                )}
                onClick={() => setFilter("mine")}
              >
                Мои
                <span className="tasks-page__filter-count">
                  {myOpenTasksCount}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={filter === "all"}
                className={cn(
                  "tasks-page__filter",
                  filter === "all" && "tasks-page__filter--active",
                )}
                onClick={() => setFilter("all")}
              >
                Все
                <span className="tasks-page__filter-count">{totalTasksCount}</span>
              </button>
            </div>

            {showImport ? (
              <Button
                type="button"
                variant="secondary"
                disabled={importingRequisites}
                onClick={() => void handleImportRequisites()}
                title="Импортировать задачи из реквизита сценария"
              >
                {importingRequisites
                  ? "Импорт…"
                  : `Из реквизита (${requisiteImportCount})`}
              </Button>
            ) : null}
          </div>

          <form className="tasks-page__compose" onSubmit={handleCreateSubmit}>
            <div className="tasks-page__compose-main">
              <span className="tasks-page__compose-mark" aria-hidden>
                +
              </span>
              <input
                type="text"
                className="native-text-input tasks-page__title-field"
                placeholder="Название задачи — Enter чтобы добавить"
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                onKeyDown={handleTitleKeyDown}
                maxLength={200}
                aria-label="Название задачи"
              />
              <Button type="submit" disabled={isCreateDisabled}>
                {creating ? "…" : "Добавить"}
              </Button>
            </div>
            <textarea
              className="native-text-input tasks-page__description-field"
              placeholder="Что именно нужно сделать (необязательно)"
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              rows={2}
              maxLength={2000}
              aria-label="Описание задачи"
            />
            <div className="tasks-page__compose-meta">
              <CustomSelect
                value={newAssigneeEmail}
                options={assigneeOptionsWithEmpty}
                onChange={setNewAssigneeEmail}
                placeholder="Исполнитель"
                searchPlaceholder="Поиск по имени или email"
                noOptionsLabel="Нет участников театра"
                triggerClassName="tasks-page__assignee-select"
                aria-label="Исполнитель"
                renderValue={(option) =>
                  renderAssigneePerson(option?.value, "Исполнитель", true)
                }
                renderOption={(option) =>
                  option.value
                    ? renderAssigneePerson(option.value, "Исполнитель", false)
                    : option.label
                }
              />
              <CustomSelect
                value={newCategory}
                options={categorySelectOptions}
                onChange={(value) => setNewCategory(value as ProjectTaskCategory)}
                triggerClassName="tasks-page__category-select"
                aria-label="Категория"
              />
              <input
                type="date"
                className="native-text-input tasks-page__due-field"
                value={newDueDate}
                aria-label="Срок"
                onChange={(event) => setNewDueDate(event.target.value)}
              />
            </div>
          </form>

          {error ? <div className="tasks-page__error">{error}</div> : null}

          {loading ? (
            <div className="tasks-page__panel">
              <p className="tasks-page__hint">Загрузка задач…</p>
            </div>
          ) : null}

          {!loading && tasks.length === 0 ? (
            <div className="tasks-page__empty">
              <p className="tasks-page__empty-title">Пока пусто</p>
              <p className="tasks-page__hint">
                Добавьте задачу выше или импортируйте из реквизита на сценах.
              </p>
            </div>
          ) : null}

          {!loading && tasks.length > 0 ? (
            <ul className="tasks-page__list" aria-label="Список задач">
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  assigneeOptions={assigneeOptionsWithEmpty}
                  renderAssigneePerson={renderAssigneePerson}
                  onStatusChange={handleUpdateTaskStatus}
                  onAssigneeChange={handleUpdateTaskAssignee}
                  onDelete={handleDeleteTask}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </RehearsalPlanSectionChrome>
    </div>
  );
}

type TaskRowProps = {
  task: ProjectTaskItem;
  assigneeOptions: Array<{ value: string; label: string; searchText?: string }>;
  renderAssigneePerson: (
    email: string | null | undefined,
    placeholder?: string,
    compact?: boolean,
  ) => ReactNode;
  onStatusChange: (task: ProjectTaskItem, status: ProjectTaskStatus) => void;
  onAssigneeChange: (task: ProjectTaskItem, assigneeEmail: string) => void;
  onDelete: (task: ProjectTaskItem) => void;
};

function TaskRow({
  task,
  assigneeOptions,
  renderAssigneePerson,
  onStatusChange,
  onAssigneeChange,
  onDelete,
}: TaskRowProps) {
  const dueDateLabel = formatProjectTaskDueDate(task.dueAt);
  const isOverdue = isProjectTaskOverdue(task.dueAt) && task.status !== "done";
  const categoryLabel = PROJECT_TASK_CATEGORY_LABELS[task.category];
  const statusLabel = PROJECT_TASK_STATUS_LABELS[task.status];
  const isDone = task.status === "done";
  const isFromRequisite = task.source === "requisite";
  const canCycleStatus = Boolean(task.canChangeStatus);
  const cycledStatus = nextStatus(task.status);

  return (
    <li
      className={cn(
        "tasks-page__item",
        isDone && "tasks-page__item--done",
        `tasks-page__item--status-${task.status}`,
      )}
    >
      <button
        type="button"
        className={cn(
          "tasks-page__status-chip",
          `tasks-page__status-chip--${task.status}`,
        )}
        disabled={!canCycleStatus}
        title={
          canCycleStatus
            ? `${statusLabel} → ${PROJECT_TASK_STATUS_LABELS[cycledStatus]}`
            : statusLabel
        }
        aria-label={`Статус: ${statusLabel}`}
        onClick={() => {
          if (!canCycleStatus) return;
          onStatusChange(task, cycledStatus);
        }}
      >
        <span className="tasks-page__status-dot" aria-hidden />
        <span className="tasks-page__status-text">{statusLabel}</span>
      </button>

      <div className="tasks-page__item-primary">
        <Link
          className="tasks-page__item-title"
          to={buildTaskPath(task.id, task.title)}
        >
          {task.title}
        </Link>
        <div className="tasks-page__item-badges">
          <span className="tasks-page__item-badge">{categoryLabel}</span>
          {isFromRequisite ? (
            <span className="tasks-page__item-badge tasks-page__item-badge--muted">
              из реквизита
            </span>
          ) : null}
        </div>
      </div>

      <div className="tasks-page__item-assignee">
        <CustomSelect
          value={task.assigneeEmail ?? ""}
          options={assigneeOptions}
          onChange={(value) => onAssigneeChange(task, value)}
          placeholder="Исполнитель"
          searchPlaceholder="Поиск по театру"
          noOptionsLabel="Нет участников театра"
          triggerClassName="tasks-page__assignee-select"
          aria-label="Исполнитель задачи"
          renderValue={(option) =>
            renderAssigneePerson(option?.value, "Без исполнителя", true)
          }
          renderOption={(option) =>
            option.value
              ? renderAssigneePerson(option.value, "Исполнитель", false)
              : option.label
          }
        />
      </div>

      <time
        className={cn(
          "tasks-page__item-due",
          isOverdue && "tasks-page__item-due--overdue",
        )}
        dateTime={task.dueAt ?? undefined}
      >
        {dueDateLabel}
      </time>

      <div className="tasks-page__item-actions">
        <Button
          type="button"
          className="ghost tasks-page__delete-btn"
          onClick={() => void onDelete(task)}
          aria-label="Удалить задачу"
        >
          Удалить
        </Button>
      </div>
    </li>
  );
}

export function TasksPage() {
  const vm = useProjectTasksPage();
  return <TasksPageView vm={vm} />;
}
