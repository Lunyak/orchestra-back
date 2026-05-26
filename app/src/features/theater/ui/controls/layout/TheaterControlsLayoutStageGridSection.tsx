import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutStageGridSection({ vm }: LayoutSectionProps) {
  return (
    <>
      <TheaterCollapsibleSection
            sectionId="layout-stage-grid"
            title="Сетка сцены"
            summary="Столбцы и ряды на полу"
            badge={`${vm.stageGrid.cols}×${vm.stageGrid.rows}`}
            defaultOpen
          >
            <p className="theater-layout-hint">
              Сетка повторяет контур сцены. Ряд 1 — у задника, последний — у авансцены. При
              смене формы зала пересчитывается вместе с полом.
            </p>
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterField label="Столбцы">
                <input
                  type="number"
                  className="native-text-input"
                  min={1}
                  max={12}
                  value={vm.stageGrid.cols}
                  disabled={!vm.currentStep}
                  onChange={(event) =>
                    vm.updateLayoutZoneGrid({
                      cols: Math.max(1, Math.min(12, Number(event.target.value) || 1)),
                    })
                  }
                />
              </TheaterField>
              <TheaterField label="Ряды">
                <input
                  type="number"
                  className="native-text-input"
                  min={1}
                  max={8}
                  value={vm.stageGrid.rows}
                  disabled={!vm.currentStep}
                  onChange={(event) =>
                    vm.updateLayoutZoneGrid({
                      rows: Math.max(1, Math.min(8, Number(event.target.value) || 1)),
                    })
                  }
                />
              </TheaterField>
            </div>
                  <LabeledCheckbox checked={vm.showStageGrid} onChange={vm.setShowStageGrid}>
          Показывать на сцене и в плане
        </LabeledCheckbox>
      </TheaterCollapsibleSection>
    </>
  );
}
