import type {
  SyncChange,
  SyncPullRequest,
  SyncPullResponse,
  SyncPushOptions,
} from "./types/sync";
import {
  dispatchSyncPull,
  dispatchSyncPullScene,
  dispatchSyncPush,
} from "../../shared/api/rtk/sync-dispatch";
import type { SyncPullSceneResponse } from "../../shared/api/rtk/sync-api";

/** @deprecated Prefer `dispatchSyncPush` from `shared/api/rtk/sync-dispatch`. */
export async function syncPush(
  _accessToken: string,
  changes: SyncChange[],
  options?: SyncPushOptions,
): Promise<void> {
  if (!changes.length) return;
  await dispatchSyncPush({
    changes,
    destructiveConfirm: options?.destructiveConfirm,
  });
}

/** @deprecated Prefer `dispatchSyncPull` from `shared/api/rtk/sync-dispatch`. */
export async function syncPull(
  _accessToken: string,
  lastSyncAt: string | null,
  projectSlug?: string,
  include?: SyncPullRequest["include"],
): Promise<SyncPullResponse> {
  return dispatchSyncPull({ projectSlug, lastSyncAt, include });
}

/** @deprecated Prefer `dispatchSyncPullScene` from `shared/api/rtk/sync-dispatch`. */
export async function syncPullScene(
  _accessToken: string,
  projectSlug: string,
  sceneName: string,
  include?: SyncPullRequest["include"],
): Promise<SyncPullSceneResponse> {
  return dispatchSyncPullScene({ projectSlug, sceneName, include });
}
