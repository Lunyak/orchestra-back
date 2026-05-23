import { orchestraApi } from "../../../shared/api/rtk/orchestra-api";
import type {
  TroupeMemberItem,
  TroupeSummary,
} from "../../../sync/api/troupe";

export type MyTroupeArgs = {
  project: string;
  month?: string;
};

export type MyTroupeResponse = {
  troupe: TroupeSummary | null;
  members: TroupeMemberItem[];
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

    patchTroupeTitle: build.mutation<TroupeSummary, { title: string }>({
      query: ({ title }) => ({
        url: "/troupe",
        method: "PATCH",
        data: { title: title.trim() },
      }),
      invalidatesTags: ["Troupe"],
    }),
  }),
});

export const {
  useMyTroupeQuery,
  useAddTroupeMemberMutation,
  useRemoveTroupeMemberMutation,
  usePatchTroupeTitleMutation,
} = troupeApi;
