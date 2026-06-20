import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  MyTroupeResponse,
  ProjectCastMemberItem,
  TeamMemberItem,
  TeamMemberRole,
  TeamRoleDefinitionItem,
  TeamRoleDetails,
  TroupeMemberKind,
  TroupeMemberItem,
  TroupeSummary,
} from "../../../sync/api/troupe";

export type MyTroupeArgs = {
  project: string;
  month?: string;
};

export type {
  MyTroupeResponse,
  ProjectCastMemberItem,
  TeamMemberItem,
  TeamMemberRole,
  TeamRoleDefinitionItem,
  TeamRoleDetails,
  TroupeMemberKind,
  TroupeMemberItem,
};

export const troupeApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    myTroupe: build.query<MyTroupeResponse, MyTroupeArgs>({
      query: ({ project, month }) => ({
        url: "/troupe",
        params: {
          project,
          ...(month ? { month } : {}),
        },
      }),
      providesTags: (_r, _e, arg) => [
        { type: "Troupe", id: `${arg.project}:${arg.month ?? ""}` },
      ],
    }),

    addTroupeMember: build.mutation<
      TroupeMemberItem,
      { project: string; email: string; month?: string }
    >({
      query: ({ project, email }) => ({
        url: "/troupe/members",
        method: "POST",
        data: { email: email.trim() },
        params: { project },
      }),
      invalidatesTags: (_r, _e, { project, month }) => [
        { type: "Troupe", id: `${project}:${month ?? ""}` },
        { type: "Troupe", id: `${project}:` },
      ],
    }),

    removeTroupeMember: build.mutation<
      void,
      { project: string; memberId: string; month?: string }
    >({
      query: ({ project, memberId }) => ({
        url: `/troupe/members/${encodeURIComponent(memberId)}`,
        method: "DELETE",
        params: { project },
      }),
      invalidatesTags: (_r, _e, { project, month }) => [
        { type: "Troupe", id: `${project}:${month ?? ""}` },
        { type: "Troupe", id: `${project}:` },
      ],
    }),

    updateTroupeMemberKind: build.mutation<
      TroupeMemberItem,
      { project: string; memberId: string; kind: TroupeMemberKind; month?: string }
    >({
      query: ({ project, memberId, kind }) => ({
        url: `/troupe/members/${encodeURIComponent(memberId)}`,
        method: "PATCH",
        data: { kind },
        params: { project },
      }),
      invalidatesTags: (_r, _e, { project, month }) => [
        { type: "Troupe", id: `${project}:${month ?? ""}` },
        { type: "Troupe", id: `${project}:` },
      ],
    }),

    patchTroupeTitle: build.mutation<TroupeSummary, { title: string }>({
      query: ({ title }) => ({
        url: "/troupe",
        method: "PATCH",
        data: { title: title.trim() },
      }),
      invalidatesTags: ["Troupe"],
    }),

    addTeamMember: build.mutation<
      TeamMemberItem,
      { email: string; roles: TeamMemberRole[] }
    >({
      query: ({ email, roles }) => ({
        url: "/troupe/team-members",
        method: "POST",
        data: { email: email.trim(), roles },
      }),
      invalidatesTags: ["Troupe"],
    }),

    updateTeamMember: build.mutation<
      TeamMemberItem,
      { memberId: string; roles: TeamMemberRole[] }
    >({
      query: ({ memberId, roles }) => ({
        url: `/troupe/team-members/${encodeURIComponent(memberId)}`,
        method: "PATCH",
        data: { roles },
      }),
      invalidatesTags: ["Troupe"],
    }),

    removeTeamMember: build.mutation<void, { memberId: string }>({
      query: ({ memberId }) => ({
        url: `/troupe/team-members/${encodeURIComponent(memberId)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Troupe"],
    }),

    teamRoles: build.query<TeamRoleDefinitionItem[], void>({
      query: () => ({
        url: "/troupe/team-roles",
      }),
      providesTags: ["Troupe"],
    }),

    teamRole: build.query<TeamRoleDetails, { roleId: string }>({
      query: ({ roleId }) => ({
        url: `/troupe/team-roles/${encodeURIComponent(roleId)}`,
      }),
      providesTags: (_r, _e, { roleId }) => [
        { type: "Troupe", id: `team-role:${roleId}` },
      ],
    }),

    createTeamRole: build.mutation<
      TeamRoleDetails,
      {
        title: string;
        parentId?: string | null;
        sortOrder?: number;
        description?: string;
      }
    >({
      query: (data) => ({
        url: "/troupe/team-roles",
        method: "POST",
        data,
      }),
      invalidatesTags: ["Troupe"],
    }),

    updateTeamRole: build.mutation<
      TeamRoleDetails,
      {
        roleId: string;
        patch: Partial<
          Pick<TeamRoleDetails, "title" | "parentId" | "sortOrder" | "description">
        >;
      }
    >({
      query: ({ roleId, patch }) => ({
        url: `/troupe/team-roles/${encodeURIComponent(roleId)}`,
        method: "PATCH",
        data: patch,
      }),
      invalidatesTags: (_r, _e, { roleId }) => [
        "Troupe",
        { type: "Troupe", id: `team-role:${roleId}` },
      ],
    }),

    removeTeamRole: build.mutation<void, { roleId: string }>({
      query: ({ roleId }) => ({
        url: `/troupe/team-roles/${encodeURIComponent(roleId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { roleId }) => [
        "Troupe",
        { type: "Troupe", id: `team-role:${roleId}` },
      ],
    }),

    addTeamRoleAssignment: build.mutation<
      TeamRoleDetails,
      { roleId: string; email: string }
    >({
      query: ({ roleId, email }) => ({
        url: `/troupe/team-roles/${encodeURIComponent(roleId)}/assignments`,
        method: "POST",
        data: { email: email.trim() },
      }),
      invalidatesTags: (_r, _e, { roleId }) => [
        "Troupe",
        { type: "Troupe", id: `team-role:${roleId}` },
      ],
    }),

    removeTeamRoleAssignment: build.mutation<
      void,
      { roleId: string; assignmentId: string }
    >({
      query: ({ roleId, assignmentId }) => ({
        url: `/troupe/team-roles/${encodeURIComponent(
          roleId,
        )}/assignments/${encodeURIComponent(assignmentId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { roleId }) => [
        "Troupe",
        { type: "Troupe", id: `team-role:${roleId}` },
      ],
    }),
  }),
});

export const {
  useMyTroupeQuery,
  useAddTroupeMemberMutation,
  useRemoveTroupeMemberMutation,
  useUpdateTroupeMemberKindMutation,
  usePatchTroupeTitleMutation,
  useAddTeamMemberMutation,
  useUpdateTeamMemberMutation,
  useRemoveTeamMemberMutation,
  useTeamRolesQuery,
  useTeamRoleQuery,
  useCreateTeamRoleMutation,
  useUpdateTeamRoleMutation,
  useRemoveTeamRoleMutation,
  useAddTeamRoleAssignmentMutation,
  useRemoveTeamRoleAssignmentMutation,
} = troupeApi;
