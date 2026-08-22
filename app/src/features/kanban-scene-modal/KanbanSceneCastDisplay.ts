import type { KanbanSceneRolesAdminMember } from "./KanbanSceneRolesAdminPanel";
import { profileListAvatarSrc } from "../../sync/api/profile";

export function normalizeActorEmail(v: unknown): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

export function findAssignmentMember(
  members: KanbanSceneRolesAdminMember[],
  rawEmail: string,
): KanbanSceneRolesAdminMember | null {
  const e = normalizeActorEmail(rawEmail);
  if (!e) return null;
  return members.find((m) => normalizeActorEmail(m.email) === e) ?? null;
}

/** Имя для отображения: имя+фамилия → displayName → email. */
export function actorDisplay(
  member: KanbanSceneRolesAdminMember | null,
  fallbackEmail: string,
): { label: string; avatarUrl: string | null; title: string } {
  const email = String(fallbackEmail ?? "").trim();
  if (!member?.profile) {
    return { label: email || "?", avatarUrl: null, title: email };
  }
  const p = member.profile;
  const avatarUrl = profileListAvatarSrc(p);
  const full =
    `${String(p.firstName ?? "").trim()} ${String(p.lastName ?? "").trim()}`.trim();
  if (full) {
    return {
      label: full,
      avatarUrl,
      title: email ? `${full} (${email})` : full,
    };
  }
  const display = String(p.displayName ?? "").trim();
  if (display) {
    return {
      label: display,
      avatarUrl,
      title: email ? `${display} (${email})` : display,
    };
  }
  return {
    label: email || "?",
    avatarUrl,
    title: email,
  };
}
