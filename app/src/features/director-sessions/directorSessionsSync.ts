import {
  getDirectorSessions,
  replaceDirectorSessions,
  type DirectorSessionParticipant,
} from "../../sync/api/director-sessions";
import { ensureProject } from "../../sync/api/projects";
import { getMyProfile, type MyProfile } from "../../sync/api/profile";

export type DirectorSlotRef = {
  projectSlug: string;
  sceneId: number;
};

export type DirectorSlotRoleRehearsalPick = {
  roleKey: string;
  email: string;
  checked: boolean;
};

export type DirectorSessionSlot = {
  id: string;
  offsetMin: number;
  durationMin: number;
  title?: string;
  ref?: DirectorSlotRef;
  notes?: string;
  participantEmails?: string[];
  /** Прогон всего материала проекта: все сцены, актёры с возможностью открепить. */
  isProgRun?: boolean;
  /** Кто репетирует роли в слоте; в план вызова попадают только checked=true. */
  roleRehearsalPicks?: DirectorSlotRoleRehearsalPick[];
};

export type DirectorRehearsalSession = {
  id: string;
  title: string;
  startsAt: string; // ISO
  theaterId?: string;
  projectSlugs?: string[];
  comment?: string | null;
  slots: DirectorSessionSlot[];
  plannedEmails?: string[];
  /** Заполняется при публикации сессии (акторы с «свободен» в календаре на дату). */
  participants?: DirectorSessionParticipant[];
  /** ISO: после нажатия «Опубликовать» в приложении; опционально дублируется в Telegram. */
  publishedAt?: string | null;
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

