import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  ProjectParticipantsResponse,
  ProjectCastMemberItem,
  TeamMemberItem,
  TeamMemberRole,
  TeamRoleDefinitionItem,
  TeamRoleDetails,
  TroupeMemberKind,
  TroupeMemberItem,
  TroupeResponse,
  TroupeSummary,
} from "../../../sync/api/troupe";

export type MyTroupeArgs = {
  month?: string;
};

export type TheaterTroupeArgs = {
  theaterId: string;
  month?: string;
};

export type {
  ProjectParticipantsResponse,
  ProjectCastMemberItem,
  TeamMemberItem,
  TeamMemberRole,
  TeamRoleDefinitionItem,
  TeamRoleDetails,
  TroupeMemberKind,
  TroupeMemberItem,
  TroupeResponse,
};

export const troupeApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    myTroupe: build.query<TroupeResponse, MyTroupeArgs>({
      query: ({ month }) => ({
        url: "/troupe",
        params: month ? { month } : undefined,
      }),
      providesTags: [{ type: "Troupe", id: "MY" }],
    }),

    theaterHomeTroupe: build.query<TroupeResponse, TheaterTroupeArgs>({
      query: ({ theaterId, month }) => ({
        url: `/workspaces/theaters/${encodeURIComponent(theaterId)}/troupe`,
        params: month ? { month } : undefined,
      }),
      providesTags: (_r, _e, { theaterId }) => [
        { type: "Troupe", id: `theater:${theaterId}` },
      ],
    }),

    projectParticipants: build.query<
      ProjectParticipantsResponse,
      { project: string; month?: string }
    >({
      query: ({ project, month }) => ({
        url: "/troupe/project-members",
        params: { project, ...(month ? { month } : {}) },
      }),
      providesTags: (_r, _e, { project }) => [
        { type: "Troupe", id: `project:${project}` },
      ],
    }),

    addTroupeMember: build.mutation<
      {
        id: string;
        token: string;
        invitePath: string;
        email: string;
        kind: TroupeMemberKind;
        pending: true;
        troupe: { id: string; title: string };
      },
      { email: string }
    >({
      query: ({ email }) => ({
        url: "/troupe/members",
        method: "POST",
        data: { email: email.trim() },
      }),
      invalidatesTags: [{ type: "Troupe", id: "MY" }, "Troupe", "Dashboard"],
    }),

    removeTroupeMember: build.mutation<
      void,
      { memberId: string }
    >({
      query: ({ memberId }) => ({
        url: `/troupe/members/${encodeURIComponent(memberId)}`,
        method: "DELETE",
      }),
      invalidatesTags: [{ type: "Troupe", id: "MY" }, "Troupe"],
    }),

    updateTroupeMemberKind: build.mutation<
      TroupeMemberItem,
      { memberId: string; kind: TroupeMemberKind }
    >({
      query: ({ memberId, kind }) => ({
        url: `/troupe/members/${encodeURIComponent(memberId)}`,
        method: "PATCH",
        data: { kind },
      }),
      invalidatesTags: [{ type: "Troupe", id: "MY" }, "Troupe"],
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
          Pick<
            TeamRoleDetails,
            "title" | "parentId" | "sortOrder" | "description" | "avatarKey"
          >
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
  useTheaterHomeTroupeQuery,
  useProjectParticipantsQuery,
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
