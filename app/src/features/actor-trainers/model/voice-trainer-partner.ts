import { normalizeActorKey } from "../../actor/model/actor-page-helpers";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import type { TeamProfile } from "../../../sync/api/profile";
import type { SceneVoiceLineEntry, SceneVoiceLineTake } from "../../playbook/model/playbook-slice";
import { normalizeRoleKey } from "./dialogue";

export function findPreferredTake(
  entry: SceneVoiceLineEntry | undefined,
  perfId: string,
): SceneVoiceLineTake | null {
  if (!entry) return null;
  const list = entry.takesByPerformer?.[perfId] ?? [];
  if (list.length === 0) return null;
  const preferredId = entry.preferredTakeIdByPerformer?.[perfId];
  if (preferredId) {
    const found = list.find((t) => t.id === preferredId);
    if (found) return found;
  }
  return list[list.length - 1] ?? null;
}

export function projectRoleKeys(role: ProjectRoleInfo): string[] {
  const out: string[] = [];
  if (role.key) out.push(normalizeRoleKey(role.key));
  if (role.title) out.push(normalizeRoleKey(role.title));
  for (const a of role.aliases ?? []) {
    const k = normalizeRoleKey(String(a ?? ""));
    if (k) out.push(k);
  }
  return out;
}

export function findProjectRoleForScriptKey(
  scriptRoleKey: string,
  projectRoles: ProjectRoleInfo[],
): ProjectRoleInfo | null {
  const wanted = normalizeRoleKey(scriptRoleKey);
  if (!wanted) return null;
  for (const role of projectRoles) {
    if (projectRoleKeys(role).includes(wanted)) return role;
  }
  return null;
}

export function actorDisplayName(profile: TeamProfile | null | undefined, email: string): string {
  const first = String(profile?.firstName ?? "").trim();
  const last = String(profile?.lastName ?? "").trim();
  const full = `${first} ${last}`.trim();
  if (full) return full;
  const display = String(profile?.displayName ?? "").trim();
  if (display) return display;
  return String(email ?? "").trim() || "—";
}

export function actorsAssignedToProjectRole(
  role: ProjectRoleInfo,
): Array<{ id: string; label: string }> {
  const seen = new Set<string>();
  const out: Array<{ id: string; label: string }> = [];
  for (const raw of role.emails ?? []) {
    const label = String(raw ?? "").trim();
    const id = normalizeActorKey(label);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push({ id, label: label || id });
  }
  return out;
}
