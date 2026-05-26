import type { TheaterLayout, TheaterModel } from "../../../shared/types/script";
import type { DecorCatalogKey } from "./theater-decor-catalog";
import {
  DECOR_CATALOG,
  getDecorCatalogEntry,
  isTheaterDecorModel,
  resolveDecorColor,
  resolveDecorSize,
} from "./theater-decor-catalog";
import { roundM } from "./theater-metrics";

export const DECOR_TEMPLATE_JSON_VERSION = 2 as const;
export const DECOR_TEMPLATE_JSON_VERSION_LEGACY = 1 as const;

export type DecorTemplateJsonItem = {
  key: DecorCatalogKey;
  /** X как доля половины ширины зала: -1 — левый край, 0 — центр, 1 — правый */
  xNorm: number;
  /** Z от задней стены: 0 — задняя стена, 1 — передняя */
  zNorm: number;
  /** [ширина/hallWidth, высота/wallHeight, глубина в метрах] */
  size: [number, number, number];
  decorColor?: string;
  decorTexture?: string;
  decorTextureMode?: TheaterModel["decorTextureMode"];
  decorTextureRepeat?: number;
  name?: string;
};

export type DecorTemplateJson = {
  version: typeof DECOR_TEMPLATE_JSON_VERSION;
  id: string;
  label: string;
  description?: string;
  /** Монотонный номер ревизии шаблона (для версионирования). */
  revision: number;
  updatedAt?: string;
  items: DecorTemplateJsonItem[];
};

export type DecorTemplateListItem = {
  id: string;
  label: string;
  description?: string;
  revision?: number;
  source: "builtin" | "project" | "imported";
};

const CATALOG_KEYS = new Set<string>(DECOR_CATALOG.map((item) => item.key));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value != null && !Array.isArray(value);
}

function readTuple3(value: unknown): [number, number, number] | null {
  if (!Array.isArray(value) || value.length < 3) return null;
  const nums = value.slice(0, 3).map((item) => Number(item));
  if (nums.some((item) => !Number.isFinite(item))) return null;
  return [nums[0], nums[1], nums[2]];
}

function parseDecorTemplateItems(raw: unknown): DecorTemplateJsonItem[] {
  if (!Array.isArray(raw)) return [];
  const items: DecorTemplateJsonItem[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const key = String(item.key ?? "").trim();
    if (!CATALOG_KEYS.has(key)) continue;
    const xNorm = Number(item.xNorm);
    const zNorm = Number(item.zNorm);
    const size = readTuple3(item.size);
    if (!Number.isFinite(xNorm) || !Number.isFinite(zNorm) || !size) continue;
    items.push({
      key: key as DecorCatalogKey,
      xNorm,
      zNorm,
      size,
      decorColor: typeof item.decorColor === "string" ? item.decorColor : undefined,
      decorTexture:
        typeof item.decorTexture === "string" ? item.decorTexture : undefined,
      decorTextureMode:
        item.decorTextureMode === "repeat" ||
        item.decorTextureMode === "cover" ||
        item.decorTextureMode === "contain" ||
        item.decorTextureMode === "once"
          ? item.decorTextureMode
          : undefined,
      decorTextureRepeat:
        typeof item.decorTextureRepeat === "number" &&
        Number.isFinite(item.decorTextureRepeat)
          ? item.decorTextureRepeat
          : undefined,
      name: typeof item.name === "string" ? item.name : undefined,
    });
  }
  return items;
}

function finalizeDecorTemplateJson(
  raw: Record<string, unknown>,
  items: DecorTemplateJsonItem[],
): DecorTemplateJson | null {
  const id = String(raw.id ?? "").trim();
  const label = String(raw.label ?? "").trim();
  if (!id || !label || items.length === 0) return null;
  const revisionRaw = Number(raw.revision);
  const revision =
    Number.isFinite(revisionRaw) && revisionRaw > 0 ? Math.trunc(revisionRaw) : 1;
  return {
    version: DECOR_TEMPLATE_JSON_VERSION,
    id,
    label,
    description: typeof raw.description === "string" ? raw.description : undefined,
    revision,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : undefined,
    items,
  };
}

export function migrateDecorTemplateV1ToV2(raw: unknown): DecorTemplateJson | null {
  if (!isRecord(raw)) return null;
  if (Number(raw.version) !== DECOR_TEMPLATE_JSON_VERSION_LEGACY) return null;
  const items = parseDecorTemplateItems(raw.items);
  return finalizeDecorTemplateJson(
    { ...raw, revision: 1, updatedAt: raw.updatedAt ?? new Date().toISOString() },
    items,
  );
}

export function parseDecorTemplateJson(raw: unknown): DecorTemplateJson | null {
  if (!isRecord(raw)) return null;
  const version = Number(raw.version);
  if (version === DECOR_TEMPLATE_JSON_VERSION_LEGACY) {
    return migrateDecorTemplateV1ToV2(raw);
  }
  if (version !== DECOR_TEMPLATE_JSON_VERSION) return null;
  const items = parseDecorTemplateItems(raw.items);
  return finalizeDecorTemplateJson(raw, items);
}

export function layoutNormToPosition(
  layout: TheaterLayout,
  xNorm: number,
  zNorm: number,
): [number, number, number] {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const x = roundM(xNorm * halfW);
  const z = roundM(-halfD + zNorm * layout.hallDepth);
  return [x, 0, z];
}

export function layoutNormToSize(
  layout: TheaterLayout,
  sizeNorm: [number, number, number],
): [number, number, number] {
  return [
    roundM(sizeNorm[0] * layout.hallWidth),
    roundM(sizeNorm[1] * layout.wallHeight),
    roundM(sizeNorm[2]),
  ];
}

export function positionToLayoutNorm(
  layout: TheaterLayout,
  position: [number, number, number],
): { xNorm: number; zNorm: number } {
  const halfW = layout.hallWidth / 2;
  const halfD = layout.hallDepth / 2;
  const xNorm = halfW > 0 ? position[0] / halfW : 0;
  const zNorm =
    layout.hallDepth > 0 ? (position[2] + halfD) / layout.hallDepth : 0;
  return {
    xNorm: roundM(xNorm),
    zNorm: roundM(zNorm),
  };
}

export function sizeToLayoutNorm(
  layout: TheaterLayout,
  size: [number, number, number],
): [number, number, number] {
  return [
    layout.hallWidth > 0 ? roundM(size[0] / layout.hallWidth) : size[0],
    layout.wallHeight > 0 ? roundM(size[1] / layout.wallHeight) : size[1],
    roundM(size[2]),
  ];
}

function makeModelFromJsonItem(
  id: number,
  layout: TheaterLayout,
  item: DecorTemplateJsonItem,
): TheaterModel {
  const preset = getDecorCatalogEntry(item.key);
  const size = layoutNormToSize(layout, item.size);
  const position = layoutNormToPosition(layout, item.xNorm, item.zNorm);
  return {
    id,
    name: item.name?.trim() || preset.label,
    type: "builtin",
    builtin: preset.builtin,
    decorSize: size,
    decorColor: item.decorColor ?? preset.defaultColor,
    decorTexture: item.decorTexture,
    decorTextureMode: item.decorTextureMode,
    decorTextureRepeat: item.decorTextureRepeat,
    allowOutOfBounds: false,
    position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
  };
}

export function buildModelsFromDecorTemplateJson(
  template: DecorTemplateJson,
  layout: TheaterLayout,
  startId: number,
): TheaterModel[] {
  let id = startId;
  return template.items.map((item) => makeModelFromJsonItem(++id, layout, item));
}

export function exportDecorModelsToTemplateJson(
  models: TheaterModel[],
  layout: TheaterLayout,
  meta: Pick<DecorTemplateJson, "id" | "label" | "description"> & {
    revision?: number;
  },
): DecorTemplateJson {
  const items: DecorTemplateJsonItem[] = models
    .filter(isTheaterDecorModel)
    .map((model) => {
      const catalogKey =
        DECOR_CATALOG.find((entry) => entry.builtin === model.builtin)?.key ??
        "flat";
      const size = resolveDecorSize(model);
      const { xNorm, zNorm } = positionToLayoutNorm(layout, model.position);
      return {
        key: catalogKey,
        xNorm,
        zNorm,
        size: sizeToLayoutNorm(layout, size),
        decorColor: resolveDecorColor(model),
        decorTexture: model.decorTexture,
        decorTextureMode: model.decorTextureMode,
        decorTextureRepeat: model.decorTextureRepeat,
        name: model.name,
      };
    });

  return {
    version: DECOR_TEMPLATE_JSON_VERSION,
    id: meta.id,
    label: meta.label,
    description: meta.description,
    revision: Math.max(1, meta.revision ?? 1),
    updatedAt: new Date().toISOString(),
    items,
  };
}

export function decorTemplateStorageKey(projectName: string): string {
  return `orchestra:theaterDecorTemplates:${projectName}`;
}

export function readStoredDecorTemplates(projectName: string): DecorTemplateJson[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(decorTemplateStorageKey(projectName));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => parseDecorTemplateJson(item))
      .filter((item): item is DecorTemplateJson => item != null);
  } catch {
    return [];
  }
}

export function writeStoredDecorTemplates(
  projectName: string,
  templates: DecorTemplateJson[],
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      decorTemplateStorageKey(projectName),
      JSON.stringify(templates),
    );
  } catch {
    // ignore quota
  }
}

export function upsertStoredDecorTemplate(
  projectName: string,
  template: DecorTemplateJson,
): DecorTemplateJson[] {
  const existing = readStoredDecorTemplates(projectName);
  const prev = existing.find((item) => item.id === template.id);
  const nextTemplate: DecorTemplateJson = {
    ...template,
    version: DECOR_TEMPLATE_JSON_VERSION,
    revision: (prev?.revision ?? template.revision ?? 0) + 1,
    updatedAt: new Date().toISOString(),
  };
  const next = [
    ...existing.filter((item) => item.id !== template.id),
    nextTemplate,
  ];
  writeStoredDecorTemplates(projectName, next);
  return next;
}

export function removeStoredDecorTemplate(
  projectName: string,
  templateId: string,
): DecorTemplateJson[] {
  const next = readStoredDecorTemplates(projectName).filter(
    (item) => item.id !== templateId,
  );
  writeStoredDecorTemplates(projectName, next);
  return next;
}

export async function loadProjectDecorTemplateManifest(
  projectName: string,
): Promise<DecorTemplateJson[]> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api?.readProjectScene) return [];
  try {
    const raw = await api.readProjectScene(projectName, "decor-templates");
    if (Array.isArray(raw)) {
      return raw
        .map((item) => parseDecorTemplateJson(item))
        .filter((item): item is DecorTemplateJson => item != null);
    }
    if (isRecord(raw) && Array.isArray(raw.templates)) {
      return raw.templates
        .map((item) => parseDecorTemplateJson(item))
        .filter((item): item is DecorTemplateJson => item != null);
    }
  } catch {
    // scene file may not exist
  }
  return [];
}

export async function saveProjectDecorTemplates(
  projectName: string,
  templates: DecorTemplateJson[],
): Promise<boolean> {
  const api = typeof window !== "undefined" ? window.api : undefined;
  if (!api?.saveProjectScene) return false;
  try {
    await api.saveProjectScene(projectName, "decor-templates", { templates });
    return true;
  } catch {
    return false;
  }
}

export async function persistStoredDecorTemplatesToProject(
  projectName: string,
): Promise<{ ok: boolean; count: number }> {
  const local = readStoredDecorTemplates(projectName);
  const existing = await loadProjectDecorTemplateManifest(projectName);
  const merged = new Map<string, DecorTemplateJson>();
  for (const item of existing) merged.set(item.id, item);
  for (const item of local) merged.set(item.id, item);
  const templates = Array.from(merged.values());
  const ok = await saveProjectDecorTemplates(projectName, templates);
  return { ok, count: templates.length };
}

export function serializeDecorTemplateJson(template: DecorTemplateJson): string {
  return JSON.stringify(template, null, 2);
}

export function downloadDecorTemplateJson(template: DecorTemplateJson): void {
  const blob = new Blob([serializeDecorTemplateJson(template)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${template.id || "decor-template"}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
