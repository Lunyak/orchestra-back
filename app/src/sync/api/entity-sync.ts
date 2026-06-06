import { getClientInstanceId } from "../../realtime/clientInstanceId";
import { api } from "./client";
import type {
  SyncChange,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushOptions,
  SyncPushRequest,
} from "./types/sync";

export async function syncPush(
  accessToken: string,
  changes: SyncChange[],
  options?: SyncPushOptions,
) {
  if (!changes.length) return;
  const body: SyncPushRequest = { changes };
  if (options?.destructiveConfirm?.trim()) {
    body.destructiveConfirm = options.destructiveConfirm.trim();
  }
  await api.post<unknown>("/sync/push", body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "x-orchestra-client-id": getClientInstanceId(),
    },
  });
}

export async function syncPull(
  accessToken: string,
  lastSyncAt: string | null,
  projectSlug?: string,
  include?: SyncPullRequest["include"],
): Promise<SyncPullResponse> {
  const body: SyncPullRequest = { lastSyncAt };
  if (projectSlug) body.projectSlug = projectSlug;
  if (include) body.include = include;
  const { data } = await api.post<SyncPullResponse>("/sync/pull", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function syncPullScene(
  accessToken: string,
  projectSlug: string,
  sceneName: string,
  include?: SyncPullRequest["include"],
): Promise<{
  scene: { id: string; projectId: string; name: string; updatedAt: string };
  steps?: any[];
  playlistItems?: any[];
  sounds?: any[];
  lightChannels?: any[];
  theaterLayout?: any;
}> {
  const { data } = await api.post(
    "/sync/pull-scene",
    { projectSlug, sceneName, include },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}
