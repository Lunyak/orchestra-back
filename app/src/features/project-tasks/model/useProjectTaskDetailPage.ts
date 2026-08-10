import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth";
import { useProject } from "../../project";
import { useProjectMembersQuery } from "../../project/api/project-api";
import { useMyTroupeQuery } from "../../troupe/api/troupe-api";
import { memberLabel } from "../../troupe/model/troupe-page-utils";
import {
  useDeleteProjectTaskMutation,
  useGetProjectTaskQuery,
  useUpdateProjectTaskMutation,
} from "../api/project-tasks-api";
import { mergeTaskAssigneeMembers } from "../model/merge-task-assignee-members";
import {
  PROJECT_TASK_CATEGORY_LABELS,
  PROJECT_TASK_STATUS_LABELS,
  formatProjectTaskDueDate,
  isProjectTaskOverdue,
} from "../model/project-task-labels";
import { buildTaskPath, parseTaskPathParam } from "../model/task-path";
import type {
  ProjectTaskCategory,
  ProjectTaskStatus,
} from "../../../sync/api/project-tasks";

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function dueDateInputValue(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useProjectTaskDetailPage() {
  const { taskId: taskPathParam = "" } = useParams();
  const taskId = parseTaskPathParam(taskPathParam);
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useAuth();
  const { projectName } = useProject();

  const {
    data,
    isLoading,
    error: queryError,
  } = useGetProjectTaskQuery(taskId, {
    skip: !accessToken || !taskId,
  });

  const task = data?.task ?? null;
  const project = data?.project ?? null;
  const projectSlug = projectName;

  useEffect(() => {
    if (!task) return;
    const canonicalPath = buildTaskPath(projectSlug, task.id, task.title);
    if (location.pathname === canonicalPath) return;
    navigate(canonicalPath, { replace: true });
  }, [location.pathname, navigate, projectSlug, task]);

  const { data: projectMembersData } = useProjectMembersQuery(projectSlug, {
    skip: !accessToken || !projectSlug,
  });
  const { data: troupeData } = useMyTroupeQuery(
    {},
    { skip: !accessToken },
  );

  const [updateTask, { isLoading: saving }] = useUpdateProjectTaskMutation();
  const [deleteTask, { isLoading: deleting }] = useDeleteProjectTaskMutation();

  const [titleDraft, setTitleDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [dueDateDraft, setDueDateDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [copyStatus, setCopyStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!task) return;
    setTitleDraft(task.title);
    setDescriptionDraft(task.description ?? "");
    setDueDateDraft(dueDateInputValue(task.dueAt));
  }, [task]);

  const assigneeMembers = useMemo(
    () => mergeTaskAssigneeMembers(troupeData, projectMembersData),
    [troupeData, projectMembersData],
  );

  const assigneeMemberByEmail = useMemo(() => {
    const map = new Map<string, (typeof assigneeMembers)[number]>();
    for (const member of assigneeMembers) {
      map.set(normalizeEmail(member.email), member);
    }
    return map;
  }, [assigneeMembers]);

  const assigneeSelectOptions = useMemo(
    () => [
      { value: "", label: "Без исполнителя", searchText: "без исполнителя" },
      ...assigneeMembers.map((member) => {
        const label = memberLabel(member);
        const profile = member.profile;
        const searchParts = [
          label,
          member.email,
          profile?.displayName,
          profile?.firstName,
          profile?.lastName,
        ].filter(Boolean);
        return {
          value: member.email,
          label,
          searchText: searchParts.join(" "),
        };
      }),
    ],
    [assigneeMembers],
  );

  const categorySelectOptions = (
    Object.keys(PROJECT_TASK_CATEGORY_LABELS) as ProjectTaskCategory[]
  ).map((category) => ({
    value: category,
    label: PROJECT_TASK_CATEGORY_LABELS[category],
  }));

  const statusSelectOptions = (
    Object.keys(PROJECT_TASK_STATUS_LABELS) as ProjectTaskStatus[]
  ).map((status) => ({
    value: status,
    label: PROJECT_TASK_STATUS_LABELS[status],
  }));

  const dueDateLabel = formatProjectTaskDueDate(task?.dueAt);
  const isOverdue =
    Boolean(task) &&
    isProjectTaskOverdue(task?.dueAt) &&
    task?.status !== "done";

  const titleDirty = Boolean(task) && titleDraft.trim() !== task!.title;
  const descriptionDirty =
    Boolean(task) &&
    descriptionDraft.trim() !== String(task!.description ?? "").trim();
  const dueDateDirty =
    Boolean(task) && dueDateDraft !== dueDateInputValue(task!.dueAt);
  const hasUnsavedChanges = titleDirty || descriptionDirty || dueDateDirty;

  const patchTask = async (body: {
    title?: string;
    description?: string | null;
    status?: ProjectTaskStatus;
    category?: ProjectTaskCategory;
    assigneeEmail?: string | null;
    dueAt?: string | null;
  }) => {
    if (!task || !projectSlug) return;
    setActionError(null);
    try {
      await updateTask({
        id: task.id,
        projectSlug,
        body,
      }).unwrap();
    } catch (error: unknown) {
      const err = error as {
        data?: { message?: string };
        message?: string;
        status?: number;
      };
      const isForbidden = err?.status === 403;
      setActionError(
        isForbidden
          ? "Недостаточно прав для изменения задачи"
          : err?.data?.message ?? err?.message ?? "Не удалось сохранить задачу",
      );
      throw error;
    }
  };

  const handleSaveDetails = async () => {
    if (!task || !hasUnsavedChanges) return;
    const title = titleDraft.trim();
    if (!title) {
      setActionError("Название не может быть пустым");
      return;
    }
    await patchTask({
      title,
      description: descriptionDraft.trim() || null,
      dueAt: dueDateDraft ? new Date(dueDateDraft).toISOString() : null,
    });
  };

  const handleStatusChange = async (status: ProjectTaskStatus) => {
    if (!task || status === task.status) return;
    await patchTask({ status });
  };

  const handleCategoryChange = async (category: ProjectTaskCategory) => {
    if (!task || category === task.category) return;
    await patchTask({ category });
  };

  const handleAssigneeChange = async (assigneeEmail: string) => {
    if (!task) return;
    const nextEmail = assigneeEmail.trim() || null;
    const currentEmail = task.assigneeEmail?.trim() || null;
    if (nextEmail === currentEmail) return;
    await patchTask({ assigneeEmail: nextEmail });
  };

  const handleDelete = async () => {
    if (!task || !projectSlug) return;
    if (!confirm("Удалить задачу?")) return;
    setActionError(null);
    try {
      await deleteTask({ id: task.id, projectSlug }).unwrap();
      navigate(buildTaskPath(projectSlug, ""));
    } catch (error: unknown) {
      const err = error as { data?: { message?: string }; message?: string };
      setActionError(
        err?.data?.message ?? err?.message ?? "Не удалось удалить задачу",
      );
    }
  };

  const handleCopyLink = async () => {
    if (!task) return;
    const url = `${window.location.origin}${buildTaskPath(projectSlug, task.id, task.title)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyStatus("Ссылка скопирована");
      window.setTimeout(() => setCopyStatus(null), 2000);
    } catch {
      setCopyStatus("Не удалось скопировать");
      window.setTimeout(() => setCopyStatus(null), 2000);
    }
  };

  const listError =
    queryError && "status" in queryError
      ? queryError.status === 404
        ? "Задача не найдена"
        : queryError.status === 403
          ? "Нет доступа к задаче"
          : "Не удалось загрузить задачу"
      : null;

  return {
    accessToken,
    taskId,
    task,
    project,
    projectSlug,
    loading: isLoading,
    saving,
    deleting,
    error: actionError ?? listError,
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
    dueDateLabel,
    isOverdue,
    copyStatus,
    handleSaveDetails,
    handleStatusChange,
    handleCategoryChange,
    handleAssigneeChange,
    handleDelete,
    handleCopyLink,
  };
}

export type ProjectTaskDetailPageViewModel = ReturnType<
  typeof useProjectTaskDetailPage
>;
