type TheaterModelPayload = {
  id?: number;
  name?: string;
  type?: string;
  builtin?: string | null;
  file?: string | null;
  kind?: string;
  allowOutOfBounds?: boolean;
  position?: unknown;
  rotation?: unknown;
  scale?: unknown;
  decorSize?: unknown;
  decorColor?: string | null;
  decorTexture?: string | null;
  decorTextureRepeat?: number | null;
  decorTextureMode?: string | null;
  decorTextureFaces?: unknown;
};

export function flattenClientTheaterModels(step: {
  theaterModels?: TheaterModelPayload[];
  theaterDecor?: TheaterModelPayload[];
}): TheaterModelPayload[] {
  const props = (step.theaterModels ?? []).map((m) => ({ ...m, kind: m.kind ?? 'prop' }));
  const decor = (step.theaterDecor ?? []).map((m) => ({ ...m, kind: 'decor' }));
  return [...props, ...decor];
}

export function splitPrismaTheaterModelsForClient(models: Array<Record<string, unknown>>): {
  theaterModels: Record<string, unknown>[];
  theaterDecor: Record<string, unknown>[];
} {
  const theaterModels: Record<string, unknown>[] = [];
  const theaterDecor: Record<string, unknown>[] = [];
  for (const row of models) {
    const client = prismaTheaterModelRowToClient(row);
    if (row.kind === 'decor') theaterDecor.push(client);
    else theaterModels.push(client);
  }
  return { theaterModels, theaterDecor };
}

export function prismaTheaterModelRowToClient(row: Record<string, unknown>) {
  return {
    id: row.sourceId,
    name: row.name,
    type: row.type,
    builtin: row.builtin ?? undefined,
    file: row.file ?? undefined,
    allowOutOfBounds: row.allowOutOfBounds ?? false,
    position: row.position,
    rotation: row.rotation,
    scale: row.scale,
    decorSize: row.decorSize ?? undefined,
    decorColor: row.decorColor ?? undefined,
    decorTexture: row.decorTexture ?? undefined,
    decorTextureRepeat: row.decorTextureRepeat ?? undefined,
    decorTextureMode: row.decorTextureMode ?? undefined,
    decorTextureFaces: row.decorTextureFaces ?? undefined,
  };
}

export function clientTheaterModelToPrisma(
  stepId: string,
  m: TheaterModelPayload,
  normalizeVec3: (v: unknown, fallback: [number, number, number]) => [number, number, number],
  normalizeInt: (v: unknown, fallback: number) => number,
  normalizeString: (v: unknown, fallback: string) => string,
  normalizeBool: (v: unknown, fallback: boolean) => boolean,
) {
  const sourceId = normalizeInt(m?.id, -1);
  if (sourceId <= 0) return null;
  return {
    stepId,
    sourceId,
    name: normalizeString(m?.name, `Model ${sourceId}`),
    type: normalizeString(m?.type, 'builtin'),
    builtin:
      typeof m?.builtin === 'string' && m.builtin.trim() ? m.builtin.trim() : null,
    file: typeof m?.file === 'string' && m.file.trim() ? m.file.trim() : null,
    kind: m?.kind === 'decor' ? 'decor' : 'prop',
    allowOutOfBounds: normalizeBool(m?.allowOutOfBounds, false),
    position: normalizeVec3(m?.position, [0, 0, 0]),
    rotation: normalizeVec3(m?.rotation, [0, 0, 0]),
    scale: normalizeVec3(m?.scale, [1, 1, 1]),
    decorSize: m?.decorSize ?? null,
    decorColor:
      typeof m?.decorColor === 'string' && m.decorColor.trim()
        ? m.decorColor.trim()
        : null,
    decorTexture:
      typeof m?.decorTexture === 'string' && m.decorTexture.trim()
        ? m.decorTexture.trim()
        : null,
    decorTextureRepeat:
      typeof m?.decorTextureRepeat === 'number' && Number.isFinite(m.decorTextureRepeat)
        ? m.decorTextureRepeat
        : null,
    decorTextureMode:
      typeof m?.decorTextureMode === 'string' && m.decorTextureMode.trim()
        ? m.decorTextureMode.trim()
        : null,
    decorTextureFaces: m?.decorTextureFaces ?? null,
  };
}
