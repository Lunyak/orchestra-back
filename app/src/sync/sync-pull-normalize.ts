import type { SyncPullResponse } from "./api/types/sync";

/** Script scenes from sync pull (`scenes` or legacy cached `steps`). */
export function pullScriptScenesFromSync(
  pull: SyncPullResponse | Record<string, unknown> | null | undefined,
): any[] {
  if (!pull) return [];
  const row = pull as Record<string, unknown>;
  if (Array.isArray(row.scenes) && row.scenes.length > 0 && looksLikeScriptSceneRow(row.scenes[0])) {
    return row.scenes;
  }
  if (Array.isArray(row.playbooks) && Array.isArray(row.scenes)) return row.scenes;
  if (Array.isArray(row.steps)) return row.steps;
  if (Array.isArray(row.scenes)) return row.scenes;
  return [];
}

/** Playbook containers from sync pull. */
export function pullPlaybooksFromSync(
  pull: SyncPullResponse | Record<string, unknown> | null | undefined,
): any[] {
  if (!pull) return [];
  const row = pull as Record<string, unknown>;
  if (Array.isArray(row.playbooks)) return row.playbooks;
  if (Array.isArray(row.scenes) && Array.isArray(row.steps)) return row.scenes;
  if (Array.isArray(row.scenes) && !row.playbooks) {
    const scenes = row.scenes;
    if (scenes.length === 0) return [];
    if (!looksLikeScriptSceneRow(scenes[0])) return scenes;
  }
  return [];
}

export function syncPullIncludeScenes(include?: { scenes?: boolean }): boolean {
  return Boolean(include?.scenes);
}

/** Pull flags for playbook sync (script scenes + heavy tables). */
export function syncPullIncludeForPlaybook(
  include?: {
    scenes?: boolean;
    playlist?: boolean;
    sounds?: boolean;
    lightChannels?: boolean;
    theaterLayout?: boolean;
  },
) {
  const wantScenes = include == null ? true : syncPullIncludeScenes(include);
  return {
    playlist: true,
    sounds: true,
    lightChannels: true,
    theaterLayout: true,
    ...include,
    scenes: wantScenes,
  };
}

function looksLikeScriptSceneRow(row: unknown): boolean {
  const r = row as Record<string, unknown> | null | undefined;
  if (!r) return false;
  const sourceId = Number(r.sourceId ?? 0);
  if (!Number.isFinite(sourceId) || sourceId <= 0) return false;
  return Boolean(syncRowPlaybookId(r));
}

/** Playbook id on sync rows: new `playbookId` or legacy `sceneId`. */
export function syncRowPlaybookId(row: unknown): string {
  const r = row as Record<string, unknown> | null | undefined;
  return String(r?.playbookId ?? r?.sceneId ?? "").trim();
}

export function syncRowMatchesPlaybook(row: unknown, playbookId: string): boolean {
  const id = String(playbookId ?? "").trim();
  if (!id) return false;
  return syncRowPlaybookId(row) === id;
}
