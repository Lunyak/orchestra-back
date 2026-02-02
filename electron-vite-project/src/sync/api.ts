import axios from "axios";

export type SyncOperation = "create" | "update" | "delete";

export type SyncEntityType = "Project" | "Scene" | "Step";

export interface SyncChange {
  id: string;
  entityType: SyncEntityType;
  entityId: string;
  operation: SyncOperation;
  payload: any;
  createdAt: string;
}

export interface SyncPushRequest {
  changes: SyncChange[];
}

export interface SyncPullRequest {
  lastSyncAt: string | null;
}

export interface SyncPullResponse {
  now: string;
  projects: ProjectSummary[];
  scenes: any[];
  steps: any[];
}

export interface ProjectSummary {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}

// В React/Vite нельзя использовать process.env в браузере, только import.meta.env
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function syncPush(accessToken: string, changes: SyncChange[]) {
  console.log("[sync/api] syncPush called", { changesCount: changes.length });
  if (!changes.length) {
    console.warn("[sync/api] syncPush: empty changes array, returning early");
    return;
  }
  console.log("[sync/api] syncPush: sending request", {
    url: `${API_BASE}/sync/push`,
    changesCount: changes.length,
  });
  await axios.post<unknown>(
    `${API_BASE}/sync/push`,
    { changes } as SyncPushRequest,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  console.log("[sync/api] syncPush: request completed");
}

export async function syncPull(
  accessToken: string,
  lastSyncAt: string | null,
): Promise<SyncPullResponse> {
  const { data } = await axios.post<SyncPullResponse>(
    `${API_BASE}/sync/pull`,
    { lastSyncAt } as SyncPullRequest,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return data;
}

export async function fetchProjects(
  accessToken: string,
): Promise<ProjectSummary[]> {
  const { data } = await axios.get<ProjectSummary[]>(`${API_BASE}/projects`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
}

export async function ensureProject(
  accessToken: string,
  slug: string,
  name?: string,
): Promise<ProjectSummary> {
  const projects = await fetchProjects(accessToken);
  const existing = projects.find((p) => p.slug === slug);
  if (existing) return existing;

  const { data } = await axios.post<ProjectSummary>(
    `${API_BASE}/projects`,
    { slug, name: name ?? slug },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  );
  return data;
}
