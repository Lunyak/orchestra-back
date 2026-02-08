import axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { refreshToken } from "./auth";

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
  /** Только данные этого проекта (по slug). */
  projectSlug?: string;
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

// Отдельный axios-инстанс для API, чтобы повесить интерцепторы
export const api = axios.create({
  baseURL: API_BASE,
});

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshQueue.push(cb);
}

function notifyTokenRefreshed(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalConfig = error.config as
      | (AxiosRequestConfig & {
          _retry?: boolean;
        })
      | undefined;

    if (!originalConfig || status !== 401 || originalConfig._retry) {
      return Promise.reject(error);
    }

    originalConfig._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }
          originalConfig.headers = originalConfig.headers ?? {};
          (originalConfig.headers as any).Authorization = `Bearer ${newToken}`;
          resolve(api(originalConfig));
        });
      });
    }

    isRefreshing = true;

    try {
      const oldRefresh = localStorage.getItem("refreshToken");
      if (!oldRefresh) {
        notifyTokenRefreshed(null);
        return Promise.reject(error);
      }

      const tokens = await refreshToken(oldRefresh);
      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      notifyTokenRefreshed(tokens.accessToken);

      originalConfig.headers = originalConfig.headers ?? {};
      (
        originalConfig.headers as any
      ).Authorization = `Bearer ${tokens.accessToken}`;
      return api(originalConfig);
    } catch (e) {
      notifyTokenRefreshed(null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  }
);

/** Адрес бекенда, к которому идут запросы (логин, sync). Чтобы показывать его в UI. */
export function getApiBaseUrl(): string {
  return API_BASE;
}

export async function syncPush(accessToken: string, changes: SyncChange[]) {
  console.log("[sync/api] syncPush called", { changesCount: changes.length });
  if (!changes.length) {
    console.warn("[sync/api] syncPush: empty changes array, returning early");
    return;
  }
  console.log("[sync/api] syncPush: sending request", {
    url: "/sync/push",
    changesCount: changes.length,
  });
  await api.post<unknown>("/sync/push", { changes } as SyncPushRequest, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  console.log("[sync/api] syncPush: request completed");
}

export async function syncPull(
  accessToken: string,
  lastSyncAt: string | null,
  projectSlug?: string
): Promise<SyncPullResponse> {
  const body: SyncPullRequest = { lastSyncAt };
  if (projectSlug) body.projectSlug = projectSlug;
  const { data } = await api.post<SyncPullResponse>("/sync/pull", body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
}

export async function fetchProjects(
  accessToken: string
): Promise<ProjectSummary[]> {
  const { data } = await api.get<ProjectSummary[]>("/projects", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return data;
}

export async function ensureProject(
  accessToken: string,
  slug: string,
  name?: string
): Promise<ProjectSummary> {
  const projects = await fetchProjects(accessToken);
  const existing = projects.find((p) => p.slug === slug);
  if (existing) return existing;

  const { data } = await api.post<ProjectSummary>(
    "/projects",
    { slug, name: name ?? slug },
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
  return data;
}

/** Пригласить пользователя в проект по email (только владелец проекта) */
export async function inviteToProject(
  accessToken: string,
  slug: string,
  email: string,
  role?: string
): Promise<{ id: string; projectId: string; userId: string; role: string }> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(slug)}/invite`,
    { email: email.trim(), role: role ?? "editor" },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return data;
}

export interface ProjectMemberInfo {
  id: string;
  role: string;
  user: { id: string; email: string };
}

/** Список участников проекта. Только владелец видит; при 403 — не владелец. */
export async function getProjectMembers(
  accessToken: string,
  slug: string
): Promise<{ id: string; members: ProjectMemberInfo[] }> {
  const { data } = await api.get(
    `/projects/${encodeURIComponent(slug)}/members`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return data;
}

/** Свежая подписанная ссылка для воспроизведения (когда старая истекла). */
export async function getPlayUrl(
  accessToken: string,
  key: string
): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>("/files/play-url", {
    params: { key },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

/** Стрим файла по ключу с авторизацией → blob URL для воспроизведения в звуках. */
export async function fetchSoundStreamBlobUrl(
  accessToken: string,
  key: string
): Promise<string | null> {
  try {
    const { data } = await api.get<Blob>("/files/stream", {
      params: { key },
      responseType: "blob",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!data || !(data instanceof Blob)) return null;
    if (data.size === 0) return null;
    const type = data.type;
    if (
      type &&
      !type.startsWith("audio/") &&
      type !== "application/octet-stream"
    )
      return null;
    return URL.createObjectURL(data);
  } catch {
    return null;
  }
}
