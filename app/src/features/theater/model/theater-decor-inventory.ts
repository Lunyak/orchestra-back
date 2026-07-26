import type { ScriptRequisite, TheaterModel } from "../../../shared/types/script";
import { roundM } from "./theater-metrics";
import {
  DECOR_CATALOG,
  getDecorCatalogEntry,
  isTheaterDecorModel,
  resolveDecorColor,
  resolveDecorSize,
} from "./theater-decor-catalog";
import {
  DECOR_TEXTURE_PRESETS,
  getDecorTextureFilePath,
  getDecorTexturePresetId,
} from "./theater-decor-textures";

export type DecorInventoryLine = {
  key: string;
  label: string;
  count: number;
  size?: [number, number, number];
  textureLabel?: string;
  positions: [number, number, number][];
};

function formatDecorTextureLabel(textureRef: string | undefined): string | undefined {
  if (!textureRef) return undefined;
  const presetId = getDecorTexturePresetId(textureRef);
  if (presetId) {
    const preset = DECOR_TEXTURE_PRESETS.find((item) => item.id === presetId);
    return preset?.label ?? presetId;
  }
  const filePath = getDecorTextureFilePath(textureRef);
  if (filePath) return filePath.split("/").pop() ?? filePath;
  if (/^data:image\//i.test(textureRef)) return "загруженное изображение";
  return textureRef;
}

function decorLineKey(model: TheaterModel): string {
  const size = resolveDecorSize(model);
  const texture = model.decorTexture ?? "";
  const mode = model.decorTextureMode ?? "";
  const name = model.name.trim();
  return [
    name,
    size.map((v) => roundM(v).toFixed(2)).join("×"),
    texture,
    mode,
  ].join("|");
}

function formatSize(size: [number, number, number]): string {
  return `${roundM(size[0])}×${roundM(size[1])}×${roundM(size[2])}`;
}

function formatPosition(position: [number, number, number]): string {
  return `(${roundM(position[0])}; ${roundM(position[1])}; ${roundM(position[2])})`;
}

export function collectDecorInventoryLines(models: TheaterModel[]): DecorInventoryLine[] {
  const map = new Map<string, DecorInventoryLine>();

  for (const model of models) {
    if (!isTheaterDecorModel(model)) continue;
    const key = decorLineKey(model);
    const size = resolveDecorSize(model);
    const textureLabel = formatDecorTextureLabel(model.decorTexture);
    const existing = map.get(key);
    if (existing) {
      existing.count += 1;
      existing.positions.push([...model.position]);
      continue;
    }
    map.set(key, {
      key,
      label: model.name.trim() || getDecorCatalogEntryByBuiltin(model.builtin)?.label || "Декор",
      count: 1,
      size,
      textureLabel,
      positions: [[...model.position]],
    });
  }

  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "ru"));
}

function getDecorCatalogEntryByBuiltin(
  builtin: TheaterModel["builtin"],
) {
  return DECOR_CATALOG.find((item) => item.builtin === builtin);
}

export function formatDecorInventoryPlain(
  models: TheaterModel[],
  sceneTitle?: string,
): string {
  const lines = collectDecorInventoryLines(models);
  const header = sceneTitle ? `Реквизит сцены: ${sceneTitle}` : "Реквизит сцены";
  if (lines.length === 0) return `${header}\n\n(нет декора на сцене)`;

  const body = lines.map((line) => {
    const qty = line.count > 1 ? ` ×${line.count}` : "";
    const sizePart = line.size ? ` — ${formatSize(line.size)}` : "";
    const texturePart = line.textureLabel ? `, текстура: ${line.textureLabel}` : "";
    const posPart =
      line.count === 1
        ? `, поз. ${formatPosition(line.positions[0])}`
        : `, позиции: ${line.positions.map(formatPosition).join(", ")}`;
    return `• ${line.label}${qty}${sizePart}${texturePart}${posPart}`;
  });

  return [header, "", ...body].join("\n");
}

export function formatDecorInventoryMarkdown(
  models: TheaterModel[],
  sceneTitle?: string,
): string {
  const lines = collectDecorInventoryLines(models);
  const header = sceneTitle ? `## Реквизит: ${sceneTitle}` : "## Реквизит сцены";
  if (lines.length === 0) return `${header}\n\n_Нет декора на сцене._`;

  const body = lines.map((line) => {
    const qty = line.count > 1 ? ` (**×${line.count}**)` : "";
    const sizePart = line.size ? ` — ${formatSize(line.size)}` : "";
    const texturePart = line.textureLabel ? `, текстура: *${line.textureLabel}*` : "";
    const posPart =
      line.count === 1
        ? `, поз. \`${formatPosition(line.positions[0])}\``
        : `, позиции: ${line.positions.map((p) => `\`${formatPosition(p)}\``).join(", ")}`;
    return `- **${line.label}**${qty}${sizePart}${texturePart}${posPart}`;
  });

  return [header, "", ...body].join("\n");
}

export function decorInventoryToRequisiteLabels(models: TheaterModel[]): string[] {
  return collectDecorInventoryLines(models).map((line) => {
    const qty = line.count > 1 ? ` ×${line.count}` : "";
    const sizePart = line.size ? ` ${formatSize(line.size)}` : "";
    const texturePart = line.textureLabel ? `, ${line.textureLabel}` : "";
    return `${line.label}${qty}${sizePart}${texturePart}`.trim();
  });
}

export function mergeDecorIntoRequisites(
  existing: ScriptRequisite[],
  decorLabels: string[],
): ScriptRequisite[] {
  const known = new Set(existing.map((item) => item.label.trim()));
  const maxId = existing.reduce((acc, item) => Math.max(acc, item.id), 0);
  let nextId = maxId;
  const appended: ScriptRequisite[] = [];

  for (const label of decorLabels) {
    const trimmed = label.trim();
    if (!trimmed || known.has(trimmed)) continue;
    known.add(trimmed);
    nextId += 1;
    appended.push({ id: nextId, label: trimmed, checked: false });
  }

  if (appended.length === 0) return existing;
  return [...existing, ...appended];
}

/** Models flagged as prop in 3D and not yet in the scene requisites list. */
export function listTheaterRequisiteCandidates(
  models: TheaterModel[],
  existing: ScriptRequisite[],
): Array<Pick<TheaterModel, "id" | "name">> {
  const linkedIds = new Set(
    existing
      .map((item) => item.theaterModelId)
      .filter((id): id is number => id != null && id > 0),
  );
  return models
    .filter((model) => model.isRequisite === true && !linkedIds.has(model.id))
    .map((model) => ({
      id: model.id,
      name: String(model.name ?? "").trim() || `Модель ${model.id}`,
    }));
}

/** Explicit add of a 3D prop into the scene requisites list. */
export function addRequisiteFromTheaterModel(
  existing: ScriptRequisite[],
  model: Pick<TheaterModel, "id" | "name">,
): ScriptRequisite[] {
  const modelId = Math.trunc(Number(model.id) || 0);
  if (modelId <= 0) return existing;
  if (existing.some((item) => item.theaterModelId === modelId)) return existing;
  const label = String(model.name ?? "").trim() || `Модель ${modelId}`;
  const labelKey = label.toLowerCase();
  const orphanIndex = existing.findIndex(
    (item) =>
      (item.theaterModelId == null || item.theaterModelId <= 0) &&
      item.label.trim().toLowerCase() === labelKey,
  );
  if (orphanIndex >= 0) {
    return existing.map((item, index) =>
      index === orphanIndex ? { ...item, label, theaterModelId: modelId } : item,
    );
  }
  const maxId = existing.reduce((acc, item) => Math.max(acc, item.id), 0);
  return [
    ...existing,
    {
      id: maxId + 1,
      label,
      checked: false,
      theaterModelId: modelId,
    },
  ];
}

/** Drop scene requisite linked to a deleted 3D model (manual items untouched). */
export function unlinkRequisiteFromTheaterModel(
  existing: ScriptRequisite[],
  theaterModelId: number,
): ScriptRequisite[] {
  const modelId = Math.trunc(Number(theaterModelId) || 0);
  if (modelId <= 0) return existing;
  const next = existing.filter((item) => item.theaterModelId !== modelId);
  return next.length === existing.length ? existing : next;
}

/**
 * Subscription for items added from 3D (`theaterModelId`):
 * - model gone or `isRequisite` off → drop from list
 * - still linked → keep label in sync with model name
 * Manual requisites (no theaterModelId) are untouched.
 */
export function syncSubscribedTheaterRequisites(
  existing: ScriptRequisite[],
  models: TheaterModel[],
): ScriptRequisite[] {
  if (existing.length === 0) return existing;
  const byId = new Map(models.map((model) => [model.id, model]));
  let changed = false;
  const next: ScriptRequisite[] = [];

  for (const item of existing) {
    const modelId = item.theaterModelId;
    if (modelId == null || modelId <= 0) {
      next.push(item);
      continue;
    }
    const model = byId.get(modelId);
    if (!model || model.isRequisite !== true) {
      changed = true;
      continue;
    }
    const label = String(model.name ?? "").trim() || `Модель ${modelId}`;
    if (item.label !== label) {
      changed = true;
      next.push({ ...item, label });
      continue;
    }
    next.push(item);
  }

  return changed ? next : existing;
}

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function formatDecorInventoryCsv(
  models: TheaterModel[],
  sceneTitle?: string,
): string {
  const lines = collectDecorInventoryLines(models);
  const rows: string[][] = [
    ["label", "count", "size_m", "texture", "positions_m"],
  ];
  for (const line of lines) {
    rows.push([
      line.label,
      String(line.count),
      line.size ? formatSize(line.size) : "",
      line.textureLabel ?? "",
      line.positions.map(formatPosition).join("; "),
    ]);
  }
  const body = rows.map((row) => row.map(escapeCsvCell).join(",")).join("\n");
  if (sceneTitle?.trim()) {
    return `# ${sceneTitle.trim()}\n${body}`;
  }
  return body;
}

export function downloadDecorInventoryCsv(
  models: TheaterModel[],
  sceneTitle?: string,
  filename = "decor-inventory.csv",
) {
  const csv = formatDecorInventoryCsv(models, sceneTitle);
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function collectFileModelInventoryLines(models: TheaterModel[]): string[] {
  return models
    .filter((model) => model.type === "file" || Boolean(model.file))
    .map((model) => {
      const name = model.name.trim() || model.file?.split("/").pop() || "Модель";
      return `${name} — поз. ${formatPosition(model.position)}`;
    });
}
