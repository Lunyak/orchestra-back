export type SceneRoleLinkV1 = {
  roleId: string;
  roleKey?: string;
  roleTitle?: string;
  note?: string;
  createdAtIso?: string;
  updatedAtIso?: string;
};

export type SceneRolesDataV1 = {
  v: 1;
  bySceneId?: Record<
    string,
    Record<string, SceneRoleLinkV1 | undefined> | undefined
  >;
};

type SceneRolesDataV1Raw = SceneRolesDataV1 & {
  byStepId?: SceneRolesDataV1['bySceneId'];
};

export function normalizeSceneRolesDataV1(raw: unknown): SceneRolesDataV1 | null {
  if (!raw || typeof raw !== 'object') return null;
  const parsed = raw as SceneRolesDataV1Raw;
  if (parsed.v !== 1) return null;
  const bySceneId = parsed.bySceneId ?? parsed.byStepId;
  if (!bySceneId || typeof bySceneId !== 'object') return null;
  return { v: 1, bySceneId };
}

export function readSceneRolesBySceneId(
  sceneRoles: unknown,
): Record<string, Record<string, SceneRoleLinkV1 | undefined> | undefined> {
  return normalizeSceneRolesDataV1(sceneRoles)?.bySceneId ?? {};
}

export function extractRoleKeysFromSceneRoles(
  sceneRoles: unknown,
  sceneSourceId: number,
  normalizeRoleKey: (value: unknown) => string,
): string[] {
  const bySceneId = readSceneRolesBySceneId(sceneRoles);
  const sceneMap = bySceneId[String(sceneSourceId)];
  if (!sceneMap || typeof sceneMap !== 'object') return [];
  const out: string[] = [];
  for (const it of Object.values(sceneMap as Record<string, unknown>)) {
    if (!it || typeof it !== 'object') continue;
    const row = it as SceneRoleLinkV1;
    const key =
      typeof row.roleKey === 'string' && row.roleKey.trim()
        ? normalizeRoleKey(row.roleKey)
        : typeof row.roleTitle === 'string' && row.roleTitle.trim()
          ? normalizeRoleKey(row.roleTitle)
          : null;
    if (key) out.push(key);
  }
  return Array.from(new Set(out)).filter(Boolean);
}
