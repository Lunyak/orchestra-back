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
// Если страница открыта с того же хоста (порт 80/443), всегда ходим через /api (прокси), чтобы не уходить на :3000
function getApiBase(): string {
  const raw = (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";
  if (typeof window === "undefined") return raw;
  if (raw === "/api" || (raw.startsWith("/") && !raw.startsWith("//"))) return raw;
  try {
    const envUrl = new URL(raw);
    // В проде фронт обычно на 80/443, бэк может быть на :3000 того же хоста.
    // В этом случае всегда идем через /api-прокси, чтобы не упираться в CORS/порты.
    const currentPort =
      window.location.port ||
      (window.location.protocol === "https:" ? "443" : "80");
    const sameHost = envUrl.hostname === window.location.hostname;
    const isDefaultWebPort = currentPort === "80" || currentPort === "443";
    const samePort = envUrl.port === currentPort;
    if (sameHost && (isDefaultWebPort || (samePort && currentPort !== "3000"))) {
      return "/api";
    }
  } catch {
    // ignore
  }
  return raw;
}
const API_BASE = getApiBase();

// Отдельный axios-инстанс для API, чтобы повесить интерцепторы
export const api = axios.create({
  baseURL: API_BASE,
});

/**
 * Request interceptor: всегда используем актуальный токен из localStorage
 */
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

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
  user: { id: string; email: string; displayName?: string | null };
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

export interface MyProfile {
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  telegramUsername?: string | null;
  telegramId?: string | null;
  avatarUrl?: string | null;
  availabilityCalendar?: Record<string, "present" | "absent"> | null;
}

export async function getMyProfile(accessToken: string): Promise<MyProfile> {
  const { data } = await api.get<MyProfile>("/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function updateMyProfile(
  accessToken: string,
  patch: Partial<MyProfile>
): Promise<MyProfile> {
  const { data } = await api.patch<MyProfile>("/profile", patch, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export type RehearsalParticipantStatus = "unknown" | "present" | "absent";

export interface RehearsalParticipant {
  id: string;
  email: string;
  status: RehearsalParticipantStatus;
}

export interface Rehearsal {
  id: string;
  title: string;
  startsAt: string;
  durationMin?: number | null;
  notes?: string | null;
  participants?: RehearsalParticipant[];
}

export async function listRehearsals(
  accessToken: string,
  projectSlug: string,
  from?: string,
  to?: string
): Promise<{ project: { id: string; slug: string; name: string }; rehearsals: Rehearsal[] }> {
  const { data } = await api.get("/rehearsals", {
    params: { projectSlug, from, to },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function createRehearsal(
  accessToken: string,
  body: { projectSlug: string; title: string; startsAt: string; durationMin?: number; notes?: string }
): Promise<Rehearsal> {
  const { data } = await api.post("/rehearsals", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function setRehearsalParticipants(
  accessToken: string,
  rehearsalId: string,
  body: { participants: Array<{ email: string; status: RehearsalParticipantStatus; roles?: any }> }
): Promise<Rehearsal> {
  const { data } = await api.post(`/rehearsals/${encodeURIComponent(rehearsalId)}/participants`, body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function planRehearsal(accessToken: string, rehearsalId: string): Promise<any> {
  const { data } = await api.post(`/rehearsals/${encodeURIComponent(rehearsalId)}/plan`, null, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
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
