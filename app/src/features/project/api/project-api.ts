import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type { ProjectMemberInfo, ProjectRoleInfo } from "../../../sync/api/projects";

export type ProjectMembersResponse = {
  id: string;
  owner: { id: string; email: string; displayName?: string | null } | null;
  members: ProjectMemberInfo[];
};

export const projectApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    projectRoles: build.query<{ projectId: string; roles: ProjectRoleInfo[] }, string>({
      query: (projectSlug) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/roles`,
      }),
      providesTags: (_result, _err, projectSlug) => [
        { type: "ProjectRoles", id: projectSlug },
      ],
    }),

    projectMembers: build.query<ProjectMembersResponse, string>({
      query: (projectSlug) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/members`,
      }),
      providesTags: (_result, _err, projectSlug) => [
        { type: "ProjectMembers", id: projectSlug },
      ],
    }),

    inviteProjectMember: build.mutation<
      { id: string; projectId: string; userId: string; role: string },
      { projectSlug: string; email: string; role?: string }
    >({
      query: ({ projectSlug, email, role }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/invite`,
        method: "POST",
        data: { email: email.trim(), role: role ?? "editor" },
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectMembers", id: projectSlug },
      ],
    }),

    updateProjectMemberRole: build.mutation<
      ProjectMemberInfo,
      {
        projectSlug: string;
        memberId: string;
        role: "editor" | "viewer";
      }
    >({
      query: ({ projectSlug, memberId, role }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/members/${encodeURIComponent(memberId)}`,
        method: "PATCH",
        data: { role },
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectMembers", id: projectSlug },
      ],
    }),

    removeProjectMember: build.mutation<
      void,
      { projectSlug: string; memberId: string }
    >({
      query: ({ projectSlug, memberId }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/members/${encodeURIComponent(memberId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectMembers", id: projectSlug },
      ],
    }),

    createProjectRole: build.mutation<
      { ok: boolean; roleId: string },
      {
        projectSlug: string;
        title: string;
        description?: string;
        aliases?: string[];
      }
    >({
      query: ({ projectSlug, title, description, aliases }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/roles`,
        method: "POST",
        data: { title, description, aliases: aliases ?? [] },
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectRoles", id: projectSlug },
      ],
    }),

    deleteProjectRole: build.mutation<
      { ok: boolean; deleted?: number },
      { projectSlug: string; roleId: string }
    >({
      query: ({ projectSlug, roleId }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectRoles", id: projectSlug },
      ],
    }),

    setProjectRoleAssignments: build.mutation<
      { ok: boolean },
      { projectSlug: string; roleId: string; emails: string[] }
    >({
      query: ({ projectSlug, roleId, emails }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}/assignments`,
        method: "PUT",
        data: { emails },
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectRoles", id: projectSlug },
      ],
    }),

    updateProjectRole: build.mutation<
      { ok: boolean; roleId: string },
      {
        projectSlug: string;
        roleId: string;
        title?: string;
        description?: string;
        aliases?: string[];
        avatarKey?: string | null;
      }
    >({
      query: ({ projectSlug, roleId, title, description, aliases, avatarKey }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}`,
        method: "PUT",
        data: { title, description, aliases, avatarKey },
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectRoles", id: projectSlug },
      ],
    }),
  }),
});

export const {
  useProjectRolesQuery,
  useProjectMembersQuery,
  useInviteProjectMemberMutation,
  useUpdateProjectMemberRoleMutation,
  useRemoveProjectMemberMutation,
  useCreateProjectRoleMutation,
  useDeleteProjectRoleMutation,
  useSetProjectRoleAssignmentsMutation,
  useUpdateProjectRoleMutation,
} = projectApi;
