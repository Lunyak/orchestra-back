import type { DirectorSlotRoleRehearsalPick } from "../../features/director-sessions/directorSessionsSync";
import type { SceneRolesDataV1 } from "../../features/scene";
import type { ScriptStep } from "../../shared/types/script";

export type { DirectorSlotRoleRehearsalPick };

export type DirectorSlotPlannedData = {
  steps: ScriptStep[];
  sceneRoles?: SceneRolesDataV1 | null;
  roleEmailsByKey: Record<string, string[]>;
};

function normalizeRoleKey(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeEmail(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

function extractRoleKeysFromSceneRoles(
  sceneRoles: SceneRolesDataV1 | null | undefined,
  stepId: number,
): string[] {
  const sr = sceneRoles as SceneRolesDataV1 | null | undefined;
  if (!sr || typeof sr !== "object" || (sr as any).v !== 1) return [];
  const byStepId = (sr as any).byStepId;
  if (!byStepId || typeof byStepId !== "object") return [];
  const stepMap = byStepId[String(stepId)];
  if (!stepMap || typeof stepMap !== "object") return [];
  const out: string[] = [];
  for (const it of Object.values(stepMap as Record<string, unknown>)) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const key =
      typeof o.roleKey === "string" && o.roleKey.trim()
        ? normalizeRoleKey(o.roleKey)
        : typeof o.roleTitle === "string" && o.roleTitle.trim()
          ? normalizeRoleKey(o.roleTitle)
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

export function getNormalizedRoleKeysForSlotStep(
  step: ScriptStep | null | undefined,
  sceneRoles: SceneRolesDataV1 | null | undefined,
  stepId: number,
): string[] {
  if (!step) return [];
  const text = String(
    (step as any)?.playMarkdown ?? (step as any)?.markdown ?? "",
  );
  const attachedKeys = extractRoleKeysFromSceneRoles(sceneRoles, stepId);
  const roleKeys =
    attachedKeys.length > 0
      ? attachedKeys
      : extractRolesSmart(text)
          .map((r) => normalizeRoleKey(r))
          .filter(Boolean);
  return Array.from(new Set(roleKeys));
}

/** Все назначенные на роли слота — для графика занятости (без учёта roleRehearsalPicks). */
export function getAllAssigneeEmailsForDirectorSlotChart(
  projectSlug: string,
  stepId: number,
  data: DirectorSlotPlannedData | null | undefined,
): string[] {
  const slug = String(projectSlug ?? "").trim();
  if (!slug) return [];
  if (!data) return [];
  const step = (data.steps ?? []).find((x) => x.id === stepId) ?? null;
  const roleKeys = getNormalizedRoleKeysForSlotStep(
    step,
    data.sceneRoles,
    stepId,
  );
  const out = new Set<string>();
  const roleEmails = data.roleEmailsByKey ?? {};
  for (const key of roleKeys) {
    if (!key) continue;
    const assignees = roleEmails[key] ?? [];
    for (const e of assignees) {
      const norm = normalizeEmail(String(e ?? ""));
      if (!norm || !looksLikeEmail(norm)) continue;
      out.add(norm);
      if (out.size >= 500) break;
    }
    if (out.size >= 500) break;
  }
  return Array.from(out);
}

export function getEmailsPlannedForDirectorSlot(
  projectSlug: string,
  stepId: number,
  data: DirectorSlotPlannedData | null | undefined,
  roleRehearsalPicks?: DirectorSlotRoleRehearsalPick[] | null,
): string[] {
  const slug = String(projectSlug ?? "").trim();
  if (!slug) return [];
  if (!data) return [];
  const step = (data.steps ?? []).find((x) => x.id === stepId) ?? null;
  const roleKeys = getNormalizedRoleKeysForSlotStep(
    step,
    data.sceneRoles,
    stepId,
  );
  const picks = roleRehearsalPicks ?? null;
  const out = new Set<string>();
  const roleEmails = data.roleEmailsByKey ?? {};
  for (const key of roleKeys) {
    if (!key) continue;
    const assignees = roleEmails[key] ?? [];
    const rolePicks = (picks ?? []).filter(
      (p) => normalizeRoleKey(p.roleKey) === key,
    );
    if (rolePicks.length > 0) {
      for (const p of rolePicks) {
        if (!p.checked) continue;
        const norm = normalizeEmail(String(p.email ?? ""));
        if (!norm || !looksLikeEmail(norm)) continue;
        out.add(norm);
        if (out.size >= 500) break;
      }
    } else {
      for (const e of assignees) {
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
