import { useScene } from "../../../scene/model/scene-context";
import type { TheaterControlsTabProps } from "./types";

export function TheaterControlsProjectSection({ vm }: TheaterControlsTabProps) {
  const { steps, currentPage, setCurrentPage } = useScene();

  return (
    <div className="theater-editor-project">
      <div className="theater-editor-panel-block">
        <div className="theater-editor-panel-row">
          <span className="theater-editor-panel-label">Проект</span>
          <span className="theater-editor-panel-value" title={vm.projectName}>
            {vm.projectName}
          </span>
        </div>
        <div className="theater-editor-panel-row">
          <span className="theater-editor-panel-label">Шаг</span>
          <span className="theater-editor-panel-value">
            {vm.currentStep
              ? `${currentPage + 1} / ${vm.stepCount}`
              : `— / ${vm.stepCount}`}
          </span>
        </div>
        {vm.currentStep?.title ? (
          <div className="theater-editor-panel-row theater-editor-panel-row--stack">
            <span className="theater-editor-panel-label">Название</span>
            <span className="theater-editor-panel-value">{vm.currentStep.title}</span>
          </div>
        ) : null}
      </div>

      <div className="theater-editor-panel-heading">Шаги сценария</div>
      <div className="theater-editor-project-steps" role="listbox" aria-label="Шаги сценария">
        {steps.length === 0 ? (
          <p className="theater-editor-outliner-empty">Нет шагов</p>
        ) : (
          steps.map((step, index) => {
            const active = index === currentPage;
            const label = step.title?.trim() || `Шаг ${index + 1}`;
            const meta =
              step.durationMin != null && Number.isFinite(step.durationMin)
                ? `${step.durationMin} мин`
                : undefined;
            return (
              <button
                key={step.id}
                type="button"
                role="option"
                aria-selected={active}
                className={[
                  "theater-editor-outliner-option",
                  active ? "theater-editor-outliner-option--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                style={{ paddingLeft: "4px" }}
                title={label}
                onClick={() => setCurrentPage(index)}
              >
                <span className="theater-editor-outliner-spacer" aria-hidden />
                <span className="theater-editor-outliner-type Script" aria-hidden />
                <span className="theater-editor-outliner-name">{label}</span>
                {meta ? (
                  <span className="theater-editor-outliner-meta">{meta}</span>
                ) : null}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
