import type { ImportRequisiteTaskPayload } from "../../../sync/api/project-tasks";
import type { ScriptScene } from "../../../shared/types/script";

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function parseAssigneeList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];
  return Array.from(
    new Set(
      values
        .map((item) => normalizeEmail(item))
        .filter((item) => item.length > 0),
    ),
  );
}

export function buildRequisiteTaskImports(scenes: ScriptScene[]): ImportRequisiteTaskPayload[] {
  const result: ImportRequisiteTaskPayload[] = [];

  for (const scene of scenes) {
    const sceneId = scene.id;
    const sceneTitle = String(scene.title ?? "").trim() || `Сцена #${sceneId}`;
    const requisites = Array.isArray(scene.requisites) ? scene.requisites : [];

    for (const requisite of requisites) {
      const requisiteId = requisite.id;
      const label = String(requisite.label ?? "").trim() || "Реквизит";
      const setupAssignees = parseAssigneeList(requisite.setupAssignees);
      const removeAssignees = parseAssigneeList(requisite.removeAssignees);

      for (const assigneeEmail of setupAssignees) {
        result.push({
          title: `Выставить «${label}» · ${sceneTitle}`,
          sourceKey: `requisite:${sceneId}:${requisiteId}:setup:${assigneeEmail}`,
          assigneeEmail,
          refSceneId: sceneId,
          refRequisiteId: requisiteId,
          refAction: "setup",
        });
      }

      for (const assigneeEmail of removeAssignees) {
        result.push({
          title: `Убрать «${label}» · ${sceneTitle}`,
          sourceKey: `requisite:${sceneId}:${requisiteId}:remove:${assigneeEmail}`,
          assigneeEmail,
          refSceneId: sceneId,
          refRequisiteId: requisiteId,
          refAction: "remove",
        });
      }
    }
  }

  return result;
}

export function countRequisiteTaskImports(scenes: ScriptScene[]): number {
  return buildRequisiteTaskImports(scenes).length;
}
