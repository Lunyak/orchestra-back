import type { ScriptScene } from "../../types/script";
import { statusOf, type KanbanStatus } from "./kanban-constants";

export type KanbanMemberInfo = { email: string; displayName?: string | null };

export function orderOf(scene: ScriptScene, fallback: number): number {
  const value = scene.kanbanOrder;
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function normalizeMissingOrders(scenes: ScriptScene[]): ScriptScene[] {
  let changed = false;
  const next = scenes.map((scene, idx) => {
    if (typeof scene.kanbanOrder === "number" && Number.isFinite(scene.kanbanOrder)) {
      return scene;
    }
    changed = true;
    return { ...scene, kanbanOrder: idx + 1 };
  });
  return changed ? next : scenes;
}

function reorderColumn(
  scenes: ScriptScene[],
  status: KanbanStatus,
  idsInDesiredOrder: string[],
  mutateDragged?: (scene: ScriptScene) => ScriptScene,
): ScriptScene[] {
  const orderMap = new Map<string, number>();
  idsInDesiredOrder.forEach((id, idx) => orderMap.set(id, idx + 1));
  return scenes.map((scene) => {
    if (statusOf(scene) !== status) return scene;
    const desired = orderMap.get(String(scene.id));
    if (desired == null) return scene;
    const next: ScriptScene = { ...scene, kanbanOrder: desired };
    return mutateDragged ? mutateDragged(next) : next;
  });
}

export function applyMove(
  scenes: ScriptScene[],
  draggedId: number,
  toStatus: KanbanStatus,
  beforeId?: number,
): ScriptScene[] {
  const dragged = scenes.find((scene) => scene.id === draggedId);
  if (!dragged) return scenes;

  const fromStatus = statusOf(dragged);
  const draggedKey = String(draggedId);

  const sortedKeysForStatus = (status: KanbanStatus) =>
    scenes
      .map((scene, idx) => ({
        key: String(scene.id),
        id: scene.id,
        status: statusOf(scene),
        order: orderOf(scene, idx + 1),
      }))
      .filter((item) => item.status === status && item.id !== draggedId)
      .sort((a, b) => a.order - b.order)
      .map((item) => item.key);

  const fromKeys = sortedKeysForStatus(fromStatus);
  const toKeys = sortedKeysForStatus(toStatus);

  const insertAt =
    beforeId != null ? Math.max(0, toKeys.indexOf(String(beforeId))) : toKeys.length;
  const nextToKeys = [...toKeys];
  nextToKeys.splice(insertAt < 0 ? nextToKeys.length : insertAt, 0, draggedKey);

  if (fromStatus === toStatus) {
    const current = [draggedKey, ...toKeys];
    const fromIndex = current.indexOf(draggedKey);
    const toIndex =
      beforeId != null
        ? Math.max(0, current.indexOf(String(beforeId)))
        : current.length - 1;
    const desired = [...current];
    const [item] = desired.splice(fromIndex, 1);
    desired.splice(toIndex, 0, item);
    return reorderColumn(scenes, toStatus, desired, (scene) =>
      scene.id === draggedId ? { ...scene, kanbanStatus: toStatus } : scene,
    );
  }

  let next = reorderColumn(scenes, fromStatus, fromKeys);
  next = reorderColumn(next, toStatus, nextToKeys, (scene) =>
    scene.id === draggedId ? { ...scene, kanbanStatus: toStatus } : scene,
  );
  return next.map((scene) =>
    scene.id === draggedId ? { ...scene, kanbanStatus: toStatus } : scene,
  );
}
