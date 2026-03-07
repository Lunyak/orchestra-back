import { useScriptUI } from "../../../../features/script-ui";
import type { ScriptStep } from "../../../types/script";

export function ScriptStepHeader({
  currentStep,
  updateStep,
}: {
  currentStep: ScriptStep | undefined;
  updateStep: <K extends keyof ScriptStep>(
    id: number,
    field: K,
    value: ScriptStep[K],
  ) => void;

}) {
  const {
    isEditing,
  } = useScriptUI();

  return (
    <div className="script-header">
      {isEditing && currentStep ? (
        <div className="form-group">
          <div className="script-title-insert">
            <label htmlFor={`title-${currentStep?.id}`}></label>
            <input
              id={`title-${currentStep.id}`}
              type="text"
              className="form-input"
              value={currentStep.title ?? ""}
              onChange={(e) => updateStep(currentStep.id, "title", e.target.value)}
              placeholder="Введите название шага"
            />
          </div>
          <div className="script-duration-insert">
            <label>
              <div className="script-duration-label">Длительность (мин)</div>
              <input
                type="number"
                min={1}
                max={480}
                step={1}
                className="form-input"
                value={currentStep.durationMin ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (!raw) {
                    updateStep(currentStep.id, "durationMin", undefined);
                    return;
                  }
                  const n = Number(raw);
                  if (!Number.isFinite(n)) return;
                  const clamped = Math.max(1, Math.min(480, Math.trunc(n)));
                  updateStep(currentStep.id, "durationMin", clamped);
                }}
                placeholder="например 10"
              />
            </label>
          </div>
        </div>
      ) : (
       null
      )}
    </div>
  );
}

