import { ensureProject, syncPull, syncPush } from "../../sync/api";
import { getMyProfile, type MyProfile } from "../../sync/api";

export type DirectorSlotRef = {
  projectSlug: string;
  stepId: number;
};

export type DirectorSessionSlot = {
  id: string;
  offsetMin: number;
  durationMin: number;
  ref?: DirectorSlotRef;
  notes?: string;
};

export type DirectorRehearsalSession = {
  id: string;
  title: string;
  startsAt: string; // ISO
  slots: DirectorSessionSlot[];
  updatedAt: string;
};

type SessionsSceneRawJson = {
  sessions?: DirectorRehearsalSession[];
};

function slugifyEmail(email: string): string {
  return String(email ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function directorSessionsProjectSlug(email: string): string {
  const s = slugifyEmail(email);
  return `__director_sessions__${s || "me"}`;
}

export function isDirectorSessionsSlug(slug: string): boolean {
  return String(slug ?? "").startsWith("__director_sessions__");
}

export async function ensureDirectorSessionsProject(accessToken: string): Promise<{
  email: string;
  projectSlug: string;
  projectId: string;
}> {
  const profile: MyProfile | null = await getMyProfile(accessToken).catch(() => null);
  const email = String(profile?.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new Error("Не удалось определить email пользователя");
  }
  const projectSlug = directorSessionsProjectSlug(email);
  const project = await ensureProject(accessToken, projectSlug, "Режиссёрские сессии");
  // совместимо с остальными частями приложения
  try {
    localStorage.setItem(`projectId:${projectSlug}`, project.id);
  } catch (_) {}
  return { email, projectSlug, projectId: project.id };
}

export async function loadDirectorSessions(
  accessToken: string,
): Promise<{
  projectSlug: string;
  projectId: string;
  sceneId: string;
  sessions: DirectorRehearsalSession[];
}> {
  const { projectSlug, projectId } = await ensureDirectorSessionsProject(accessToken);
  const sceneId = `${projectId}:sessions`;
  const pull = await syncPull(accessToken, null, projectSlug);
  const scene = (pull.scenes ?? []).find((s: any) => String(s?.id) === sceneId);
  const raw = (scene?.rawJson ?? {}) as SessionsSceneRawJson;
  const sessions = Array.isArray(raw?.sessions) ? raw.sessions : [];
  return { projectSlug, projectId, sceneId, sessions };
}

export async function saveDirectorSessions(
  accessToken: string,
  payload: {
    projectId: string;
    sceneId: string;
    sessions: DirectorRehearsalSession[];
  },
): Promise<void> {
  const nowIso = new Date().toISOString();
  await syncPush(accessToken, [
    {
      id: crypto.randomUUID(),
      entityType: "Scene",
      entityId: payload.sceneId,
      operation: "update",
      payload: {
        id: payload.sceneId,
        projectId: payload.projectId,
        name: "sessions",
        rawJson: { sessions: payload.sessions },
        updatedAt: nowIso,
      },
      createdAt: nowIso,
    },
  ]);
}

