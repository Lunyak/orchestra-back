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
        </div>
      ) : (
       null
      )}
    </div>
  );
}

