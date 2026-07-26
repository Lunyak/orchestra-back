import type { ImportRequisiteTaskPayload } from "../../../sync/api/project-tasks";
import type { ScriptRequisiteDuty, ScriptScene } from "../../../shared/types/script";

function normalizeEmail(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

const DUTY_TASK_META: Record<
  ScriptRequisiteDuty,
  { titleVerb: string; refAction: ImportRequisiteTaskPayload["refAction"] }
> = {
  setup: { titleVerb: "Занести", refAction: "setup" },
  strike: { titleVerb: "Унести", refAction: "remove" },
  use: { titleVerb: "Манипуляции", refAction: "use" },
};

export function buildRequisiteTaskImports(scenes: ScriptScene[]): ImportRequisiteTaskPayload[] {
  const result: ImportRequisiteTaskPayload[] = [];

  for (const scene of scenes) {
    const sceneId = scene.id;
    const sceneTitle = String(scene.title ?? "").trim() || `Сцена #${sceneId}`;
    const requisites = Array.isArray(scene.requisites) ? scene.requisites : [];

    for (const requisite of requisites) {
      const requisiteId = requisite.id;
      const label = String(requisite.label ?? "").trim() || "Реквизит";
      const assigneeEmail = normalizeEmail(requisite.assigneeEmail);
      if (!assigneeEmail) continue;

      const duty: ScriptRequisiteDuty =
        requisite.duty === "strike" || requisite.duty === "use"
          ? requisite.duty
          : "setup";
      const meta = DUTY_TASK_META[duty];
      const detail =
        duty === "setup"
          ? String(requisite.placeNote ?? "").trim()
          : duty === "use"
            ? String(requisite.actionNote ?? "").trim()
            : "";
      const title = detail
        ? `${meta.titleVerb} «${label}» · ${detail} · ${sceneTitle}`
        : `${meta.titleVerb} «${label}» · ${sceneTitle}`;

      result.push({
        title,
        sourceKey: `requisite:${sceneId}:${requisiteId}:${meta.refAction}:${assigneeEmail}`,
        assigneeEmail,
        refSceneId: sceneId,
        refRequisiteId: requisiteId,
        refAction: meta.refAction,
      });
    }
  }

  return result;
}

export function countRequisiteTaskImports(scenes: ScriptScene[]): number {
  return buildRequisiteTaskImports(scenes).length;
}
