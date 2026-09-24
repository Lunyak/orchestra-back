import type { TheaterModel } from "../../../shared/types/script";

export function modelGroupMemberIds(
  models: TheaterModel[],
  modelId: number,
): number[] {
  const model = models.find((item) => item.id === modelId);
  if (model?.groupId == null) return [modelId];
  const members = models
    .filter((item) => item.groupId === model.groupId)
    .map((item) => item.id);
  return members.length > 1 ? members : [modelId];
}

export function expandModelIdsWithGroups(
  models: TheaterModel[],
  ids: number[],
): number[] {
  const expanded = new Set<number>();
  ids.forEach((id) => {
    modelGroupMemberIds(models, id).forEach((memberId) => expanded.add(memberId));
  });
  return [...expanded];
}

export function selectionHasModelGroup(
  models: TheaterModel[],
  ids: number[],
): boolean {
  return ids.some((id) => {
    const model = models.find((item) => item.id === id);
    return model?.groupId != null && modelGroupMemberIds(models, id).length > 1;
  });
}

function nextGroupId(models: TheaterModel[]): number {
  return models.reduce((maxId, model) => Math.max(maxId, model.groupId ?? 0), 0) + 1;
}

function withoutOrphanGroups(models: TheaterModel[]): TheaterModel[] {
  const counts = new Map<number, number>();
  models.forEach((model) => {
    if (model.groupId == null) return;
    counts.set(model.groupId, (counts.get(model.groupId) ?? 0) + 1);
  });
  return models.map((model) => {
    if (model.groupId == null) return model;
    if ((counts.get(model.groupId) ?? 0) > 1) return model;
    const { groupId: _groupId, ...rest } = model;
    return rest;
  });
}

export function groupTheaterModels(
  models: TheaterModel[],
  ids: number[],
): TheaterModel[] {
  const selected = new Set(expandModelIdsWithGroups(models, ids));
  if (selected.size < 2) return models;
  const groupId = nextGroupId(models);
  return models.map((model) =>
    selected.has(model.id) ? { ...model, groupId } : model,
  );
}

export function ungroupTheaterModels(
  models: TheaterModel[],
  ids: number[],
): TheaterModel[] {
  const selected = new Set(expandModelIdsWithGroups(models, ids));
  const cleared = models.map((model) => {
    if (!selected.has(model.id) || model.groupId == null) return model;
    const { groupId: _groupId, ...rest } = model;
    return rest;
  });
  return withoutOrphanGroups(cleared);
}

export function dissolveOrphanModelGroups(models: TheaterModel[]): TheaterModel[] {
  return withoutOrphanGroups(models);
}

export function retargetCopiedModelGroups(
  copies: TheaterModel[],
  occupiedMaxGroupId: number,
): TheaterModel[] {
  const counts = new Map<number, number>();
  copies.forEach((copy) => {
    if (copy.groupId == null) return;
    counts.set(copy.groupId, (counts.get(copy.groupId) ?? 0) + 1);
  });
  const remapped = new Map<number, number>();
  let nextId = occupiedMaxGroupId;
  return copies.map((copy) => {
    if (copy.groupId == null) return copy;
    if ((counts.get(copy.groupId) ?? 0) < 2) {
      const { groupId: _groupId, ...rest } = copy;
      return rest;
    }
    let groupId = remapped.get(copy.groupId);
    if (groupId == null) {
      nextId += 1;
      groupId = nextId;
      remapped.set(copy.groupId, groupId);
    }
    return { ...copy, groupId };
  });
}

export function translateGroupedModels(args: {
  models: TheaterModel[];
  memberIds: number[];
  origin: [number, number, number];
  nextOrigin: [number, number, number];
  baselines: Map<number, [number, number, number]>;
  activeId: number;
  activePatch: Partial<TheaterModel>;
}): TheaterModel[] {
  const [dx, dy, dz] = [
    args.nextOrigin[0] - args.origin[0],
    args.nextOrigin[1] - args.origin[1],
    args.nextOrigin[2] - args.origin[2],
  ];
  const members = new Set(args.memberIds);
  return args.models.map((model) => {
    if (!members.has(model.id)) return model;
    if (model.id === args.activeId) return { ...model, ...args.activePatch };
    const base = args.baselines.get(model.id);
    if (!base) return model;
    return {
      ...model,
      position: [base[0] + dx, base[1] + dy, base[2] + dz] as [number, number, number],
    };
  });
}
