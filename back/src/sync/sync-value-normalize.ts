export function syncNormalizeBool(v: unknown, fallback = false): boolean {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'true' || s === '1' || s === 'yes') return true;
    if (s === 'false' || s === '0' || s === 'no') return false;
  }
  return fallback;
}

export function syncNormalizeInt(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

export function syncNormalizeFloat(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export function syncNormalizeString(v: unknown, fallback = ''): string {
  const s = typeof v === 'string' ? v : String(v ?? '');
  const t = s.trim();
  return t || fallback;
}

export function syncNormalizeVec3(
  v: unknown,
  fallback: [number, number, number],
): [number, number, number] {
  if (!Array.isArray(v) || v.length !== 3) return fallback;
  const x = syncNormalizeFloat(v[0], fallback[0]);
  const y = syncNormalizeFloat(v[1], fallback[1]);
  const z = syncNormalizeFloat(v[2], fallback[2]);
  return [x, y, z];
}

export function syncNormalizeOptionalInt(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

const REQUISITE_DUTIES = new Set(["setup", "strike", "use"]);

export function syncMapSceneRequisiteRow(sceneId: string, raw: unknown) {
  const row = raw as Record<string, unknown> | null | undefined;
  const sourceId = syncNormalizeInt(row?.id ?? row?.sourceId, -1);
  if (sourceId <= 0) return null;
  const label = syncNormalizeString(row?.label, "");
  if (!label) return null;
  const theaterModelId = syncNormalizeInt(row?.theaterModelId, 0);
  const avatarKey = syncNormalizeString(row?.avatarKey, "");
  const assigneeEmail = syncNormalizeString(row?.assigneeEmail, "").toLowerCase();
  const dutyRaw = syncNormalizeString(row?.duty, "");
  const duty = REQUISITE_DUTIES.has(dutyRaw) ? dutyRaw : null;
  const placeNote = syncNormalizeString(row?.placeNote, "");
  const actionNote = syncNormalizeString(row?.actionNote, "");
  return {
    sceneId,
    sourceId,
    label,
    checked: syncNormalizeBool(row?.checked, false),
    theaterModelId: theaterModelId > 0 ? theaterModelId : null,
    avatarKey: avatarKey || null,
    assigneeEmail: assigneeEmail || null,
    duty,
    placeNote: placeNote || null,
    actionNote: actionNote || null,
  };
}

export function syncMapTheaterSpotlightRow(sceneId: string, sp: unknown) {
  const row = sp as Record<string, unknown> | null | undefined;
  const sourceId = syncNormalizeInt(row?.id, -1);
  if (sourceId <= 0) return null;
  const label = syncNormalizeString(row?.label, `Spotlight ${sourceId}`);
  return {
    sceneId,
    sourceId,
    label,
    position: syncNormalizeVec3(row?.position, [0, 6, 6]),
    target: syncNormalizeVec3(row?.target, [0, 1, 2]),
    angleDeg: syncNormalizeInt(row?.angleDeg, 20),
    intensity: syncNormalizeFloat(row?.intensity, 0.7),
    color: syncNormalizeString(row?.color, '#ffffff'),
    enabled: syncNormalizeBool(row?.enabled, true),
    channel: syncNormalizeInt(row?.channel, sourceId),
    isRgb: syncNormalizeBool(row?.isRgb, false),
    modelLowDetail: syncNormalizeBool(row?.modelLowDetail, false),
    mountModelId: syncNormalizeOptionalInt(row?.mountModelId),
    mountPointId:
      typeof row?.mountPointId === 'string' && row.mountPointId.trim()
        ? row.mountPointId.trim()
        : null,
    faderId: syncNormalizeOptionalInt(row?.faderId),
    hidden: syncNormalizeBool(row?.hidden, false),
    gridCol: syncNormalizeOptionalInt(row?.gridCol),
    gridRow: syncNormalizeOptionalInt(row?.gridRow),
  };
}

export function syncProjectIdFromCompoundId(
  value: string | null | undefined,
): string | null {
  const id = typeof value === 'string' ? value.trim() : '';
  if (!id) return null;
  const idx = id.indexOf(':');
  if (idx <= 0) return null;
  return id.slice(0, idx);
}
