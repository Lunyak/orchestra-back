export type ProjectTaskStatus = "todo" | "in_progress" | "done" | "blocked";

export type ProjectTaskCategory =
  | "props"
  | "costume"
  | "light"
  | "sound"
  | "admin"
  | "production"
  | "other";

export type ProjectTaskSource = "manual" | "requisite";

export type ProjectTaskItem = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  category: ProjectTaskCategory;
  source: ProjectTaskSource;
  sourceKey: string | null;
  assigneeEmail: string | null;
  dueAt: string | null;
  refSceneId: number | null;
  refRequisiteId: number | null;
  refAction: string | null;
  sortOrder: number;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  canChangeStatus?: boolean;
};

export type ProjectTasksListResponse = {
  project: { id: string; slug: string; name: string };
  tasks: ProjectTaskItem[];
};

export type ProjectTaskDetailResponse = {
  project: { id: string; slug: string; name: string };
  task: ProjectTaskItem;
};

export type CreateProjectTaskPayload = {
  projectSlug: string;
  title: string;
  description?: string;
  status?: ProjectTaskStatus;
  category?: ProjectTaskCategory;
  assigneeEmail?: string;
  dueAt?: string;
};

export type UpdateProjectTaskPayload = {
  title?: string;
  description?: string;
  status?: ProjectTaskStatus;
  category?: ProjectTaskCategory;
  assigneeEmail?: string | null;
  dueAt?: string | null;
  sortOrder?: number;
};

export type ImportRequisiteTaskPayload = {
  title: string;
  sourceKey: string;
  assigneeEmail?: string;
  refSceneId: number;
  refRequisiteId: number;
  refAction: "setup" | "remove" | "use";
};

export type ImportRequisiteTasksPayload = {
  projectSlug: string;
  tasks: ImportRequisiteTaskPayload[];
};

export type ImportRequisiteTasksResponse = {
  created: number;
  skipped: number;
  tasks: ProjectTaskItem[];
};
