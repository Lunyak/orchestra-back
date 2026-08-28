import type { DialogueLine } from "./dialogue";
import { buildDialogueLines, normalizeRoleKey } from "./dialogue";
import { normalizeForCheck } from "./phraseTextMatch";
import type { ScriptScene } from "../../../shared/types/script";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import {
  actorsAssignedToProjectRole,
  findProjectRoleForScriptKey,
} from "./voice-trainer-partner";
import type { VoiceExercise } from "./voice-trainer-types";

export function buildDesiredRoleKeySet(role: string, roleKeys?: string[]): Set<string> {
  const keys = (roleKeys && roleKeys.length ? roleKeys : [role])
    .map((x) => normalizeRoleKey(String(x ?? "")))
    .filter(Boolean);
  return new Set(keys);
}

export function resolvePrimaryRoleKey(role: string, roleKeys?: string[]): string {
  const first = roleKeys && roleKeys.length ? normalizeRoleKey(String(roleKeys[0] ?? "")) : "";
  return first || normalizeRoleKey(role);
}

export function buildAllDialogueLines(
  scenes: ScriptScene[],
  selectedPlaybookIds: number[],
): DialogueLine[] {
  const selected = scenes.filter((s) => selectedPlaybookIds.includes(s.id));
  return buildDialogueLines({ scenes: selected, preferField: "playMarkdown" });
}

export function buildVoiceExercises(
  allLines: DialogueLine[],
  desiredRoleKeySet: Set<string>,
): VoiceExercise[] {
  const out: VoiceExercise[] = [];
  for (let idx = 0; idx < allLines.length; idx += 1) {
    const line = allLines[idx] as DialogueLine;
    if (line.kind !== "utterance" || !line.role) continue;
    if (!desiredRoleKeySet.has(normalizeRoleKey(line.role))) continue;
    const prev = (() => {
      for (let j = idx - 1; j >= 0; j -= 1) {
        const p = allLines[j];
        if (p.kind === "utterance" && p.text) return { lineId: p.id, role: p.role, text: p.text };
      }
      return null;
    })();
    const nextPartner = (() => {
      for (let j = idx + 1; j < allLines.length; j += 1) {
        const n = allLines[j];
        if (n.kind !== "utterance" || !n.text) continue;
        const nk = normalizeRoleKey(n.role ?? "");
        if (!nk || desiredRoleKeySet.has(nk)) continue;
        return { lineId: n.id, role: n.role, text: n.text };
      }
      return null;
    })();
    const textForCheck = normalizeForCheck(line.text);
    if (!textForCheck) continue;
    out.push({
      id: line.id,
      lineId: line.id,
      sceneId: line.sceneId,
      sceneTitle: line.sceneTitle,
      role: line.role,
      textRaw: line.text,
      textForCheck,
      prev,
      nextPartner,
    });
  }
  return out;
}

export function buildExerciseIndexByLineId(exercises: VoiceExercise[]): Map<string, number> {
  const m = new Map<string, number>();
  for (let i = 0; i < exercises.length; i += 1) {
    const ex = exercises[i]!;
    m.set(ex.lineId, i);
  }
  return m;
}

export function buildLineBeforeActive(current: VoiceExercise | null): DialogueLine | null {
  if (!current?.prev) return null;
  return {
    id: current.prev.lineId,
    sceneId: current.sceneId,
    sceneTitle: current.sceneTitle,
    kind: "utterance",
    role: current.prev.role,
    text: current.prev.text,
  };
}

export function buildActiveLineForBody(current: VoiceExercise | null): DialogueLine | null {
  if (!current) return null;
  return {
    id: current.lineId,
    sceneId: current.sceneId,
    sceneTitle: current.sceneTitle,
    kind: "utterance",
    role: current.role,
    text: current.textRaw,
  };
}

export function countDoneExercises(exercises: VoiceExercise[], doneIds: Set<string>): number {
  let c = 0;
  for (const ex of exercises) if (doneIds.has(ex.id)) c += 1;
  return c;
}

export type PartnerRoleInScene = { roleKey: string; roleTitle: string };

export function buildPartnerRolesInScene(
  allLines: DialogueLine[],
  desiredRoleKeySet: Set<string>,
): PartnerRoleInScene[] {
  const map = new Map<string, string>();
  for (const line of allLines) {
    if (line.kind !== "utterance" || !line.role) continue;
    const rk = normalizeRoleKey(line.role);
    if (!rk || desiredRoleKeySet.has(rk)) continue;
    if (!map.has(rk)) map.set(rk, line.role);
  }
  return Array.from(map.entries())
    .map(([roleKey, roleTitle]) => ({ roleKey, roleTitle }))
    .sort((a, b) => a.roleTitle.localeCompare(b.roleTitle, "ru"));
}

export function buildActorsByPartnerRole(
  partnerRolesInScene: PartnerRoleInScene[],
  projectRoles: ProjectRoleInfo[],
): Record<string, Array<{ id: string; label: string }>> {
  const out: Record<string, Array<{ id: string; label: string }>> = {};
  for (const { roleKey } of partnerRolesInScene) {
    const projectRole = findProjectRoleForScriptKey(roleKey, projectRoles);
    out[roleKey] = projectRole ? actorsAssignedToProjectRole(projectRole) : [];
  }
  return out;
}

export function collectAssignedActorEmails(
  actorsByPartnerRole: Record<string, Array<{ id: string; label: string }>>,
): string[] {
  const seen = new Set<string>();
  for (const list of Object.values(actorsByPartnerRole)) {
    for (const a of list) {
      if (a.id) seen.add(a.id);
    }
  }
  return Array.from(seen);
}
