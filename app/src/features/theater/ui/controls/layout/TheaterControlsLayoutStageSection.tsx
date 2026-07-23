import { STAGE_SHAPE_LABELS } from "../../../model/theater-stage-geometry";
import {
  defaultCustomStageOutline,
  defaultCustomStageOutlineOpenEdges,
  MIN_STAGE_OUTLINE_POINTS,
  resolveStageOutlinePoints,
} from "../../../model/theater-custom-outline";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import type { TheaterStageShape } from "../../../../../shared/types/script";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { getStageFrontZBounds, labelM } from "../../../model/theater-metrics";
import {
  TheaterBtn,
  TheaterField,
  TheaterRangeField,
} from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutStageSection({ vm, layout }: LayoutSectionProps) {
  const { layoutShapeLabel, isCustomStageOutline } = layout;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-stage"
        title="Форма сцены"
        summary={layoutShapeLabel}
        badge={isCustomStageOutline ? "Свой контур" : undefined}
        defaultOpen={isCustomStageOutline}
      >
<div className="theater-layout-grid">
            <TheaterField label="Форма сцены">
              <select
                className="native-text-input"
                value={vm.layout.stageShape ?? "rectangle"}
                onChange={(event) =>
                  vm.updateLayout({
                    stageShape: event.target.value as TheaterStageShape,
                    prosceniumEnabled:
                      event.target.value === "trapezoid" ? true : vm.layout.prosceniumEnabled,
                  })
                }
              >
                {(Object.keys(STAGE_SHAPE_LABELS) as TheaterStageShape[]).map((shape) => (
                  <option key={shape} value={shape}>
                    {STAGE_SHAPE_LABELS[shape]}
                  </option>
                ))}
              </select>
            </TheaterField>
            <TheaterField label="Арка у зала">
              <LabeledCheckbox
                checked={vm.layout.prosceniumEnabled === true}
                disabled={(vm.layout.stageShape ?? "rectangle") !== "trapezoid"}
                onChange={(checked) => vm.updateLayout({ prosceniumEnabled: checked })}
              >
                Портал включён
              </LabeledCheckbox>
            </TheaterField>
          </div>
          {(vm.layout.stageShape ?? "rectangle") !== "rectangle" ? (
            <div className="theater-layout-grid">
              <TheaterField label={labelM("Ширина у задней стены")}>
                <input
                  type="number"
                  className="native-text-input"
                  min={2}
                  max={vm.layout.hallWidth}
                  step={0.5}
                  value={vm.layout.stageBackWidth ?? vm.layout.hallWidth}
                  onFocus={vm.beginTheaterHistoryTransaction}
                  onBlur={vm.endTheaterHistoryTransaction}
                  onChange={(event) =>
                    vm.updateLayout({
                      stageBackWidth: Number(event.target.value) || vm.layout.hallWidth,
                    })
                  }
                />
              </TheaterField>
              <TheaterField
                label={
                  (vm.layout.stageShape ?? "rectangle") === "t-shape"
                    ? labelM("Ширина «ножки»")
                    : labelM("Ширина у зала")
                }
              >
                <input
                  type="number"
                  className="native-text-input"
                  min={2}
                  max={vm.layout.hallWidth}
                  step={0.5}
                  value={vm.layout.prosceniumWidth ?? vm.layout.hallWidth}
                  onFocus={vm.beginTheaterHistoryTransaction}
                  onBlur={vm.endTheaterHistoryTransaction}
                  onChange={(event) =>
                    vm.updateLayout({
                      prosceniumWidth: Number(event.target.value) || vm.layout.hallWidth,
                    })
                  }
                />
              </TheaterField>
              {(vm.layout.stageShape ?? "rectangle") === "t-shape" ? (
                <TheaterField label={labelM("Перелом Т (Z)")}>
                  <input
                    type="number"
                    className="native-text-input"
                    step={0.5}
                    value={vm.layout.tJunctionZ ?? 0}
                    onFocus={vm.beginTheaterHistoryTransaction}
                    onBlur={vm.endTheaterHistoryTransaction}
                    onChange={(event) =>
                      vm.updateLayout({ tJunctionZ: Number(event.target.value) || 0 })
                    }
                  />
                </TheaterField>
              ) : null}
              {vm.layout.prosceniumEnabled && (vm.layout.stageShape ?? "rectangle") === "trapezoid" ? (
                <TheaterField label={labelM("Высота арки")}>
                  <input
                    type="number"
                    className="native-text-input"
                    min={2}
                    max={vm.layout.wallHeight}
                    step={0.1}
                    value={vm.layout.prosceniumHeight ?? vm.layout.wallHeight}
                    onFocus={vm.beginTheaterHistoryTransaction}
                    onBlur={vm.endTheaterHistoryTransaction}
                    onChange={(event) =>
                      vm.updateLayout({
                        prosceniumHeight: Number(event.target.value) || vm.layout.wallHeight,
                      })
                    }
                  />
                </TheaterField>
              ) : null}
            </div>
          ) : null}
          
        {(vm.layout.stageShape ?? "rectangle") !== "custom" ? (
          <TheaterRangeField
            label={labelM("Передний край сцены (Z)")}
            min={getStageFrontZBounds(vm.layout).min}
            max={getStageFrontZBounds(vm.layout).max}
            step={0.1}
            value={vm.layout.stageFrontZ ?? vm.layout.audienceStartZ}
            formatValue={(v) => v.toFixed(1)}
            onChange={(stageFrontZ) => vm.updateLayout({ stageFrontZ })}
            onInteractStart={vm.beginTheaterHistoryTransaction}
            onInteractEnd={vm.endTheaterHistoryTransaction}
          />
        ) : null}
          {(vm.layout.stageShape ?? "rectangle") === "custom" ? (
            <div className="theater-custom-outline-panel">
              <div className="theater-custom-outline-actions">
                <TheaterBtn
                  active={vm.outlineDrawMode}
                  onClick={() => vm.setOutlineDrawMode(!vm.outlineDrawMode)}
                >
                  {vm.outlineDrawMode ? "Рисование: вкл" : "Рисовать вершины"}
                </TheaterBtn>
                <TheaterBtn
                  onClick={() => vm.removeActiveOutlineVertex()}
                  disabled={
                    vm.activeOutlineVertexIndex == null ||
                    resolveStageOutlinePoints(vm.layout).length <= MIN_STAGE_OUTLINE_POINTS
                  }
                >
                  Удалить вершину
                </TheaterBtn>
                <TheaterBtn onClick={() => vm.removeLastOutlinePoint()}>− Последняя</TheaterBtn>
                <TheaterBtn onClick={() => vm.seedStageOutlineFromCurrentShape()}>
                  Из текущей формы
                </TheaterBtn>
                <TheaterBtn onClick={() => vm.resetStageOutlineToRectangle()}>
                  Прямоугольник
                </TheaterBtn>
              </div>
              <TheaterField label="Вершин / выделена">
                <span className="theater-custom-outline-count">
                  {resolveStageOutlinePoints(vm.layout).length}
                  {vm.activeOutlineVertexIndex != null
                    ? ` · #${vm.activeOutlineVertexIndex + 1}`
                    : " · —"}
                </span>
              </TheaterField>
            </div>
          ) : null}
      </TheaterCollapsibleSection>
    </>
  );
}
