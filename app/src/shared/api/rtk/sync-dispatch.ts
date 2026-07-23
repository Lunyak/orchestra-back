import { store } from "../../store/store";
import {
  syncApi,
  type SyncPullArgs,
  type SyncPullSceneArgs,
  type SyncPullSceneResponse,
  type SyncPushArgs,
} from "./sync-api";
import type { SyncPullResponse } from "../../../sync/api/types/sync";

export async function dispatchSyncPush(args: SyncPushArgs): Promise<void> {
  await store.dispatch(syncApi.endpoints.syncPush.initiate(args)).unwrap();
}

export async function dispatchSyncPull(args: SyncPullArgs): Promise<SyncPullResponse> {
  return store
    .dispatch(
      syncApi.endpoints.syncPull.initiate(args, {
        forceRefetch: true,
        subscribe: false,
      }),
    )
    .unwrap();
}

export async function dispatchSyncPullScene(
  args: SyncPullSceneArgs,
): Promise<SyncPullSceneResponse> {
  return store.dispatch(syncApi.endpoints.syncPullScene.initiate(args)).unwrap();
}
