import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  ProjectMemberInfo,
  ProjectRoleInfo,
} from "../../../sync/api/projects";
import type { TeamRoleDefinitionItem } from "../../../sync/api/troupe";

export type ProjectMembersResponse = {
  id: string;
  owner: { id: string; email: string; displayName?: string | null } | null;
  members: ProjectMemberInfo[];
};

export type ProjectAccessResponse = {
  project: {
    id: string;
    slug: string;
    name: string;
    workspaceId: string;
    workspaceType: "PERSONAL" | "THEATER" | "TROUPE";
    ownerId: string;
  };
  workspaceRole: "OWNER" | "ADMIN" | "MEMBER" | null;
  projectRole: "editor" | "viewer" | null;
  capabilities: {
    read: boolean;
    write: boolean;
    manageMembers: boolean;
    owner: boolean;
    admin: boolean;
  };
};

export type ProjectTeamRoleAssignee = {
  id: string;
  email: string;
  profile: {
    displayName: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl: string | null;
  } | null;
};

export type ProjectTeamRoleItem = {
  id: string;
  projectId: string;
  slug: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
  description: string;
  avatarKey: string | null;
  createdAt: string;
  updatedAt: string;
  assignmentCount: number;
  assignees: ProjectTeamRoleAssignee[];
  assignments: Array<{
    id: string;
    email: string;
    createdAt: string;
    assignee: ProjectTeamRoleAssignee;
  }>;
};

export type ProductionTeamResponse = {
  theater: { id: string; title: string } | null;
  theaterRoles: TeamRoleDefinitionItem[];
  projectRoles: ProjectTeamRoleItem[];
};

export const projectApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    projectRoles: build.query<
      { projectId: string; roles: ProjectRoleInfo[] },
      string
    >({
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

    projectAccess: build.query<ProjectAccessResponse, string>({
      query: (projectSlug) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/access`,
      }),
    }),

    inviteProjectMember: build.mutation<
      {
        id: string;
        token: string;
        invitePath: string;
        role: string;
        email: string;
        pending?: true;
      },
      { projectSlug: string; email: string; role?: string }
    >({
      query: ({ projectSlug, email, role }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/invite`,
        method: "POST",
        data: { email: email.trim(), role: role ?? "editor" },
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectMembers", id: projectSlug },
        "Dashboard",
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

    transferProjectOwnership: build.mutation<
      { ok: true; ownerId: string },
      { projectSlug: string; userId: string }
    >({
      query: ({ projectSlug, userId }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/transfer-ownership`,
        method: "POST",
        data: { userId },
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
      query: ({
        projectSlug,
        roleId,
        title,
        description,
        aliases,
        avatarKey,
      }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}`,
        method: "PUT",
        data: { title, description, aliases, avatarKey },
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProjectRoles", id: projectSlug },
      ],
    }),

    productionTeam: build.query<ProductionTeamResponse, string>({
      query: (projectSlug) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/production-team`,
      }),
      providesTags: (_r, _e, projectSlug) => [
        { type: "ProductionTeam", id: projectSlug },
      ],
    }),

    projectTeamRole: build.query<
      ProjectTeamRoleItem,
      { projectSlug: string; roleId: string }
    >({
      query: ({ projectSlug, roleId }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/team-roles/${encodeURIComponent(roleId)}`,
      }),
      providesTags: (_r, _e, { projectSlug, roleId }) => [
        { type: "ProductionTeam", id: `${projectSlug}:${roleId}` },
      ],
    }),

    createProjectTeamRole: build.mutation<
      ProjectTeamRoleItem,
      {
        projectSlug: string;
        title: string;
        parentId?: string | null;
        description?: string;
      }
    >({
      query: ({ projectSlug, title, parentId, description }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/team-roles`,
        method: "POST",
        data: { title, parentId, description },
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProductionTeam", id: projectSlug },
      ],
    }),

    updateProjectTeamRole: build.mutation<
      ProjectTeamRoleItem,
      {
        projectSlug: string;
        roleId: string;
        patch: {
          title?: string;
          parentId?: string | null;
          description?: string;
          avatarKey?: string | null;
        };
      }
    >({
      query: ({ projectSlug, roleId, patch }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/team-roles/${encodeURIComponent(roleId)}`,
        method: "PATCH",
        data: patch,
      }),
      invalidatesTags: (_r, _e, { projectSlug, roleId }) => [
        { type: "ProductionTeam", id: projectSlug },
        { type: "ProductionTeam", id: `${projectSlug}:${roleId}` },
      ],
    }),

    removeProjectTeamRole: build.mutation<
      { ok: true },
      { projectSlug: string; roleId: string }
    >({
      query: ({ projectSlug, roleId }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/team-roles/${encodeURIComponent(roleId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectSlug }) => [
        { type: "ProductionTeam", id: projectSlug },
      ],
    }),

    addProjectTeamRoleAssignment: build.mutation<
      ProjectTeamRoleItem,
      { projectSlug: string; roleId: string; email: string }
    >({
      query: ({ projectSlug, roleId, email }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/team-roles/${encodeURIComponent(roleId)}/assignments`,
        method: "POST",
        data: { email },
      }),
      invalidatesTags: (_r, _e, { projectSlug, roleId }) => [
        { type: "ProductionTeam", id: projectSlug },
        { type: "ProductionTeam", id: `${projectSlug}:${roleId}` },
      ],
    }),

    removeProjectTeamRoleAssignment: build.mutation<
      ProjectTeamRoleItem,
      { projectSlug: string; roleId: string; assignmentId: string }
    >({
      query: ({ projectSlug, roleId, assignmentId }) => ({
        url: `/projects/${encodeURIComponent(projectSlug)}/team-roles/${encodeURIComponent(roleId)}/assignments/${encodeURIComponent(assignmentId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { projectSlug, roleId }) => [
        { type: "ProductionTeam", id: projectSlug },
        { type: "ProductionTeam", id: `${projectSlug}:${roleId}` },
      ],
    }),
  }),
});

export const {
  useProjectRolesQuery,
  useProjectMembersQuery,
  useProjectAccessQuery,
  useInviteProjectMemberMutation,
  useUpdateProjectMemberRoleMutation,
  useRemoveProjectMemberMutation,
  useTransferProjectOwnershipMutation,
  useCreateProjectRoleMutation,
  useDeleteProjectRoleMutation,
  useSetProjectRoleAssignmentsMutation,
  useUpdateProjectRoleMutation,
  useProductionTeamQuery,
  useProjectTeamRoleQuery,
  useCreateProjectTeamRoleMutation,
  useUpdateProjectTeamRoleMutation,
  useRemoveProjectTeamRoleMutation,
  useAddProjectTeamRoleAssignmentMutation,
  useRemoveProjectTeamRoleAssignmentMutation,
} = projectApi;
