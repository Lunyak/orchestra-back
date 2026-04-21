import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
} from "axios";
import { refreshToken } from "./auth";
import { getClientInstanceId } from "../realtime/clientInstanceId";

export type SyncOperation = "create" | "update" | "delete";

export type SyncEntityType =
  | "Project"
  | "Scene"
  | "Step"
  | "PlaylistItem"
  | "Sound"
  | "GlobalLightChannel"
  | "TheaterLayout";

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
  include?: {
    steps?: boolean;
    playlist?: boolean;
    sounds?: boolean;
    lightChannels?: boolean;
    theaterLayout?: boolean;
  };
}

export interface SyncPullResponse {
  now: string;
  projects: ProjectSummary[];
  scenes: any[];
  steps?: any[];
  playlistItems?: any[];
  sounds?: any[];
  lightChannels?: any[];
  theaterLayouts?: any[];
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
    if (!token) return config;

    const headersAny = config.headers as any;
    const existingAuth =
      typeof headersAny?.get === "function"
        ? headersAny.get("Authorization") ?? headersAny.get("authorization")
        : headersAny?.Authorization ?? headersAny?.authorization;

    // Don't override Authorization explicitly set by the caller.
    if (!existingAuth) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
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
let unauthorizedInterceptorId: number | null = null;

export function setupApiInterceptors(logout: () => void) {
  globalLogoutHandler = logout;

  if (unauthorizedInterceptorId !== null) return;

  // Интерцептор для обработки ответов (401 -> logout handler).
  // Делаем setup идемпотентным, чтобы не накапливать интерцепторы при повторных монтированиях.
  unauthorizedInterceptorId = api.interceptors.response.use(
    (response) => response,
    (error: AxiosError) => {
      if (error.response?.status === 401 && globalLogoutHandler) {
        console.warn("[api] Unauthorized (401) — logging out");
        globalLogoutHandler();
      }
      return Promise.reject(error);
    },
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
        // Полная перезагрузка ломает спектакль (плейлист, состояние плеера).
        // Сбрасываем сессию через тот же путь, что и 401 — без reload.
        if (globalLogoutHandler) {
          globalLogoutHandler();
        } else {
          window.location.reload();
        }
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

export type ProjectRoleInfo = {
  id: string;
  key: string;
  title: string;
  description?: string | null;
  aliases: string[];
  emails: string[];
};

export async function getProjectRoles(
  accessToken: string,
  projectSlug: string,
): Promise<{ projectId: string; roles: ProjectRoleInfo[] }> {
  const { data } = await api.get(
    `/projects/${encodeURIComponent(projectSlug)}/roles`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function createProjectRole(
  accessToken: string,
  projectSlug: string,
  body: { title: string; description?: string; aliases?: string[] },
): Promise<{ ok: boolean; roleId: string }> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/roles`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function updateProjectRole(
  accessToken: string,
  projectSlug: string,
  roleId: string,
  body: { title: string; description?: string; aliases?: string[] },
): Promise<{ ok: boolean; roleId: string }> {
  const { data } = await api.put(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function deleteProjectRole(
  accessToken: string,
  projectSlug: string,
  roleId: string,
): Promise<{ ok: boolean; deleted?: number }> {
  const { data } = await api.delete(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function setProjectRoleAssignments(
  accessToken: string,
  projectSlug: string,
  roleId: string,
  emails: string[],
): Promise<{ ok: boolean }> {
  const { data } = await api.put(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(
      roleId,
    )}/assignments`,
    { emails },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export type RoleNoteItem = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  authorEmail: string | null;
  authorUserId: string | null;
};

export async function getProjectRoleNotes(
  accessToken: string,
  projectSlug: string,
  roleId: string,
): Promise<{ role: { id: string; title: string; key: string }; notes: RoleNoteItem[] }> {
  const { data } = await api.get(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}/notes`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function addProjectRoleNote(
  accessToken: string,
  projectSlug: string,
  roleId: string,
  content: string,
): Promise<{ ok: boolean; noteId: string }> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/roles/${encodeURIComponent(roleId)}/notes`,
    { content },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function cleanupProjectImages(
  accessToken: string,
  projectSlug: string,
): Promise<{
  ok: boolean;
  projectId: string;
  storage: "s3" | "local";
  referencedCount: number;
  existingCount?: number;
  deletedCount: number;
  skipped?: boolean;
}> {
  const { data } = await api.post(
    `/projects/${encodeURIComponent(projectSlug)}/images/cleanup`,
    null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
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
  availabilityTimeRanges?: Record<string, Array<{ from: string; to: string }>> | null;
}

export interface TeamProfile {
  email: string;
  displayName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  telegramId?: string | null;
  avatarUrl?: string | null;
  availabilityCalendar?: Record<string, "present" | "absent"> | null;
  availabilityTimeRanges?: Record<string, Array<{ from: string; to: string }>> | null;
}

export interface TroupeSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

export interface TroupeMemberItem {
  id: string;
  troupeId: string;
  email: string;
  createdAt: string;
  profile: TeamProfile | null;
}

export async function getMyTroupe(
  accessToken: string,
): Promise<{ troupe: TroupeSummary | null; members: TroupeMemberItem[] }> {
  const { data } = await api.get("/troupe", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function addTroupeMember(
  accessToken: string,
  email: string,
): Promise<TroupeMemberItem> {
  const { data } = await api.post(
    "/troupe/members",
    { email: email.trim() },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function removeTroupeMember(
  accessToken: string,
  memberId: string,
): Promise<void> {
  await api.delete(`/troupe/members/${encodeURIComponent(memberId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function patchMyTroupeTitle(
  accessToken: string,
  title: string,
): Promise<TroupeSummary> {
  const { data } = await api.patch<TroupeSummary>(
    "/troupe",
    { title: title.trim() },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export type ChatConversationKind = "TROUPE";

export interface ChatConversationItem {
  id: string;
  kind: ChatConversationKind;
  troupeId: string | null;
  title: string;
  unreadCount?: number;
}

export interface ChatMessageItem {
  id: string;
  conversationId: string;
  authorUserId: string;
  authorEmail: string;
  body: string;
  clientMessageId: string | null;
  createdAt: string;
}

export async function fetchChatConversations(): Promise<ChatConversationItem[]> {
  const { data } = await api.get<ChatConversationItem[]>("/chat/conversations");
  return data ?? [];
}

export async function markChatConversationRead(
  conversationId: string,
  lastSeenMessageId?: string,
): Promise<{ unreadCount: number }> {
  const { data } = await api.patch<{ unreadCount: number }>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/read`,
    lastSeenMessageId ? { lastSeenMessageId } : {},
  );
  return data ?? { unreadCount: 0 };
}

export async function fetchChatMessages(
  conversationId: string,
  params?: { beforeMessageId?: string; limit?: number },
): Promise<{ messages: ChatMessageItem[]; nextBeforeMessageId: string | null }> {
  const { data } = await api.get<{
    messages: ChatMessageItem[];
    nextBeforeMessageId: string | null;
  }>(`/chat/conversations/${encodeURIComponent(conversationId)}/messages`, {
    params: {
      beforeMessageId: params?.beforeMessageId,
      limit: params?.limit,
    },
  });
  return {
    messages: data?.messages ?? [],
    nextBeforeMessageId: data?.nextBeforeMessageId ?? null,
  };
}

export async function postChatMessage(
  conversationId: string,
  body: string,
  clientMessageId?: string,
): Promise<ChatMessageItem> {
  const { data } = await api.post<ChatMessageItem>(
    `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
    { body, clientMessageId },
  );
  return data;
}

export async function getMyProfile(accessToken: string): Promise<MyProfile> {
  const { data } = await api.get<MyProfile>("/profile", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function deleteMyProfile(accessToken: string): Promise<{ ok: boolean; deleted?: number }> {
  const { data } = await api.delete<{ ok: boolean; deleted?: number }>("/profile", {
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

export async function uploadMyAvatar(
  accessToken: string,
  file: File,
): Promise<MyProfile> {
  const form = new FormData();
  form.append("file", file, file.name);
  const { data } = await api.post<MyProfile>("/profile/avatar", form, {
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

export interface RehearsalMyComment {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
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

export async function getMyRehearsalComment(
  accessToken: string,
  rehearsalId: string,
): Promise<{ comment: RehearsalMyComment | null }> {
  const { data } = await api.get(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/my-comment`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function upsertMyRehearsalComment(
  accessToken: string,
  rehearsalId: string,
  body: { content?: string },
): Promise<{ comment: RehearsalMyComment | null }> {
  const { data } = await api.put(
    `/rehearsals/${encodeURIComponent(rehearsalId)}/my-comment`,
    body ?? {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
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

export async function publishDirectorSession(
  accessToken: string,
  sessionId: string,
  body?: { comment?: string | null },
): Promise<{ ok: boolean; telegramSent?: boolean; session?: DirectorSession }> {
  const { data } = await api.post(
    `/director-sessions/${encodeURIComponent(sessionId)}/publish`,
    body ?? null,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export type DirectorSessionParticipantStatus = "unknown" | "present" | "absent" | "late";

export type DirectorSessionSlotRef = { projectSlug: string; stepId: number };

export type DirectorSessionSlot = {
  id: string;
  offsetMin: number;
  durationMin: number;
  ref?: DirectorSessionSlotRef;
  notes?: string;
};

export type DirectorSessionParticipant = {
  email: string;
  status: DirectorSessionParticipantStatus;
  telegramId?: string | null;
  userName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  avatarUrl?: string | null;
  lateTime?: string | null;
  respondedAt?: string | null;
};

export type DirectorSession = {
  id: string;
  title: string;
  startsAt: string;
  slots: DirectorSessionSlot[];
  comment?: string | null;
  plannedEmails?: string[];
  updatedAt?: string;
  participants?: DirectorSessionParticipant[];
  telegramChatId?: string | null;
  telegramMessageId?: string | null;
  telegramThreadId?: string | null;
  publishedAt?: string | null;
};

export type DirectorSessionMyComment = {
  id: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export async function getDirectorSessions(
  accessToken: string,
): Promise<{ projectId: string; sessions: any[] }> {
  const { data } = await api.get("/director-sessions", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data as any;
}

/** Опубликованные сессии чужих режиссёров, где текущий пользователь в plannedEmails / participants. */
export async function getDirectorSessionInvitations(
  accessToken: string,
  fromIso: string,
  toIso: string,
): Promise<{ sessions: any[] }> {
  const { data } = await api.get("/director-sessions/invitations", {
    params: { fromIso, toIso },
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data as any;
}

export async function getDirectorSession(
  accessToken: string,
  sessionId: string,
): Promise<DirectorSession> {
  const { data } = await api.get(
    `/director-sessions/${encodeURIComponent(sessionId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function confirmMyDirectorSessionAttendance(
  accessToken: string,
  sessionId: string,
): Promise<{ ok: boolean; session: DirectorSession }> {
  const { data } = await api.post(
    `/director-sessions/${encodeURIComponent(sessionId)}/confirm-attendance`,
    {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function getMyDirectorSessionComment(
  accessToken: string,
  sessionId: string,
): Promise<{ comment: DirectorSessionMyComment | null }> {
  const { data } = await api.get(
    `/director-sessions/${encodeURIComponent(sessionId)}/my-comment`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function upsertMyDirectorSessionComment(
  accessToken: string,
  sessionId: string,
  body: { content?: string },
): Promise<{ comment: DirectorSessionMyComment | null }> {
  const { data } = await api.put(
    `/director-sessions/${encodeURIComponent(sessionId)}/my-comment`,
    body ?? {},
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
}

export async function replaceDirectorSessions(
  accessToken: string,
  sessions: any[],
): Promise<{ ok: boolean }> {
  const { data } = await api.put(
    "/director-sessions",
    { sessions },
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data as any;
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

export type UploadProjectFileType = "playlist" | "image" | "sound" | "model";

export async function uploadProjectFile(
  accessToken: string,
  params: { projectId: string; type: UploadProjectFileType; file: File },
): Promise<{ key: string; url: string }> {
  const form = new FormData();
  form.append("file", params.file, params.file.name);
  form.append("projectId", params.projectId);
  form.append("type", params.type);

  const { data } = await api.post<{ key: string; url: string }>(
    "/files/upload",
    form,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
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

export interface ActorStepNote {
  id: string;
  text: string;
  createdAt: string;
  updatedAt: string;
}

export type ActorAnnotationField = "markdown" | "playMarkdown" | "explicationMarkdown";

export interface ActorAnnotation {
  id: string;
  startOffset: number;
  endOffset: number;
  selectedText?: string | null;
  noteText: string;
  createdAt: string;
  updatedAt: string;
}

export async function getActorStepNote(
  accessToken: string,
  params: { projectSlug: string; sceneName: string; stepId: number },
): Promise<{ note: ActorStepNote | null }> {
  const { data } = await api.get<{ note: ActorStepNote | null }>(
    "/actor-notes/step",
    {
      params,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function upsertActorStepNote(
  accessToken: string,
  body: { projectSlug: string; sceneName: string; stepId: number; text?: string },
): Promise<{ note: ActorStepNote | null }> {
  const { data } = await api.put<{ note: ActorStepNote | null }>(
    "/actor-notes/step",
    body,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function deleteActorStepNote(
  accessToken: string,
  params: { projectSlug: string; sceneName: string; stepId: number },
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>("/actor-notes/step", {
    params,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return data;
}

export async function listActorAnnotations(
  accessToken: string,
  params: {
    projectSlug: string;
    sceneName: string;
    stepId: number;
    field: ActorAnnotationField;
  },
): Promise<{ annotations: ActorAnnotation[] }> {
  const { data } = await api.get<{ annotations: ActorAnnotation[] }>(
    "/actor-notes/annotations",
    {
      params,
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  return data;
}

export async function createActorAnnotation(
  accessToken: string,
  body: {
    projectSlug: string;
    sceneName: string;
    stepId: number;
    field: ActorAnnotationField;
    startOffset: number;
    endOffset: number;
    selectedText?: string;
    noteText: string;
  },
): Promise<{ annotation: ActorAnnotation }> {
  const { data } = await api.post<{ annotation: ActorAnnotation }>(
    "/actor-notes/annotations",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function updateActorAnnotation(
  accessToken: string,
  id: string,
  patch: { noteText?: string },
): Promise<{ annotation: ActorAnnotation }> {
  const { data } = await api.patch<{ annotation: ActorAnnotation }>(
    `/actor-notes/annotations/${encodeURIComponent(id)}`,
    patch,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function deleteActorAnnotation(
  accessToken: string,
  id: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/actor-notes/annotations/${encodeURIComponent(id)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

// ---- Telegram bots (user integrations) ----

export interface TelegramBotIntegrationSummary {
  id: string;
  title?: string | null;
  botUsername?: string | null;
  botTelegramUserId?: string | null;
  ownerTelegramId?: string | null;
  adminTelegramId?: string | null;
  status: string;
  groupChatId?: string | null;
  attendanceThreadId?: string | null;
  announcementsThreadId?: string | null;
  defaultProjectSlug?: string | null;
  quizGroupChatId?: string | null;
  quizThreadId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BotVariableItem {
  id: string;
  key: string;
  value: string; // for secrets backend returns empty string
  isSecret: boolean;
  updatedAt: string;
}

export async function listTelegramBots(
  accessToken: string,
): Promise<{ items: TelegramBotIntegrationSummary[] }> {
  const { data } = await api.get<{ items: TelegramBotIntegrationSummary[] }>(
    "/telegram-bots",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function connectTelegramBot(
  accessToken: string,
  body: { token: string; title?: string },
): Promise<{ ok: boolean; id: string }> {
  const { data } = await api.post<{ ok: boolean; id: string }>(
    "/telegram-bots/connect",
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function updateTelegramBot(
  accessToken: string,
  botId: string,
  patch: Partial<
    Pick<
      TelegramBotIntegrationSummary,
      | "title"
      | "ownerTelegramId"
      | "adminTelegramId"
      | "status"
      | "groupChatId"
      | "attendanceThreadId"
      | "announcementsThreadId"
      | "defaultProjectSlug"
      | "quizGroupChatId"
      | "quizThreadId"
    >
  >,
): Promise<{ ok: boolean }> {
  const { data } = await api.patch<{ ok: boolean }>(
    `/telegram-bots/${encodeURIComponent(botId)}`,
    patch,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function deleteTelegramBot(
  accessToken: string,
  botId: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/telegram-bots/${encodeURIComponent(botId)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function listBotVariables(
  accessToken: string,
  botId: string,
): Promise<{ items: BotVariableItem[] }> {
  const { data } = await api.get<{ items: BotVariableItem[] }>(
    `/telegram-bots/${encodeURIComponent(botId)}/variables`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function upsertBotVariable(
  accessToken: string,
  botId: string,
  key: string,
  body: { value: string; isSecret?: boolean },
): Promise<{ item: BotVariableItem }> {
  const { data } = await api.put<{ item: BotVariableItem }>(
    `/telegram-bots/${encodeURIComponent(botId)}/variables/${encodeURIComponent(
      key,
    )}`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function deleteBotVariable(
  accessToken: string,
  botId: string,
  key: string,
): Promise<{ ok: boolean }> {
  const { data } = await api.delete<{ ok: boolean }>(
    `/telegram-bots/${encodeURIComponent(botId)}/variables/${encodeURIComponent(
      key,
    )}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}

export async function sendTelegramBotTestMessage(
  accessToken: string,
  botId: string,
  body: { chatId: string; text: string },
): Promise<{ ok: boolean }> {
  const { data } = await api.post<{ ok: boolean }>(
    `/telegram-bots/${encodeURIComponent(botId)}/test-message`,
    body,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  return data;
}
