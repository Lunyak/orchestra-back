import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";

export type DashboardProject = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  workspace: {
    id: string;
    name: string;
    type: "PERSONAL" | "THEATER" | "TROUPE";
  };
};

export type DashboardRehearsal = {
  id: string;
  title: string;
  startsAt: string;
  durationMin: number | null;
  place: string | null;
  project: Pick<DashboardProject, "id" | "slug" | "name">;
};

export type DashboardTask = {
  id: string;
  title: string;
  status: "todo" | "in_progress" | "blocked";
  category: string;
  dueAt: string | null;
  project: Pick<DashboardProject, "id" | "slug" | "name">;
};

type DashboardActionBase = {
  id: string;
  title: string;
  dueAt: string | null;
};

export type DashboardInviteAction =
  | (DashboardActionBase & {
      kind: "studio_invite";
      description: string;
      invitedByEmail: string;
      studioId: string;
      studioTitle: string;
      role: "owner" | "teacher" | "student";
    })
  | (DashboardActionBase & {
      kind: "project_invite";
      description: string;
      invitedByEmail: string;
      project: Pick<DashboardProject, "id" | "slug" | "name">;
      role: string;
    })
  | (DashboardActionBase & {
      kind: "troupe_invite";
      description: string;
      invitedByEmail: string;
      troupe: { id: string; title: string };
      memberKind: "regular" | "guest";
    });

export type DashboardAction =
  | DashboardInviteAction
  | (DashboardActionBase & {
      kind: "director_session_invitation";
    })
  | (DashboardActionBase & {
      kind: "rehearsal_response";
      project: Pick<DashboardProject, "id" | "slug" | "name">;
    })
  | (DashboardActionBase & {
      kind: "studio_assignment";
      studioId: string;
      studioTitle: string;
    });

export type DashboardInviteKind = DashboardInviteAction["kind"];

export type DashboardResponse = {
  generatedAt: string;
  horizonDays: number;
  summary: {
    projects: number;
    upcomingRehearsals: number;
    openTasks: number;
    actions: number;
    unreadChat: number;
  };
  projects: DashboardProject[];
  rehearsals: DashboardRehearsal[];
  tasks: DashboardTask[];
  actions: DashboardAction[];
  chat: {
    totalUnread: number;
    conversations: Array<{
      id: string;
      kind: string;
      troupeId: string | null;
      title: string;
      unreadCount: number;
    }>;
  };
};

function inviteEndpoints(kind: DashboardInviteKind) {
  if (kind === "studio_invite") return "/studios/invites/by-id";
  if (kind === "project_invite") return "/projects/invites/by-id";
  return "/troupe/invites/by-id";
}

export const dashboardApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    globalDashboard: build.query<DashboardResponse, void>({
      query: () => ({ url: "/dashboard" }),
      providesTags: ["Dashboard"],
    }),
    answerDashboardInvite: build.mutation<
      unknown,
      { kind: DashboardInviteKind; inviteId: string; response: "accept" | "decline" }
    >({
      query: ({ kind, inviteId, response }) => ({
        url: `${inviteEndpoints(kind)}/${encodeURIComponent(inviteId)}/${response}`,
        method: "POST",
      }),
      invalidatesTags: ["Dashboard", "Studios", "ProjectMembers", "Troupe"],
    }),
    answerDashboardRehearsal: build.mutation<
      unknown,
      { rehearsalId: string; status: "present" | "absent" }
    >({
      query: ({ rehearsalId, status }) => ({
        url: `/rehearsals/${encodeURIComponent(rehearsalId)}/my-attendance`,
        method: "POST",
        data: { status },
      }),
      invalidatesTags: ["Dashboard", "RehearsalList"],
    }),
    answerDashboardDirectorSession: build.mutation<
      unknown,
      { sessionId: string; response: "confirm" | "decline" }
    >({
      query: ({ sessionId, response }) => ({
        url: `/director-sessions/${encodeURIComponent(sessionId)}/${
          response === "confirm" ? "confirm-attendance" : "decline-attendance"
        }`,
        method: "POST",
      }),
      invalidatesTags: ["Dashboard", "DirectorSessions"],
    }),
  }),
});

export const {
  useGlobalDashboardQuery,
  useAnswerDashboardInviteMutation,
  useAnswerDashboardRehearsalMutation,
  useAnswerDashboardDirectorSessionMutation,
} = dashboardApi;
