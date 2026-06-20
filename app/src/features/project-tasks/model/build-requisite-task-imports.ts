import type { ImportRequisiteTaskPayload } from "../../../sync/api/project-tasks";
import type { ScriptStep } from "../../../shared/types/script";

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

export function buildRequisiteTaskImports(steps: ScriptStep[]): ImportRequisiteTaskPayload[] {
  const result: ImportRequisiteTaskPayload[] = [];

  for (const step of steps) {
    const stepId = step.id;
    const stepTitle = String(step.title ?? "").trim() || `Шаг #${stepId}`;
    const requisites = Array.isArray(step.requisites) ? step.requisites : [];

    for (const requisite of requisites) {
      const requisiteId = requisite.id;
      const label = String(requisite.label ?? "").trim() || "Реквизит";
      const setupAssignees = parseAssigneeList(requisite.setupAssignees);
      const removeAssignees = parseAssigneeList(requisite.removeAssignees);

      for (const assigneeEmail of setupAssignees) {
        result.push({
          title: `Выставить «${label}» · ${stepTitle}`,
          sourceKey: `requisite:${stepId}:${requisiteId}:setup:${assigneeEmail}`,
          assigneeEmail,
          refStepId: stepId,
          refRequisiteId: requisiteId,
          refAction: "setup",
        });
      }

      for (const assigneeEmail of removeAssignees) {
        result.push({
          title: `Убрать «${label}» · ${stepTitle}`,
          sourceKey: `requisite:${stepId}:${requisiteId}:remove:${assigneeEmail}`,
          assigneeEmail,
          refStepId: stepId,
          refRequisiteId: requisiteId,
          refAction: "remove",
        });
      }
    }
  }

  return result;
}

export function countRequisiteTaskImports(steps: ScriptStep[]): number {
  return buildRequisiteTaskImports(steps).length;
}
