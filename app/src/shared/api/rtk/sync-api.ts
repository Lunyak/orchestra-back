import { getClientInstanceId } from "../../../realtime/clientInstanceId";
import type {
  SyncChange,
  SyncPullRequest,
  SyncPullResponse,
} from "../../../sync/api/types/sync";
import { orchestraApi } from "./orchestra-api";

export type SyncPullArgs = {
  projectSlug?: string;
  lastSyncAt?: string | null;
  include?: SyncPullRequest["include"];
};

export type SyncPushArgs = {
  changes: SyncChange[];
  destructiveConfirm?: string;
};

export type SyncPullSceneArgs = {
  projectSlug: string;
  sceneName: string;
  include?: SyncPullRequest["include"];
};

export type SyncPullSceneResponse = {
  scene: { id: string; projectId: string; name: string; updatedAt: string };
  scenes?: unknown[];
  playlistItems?: unknown[];
  sounds?: unknown[];
  lightChannels?: unknown[];
  theaterLayout?: unknown;
};

export const syncApi = orchestraApi.injectEndpoints({
  endpoints: (build) => ({
    syncPull: build.query<SyncPullResponse, SyncPullArgs>({
      query: ({ projectSlug, lastSyncAt = null, include }) => ({
        url: "/sync/pull",
        method: "POST",
        data: { lastSyncAt, projectSlug, include },
      }),
      providesTags: (_result, _error, { projectSlug }) =>
        projectSlug
          ? [
              { type: "SyncPull", id: "ALL" },
              { type: "SyncPull", id: projectSlug },
            ]
          : [{ type: "SyncPull", id: "ALL" }],
    }),

    syncPush: build.mutation<void, SyncPushArgs>({
      query: ({ changes, destructiveConfirm }) => {
        const data: { changes: SyncChange[]; destructiveConfirm?: string } = { changes };
        const confirm = destructiveConfirm?.trim();
        if (confirm) data.destructiveConfirm = confirm;
        return {
          url: "/sync/push",
          method: "POST",
          data,
          headers: { "x-orchestra-client-id": getClientInstanceId() },
        };
      },
      invalidatesTags: [{ type: "SyncPull", id: "ALL" }],
    }),

    syncPullScene: build.mutation<SyncPullSceneResponse, SyncPullSceneArgs>({
      query: ({ projectSlug, sceneName, include }) => ({
        url: "/sync/pull-scene",
        method: "POST",
        data: { projectSlug, sceneName, include },
      }),
    }),
  }),
});

export const {
  useSyncPullQuery,
  useLazySyncPullQuery,
  useSyncPushMutation,
  useSyncPullSceneMutation,
} = syncApi;
