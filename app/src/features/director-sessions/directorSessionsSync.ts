import { ensureProject, getDirectorSessions, replaceDirectorSessions } from "../../sync/api";
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
  comment?: string | null;
  slots: DirectorSessionSlot[];
  plannedEmails?: string[];
  updatedAt: string;
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
  sessions: DirectorRehearsalSession[];
}> {
  const { projectSlug, projectId } = await ensureDirectorSessionsProject(accessToken);
  const data = await getDirectorSessions(accessToken).catch(() => null);
  const sessions = Array.isArray(data?.sessions) ? (data?.sessions as any[]) : [];
  return { projectSlug, projectId, sessions: sessions as any };
}

export async function saveDirectorSessions(
  accessToken: string,
  payload: { sessions: DirectorRehearsalSession[] },
): Promise<void> {
  await replaceDirectorSessions(accessToken, payload.sessions ?? []);
}

