import type { KanbanSceneRolesAdminMember } from "../../kanban-scene-modal/KanbanSceneRolesAdminPanel";
import type { ProjectMembersResponse } from "../../project/api/project-api";
import type { TroupeResponse } from "../../troupe/api/troupe-api";

export function normalizeEmail(v: string): string {
  return String(v ?? "").trim().toLowerCase();
}

export function mergeKanbanRoleAssignmentMembers(
  troupeRes: TroupeResponse | undefined,
  projectMembersRes: ProjectMembersResponse | undefined,
): KanbanSceneRolesAdminMember[] {
  const membersFromTroupe = (troupeRes?.members ?? [])
    .map((m) => ({
      email: normalizeEmail(String(m?.email ?? "")),
      profile: m?.profile ?? null,
    }))
    .filter((m) => Boolean(m.email));

  const membersFromProject: KanbanSceneRolesAdminMember[] = [];
  const ownerEmail = normalizeEmail(String(projectMembersRes?.owner?.email ?? ""));
  if (ownerEmail) {
    membersFromProject.push({
      email: ownerEmail,
      profile: projectMembersRes?.owner?.displayName
        ? { displayName: projectMembersRes.owner.displayName }
        : null,
    });
  }
  for (const m of projectMembersRes?.members ?? []) {
    const em = normalizeEmail(String(m?.user?.email ?? ""));
    if (!em) continue;
    membersFromProject.push({
      email: em,
      profile: m?.user?.displayName ? { displayName: m.user.displayName } : null,
    });
  }

  const uniq = new Map<string, KanbanSceneRolesAdminMember>();
  for (const m of [...membersFromTroupe, ...membersFromProject]) {
    if (!m.email) continue;
    const prev = uniq.get(m.email);
    if (!prev) {
      uniq.set(m.email, m);
      continue;
    }
    if (!prev.profile && m.profile) uniq.set(m.email, { ...prev, profile: m.profile });
  }

  return Array.from(uniq.values()).sort((a, b) => {
    const la = `${String(a.profile?.displayName ?? "").trim() || a.email} (${a.email})`;
    const lb = `${String(b.profile?.displayName ?? "").trim() || b.email} (${b.email})`;
    return la.localeCompare(lb, "ru");
  });
}
