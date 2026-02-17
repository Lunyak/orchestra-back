import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
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

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

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

/**
 * Глобальный обработчик 401 ошибок.
 * Вызывает logout при получении Unauthorized.
 */
let globalLogoutHandler: (() => void) | null = null;

export function setupApiInterceptors(logout: () => void) {
  globalLogoutHandler = logout;

  // Интерцептор для обработки ответов
  api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      // При 401 — токен невалидный или истёк
      if (error.response?.status === 401 && globalLogoutHandler) {
        console.warn("[api] Unauthorized (401) — logging out");
        globalLogoutHandler();
      }
      return Promise.reject(error);
    }
  );
}

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
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalConfig = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
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
      (originalConfig.headers as any).Authorization =
        `Bearer ${tokens.accessToken}`;
      return api(originalConfig);
    } catch (e) {
      notifyTokenRefreshed(null);
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("lastSyncAt");
      if (typeof window !== "undefined") {
        window.location.reload();
      }
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  },
);

export function getApiBaseUrl(): string {
  return API_BASE;
}

export async function syncPush(accessToken: string, changes: SyncChange[]) {
  if (!changes.length) return;
  await api.post<unknown>("/sync/push", { changes } as SyncPushRequest, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function syncPull(
  accessToken: string,
  lastSyncAt: string | null,
  projectSlug?: string,
): Promise<SyncPullResponse> {
  const body: SyncPullRequest = { lastSyncAt };
  if (projectSlug) body.projectSlug = projectSlug;
  const { data } = await api.post<SyncPullResponse>("/sync/pull", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function fetchProjects(
  accessToken: string,
): Promise<ProjectSummary[]> {
  const { data } = await api.get<ProjectSummary[]>("/projects", {
    headers: { Authorization: `Bearer ${accessToken}` },
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

  try {
    const { data } = await api.post<ProjectSummary>(
      "/projects",
      { slug, name: name ?? slug },
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    return data;
  } catch (error: any) {
    if (error?.response?.status === 403) {
      const message =
        error?.response?.data?.message ||
        "Project limit reached for current plan";
      throw new Error(message);
    }
    throw error;
  }
}

export async function inviteToProject(
  accessToken: string,
  slug: string,
  email: string,
  role?: string,
): Promise<{ id: string; projectId: string; userId: string; role: string }> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(slug)}/invite`,
    { email: email.trim(), role: role ?? "editor" },
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export interface ProjectMemberInfo {
  id: string;
  role: string;
  user: { id: string; email: string; displayName?: string | null };
}

export async function getProjectMembers(
  accessToken: string,
  slug: string,
): Promise<{
  id: string;
  owner: { id: string; email: string; displayName?: string | null } | null;
  members: ProjectMemberInfo[];
}> {
  const { data } = await api.get(
    `/projects/${encodeURIComponent(slug)}/members`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
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
  characters?: string[] | null;
  availabilityCalendar?: Record<string, "present" | "absent"> | null;
}

export interface TeamProfile {
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  telegramId?: string | null;
  characters?: string[] | null;
  availabilityCalendar?: Record<string, "present" | "absent"> | null;
}

export async function getMyProfile(accessToken: string): Promise<MyProfile> {
  const { data } = await api.get<MyProfile>("/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getProfilesBatch(
  accessToken: string,
  emails: string[],
): Promise<TeamProfile[]> {
  const { data } = await api.post<TeamProfile[]>(
    "/profile/batch",
    { emails },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data ?? [];
}

export async function updateMyProfile(
  accessToken: string,
  patch: Partial<MyProfile>,
): Promise<MyProfile> {
  const { data } = await api.patch<MyProfile>("/profile", patch, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export type RehearsalParticipantStatus = "unknown" | "present" | "absent" | "late";

export interface RehearsalParticipant {
  id: string;
  email: string;
  status: RehearsalParticipantStatus;
  telegramId?: string | null;
  userName?: string | null;
  lateTime?: string | null;
  respondedAt?: string | null;
}

export type RehearsalSelectedStep = { sceneId: string; stepId: number };

export interface Rehearsal {
  id: string;
  title: string;
  startsAt: string;
  durationMin?: number | null;
  notes?: string | null;
  place?: string | null;
  selectedSceneIds?: string[] | null;
  selectedSteps?: RehearsalSelectedStep[] | null;
  telegramChatId?: string | null;
  telegramMessageId?: string | null;
  telegramThreadId?: string | null;
  publishedAt?: string | null;
  participants?: RehearsalParticipant[];
}

export async function updateRehearsal(
  accessToken: string,
  rehearsalId: string,
  patch: Partial<
    Pick<
      Rehearsal,
      "title" | "startsAt" | "durationMin" | "notes" | "selectedSceneIds" | "selectedSteps"
    >
  >,
): Promise<Rehearsal> {
  const { data } = await api.patch(
    `/rehearsals/${encodeURIComponent(rehearsalId)}`,
    patch,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function getRehearsalSteps(
  accessToken: string,
  rehearsalId: string,
): Promise<{
  rehearsal: { id: string; title: string; startsAt: string };
  selectedSceneIds: string[];
  selectedSteps: RehearsalSelectedStep[];
  scenes: Array<{ id: string; name: string; steps: Array<{ id: number; title: string }> }>;
}> {
  const { data } = await api.get(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/steps`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function listRehearsals(
  accessToken: string,
  projectSlug: string,
  from?: string,
  to?: string,
): Promise<{
  project: { id: string; slug: string; name: string };
  rehearsals: Rehearsal[];
}> {
  const { data } = await api.get("/rehearsals", {
    params: { projectSlug, from, to },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function createRehearsal(
  accessToken: string,
  body: {
    projectSlug: string;
    title: string;
    startsAt: string;
    durationMin?: number;
    notes?: string;
  },
): Promise<Rehearsal> {
  const { data } = await api.post("/rehearsals", body, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function getRehearsal(
  accessToken: string,
  rehearsalId: string,
): Promise<Rehearsal> {
  const { data } = await api.get(`/rehearsals/${encodeURIComponent(rehearsalId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function setRehearsalParticipants(
  accessToken: string,
  rehearsalId: string,
  body: {
    participants: Array<{
      email: string;
      status: RehearsalParticipantStatus;
      roles?: any;
    }>;
  },
): Promise<Rehearsal> {
  const { data } = await api.post(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/participants`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function publishRehearsal(
  accessToken: string,
  rehearsalId: string,
): Promise<{ ok: boolean; published?: Rehearsal }> {
  const { data } = await api.post(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/publish`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function planRehearsal(
  accessToken: string,
  rehearsalId: string,
): Promise<any> {
  const { data } = await api.post(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/plan`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function updateProjectMemberRole(
  accessToken: string,
  slug: string,
  memberId: string,
  role: "editor" | "viewer",
): Promise<ProjectMemberInfo> {
  const { data } = await api.patch(
    `/projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(
      memberId,
    )}`,
    { role },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function removeProjectMember(
  accessToken: string,
  slug: string,
  memberId: string,
): Promise<void> {
  await api.delete(
    `/projects/${encodeURIComponent(slug)}/members/${encodeURIComponent(
      memberId,
    )}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
}

export async function getPlayUrl(
  accessToken: string,
  key: string,
): Promise<{ url: string }> {
  const { data } = await api.get<{ url: string }>("/files/play-url", {
    params: { key },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function fetchSoundStreamBlobUrl(
  accessToken: string,
  key: string,
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
