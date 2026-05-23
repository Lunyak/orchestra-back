import { orchestraApi } from "./orchestra-api";
import type { SyncPullResponse } from "../../../sync/api/types/sync";

export type SyncPullArgs = {
  projectSlug: string;
  include?: { steps?: boolean };
};

export const syncApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    syncPull: build.query<SyncPullResponse, SyncPullArgs>({
      query: ({ projectSlug, include }) => ({
        url: "/sync/pull",
        method: "POST",
        data: { lastSyncAt: null, projectSlug, include },
      }),
      providesTags: (_r, _e, { projectSlug }) => [
        { type: "SyncPull", id: projectSlug },
      ],
    }),
  }),
});

export const { useSyncPullQuery, useLazySyncPullQuery } = syncApi;
