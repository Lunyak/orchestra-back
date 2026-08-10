import type { ProjectMembersResponse } from "../../project/api/project-api";
import type { TroupeResponse } from "../../troupe/api/troupe-api";

export type TaskAssigneeMember = {
  email: string;
  profile: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
};

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function mergeMember(
  map: Map<string, TaskAssigneeMember>,
  emailRaw: unknown,
  profile: TaskAssigneeMember["profile"],
) {
  const email = normalizeEmail(emailRaw);
  if (!email) return;

  const next: TaskAssigneeMember = { email, profile: profile ?? null };
  const prev = map.get(email);
  if (!prev) {
    map.set(email, next);
    return;
  }

  if (!prev.profile && next.profile) {
    map.set(email, { ...prev, profile: next.profile });
    return;
  }

  if (prev.profile && next.profile) {
    const mergedProfile = {
      displayName: prev.profile.displayName ?? next.profile.displayName ?? null,
      firstName: prev.profile.firstName ?? next.profile.firstName ?? null,
      lastName: prev.profile.lastName ?? next.profile.lastName ?? null,
      avatarUrl: prev.profile.avatarUrl ?? next.profile.avatarUrl ?? null,
    };
    map.set(email, { ...prev, profile: mergedProfile });
  }
}

export function mergeTaskAssigneeMembers(
  troupeRes: TroupeResponse | undefined,
  projectMembersRes: ProjectMembersResponse | undefined,
): TaskAssigneeMember[] {
  const map = new Map<string, TaskAssigneeMember>();

  for (const member of troupeRes?.members ?? []) {
    mergeMember(map, member.email, member.profile ?? null);
  }

  for (const member of troupeRes?.teamMembers ?? []) {
    mergeMember(map, member.email, member.profile ?? null);
  }

  const ownerEmail = normalizeEmail(projectMembersRes?.owner?.email);
  if (ownerEmail) {
    mergeMember(map, ownerEmail, projectMembersRes?.owner?.displayName
      ? { displayName: projectMembersRes.owner.displayName }
      : null);
  }

  for (const member of projectMembersRes?.members ?? []) {
    mergeMember(
      map,
      member.user?.email,
      member.user?.displayName ? { displayName: member.user.displayName } : null,
    );
  }

  return Array.from(map.values()).sort((left, right) => {
    const leftLabel = `${left.profile?.displayName ?? ""} ${left.email}`.trim();
    const rightLabel = `${right.profile?.displayName ?? ""} ${right.email}`.trim();
    return leftLabel.localeCompare(rightLabel, "ru");
  });
}
