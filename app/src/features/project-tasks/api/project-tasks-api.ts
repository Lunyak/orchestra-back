import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  CreateProjectTaskPayload,
  ImportRequisiteTasksPayload,
  ImportRequisiteTasksResponse,
  ProjectTaskItem,
  ProjectTasksListResponse,
  UpdateProjectTaskPayload,
} from "../../../sync/api/project-tasks";

const projectTasksTag = (projectSlug: string) => ({
  type: "ProjectTasks" as const,
  id: projectSlug,
});

export const projectTasksApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    listProjectTasks: build.query<ProjectTasksListResponse, string>({
      query: (projectSlug) => ({
        url: "/project-tasks",
        params: { projectSlug },
      }),
      providesTags: (_r, _e, projectSlug) => [projectTasksTag(projectSlug)],
    }),

    createProjectTask: build.mutation<ProjectTaskItem, CreateProjectTaskPayload>({
      query: (body) => ({
        url: "/project-tasks",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, body) => [projectTasksTag(body.projectSlug)],
    }),

    updateProjectTask: build.mutation<
      ProjectTaskItem,
      { id: string; projectSlug: string; body: UpdateProjectTaskPayload }
    >({
      query: ({ id, body }) => ({
        url: `/project-tasks/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [projectTasksTag(projectSlug)],
    }),

    deleteProjectTask: build.mutation<
      { ok: true },
      { id: string; projectSlug: string }
    >({
      query: ({ id }) => ({
        url: `/project-tasks/${encodeURIComponent(id)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [projectTasksTag(projectSlug)],
    }),

    importRequisiteProjectTasks: build.mutation<
      ImportRequisiteTasksResponse,
      ImportRequisiteTasksPayload
    >({
      query: (body) => ({
        url: "/project-tasks/import-requisites",
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, body) => [projectTasksTag(body.projectSlug)],
    }),
  }),
});

export const {
  useListProjectTasksQuery,
  useCreateProjectTaskMutation,
  useUpdateProjectTaskMutation,
  useDeleteProjectTaskMutation,
  useImportRequisiteProjectTasksMutation,
} = projectTasksApi;
