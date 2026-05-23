import type { SceneData, SceneRolesDataV1 } from "./scene-slice";

export function loadSceneRolesFromStorage(projectSlug: string): SceneRolesDataV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`sceneRoles:${projectSlug}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return null;
    if ((parsed as SceneRolesDataV1).v !== 1) return null;
    const byStepId = (parsed as SceneRolesDataV1).byStepId;
    if (!byStepId || typeof byStepId !== "object") return null;
    return parsed as SceneRolesDataV1;
  } catch {
    return null;
  }
}

export function saveSceneRolesToStorage(projectSlug: string, sceneData: SceneData | null) {
  if (typeof window === "undefined") return;
  try {
    const raw = sceneData?.sceneRoles;
    // Important: do not wipe previously cached roles on initial null sceneData.
    if (!raw) return;
    if (typeof raw !== "object") return;
    if (raw.v !== 1) return;
    localStorage.setItem(`sceneRoles:${projectSlug}`, JSON.stringify(raw));
  } catch {
    // ignore
  }
}
