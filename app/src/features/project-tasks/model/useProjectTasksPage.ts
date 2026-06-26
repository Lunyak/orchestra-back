import { useMemo, useState } from "react";
import { useAuth } from "../../auth";
import { useMyProfileQuery } from "../../profile/api/profile-api";
import { useProject } from "../../project";
import { useProjectMembersQuery } from "../../project/api/project-api";
import { usePlaybook } from "../../playbook";
import { useMyTroupeQuery } from "../../troupe/api/troupe-api";
import { memberLabel } from "../../troupe/model/troupe-page-utils";
import {
  useCreateProjectTaskMutation,
  useDeleteProjectTaskMutation,
  useImportRequisiteProjectTasksMutation,
  useListProjectTasksQuery,
  useUpdateProjectTaskMutation,
} from "../api/project-tasks-api";
import { buildRequisiteTaskImports, countRequisiteTaskImports } from "./build-requisite-task-imports";
import { mergeTaskAssigneeMembers } from "./merge-task-assignee-members";
import {
  isProjectTaskOpen,
  type ProjectTaskFilter,
} from "./project-task-labels";
import type {
  ProjectTaskCategory,
  ProjectTaskItem,
  ProjectTaskStatus,
} from "../../../sync/api/project-tasks";

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

export function useProjectTasksPage() {
  const { accessToken } = useAuth();
  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });
  const { projectName } = useProject();
  const { scenes } = usePlaybook();
  const [filter, setFilter] = useState<ProjectTaskFilter>("open");
  const [newTitle, setNewTitle] = useState("");
  const [newAssigneeEmail, setNewAssigneeEmail] = useState("");
  const [newCategory, setNewCategory] = useState<ProjectTaskCategory>("other");
  const [newDueDate, setNewDueDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const projectSlug = projectName ?? "";
  const myEmail = normalizeEmail(myProfile?.email);

  const {
    data,
    isLoading,
    error: queryError,
  } = useListProjectTasksQuery(projectSlug, {
    skip: !accessToken || !projectSlug,
  });

  const { data: projectMembersData } = useProjectMembersQuery(projectSlug, {
    skip: !accessToken || !projectSlug,
  });

  const [createTask, { isLoading: creating }] = useCreateProjectTaskMutation();
  const [updateTask] = useUpdateProjectTaskMutation();
  const [deleteTask] = useDeleteProjectTaskMutation();
  const [importRequisites, { isLoading: importingRequisites }] =
    useImportRequisiteProjectTasksMutation();

  const { data: troupeData } = useMyTroupeQuery(
    { project: projectSlug },
    { skip: !accessToken || !projectSlug },
  );

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
    () =>
      assigneeMembers.map((member) => {
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
    [assigneeMembers],
  );

  const requisiteImportCount = useMemo(
    () => countRequisiteTaskImports(scenes),
    [scenes],
  );

  const tasks = data?.tasks ?? [];

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === "mine") {
        return normalizeEmail(task.assigneeEmail) === myEmail;
      }
      if (filter === "open") {
        return isProjectTaskOpen(task.status);
      }
      return true;
    });
  }, [filter, myEmail, tasks]);

  const openTasksCount = useMemo(
    () => tasks.filter((task) => isProjectTaskOpen(task.status)).length,
    [tasks],
  );

  const myOpenTasksCount = useMemo(
    () =>
      tasks.filter(
        (task) =>
          isProjectTaskOpen(task.status) &&
          normalizeEmail(task.assigneeEmail) === myEmail,
      ).length,
    [myEmail, tasks],
  );

  const handleCreateTask = async () => {
    const title = newTitle.trim();
    if (!projectSlug || !title) return;
    setActionError(null);
    try {
      await createTask({
        projectSlug,
        title,
        category: newCategory,
        assigneeEmail: newAssigneeEmail.trim() || undefined,
        dueAt: newDueDate ? new Date(newDueDate).toISOString() : undefined,
      }).unwrap();
      setNewTitle("");
      setNewDueDate("");
    } catch (error: unknown) {
      const err = error as { data?: { message?: string }; message?: string };
      setActionError(
        err?.data?.message ?? err?.message ?? "Не удалось создать задачу",
      );
    }
  };

  const handleUpdateTaskStatus = async (
    task: ProjectTaskItem,
    status: ProjectTaskStatus,
  ) => {
    if (!projectSlug) return;
    setActionError(null);
    try {
      await updateTask({
        id: task.id,
        projectSlug,
        body: { status },
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
          ? "Статус может менять только исполнитель или создатель задачи"
          : err?.data?.message ?? err?.message ?? "Не удалось обновить задачу",
      );
    }
  };

  const handleDeleteTask = async (task: ProjectTaskItem) => {
    if (!projectSlug) return;
    setActionError(null);
    try {
      await deleteTask({ id: task.id, projectSlug }).unwrap();
    } catch (error: unknown) {
      const err = error as { data?: { message?: string }; message?: string };
      setActionError(
        err?.data?.message ?? err?.message ?? "Не удалось удалить задачу",
      );
    }
  };

  const handleImportRequisites = async () => {
    if (!projectSlug) return;
    const imports = buildRequisiteTaskImports(scenes);
    if (!imports.length) return;
    setActionError(null);
    try {
      await importRequisites({ projectSlug, tasks: imports }).unwrap();
    } catch (error: unknown) {
      const err = error as { data?: { message?: string }; message?: string };
      setActionError(
        err?.data?.message ?? err?.message ?? "Не удалось импортировать задачи",
      );
    }
  };

  const listError =
    queryError && "status" in queryError
      ? "Не удалось загрузить задачи"
      : null;

  return {
    accessToken,
    projectSlug,
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
    assigneeMembers,
    assigneeMemberByEmail,
    assigneeSelectOptions,
    tasks: filteredTasks,
    totalTasksCount: tasks.length,
    openTasksCount,
    myOpenTasksCount,
    requisiteImportCount,
    loading: isLoading,
    creating,
    importingRequisites,
    error: actionError ?? listError,
    handleCreateTask,
    handleUpdateTaskStatus,
    handleDeleteTask,
    handleImportRequisites,
  };
}

export type ProjectTasksPageViewModel = ReturnType<typeof useProjectTasksPage>;
