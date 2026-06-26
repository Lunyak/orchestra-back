import { getAccessToken } from "../../../shared/api/authenticated";
import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  DirectorSession,
  DirectorSessionParticipant,
} from "../../../sync/api/director-sessions";
import { projectApi } from "../../project/api/project-api";
import { syncPull } from "../../../sync/api/entity-sync";
import {
  loadDirectorSessions,
  type DirectorRehearsalSession,
} from "../directorSessionsSync";
import { buildProjectDataCacheFromPull } from "../model/build-project-data-cache";
import type { ProjectDataCache } from "../model/session-page-types";

export type DirectorSessionsBundle = {
  projectSlug: string;
  projectId: string;
  sessions: DirectorRehearsalSession[];
};

export type DirectorSessionAttendanceResponse = {
  ok: boolean;
  session: DirectorSession;
};

export const directorSessionsApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    directorSessionsBundle: build.query<DirectorSessionsBundle, void>({
      queryFn: async () => {
        const token = getAccessToken();
        if (!token) {
          return { error: { status: 401, message: "Нет токена авторизации" } };
        }
        try {
          const data = await loadDirectorSessions(token);
          return { data };
        } catch (e: unknown) {
          const err = e as { message?: string; response?: { data?: { message?: string } } };
          return {
            error: {
              status: 500,
              message:
                err?.response?.data?.message ||
                err?.message ||
                "Не удалось загрузить сессии",
            },
          };
        }
      },
      providesTags: [{ type: "DirectorSessions", id: "BUNDLE" }],
    }),

    replaceDirectorSessions: build.mutation<
      { ok: boolean },
      { sessions: DirectorRehearsalSession[] }
    >({
      query: ({ sessions }) => ({
        url: "/director-sessions",
        method: "PUT",
        data: { sessions },
      }),
    }),

    publishDirectorSession: build.mutation<
      { ok: boolean; telegramSent?: boolean; session?: DirectorSession },
      { sessionId: string; comment?: string | null }
    >({
      query: ({ sessionId, comment }) => ({
        url: `/director-sessions/${encodeURIComponent(sessionId)}/publish`,
        method: "POST",
        data: comment != null ? { comment } : null,
      }),
      invalidatesTags: [{ type: "DirectorSessions", id: "BUNDLE" }],
    }),

    remindDirectorSessionMissingAvailability: build.mutation<
      {
        ok: boolean;
        sentCount: number;
        skippedCount: number;
        totalWithoutAvailability: number;
      },
      string
    >({
      query: (sessionId) => ({
        url: `/director-sessions/${encodeURIComponent(sessionId)}/remind-missing-availability`,
        method: "POST",
      }),
    }),

    projectMaterial: build.query<ProjectDataCache[string], string>({
      queryFn: async (projectSlug, api) => {
        const token = getAccessToken();
        if (!token) {
          return { error: { status: 401, message: "Нет токена авторизации" } };
        }
        try {
          const pull = await syncPull(token, null, projectSlug, { scenes: true });
          const rolesRes = await api
            .dispatch(projectApi.endpoints.projectRoles.initiate(projectSlug))
            .unwrap()
            .catch(() => null);
          const data = buildProjectDataCacheFromPull(pull, projectSlug, rolesRes?.roles);
          return { data };
        } catch (e: unknown) {
          const err = e as { message?: string };
          return {
            error: {
              status: 500,
              message: err?.message ?? "Не удалось загрузить материалы проекта",
            },
          };
        }
      },
      providesTags: (_r, _e, slug) => [{ type: "ProjectMaterial", id: slug }],
    }),

    directorSession: build.query<DirectorRehearsalSession, string>({
      query: (sessionId) => ({
        url: `/director-sessions/${encodeURIComponent(sessionId)}`,
      }),
      providesTags: (_r, _e, sessionId) => [{ type: "DirectorSessions", id: sessionId }],
    }),

    confirmDirectorSessionAttendance: build.mutation<
      DirectorSessionAttendanceResponse,
      string
    >({
      query: (sessionId) => ({
        url: `/director-sessions/${encodeURIComponent(sessionId)}/confirm-attendance`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, sessionId) => [
        { type: "DirectorSessions", id: sessionId },
        { type: "DirectorSessions", id: "BUNDLE" },
      ],
    }),

    declineDirectorSessionAttendance: build.mutation<
      DirectorSessionAttendanceResponse,
      string
    >({
      query: (sessionId) => ({
        url: `/director-sessions/${encodeURIComponent(sessionId)}/decline-attendance`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, sessionId) => [
        { type: "DirectorSessions", id: sessionId },
        { type: "DirectorSessions", id: "BUNDLE" },
      ],
    }),
  }),
});

export const {
  useDirectorSessionsBundleQuery,
  useDirectorSessionQuery,
  useReplaceDirectorSessionsMutation,
  usePublishDirectorSessionMutation,
  useRemindDirectorSessionMissingAvailabilityMutation,
  useProjectMaterialQuery,
  useLazyProjectMaterialQuery,
  useConfirmDirectorSessionAttendanceMutation,
  useDeclineDirectorSessionAttendanceMutation,
} = directorSessionsApi;
