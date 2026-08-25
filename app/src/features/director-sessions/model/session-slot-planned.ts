import { readPlaybookRolesBySceneId } from "../../playbook/model/playbook-roles-storage";
import type { PlaybookRolesDataV1 } from "../../playbook";
import type { ScriptScene } from "../../../shared/types/script";
import type { DirectorSlotRoleRehearsalPick } from "../directorSessionsSync";
import { looksLikeEmail, normalizeEmail, normalizeRoleKey } from "./session-page-utils";

export type { DirectorSlotRoleRehearsalPick };

export type DirectorSlotPlannedData = {
  scenes: ScriptScene[];
  sceneRoles?: PlaybookRolesDataV1 | null;
  roleEmailsByKey: Record<string, string[]>;
};

function extractRoleKeysFromSceneRoles(
  sceneRoles: PlaybookRolesDataV1 | null | undefined,
  sceneId: number,
): string[] {
  const sr = sceneRoles;
  if (!sr || typeof sr !== "object" || sr.v !== 1) return [];
  const bySceneId = readPlaybookRolesBySceneId(sr);
  if (!bySceneId || typeof bySceneId !== "object") return [];
  const sceneMap = bySceneId[String(sceneId)];
  if (!sceneMap || typeof sceneMap !== "object") return [];
  const out: string[] = [];
  for (const it of Object.values(sceneMap)) {
    if (!it || typeof it !== "object") continue;
    const key =
      typeof it.roleKey === "string" && it.roleKey.trim()
        ? normalizeRoleKey(it.roleKey)
        : typeof it.roleTitle === "string" && it.roleTitle.trim()
          ? normalizeRoleKey(it.roleTitle)
          : null;
    if (key) out.push(key);
  }
  return Array.from(new Set(out)).filter(Boolean);
}

function extractRolesBrackets(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const role = (m[1] ?? "").trim();
    if (role) out.push(role);
  }
  return Array.from(new Set(out));
}

function extractSpeakerRolesFromLines(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("==") || line.startsWith("(")) continue;
    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, " ").trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }
    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) out.push(m2[1].trim());
  }
  return Array.from(new Set(out));
}

function extractRolesSmart(text?: string): string[] {
  const a = extractRolesBrackets(text);
  const b = extractSpeakerRolesFromLines(text);
  return Array.from(
    new Set(
      [...a, ...b]
        .map((x) => String(x ?? "").trim())
        .filter((x) => x.length > 0),
    ),
  );
}

export function getNormalizedRoleKeysForSlotScene(
  scene: ScriptScene | null | undefined,
  sceneRoles: PlaybookRolesDataV1 | null | undefined,
  sceneId: number,
): string[] {
  if (!scene) return [];
  const text = String(scene.playMarkdown ?? scene.markdown ?? "");
  const attachedKeys = extractRoleKeysFromSceneRoles(sceneRoles, sceneId);
  const roleKeys =
    attachedKeys.length > 0
      ? attachedKeys
      : extractRolesSmart(text)
          .map((r) => normalizeRoleKey(r))
          .filter(Boolean);
  return Array.from(new Set(roleKeys));
}

export function getNormalizedRoleKeysForAllScenes(
  scenes: ScriptScene[] | null | undefined,
  sceneRoles: PlaybookRolesDataV1 | null | undefined,
): string[] {
  const out = new Set<string>();
  for (const scene of scenes ?? []) {
    const sceneId = Math.floor(Number(scene?.id) || 0);
    if (!Number.isFinite(sceneId) || sceneId <= 0) continue;
    for (const key of getNormalizedRoleKeysForSlotScene(
      scene,
      sceneRoles,
      sceneId,
    )) {
      if (key) out.add(key);
    }
  }
  return Array.from(out);
}

export function materializeAllRoleRehearsalPicks(
  roleKeys: string[],
  roleEmailsByKey: Record<string, string[]>,
): DirectorSlotRoleRehearsalPick[] {
  const out: DirectorSlotRoleRehearsalPick[] = [];
  for (const rk of roleKeys) {
    for (const em of roleEmailsByKey[rk] ?? []) {
      const email = normalizeEmail(String(em ?? ""));
      if (!email) continue;
      out.push({ roleKey: rk, email, checked: true });
    }
  }
  return out;
}

export const SLOT_PROG_RUN_TITLE = "ПРОГОН";

/** Все назначенные на роли слота — для графика занятости (без учёта roleRehearsalPicks). */
export function getAllAssigneeEmailsForDirectorSlotChart(
  projectSlug: string,
  sceneId: number,
  data: DirectorSlotPlannedData | null | undefined,
): string[] {
  const slug = String(projectSlug ?? "").trim();
  if (!slug || !data) return [];
  const scene = (data.scenes ?? []).find((x) => x.id === sceneId) ?? null;
  const roleKeys = getNormalizedRoleKeysForSlotScene(scene, data.sceneRoles, sceneId);
  const out = new Set<string>();
  const roleEmails = data.roleEmailsByKey ?? {};
  for (const key of roleKeys) {
    if (!key) continue;
    for (const e of roleEmails[key] ?? []) {
      const norm = normalizeEmail(String(e ?? ""));
      if (!norm || !looksLikeEmail(norm)) continue;
      out.add(norm);
      if (out.size >= 500) break;
    }
    if (out.size >= 500) break;
  }
  return Array.from(out);
}

export type RolePlannedEmails = { roleKey: string; emails: string[] };

/** План по ролям сцены (для проверки «в каждой роли есть свободный актёр»). */
export function getRolePlannedEmailsForDirectorSlot(
  projectSlug: string,
  sceneId: number,
  data: DirectorSlotPlannedData | null | undefined,
  roleRehearsalPicks?: DirectorSlotRoleRehearsalPick[] | null,
): RolePlannedEmails[] {
  const slug = String(projectSlug ?? "").trim();
  if (!slug || !data) return [];
  const scene = (data.scenes ?? []).find((x) => x.id === sceneId) ?? null;
  const roleKeys = getNormalizedRoleKeysForSlotScene(scene, data.sceneRoles, sceneId);
  const picks = roleRehearsalPicks ?? null;
  const roleEmails = data.roleEmailsByKey ?? {};
  const out: RolePlannedEmails[] = [];
  for (const key of roleKeys) {
    if (!key) continue;
    const assignees = roleEmails[key] ?? [];
    const rolePicks = (picks ?? []).filter((p) => normalizeRoleKey(p.roleKey) === key);
    const emails: string[] = [];
    if (rolePicks.length > 0) {
      for (const p of rolePicks) {
        if (!p.checked) continue;
        const norm = normalizeEmail(String(p.email ?? ""));
        if (!norm || !looksLikeEmail(norm)) continue;
        emails.push(norm);
        if (emails.length >= 200) break;
      }
    } else {
      for (const e of assignees) {
        const norm = normalizeEmail(String(e ?? ""));
        if (!norm || !looksLikeEmail(norm)) continue;
        emails.push(norm);
        if (emails.length >= 200) break;
      }
    }
    out.push({ roleKey: key, emails });
  }
  return out;
}

export function getEmailsPlannedForDirectorSlot(
  projectSlug: string,
  sceneId: number,
  data: DirectorSlotPlannedData | null | undefined,
  roleRehearsalPicks?: DirectorSlotRoleRehearsalPick[] | null,
): string[] {
  const slug = String(projectSlug ?? "").trim();
  if (!slug || !data) return [];
  const scene = (data.scenes ?? []).find((x) => x.id === sceneId) ?? null;
  const roleKeys = getNormalizedRoleKeysForSlotScene(scene, data.sceneRoles, sceneId);
  const picks = roleRehearsalPicks ?? null;
  const out = new Set<string>();
  const roleEmails = data.roleEmailsByKey ?? {};
  for (const key of roleKeys) {
    if (!key) continue;
    const rolePicks = (picks ?? []).filter((p) => normalizeRoleKey(p.roleKey) === key);
    if (rolePicks.length > 0) {
      let hadChecked = false;
      for (const p of rolePicks) {
        if (!p.checked) continue;
        hadChecked = true;
        const norm = normalizeEmail(String(p.email ?? ""));
        if (!norm || !looksLikeEmail(norm)) continue;
        out.add(norm);
        if (out.size >= 500) break;
      }
      if (!hadChecked) {
        for (const e of roleEmails[key] ?? []) {
          const norm = normalizeEmail(String(e ?? ""));
          if (!norm || !looksLikeEmail(norm)) continue;
          out.add(norm);
          if (out.size >= 500) break;
        }
      }
    } else {
      for (const e of roleEmails[key] ?? []) {
        const norm = normalizeEmail(String(e ?? ""));
        if (!norm || !looksLikeEmail(norm)) continue;
        out.add(norm);
        if (out.size >= 500) break;
      }
    }
    if (out.size >= 500) break;
  }
  return Array.from(out);
}
