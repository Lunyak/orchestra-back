export type SelectedSceneRef = { playbookId: string; sceneId: number };

export function parseSelectedScenesJson(value: unknown): SelectedSceneRef[] {
  if (!value || !Array.isArray(value)) return [];
  const out: SelectedSceneRef[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const playbookId = String(row.playbookId ?? row.sceneId ?? '').trim();
    const sceneIdRaw = row.sceneId ?? row.stepId;
    const sceneId =
      typeof sceneIdRaw === 'number'
        ? Math.trunc(sceneIdRaw)
        : parseInt(String(sceneIdRaw ?? ''), 10);
    if (!playbookId) continue;
    if (!Number.isFinite(sceneId) || sceneId <= 0) continue;
    out.push({ playbookId, sceneId });
  }
  const map = new Map<string, SelectedSceneRef>();
  for (const x of out) map.set(`${x.playbookId}:${x.sceneId}`, x);
  return Array.from(map.values());
}
