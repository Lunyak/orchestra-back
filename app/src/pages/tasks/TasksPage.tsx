import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import cn from "classnames";
import type { ReactNode } from "react";
import { PersonSelectPreview } from "../../shared/components/person-select/PersonSelectPreview";
import { RehearsalPlanSectionChrome } from "../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import {
  PROJECT_TASK_CATEGORY_LABELS,
  PROJECT_TASK_STATUS_LABELS,
  formatProjectTaskDueDate,
  isProjectTaskOverdue,
} from "../../features/project-tasks/model/project-task-labels";
import {
  useProjectTasksPage,
  type ProjectTasksPageViewModel,
} from "../../features/project-tasks/model/useProjectTasksPage";
import type {
  ProjectTaskCategory,
  ProjectTaskItem,
  ProjectTaskStatus,
} from "../../sync/api/project-tasks";
import "../sessions/style.css";
import "./style.css";

const STATUS_OPTIONS: ProjectTaskStatus[] = [
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

function TasksPageView({ vm }: { vm: ProjectTasksPageViewModel }) {
  const {
    accessToken,
    filter,
    setFilter,
    newTitle,
    setNewTitle,
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
    loading,
    creating,
    error,
    handleCreateTask,
    handleUpdateTaskStatus,
    handleDeleteTask,
  } = vm;

  const renderAssigneePerson = (
    email: string | null | undefined,
    placeholder = "Исполнитель",
    compact = false,
  ) => {
    const normalizedEmail = String(email ?? "").trim().toLowerCase();
    const person = normalizedEmail
      ? assigneeMemberByEmail.get(normalizedEmail) ?? { email: normalizedEmail, profile: null }
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

  const isCreateDisabled = creating || !newTitle.trim();

  if (!accessToken) {
    return (
      <div className="tasks-page">
        <RehearsalPlanSectionChrome activeTab="tasks" />
        <div className="tasks-page__content">
          <div className="tasks-page__panel">
            <p className="tasks-page__hint">Войдите, чтобы работать с задачами проекта.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tasks-page">
      <RehearsalPlanSectionChrome activeTab="tasks" />

      <div className="tasks-page__content">
      <div className="tasks-page__toolbar">
        <div className="tasks-page__filters" role="tablist" aria-label="Фильтр задач">
          <button
            type="button"
            role="tab"
            aria-selected={filter === "open"}
            className={cn("tasks-page__filter", filter === "open" && "tasks-page__filter--active")}
            onClick={() => setFilter("open")}
          >
            Открытые
            <span className="tasks-page__filter-count">{openTasksCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "mine"}
            className={cn("tasks-page__filter", filter === "mine" && "tasks-page__filter--active")}
            onClick={() => setFilter("mine")}
          >
            Мои
            <span className="tasks-page__filter-count">{myOpenTasksCount}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={filter === "all"}
            className={cn("tasks-page__filter", filter === "all" && "tasks-page__filter--active")}
            onClick={() => setFilter("all")}
          >
            Все
            <span className="tasks-page__filter-count">{totalTasksCount}</span>
          </button>
        </div>
      </div>

      <div className="tasks-page__create">
        <input
          type="text"
          className="native-text-input tasks-page__title-field"
          placeholder="Новая задача"
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          maxLength={200}
        />
        <CustomSelect
          value={newAssigneeEmail}
          options={assigneeSelectOptions}
          onChange={setNewAssigneeEmail}
          placeholder="Исполнитель"
          searchPlaceholder="Поиск по имени или email"
          noOptionsLabel="Нет участников"
          triggerClassName="tasks-page__assignee-select"
          aria-label="Исполнитель"
          renderValue={(option) => renderAssigneePerson(option?.value, "Исполнитель", true)}
          renderOption={(option) => renderAssigneePerson(option.value, "Исполнитель", false)}
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
          className="native-text-input"
          value={newDueDate}
          aria-label="Срок"
          onChange={(event) => setNewDueDate(event.target.value)}
        />
        <Button
          type="button"
          disabled={isCreateDisabled}
          onClick={() => void handleCreateTask()}
        >
          {creating ? "…" : "Добавить"}
        </Button>
      </div>

      {error ? <div className="tasks-page__error">{error}</div> : null}

      {loading ? (
        <div className="tasks-page__panel">
          <p className="tasks-page__hint">Загрузка задач…</p>
        </div>
      ) : null}

      {!loading && tasks.length === 0 ? (
        <div className="tasks-page__panel">
          <p className="tasks-page__hint">
            Задач пока нет. Добавьте вручную или импортируйте из реквизита на шагах сценария.
          </p>
        </div>
      ) : null}

      {!loading && tasks.length > 0 ? (
        <>
          <div className="tasks-page__list-head" aria-hidden="true">
            <span>Задача</span>
            <span>Исполнитель</span>
            <span>Срок</span>
            <span>Статус</span>
            <span />
          </div>
          <ul className="tasks-page__list">
            {tasks.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                renderAssignee={(email) =>
                  renderAssigneePerson(email, "Без исполнителя", true)
                }
                onStatusChange={handleUpdateTaskStatus}
                onDelete={handleDeleteTask}
              />
            ))}
          </ul>
        </>
      ) : null}
      </div>
    </div>
  );
}

type TaskRowProps = {
  task: ProjectTaskItem;
  renderAssignee: (email: string | null | undefined) => ReactNode;
  onStatusChange: (task: ProjectTaskItem, status: ProjectTaskStatus) => void;
  onDelete: (task: ProjectTaskItem) => void;
};

function TaskRow({ task, renderAssignee, onStatusChange, onDelete }: TaskRowProps) {
  const statusOptions = STATUS_OPTIONS.map((status) => ({
    value: status,
    label: PROJECT_TASK_STATUS_LABELS[status],
  }));

  const dueDateLabel = formatProjectTaskDueDate(task.dueAt);
  const isOverdue = isProjectTaskOverdue(task.dueAt) && task.status !== "done";
  const categoryLabel = PROJECT_TASK_CATEGORY_LABELS[task.category];
  const isDone = task.status === "done";
  const isFromRequisite = task.source === "requisite";

  return (
    <li
      className={cn(
        "tasks-page__item",
        isDone && "tasks-page__item--done",
        `tasks-page__item--status-${task.status}`,
      )}
    >
      <div className="tasks-page__item-primary">
        <div className="tasks-page__item-title">{task.title}</div>
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
        {renderAssignee(task.assigneeEmail)}
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

      <div className="tasks-page__item-status">
        {task.canChangeStatus ? (
          <CustomSelect
            value={task.status}
            options={statusOptions}
            onChange={(value) =>
              onStatusChange(task, value as ProjectTaskStatus)
            }
            triggerClassName="tasks-page__status-select"
            aria-label="Статус задачи"
          />
        ) : (
          <span className="tasks-page__status-label">
            {PROJECT_TASK_STATUS_LABELS[task.status]}
          </span>
        )}
      </div>

      <div className="tasks-page__item-actions">
        <Button
          type="button"
          className="ghost tasks-page__delete-btn"
          onClick={() => void onDelete(task)}
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
