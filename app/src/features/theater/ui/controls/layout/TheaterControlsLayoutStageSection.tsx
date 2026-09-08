import {
  patchForStageShape,
  resolveHiddenWalls,
  resolveStageGeometry,
  STAGE_SHAPE_HINTS,
  STAGE_WALL_SIDE_LABELS,
  stageUsesAudienceWidth,
} from "../../../model/theater-stage-geometry";
import {
  MIN_STAGE_OUTLINE_POINTS,
  resolveStageOutlinePoints,
} from "../../../model/theater-custom-outline";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import type { TheaterDoorWall, TheaterStageShape } from "../../../../../shared/types/script";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { labelM, roundM } from "../../../model/theater-metrics";
import { STAGE_WIDTH_LIMITS } from "../../../model/theater-hall-expand";
import { TheaterBtn, TheaterField, TheaterRangeField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";
import {
  TheaterStageShapePicker,
  TheaterTaperDiagram,
} from "./TheaterStageShapePicker";

export function TheaterControlsLayoutStageSection({ vm, layout }: LayoutSectionProps) {
  const { isCustomStageOutline, layoutShapeLabel } = layout;
  const shape = (vm.layout.stageShape ?? "rectangle") as TheaterStageShape;
  const usesAudienceWidth = stageUsesAudienceWidth(shape);
  const isTrapezoid = shape === "trapezoid";
  const isTShape = shape === "t-shape";
  const backWidth = vm.layout.stageBackWidth ?? vm.layout.hallWidth;
  const frontWidth = vm.layout.prosceniumWidth ?? vm.layout.hallWidth;
  const widthsAlmostEqual = Math.abs(backWidth - frontWidth) < 0.05;
  const geom = resolveStageGeometry(vm.layout);
  const tSpan = Math.max(0.5, geom.prosceniumZ - geom.backZ);
  const tJunctionMin = geom.backZ + tSpan * 0.2;
  const tJunctionMax = geom.prosceniumZ - tSpan * 0.15;
  const hiddenWalls = resolveHiddenWalls(vm.layout);
  const wallSides: TheaterDoorWall[] =
    shape === "semicircle" ? ["back", "front"] : ["back", "left", "right", "front"];
  const historyTx = {
    onInteractStart: vm.beginTheaterHistoryTransaction,
    onInteractEnd: vm.endTheaterHistoryTransaction,
  };

  const setWallVisible = (side: TheaterDoorWall, visible: boolean) => {
    const nextHidden = visible
      ? hiddenWalls.filter((item) => item !== side)
      : [...hiddenWalls, side];
    vm.updateLayout({ hiddenWalls: nextHidden });
  };

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-stage"
        title="Форма стен"
        badge={layoutShapeLabel}
        static
      >
        <div className="theater-layout-grid">
          <TheaterStageShapePicker
            value={shape}
            onChange={(nextShape) => vm.updateLayout(patchForStageShape(vm.layout, nextShape))}
          />
          <p className="theater-layout-hint">{STAGE_SHAPE_HINTS[shape]}</p>
          {shape === "circle" ? null : (
            <>
              <div className="theater-layout-subtitle">Стены</div>
              <div className="theater-wall-toggles">
                {wallSides.map((side) => (
                  <LabeledCheckbox
                    key={side}
                    checked={!hiddenWalls.includes(side)}
                    onChange={(visible) => setWallVisible(side, visible)}
                  >
                    {STAGE_WALL_SIDE_LABELS[side]}
                  </LabeledCheckbox>
                ))}
              </div>
              <p className="theater-layout-hint">Снимите галочку — стены не будет.</p>
            </>
          )}
          {isTrapezoid && widthsAlmostEqual ? (
            <>
              <p className="theater-layout-hint theater-layout-hint--warn">
                Оба края одной ширины — стены как у прямоугольника.
              </p>
              <TheaterBtn
                onClick={() => vm.updateLayout(patchForStageShape(vm.layout, "trapezoid"))}
              >
                Сузить к зрителям
              </TheaterBtn>
            </>
          ) : null}
        </div>
        {usesAudienceWidth ? (
          <div className="theater-layout-grid">
            {isTrapezoid ? (
              <TheaterTaperDiagram backWidth={backWidth} frontWidth={frontWidth} />
            ) : null}
            <TheaterRangeField
              label={labelM("У задней стены")}
              min={STAGE_WIDTH_LIMITS.min}
              max={vm.layout.hallWidth}
              step={0.1}
              value={backWidth}
              formatValue={(value) => String(roundM(value))}
              onChange={(stageBackWidth) => vm.updateLayout({ stageBackWidth })}
              {...historyTx}
            />
            <TheaterRangeField
              label={isTShape ? labelM("У зрителей, ножка") : labelM("У зрителей")}
              min={STAGE_WIDTH_LIMITS.min}
              max={vm.layout.hallWidth}
              step={0.1}
              value={frontWidth}
              formatValue={(value) => String(roundM(value))}
              onChange={(prosceniumWidth) => vm.updateLayout({ prosceniumWidth })}
              {...historyTx}
            />
            {isTShape ? (
              <TheaterRangeField
                label={labelM("Перелом Т")}
                min={tJunctionMin}
                max={tJunctionMax}
                step={0.1}
                value={vm.layout.tJunctionZ ?? geom.tJunctionZ}
                formatValue={(value) => String(roundM(value))}
                onChange={(tJunctionZ) => vm.updateLayout({ tJunctionZ })}
                {...historyTx}
              />
            ) : null}
            {isTrapezoid ? (
              <TheaterRangeField
                label={labelM("Высота арки")}
                min={2}
                max={vm.layout.wallHeight}
                step={0.1}
                value={vm.layout.prosceniumHeight ?? vm.layout.wallHeight}
                formatValue={(value) => String(roundM(value))}
                onChange={(prosceniumHeight) => vm.updateLayout({ prosceniumHeight })}
                {...historyTx}
              />
            ) : null}
          </div>
        ) : null}
        {shape === "custom" ? (
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
