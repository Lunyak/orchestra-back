/** Legacy JSON field reads during step → scene migration. */

export function readLegacySceneLabel(
  raw: Record<string, unknown> | null | undefined,
): string {
  return String(raw?.sceneLabel ?? raw?.stepLabel ?? "").trim();
}

export function readLegacySceneRolesBySceneId(
  parsed: Record<string, unknown> | null | undefined,
): unknown {
  if (!parsed || typeof parsed !== "object") return undefined;
  return parsed.bySceneId ?? parsed.byStepId;
}

export function readLegacyPlaybookScenesArray(
  data: Record<string, unknown> | null | undefined,
): unknown[] {
  if (!data || typeof data !== "object") return [];
  const fromScenes = Array.isArray(data.scenes) ? data.scenes : [];
  const fromLegacySteps = Array.isArray(data.steps) ? data.steps : [];
  return fromScenes.length > 0 ? fromScenes : fromLegacySteps;
}
