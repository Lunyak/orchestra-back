import type { TheaterModel } from "../../../shared/types/script";

function axisIndex(axis: "x" | "z"): 0 | 2 {
  return axis === "x" ? 0 : 2;
}

export function alignModelsByActiveBuiltin(
  models: TheaterModel[],
  activeId: number,
  axis: "x" | "z",
): TheaterModel[] {
  const active = models.find((item) => item.id === activeId);
  if (!active?.builtin) return models;
  const index = axisIndex(axis);
  const target = active.position[index];
  return models.map((item) => {
    if (item.builtin !== active.builtin) return item;
    if (item.id === activeId) return item;
    const position: [number, number, number] = [...item.position];
    position[index] = target;
    return { ...item, position };
  });
}

export function distributeModelsByActiveBuiltin(
  models: TheaterModel[],
  activeId: number,
  axis: "x" | "z",
): TheaterModel[] {
  const active = models.find((item) => item.id === activeId);
  if (!active?.builtin) return models;
  const group = models.filter((item) => item.builtin === active.builtin);
  if (group.length < 3) return models;

  const index = axisIndex(axis);
  const sorted = [...group].sort((a, b) => a.position[index] - b.position[index]);
  const min = sorted[0].position[index];
  const max = sorted[sorted.length - 1].position[index];
  const span = max - min;
  if (span < 1e-4) return models;

  const nextCoord = new Map<number, number>();
  sorted.forEach((item, itemIndex) => {
    const t = itemIndex / (sorted.length - 1);
    nextCoord.set(item.id, min + span * t);
  });

  return models.map((item) => {
    const value = nextCoord.get(item.id);
    if (value == null) return item;
    const position: [number, number, number] = [...item.position];
    position[index] = value;
    return { ...item, position };
  });
}

export function countMatchingBuiltin(
  models: TheaterModel[],
  activeId: number,
): number {
  const active = models.find((item) => item.id === activeId);
  if (!active?.builtin) return 0;
  return models.filter((item) => item.builtin === active.builtin).length;
}

export function alignModelsBySelection(
  models: TheaterModel[],
  selectedIds: number[],
  axis: "x" | "z",
): TheaterModel[] {
  if (selectedIds.length < 2) return models;
  const selected = new Set(selectedIds);
  const anchorId = selectedIds[0];
  const anchor = models.find((item) => item.id === anchorId);
  if (!anchor) return models;
  const index = axisIndex(axis);
  const target = anchor.position[index];
  return models.map((item) => {
    if (!selected.has(item.id) || item.id === anchorId) return item;
    const position: [number, number, number] = [...item.position];
    position[index] = target;
    return { ...item, position };
  });
}

export function distributeModelsBySelection(
  models: TheaterModel[],
  selectedIds: number[],
  axis: "x" | "z",
): TheaterModel[] {
  if (selectedIds.length < 3) return models;
  const selected = new Set(selectedIds);
  const index = axisIndex(axis);
  const group = models.filter((item) => selected.has(item.id));
  const sorted = [...group].sort((a, b) => a.position[index] - b.position[index]);
  const min = sorted[0].position[index];
  const max = sorted[sorted.length - 1].position[index];
  const span = max - min;
  if (span < 1e-4) return models;

  const nextCoord = new Map<number, number>();
  sorted.forEach((item, itemIndex) => {
    const t = itemIndex / (sorted.length - 1);
    nextCoord.set(item.id, min + span * t);
  });

  return models.map((item) => {
    const value = nextCoord.get(item.id);
    if (value == null) return item;
    const position: [number, number, number] = [...item.position];
    position[index] = value;
    return { ...item, position };
  });
}

export function setModelsVisibilityBySelection(
  models: TheaterModel[],
  selectedIds: number[],
  hidden: boolean,
): TheaterModel[] {
  if (selectedIds.length === 0) return models;
  const selected = new Set(selectedIds);
  return models.map((item) => {
    if (!selected.has(item.id)) return item;
    if (hidden) return { ...item, hidden: true };
    const { hidden: _hidden, ...rest } = item;
    return rest;
  });
}
