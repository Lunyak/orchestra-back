import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  AddStudioMemberPayload,
  CreateStudioAssignmentPayload,
  CreateStudioInvitePayload,
  CreateStudioInviteResponse,
  CreateStudioLessonPayload,
  CreateStudioMarkerPayload,
  CreateStudioModulePayload,
  CreateStudioPayload,
  CreateStudioVideoPayload,
  GradeStudioSubmissionPayload,
  ReviewStudioLessonProgressPayload,
  StudioAssignmentDetail,
  StudioDetail,
  StudioInviteItem,
  StudioInvitesListResponse,
  StudioInvitePreview,
  StudioLessonDetail,
  StudioLessonProgress,
  StudioMemberItem,
  StudioProgramLesson,
  StudioProgramModule,
  StudioSubmissionItem,
  StudioVideoDetail,
  StudioVideoMarker,
  StudioVideoSummary,
  StudiosListResponse,
  SubmitStudioAssignmentPayload,
  SubmitStudioLessonPayload,
  UpdateStudioAssignmentPayload,
  UpdateStudioLessonPayload,
  UpdateStudioMarkerPayload,
  UpdateStudioMemberPayload,
  UpdateStudioModulePayload,
  UpdateStudioPayload,
  UpdateStudioVideoPayload,
} from "../../../sync/api/studio";

export const studioApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    listStudios: build.query<StudiosListResponse, void>({
      query: () => ({ url: "/studios" }),
      providesTags: ["Studios"],
    }),

    getStudio: build.query<StudioDetail, string>({
      query: (id) => ({ url: `/studios/${encodeURIComponent(id)}` }),
      providesTags: (_r, _e, id) => [
        { type: "Studios", id },
        { type: "StudioDetail", id },
      ],
    }),

    createStudio: build.mutation<StudioDetail, CreateStudioPayload>({
      query: (body) => ({ url: "/studios", method: "POST", data: body }),
      invalidatesTags: ["Studios"],
    }),

    updateStudio: build.mutation<
      StudioDetail,
      { id: string; body: UpdateStudioPayload }
    >({
      query: ({ id, body }) => ({
        url: `/studios/${encodeURIComponent(id)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { id }) => [
        "Studios",
        { type: "Studios", id },
        { type: "StudioDetail", id },
      ],
    }),

    deleteStudio: build.mutation<{ ok: true }, string>({
      query: (id) => ({
        url: `/studios/${encodeURIComponent(id)}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Studios"],
    }),

    addStudioMember: build.mutation<
      StudioMemberItem,
      { studioId: string; body: AddStudioMemberPayload }
    >({
      query: ({ studioId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/members`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    updateStudioMember: build.mutation<
      StudioMemberItem,
      { studioId: string; memberId: string; body: UpdateStudioMemberPayload }
    >({
      query: ({ studioId, memberId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/members/${encodeURIComponent(memberId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    removeStudioMember: build.mutation<
      { ok: true },
      { studioId: string; memberId: string }
    >({
      query: ({ studioId, memberId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/members/${encodeURIComponent(memberId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    listStudioInvites: build.query<StudioInviteItem[], string>({
      query: (studioId) => ({
        url: `/studios/${encodeURIComponent(studioId)}/invites`,
      }),
      transformResponse: (response: StudioInviteItem[] | StudioInvitesListResponse) => {
        if (Array.isArray(response)) return response;
        return response.invites ?? [];
      },
      providesTags: (_r, _e, studioId) => [
        { type: "StudioInvites", id: studioId },
      ],
    }),

    createStudioInvite: build.mutation<
      CreateStudioInviteResponse,
      { studioId: string; body: CreateStudioInvitePayload }
    >({
      query: ({ studioId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/invites`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioInvites", id: studioId },
      ],
    }),

    revokeStudioInvite: build.mutation<
      { ok: true },
      { studioId: string; inviteId: string }
    >({
      query: ({ studioId, inviteId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/invites/${encodeURIComponent(inviteId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioInvites", id: studioId },
      ],
    }),

    previewStudioInvite: build.query<StudioInvitePreview, string>({
      query: (token) => ({
        url: `/studios/invites/${encodeURIComponent(token)}`,
      }),
    }),

    acceptStudioInvite: build.mutation<StudioDetail, string>({
      query: (token) => ({
        url: `/studios/invites/${encodeURIComponent(token)}/accept`,
        method: "POST",
      }),
      invalidatesTags: ["Studios"],
    }),

    createStudioModule: build.mutation<
      StudioProgramModule,
      { studioId: string; body: CreateStudioModulePayload }
    >({
      query: ({ studioId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    updateStudioModule: build.mutation<
      StudioProgramModule,
      { studioId: string; moduleId: string; body: UpdateStudioModulePayload }
    >({
      query: ({ studioId, moduleId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules/${encodeURIComponent(moduleId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    deleteStudioModule: build.mutation<
      { ok: true },
      { studioId: string; moduleId: string }
    >({
      query: ({ studioId, moduleId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules/${encodeURIComponent(moduleId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    createStudioLesson: build.mutation<
      StudioProgramLesson,
      { studioId: string; moduleId: string; body: CreateStudioLessonPayload }
    >({
      query: ({ studioId, moduleId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules/${encodeURIComponent(moduleId)}/lessons`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    updateStudioLesson: build.mutation<
      StudioProgramLesson,
      {
        studioId: string;
        moduleId: string;
        lessonId: string;
        body: UpdateStudioLessonPayload;
      }
    >({
      query: ({ studioId, moduleId, lessonId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId, lessonId }) => [
        { type: "StudioDetail", id: studioId },
        { type: "StudioLessons", id: lessonId },
      ],
    }),

    deleteStudioLesson: build.mutation<
      { ok: true },
      { studioId: string; moduleId: string; lessonId: string }
    >({
      query: ({ studioId, moduleId, lessonId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { studioId, lessonId }) => [
        { type: "StudioDetail", id: studioId },
        { type: "StudioLessons", id: lessonId },
      ],
    }),

    getStudioLesson: build.query<
      StudioLessonDetail,
      { studioId: string; moduleId: string; lessonId: string }
    >({
      query: ({ studioId, moduleId, lessonId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}`,
      }),
      providesTags: (_r, _e, { lessonId }) => [
        { type: "StudioLessons", id: lessonId },
      ],
    }),

    submitStudioLesson: build.mutation<
      StudioLessonProgress,
      {
        studioId: string;
        moduleId: string;
        lessonId: string;
        body: SubmitStudioLessonPayload;
      }
    >({
      query: ({ studioId, moduleId, lessonId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}/submit`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId, lessonId }) => [
        { type: "StudioDetail", id: studioId },
        { type: "StudioLessons", id: lessonId },
      ],
    }),

    reviewStudioLessonProgress: build.mutation<
      StudioLessonProgress,
      {
        studioId: string;
        moduleId: string;
        lessonId: string;
        progressId: string;
        body: ReviewStudioLessonProgressPayload;
      }
    >({
      query: ({ studioId, moduleId, lessonId, progressId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/modules/${encodeURIComponent(moduleId)}/lessons/${encodeURIComponent(lessonId)}/progress/${encodeURIComponent(progressId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId, lessonId }) => [
        { type: "StudioDetail", id: studioId },
        { type: "StudioLessons", id: lessonId },
      ],
    }),

    getStudioAssignment: build.query<
      StudioAssignmentDetail,
      { studioId: string; assignmentId: string }
    >({
      query: ({ studioId, assignmentId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/assignments/${encodeURIComponent(assignmentId)}`,
      }),
      providesTags: (_r, _e, { assignmentId }) => [
        { type: "StudioAssignments", id: assignmentId },
      ],
    }),

    createStudioAssignment: build.mutation<
      StudioAssignmentDetail,
      { studioId: string; body: CreateStudioAssignmentPayload }
    >({
      query: ({ studioId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/assignments`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    updateStudioAssignment: build.mutation<
      StudioAssignmentDetail,
      {
        studioId: string;
        assignmentId: string;
        body: UpdateStudioAssignmentPayload;
      }
    >({
      query: ({ studioId, assignmentId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/assignments/${encodeURIComponent(assignmentId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId, assignmentId }) => [
        { type: "StudioDetail", id: studioId },
        { type: "StudioAssignments", id: assignmentId },
      ],
    }),

    deleteStudioAssignment: build.mutation<
      { ok: true },
      { studioId: string; assignmentId: string }
    >({
      query: ({ studioId, assignmentId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/assignments/${encodeURIComponent(assignmentId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    submitStudioAssignment: build.mutation<
      StudioSubmissionItem,
      {
        studioId: string;
        assignmentId: string;
        body: SubmitStudioAssignmentPayload;
      }
    >({
      query: ({ studioId, assignmentId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/assignments/${encodeURIComponent(assignmentId)}/submit`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId, assignmentId }) => [
        { type: "StudioDetail", id: studioId },
        { type: "StudioAssignments", id: assignmentId },
      ],
    }),

    gradeStudioSubmission: build.mutation<
      StudioSubmissionItem,
      {
        studioId: string;
        assignmentId: string;
        submissionId: string;
        body: GradeStudioSubmissionPayload;
      }
    >({
      query: ({ studioId, assignmentId, submissionId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/grade`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId, assignmentId }) => [
        { type: "StudioDetail", id: studioId },
        { type: "StudioAssignments", id: assignmentId },
      ],
    }),

    getStudioVideo: build.query<
      StudioVideoDetail,
      { studioId: string; videoId: string }
    >({
      query: ({ studioId, videoId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/videos/${encodeURIComponent(videoId)}`,
      }),
      providesTags: (_r, _e, { videoId }) => [
        { type: "StudioVideos", id: videoId },
      ],
    }),

    createStudioVideo: build.mutation<
      StudioVideoSummary,
      { studioId: string; body: CreateStudioVideoPayload }
    >({
      query: ({ studioId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/videos`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    updateStudioVideo: build.mutation<
      StudioVideoSummary,
      { studioId: string; videoId: string; body: UpdateStudioVideoPayload }
    >({
      query: ({ studioId, videoId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/videos/${encodeURIComponent(videoId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { studioId, videoId }) => [
        { type: "StudioDetail", id: studioId },
        { type: "StudioVideos", id: videoId },
      ],
    }),

    deleteStudioVideo: build.mutation<
      { ok: true },
      { studioId: string; videoId: string }
    >({
      query: ({ studioId, videoId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/videos/${encodeURIComponent(videoId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { studioId }) => [
        { type: "StudioDetail", id: studioId },
      ],
    }),

    createStudioMarker: build.mutation<
      StudioVideoMarker,
      { studioId: string; videoId: string; body: CreateStudioMarkerPayload }
    >({
      query: ({ studioId, videoId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/videos/${encodeURIComponent(videoId)}/markers`,
        method: "POST",
        data: body,
      }),
      invalidatesTags: (_r, _e, { videoId }) => [
        { type: "StudioVideos", id: videoId },
      ],
    }),

    updateStudioMarker: build.mutation<
      StudioVideoMarker,
      {
        studioId: string;
        videoId: string;
        markerId: string;
        body: UpdateStudioMarkerPayload;
      }
    >({
      query: ({ studioId, videoId, markerId, body }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/videos/${encodeURIComponent(videoId)}/markers/${encodeURIComponent(markerId)}`,
        method: "PATCH",
        data: body,
      }),
      invalidatesTags: (_r, _e, { videoId }) => [
        { type: "StudioVideos", id: videoId },
      ],
    }),

    deleteStudioMarker: build.mutation<
      { ok: true },
      { studioId: string; videoId: string; markerId: string }
    >({
      query: ({ studioId, videoId, markerId }) => ({
        url: `/studios/${encodeURIComponent(studioId)}/videos/${encodeURIComponent(videoId)}/markers/${encodeURIComponent(markerId)}`,
        method: "DELETE",
      }),
      invalidatesTags: (_r, _e, { videoId }) => [
        { type: "StudioVideos", id: videoId },
      ],
    }),
  }),
});

export const {
  useListStudiosQuery,
  useGetStudioQuery,
  useCreateStudioMutation,
  useUpdateStudioMutation,
  useDeleteStudioMutation,
  useAddStudioMemberMutation,
  useUpdateStudioMemberMutation,
  useRemoveStudioMemberMutation,
  useListStudioInvitesQuery,
  useCreateStudioInviteMutation,
  useRevokeStudioInviteMutation,
  usePreviewStudioInviteQuery,
  useAcceptStudioInviteMutation,
  useCreateStudioModuleMutation,
  useUpdateStudioModuleMutation,
  useDeleteStudioModuleMutation,
  useCreateStudioLessonMutation,
  useUpdateStudioLessonMutation,
  useDeleteStudioLessonMutation,
  useGetStudioLessonQuery,
  useSubmitStudioLessonMutation,
  useReviewStudioLessonProgressMutation,
  useGetStudioAssignmentQuery,
  useCreateStudioAssignmentMutation,
  useUpdateStudioAssignmentMutation,
  useDeleteStudioAssignmentMutation,
  useSubmitStudioAssignmentMutation,
  useGradeStudioSubmissionMutation,
  useGetStudioVideoQuery,
  useCreateStudioVideoMutation,
  useUpdateStudioVideoMutation,
  useDeleteStudioVideoMutation,
  useCreateStudioMarkerMutation,
  useUpdateStudioMarkerMutation,
  useDeleteStudioMarkerMutation,
} = studioApi;
