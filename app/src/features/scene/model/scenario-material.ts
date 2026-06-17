import type { ScriptStep } from "../../../shared/types/script";

export function stepHasMaterial(step: ScriptStep | null | undefined): boolean {
  if (!step) return false;
  return Boolean(
    String(step.markdown ?? "").trim() ||
      String(step.playMarkdown ?? "").trim() ||
      String(step.explicationMarkdown ?? "").trim(),
  );
}

export function isScenarioWithoutMaterial(steps: ScriptStep[]): boolean {
  if (!steps.length) return true;
  return steps.every((step) => !stepHasMaterial(step));
}
