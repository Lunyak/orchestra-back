import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  CreateProjectTaskPayload,
  ImportRequisiteTasksPayload,
  ImportRequisiteTasksResponse,
  ProjectTaskDetailResponse,
  ProjectTaskItem,
  ProjectTasksListResponse,
  UpdateProjectTaskPayload,
} from "../../../sync/api/project-tasks";

const projectTasksTag = (projectSlug: string) => ({
  type: "ProjectTasks" as const,
  id: projectSlug,
});

const projectTaskTag = (id: string) => ({
  type: "ProjectTasks" as const,
  id: `task:${id}`,
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

    getProjectTask: build.query<ProjectTaskDetailResponse, string>({
      query: (id) => ({
        url: `/project-tasks/${encodeURIComponent(id)}`,
      }),
      providesTags: (_r, _e, id) => [projectTaskTag(id)],
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
      invalidatesTags: (_r, _e, { id, projectSlug }) => [
        projectTasksTag(projectSlug),
        projectTaskTag(id),
      ],
    }),

    deleteProjectTask: build.mutation<
      { ok: true },
      { id: string; projectSlug: string }
    >({
      query: ({ id }) => ({
        url: `/project-tasks/${encodeURIComponent(id)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { id, projectSlug }) => [
        projectTasksTag(projectSlug),
        projectTaskTag(id),
      ],
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
  useGetProjectTaskQuery,
  useCreateProjectTaskMutation,
  useUpdateProjectTaskMutation,
  useDeleteProjectTaskMutation,
  useImportRequisiteProjectTasksMutation,
} = projectTasksApi;
