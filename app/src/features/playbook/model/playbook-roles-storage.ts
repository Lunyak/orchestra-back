import type { PlaybookData, PlaybookRoleLinkV1, PlaybookRolesDataV1 } from "./playbook-slice";
import { readLegacySceneRolesBySceneId } from "../../../shared/playbook/legacy-scene-json";

export function normalizePlaybookRolesDataV1(raw: unknown): PlaybookRolesDataV1 | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as Record<string, unknown> & { v?: unknown };
  if (parsed.v !== 1) return null;
  const bySceneId = readLegacySceneRolesBySceneId(parsed) as PlaybookRolesDataV1["bySceneId"] | undefined;
  if (!bySceneId || typeof bySceneId !== "object") return null;
  return { v: 1, bySceneId };
}

export function readPlaybookRolesBySceneId(
  data: PlaybookRolesDataV1 | null | undefined,
): PlaybookRolesDataV1["bySceneId"] {
  return normalizePlaybookRolesDataV1(data)?.bySceneId ?? {};
}

export function loadSceneRolesFromStorage(projectSlug: string): PlaybookRolesDataV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`sceneRoles:${projectSlug}`);
    if (!raw) return null;
    return normalizePlaybookRolesDataV1(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveSceneRolesToStorage(projectSlug: string, playbookData: PlaybookData | null) {
  if (typeof window === "undefined") return;
  try {
    const raw = playbookData?.sceneRoles;
    if (!raw) return;
    const normalized = normalizePlaybookRolesDataV1(raw);
    if (!normalized) return;
    localStorage.setItem(`sceneRoles:${projectSlug}`, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export type { PlaybookRoleLinkV1 };
