import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  Rehearsal,
  RehearsalSelectedScene,
} from "../../../sync/api/rehearsals";

export type RehearsalListArgs = {
  projectSlug: string;
  from?: string;
  to?: string;
};

export type RehearsalListResponse = {
  project: { id: string; slug: string; name: string };
  rehearsals: Rehearsal[];
};

export type RehearsalScenesResponse = {
  rehearsal: { id: string; title: string; startsAt: string };
  selectedPlaybookIds: string[];
  selectedScenes: RehearsalSelectedScene[];
  playbooks: Array<{ id: string; name: string; scenes: Array<{ id: number; title: string }> }>;
};

export type RehearsalPlanResponse = {
  selectionRequired?: boolean;
  items?: Array<{ ready?: boolean }>;
};

const rehearsalListTag = (args: RehearsalListArgs) => ({
  type: "RehearsalList" as const,
  id: `${args.projectSlug}:${args.from ?? ""}:${args.to ?? ""}`,
});

export const rehearsalsApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    listRehearsals: build.query<RehearsalListResponse, RehearsalListArgs>({
      query: ({ projectSlug, from, to }) => ({
        url: "/rehearsals",
        params: { projectSlug, from, to },
      }),
      providesTags: (result, _err, args) =>
        result
          ? [
              { type: "RehearsalList" },
              rehearsalListTag(args),
              ...result.rehearsals.map((r) => ({ type: "Rehearsal" as const, id: r.id })),
            ]
          : [{ type: "RehearsalList" }, rehearsalListTag(args)],
    }),

    getRehearsal: build.query<Rehearsal, string>({
      query: (rehearsalId) => ({
        url: `/rehearsals/${encodeURIComponent(rehearsalId)}`,
      }),
      providesTags: (_r, _e, id) => [{ type: "Rehearsal", id }],
    }),

    rehearsalScenes: build.query<RehearsalScenesResponse, string>({
      query: (rehearsalId) => ({
        url: `/rehearsals/${encodeURIComponent(rehearsalId)}/scenes`,
      }),
      providesTags: (_r, _e, id) => [{ type: "RehearsalScenes", id }],
    }),

    rehearsalPlan: build.query<RehearsalPlanResponse, string>({
      query: (rehearsalId) => ({
        url: `/rehearsals/${encodeURIComponent(rehearsalId)}/plan`,
        method: "POST",
      }),
      providesTags: (_r, _e, id) => [{ type: "RehearsalPlan", id }],
    }),

    createRehearsal: build.mutation<
      Rehearsal,
      {
        projectSlug: string;
        title: string;
        startsAt: string;
        durationMin?: number;
        notes?: string;
      }
    >({
      query: (body) => ({ url: "/rehearsals", method: "POST", data: body }),
      invalidatesTags: [{ type: "RehearsalList" }],
    }),

    updateRehearsal: build.mutation<
      Rehearsal,
      {
        rehearsalId: string;
        patch: Partial<
          Pick<
            Rehearsal,
            | "title"
            | "startsAt"
            | "durationMin"
            | "notes"
            | "selectedPlaybookIds"
            | "selectedScenes"
          >
        >;
        projectSlug?: string;
      }
    >({
      query: ({ rehearsalId, patch }) => ({
        url: `/rehearsals/${encodeURIComponent(rehearsalId)}`,
        method: "PATCH",
        data: patch,
      }),
      invalidatesTags: (_r, _e, { rehearsalId, patch }) => [
        { type: "Rehearsal", id: rehearsalId },
        { type: "RehearsalPlan", id: rehearsalId },
        { type: "RehearsalList" },
        ...(patch.selectedScenes != null
          ? [{ type: "RehearsalScenes" as const, id: rehearsalId }]
          : []),
      ],
    }),

    publishRehearsal: build.mutation<{ ok: boolean; published?: Rehearsal }, string>({
      query: (rehearsalId) => ({
        url: `/rehearsals/${encodeURIComponent(rehearsalId)}/publish`,
        method: "POST",
      }),
      invalidatesTags: (_r, _e, id) => [{ type: "Rehearsal", id }],
    }),
  }),
});

export const {
  useListRehearsalsQuery,
  useGetRehearsalQuery,
  useLazyGetRehearsalQuery,
  useRehearsalScenesQuery,
  useRehearsalPlanQuery,
  useCreateRehearsalMutation,
  useUpdateRehearsalMutation,
  usePublishRehearsalMutation,
} = rehearsalsApi;
