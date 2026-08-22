import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import cn from "classnames";
import { Link } from "react-router-dom";
import { projectPath } from "../../../app/router/paths";
import { PersonSelectPreview } from "../../../shared/components/person-select/PersonSelectPreview";
import { RehearsalPlanSectionChrome } from "../../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import {
  PROJECT_TASK_CATEGORY_LABELS,
  PROJECT_TASK_STATUS_LABELS,
} from "../model/project-task-labels";
import {
  useProjectTaskDetailPage,
  type ProjectTaskDetailPageViewModel,
} from "../model/useProjectTaskDetailPage";
import type {
  ProjectTaskCategory,
  ProjectTaskStatus,
} from "../../../sync/api/project-tasks";
import "../../director-sessions/ui/director-sessions.css";
import "./tasks.css";

function TaskDetailPageView({ vm }: { vm: ProjectTaskDetailPageViewModel }) {
  const {
    accessToken,
    projectSlug,
    task,
    project,
    loading,
    saving,
    deleting,
    error,
    titleDraft,
    setTitleDraft,
    descriptionDraft,
    setDescriptionDraft,
    dueDateDraft,
    setDueDateDraft,
    hasUnsavedChanges,
    assigneeMemberByEmail,
    assigneeSelectOptions,
    categorySelectOptions,
    statusSelectOptions,
    isOverdue,
    copyStatus,
    handleSaveDetails,
    handleStatusChange,
    handleCategoryChange,
    handleAssigneeChange,
    handleDelete,
    handleCopyLink,
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

  if (!accessToken) {
    return (
      <div className="tasks-page">
        <RehearsalPlanSectionChrome activeTab="tasks">
          <div className="tasks-page__content">
            <div className="tasks-page__panel">
              <p className="tasks-page__hint">
                Войдите, чтобы открыть задачу.
              </p>
            </div>
          </div>
        </RehearsalPlanSectionChrome>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="tasks-page">
        <RehearsalPlanSectionChrome activeTab="tasks">
          <div className="tasks-page__content">
            <div className="tasks-page__panel">
              <PageLoader variant="view" label="Загрузка задачи…" />
            </div>
          </div>
        </RehearsalPlanSectionChrome>
      </div>
    );
  }

  if (!task) {
    return (
      <div className="tasks-page">
        <RehearsalPlanSectionChrome activeTab="tasks">
          <div className="tasks-page__content">
            <div className="tasks-page__panel">
              <p className="tasks-page__hint">{error ?? "Задача не найдена"}</p>
              <Link
                className="tasks-page__back-link"
                to={projectPath(projectSlug, "tasks")}
              >
                ← К списку задач
              </Link>
            </div>
          </div>
        </RehearsalPlanSectionChrome>
      </div>
    );
  }

  const canChangeStatus = Boolean(task.canChangeStatus);
  const statusLabel = PROJECT_TASK_STATUS_LABELS[task.status];
  const categoryLabel = PROJECT_TASK_CATEGORY_LABELS[task.category];
  const isFromRequisite = task.source === "requisite";

  return (
    <div className="tasks-page">
      <RehearsalPlanSectionChrome activeTab="tasks">
        <div className="tasks-page__content tasks-page__content--detail">
          <div className="tasks-page__detail-head">
            <Link
              className="tasks-page__back-link"
              to={projectPath(projectSlug, "tasks")}
            >
              ← К списку задач
            </Link>
            <div className="tasks-page__detail-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCopyLink()}
              >
                {copyStatus ?? "Скопировать ссылку"}
              </Button>
              <Button
                type="button"
                className="danger"
                disabled={deleting}
                onClick={() => void handleDelete()}
              >
                {deleting ? "Удаление…" : "Удалить"}
              </Button>
            </div>
          </div>

          {project ? (
            <p className="tasks-page__detail-project">
              Проект: <b>{project.name || project.slug}</b>
            </p>
          ) : null}

          {error ? <div className="tasks-page__error">{error}</div> : null}

          <div className="tasks-page__detail-card">
            <div className="tasks-page__detail-badges">
              <span
                className={cn(
                  "tasks-page__status-chip",
                  `tasks-page__status-chip--${task.status}`,
                  "tasks-page__status-chip--static",
                )}
              >
                <span className="tasks-page__status-dot" aria-hidden />
                <span className="tasks-page__status-text">{statusLabel}</span>
              </span>
              <span className="tasks-page__item-badge">{categoryLabel}</span>
              {isFromRequisite ? (
                <span className="tasks-page__item-badge tasks-page__item-badge--muted">
                  из реквизита
                </span>
              ) : null}
            </div>

            <label className="tasks-page__detail-field">
              <span className="tasks-page__detail-label">Название</span>
              <input
                type="text"
                className="native-text-input"
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                maxLength={200}
              />
            </label>

            <label className="tasks-page__detail-field">
              <span className="tasks-page__detail-label">Описание</span>
              <textarea
                className="native-text-input tasks-page__description-field"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="Что именно нужно сделать"
              />
            </label>

            <div className="tasks-page__detail-grid">
              <label className="tasks-page__detail-field">
                <span className="tasks-page__detail-label">Статус</span>
                {canChangeStatus ? (
                  <CustomSelect
                    value={task.status}
                    options={statusSelectOptions}
                    onChange={(value) =>
                      void handleStatusChange(value as ProjectTaskStatus)
                    }
                    aria-label="Статус"
                  />
                ) : (
                  <span className="tasks-page__status-label">{statusLabel}</span>
                )}
              </label>

              <label className="tasks-page__detail-field">
                <span className="tasks-page__detail-label">Категория</span>
                <CustomSelect
                  value={task.category}
                  options={categorySelectOptions}
                  onChange={(value) =>
                    void handleCategoryChange(value as ProjectTaskCategory)
                  }
                  aria-label="Категория"
                />
              </label>

              <label className="tasks-page__detail-field">
                <span className="tasks-page__detail-label">Исполнитель</span>
                <CustomSelect
                  value={task.assigneeEmail ?? ""}
                  options={assigneeSelectOptions}
                  onChange={(value) => void handleAssigneeChange(value)}
                  placeholder="Исполнитель"
                  searchPlaceholder="Поиск по театру"
                  noOptionsLabel="Нет участников театра"
                  aria-label="Исполнитель"
                  renderValue={(option) =>
                    renderAssigneePerson(option?.value, "Без исполнителя", true)
                  }
                  renderOption={(option) =>
                    option.value
                      ? renderAssigneePerson(option.value, "Исполнитель", false)
                      : option.label
                  }
                />
              </label>

              <label className="tasks-page__detail-field">
                <span className="tasks-page__detail-label">Срок</span>
                <input
                  type="date"
                  className={cn(
                    "native-text-input",
                    isOverdue && "tasks-page__due-field--overdue",
                  )}
                  value={dueDateDraft}
                  onChange={(event) => setDueDateDraft(event.target.value)}
                />
              </label>
            </div>

            <div className="tasks-page__detail-footer">
              <Button
                type="button"
                disabled={saving || !hasUnsavedChanges}
                onClick={() => void handleSaveDetails()}
              >
                {saving ? "Сохранение…" : "Сохранить"}
              </Button>
              {hasUnsavedChanges ? (
                <span className="tasks-page__hint">Есть несохранённые изменения</span>
              ) : null}
            </div>
          </div>
        </div>
      </RehearsalPlanSectionChrome>
    </div>
  );
}

export function TaskDetailPage() {
  const vm = useProjectTaskDetailPage();
  return <TaskDetailPageView vm={vm} />;
}
