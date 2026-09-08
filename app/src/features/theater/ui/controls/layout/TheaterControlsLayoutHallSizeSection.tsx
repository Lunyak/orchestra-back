import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledToggle } from "../../../../../shared/core/labeled-toggle/LabeledToggle";
import {
  HALL_SIZE_LIMITS,
  STAGE_WIDTH_LIMITS,
  resolveStageWidth,
} from "../../../model/theater-hall-expand";
import { STAGE_RISE_LIMITS, resolveStageRise } from "../../../model/theater-stage-geometry";
import {
  centerStageInHall,
  getStageBackZ,
  getStageBackZBounds,
  getStageFrontZBounds,
  labelM,
  roundM,
} from "../../../model/theater-metrics";
import { TheaterBtn, TheaterRangeField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutHallSizeSection({ vm, layout }: LayoutSectionProps) {
  const { layoutHallBadge } = layout;
  const stageFrontZBounds = getStageFrontZBounds(vm.layout);
  const stageBackZBounds = getStageBackZBounds(vm.layout);
  const stageBackZ = getStageBackZ(vm.layout);
  const stageWidth = resolveStageWidth(vm.layout);
  const stageShape = vm.layout.stageShape ?? "rectangle";
  const isCustomStage = stageShape === "custom";
  const showSingleStageWidth =
    stageShape === "rectangle" || stageShape === "circle" || stageShape === "semicircle";
  const stageRise = resolveStageRise(vm.layout);
  const historyTx = {
    onInteractStart: vm.beginTheaterHistoryTransaction,
    onInteractEnd: vm.endTheaterHistoryTransaction,
  };

  return (
    <TheaterCollapsibleSection
      sectionId="layout-hall-size"
      title="Габариты зала"
      badge={layoutHallBadge}
      static
      className="theater-panel-section--compact-labels"
    >
      <div className="theater-layout-grid">
        <LabeledToggle
          className="theater-layout-keep-objects"
          checked={vm.hallResizeKeepObjects}
          onChange={(checked) => vm.setHallResizeKeepObjects(checked)}
        >
          Объекты на месте при растягивании
        </LabeledToggle>
        <TheaterRangeField
          label={labelM("Ш. помещения")}
          min={HALL_SIZE_LIMITS.hallWidth.min}
          max={HALL_SIZE_LIMITS.hallWidth.max}
          step={0.1}
          value={vm.layout.hallWidth}
          formatValue={(value) => String(roundM(value))}
          onChange={(hallWidth) => vm.updateLayout({ hallWidth })}
          {...historyTx}
        />
        {showSingleStageWidth ? (
          <TheaterRangeField
            label={labelM("Ш. сцены")}
            min={STAGE_WIDTH_LIMITS.min}
            max={vm.layout.hallWidth}
            step={0.1}
            value={stageWidth}
            formatValue={(value) => String(roundM(value))}
            onChange={(width) =>
              vm.updateLayout({
                stageBackWidth: width,
                prosceniumWidth: width,
              })
            }
            {...historyTx}
          />
        ) : null}
        {isCustomStage ? null : (
          <>
            <TheaterRangeField
              label={labelM("З. край сцены")}
              min={stageBackZBounds.min}
              max={stageBackZBounds.max}
              step={0.1}
              value={stageBackZ}
              formatValue={(value) => String(roundM(value))}
              onChange={(nextBackZ) => vm.updateLayout({ stageBackZ: nextBackZ })}
              {...historyTx}
            />
            <TheaterRangeField
              label={labelM("П. край сцены")}
              min={stageFrontZBounds.min}
              max={stageFrontZBounds.max}
              step={0.1}
              value={vm.layout.stageFrontZ ?? vm.layout.audienceStartZ}
              formatValue={(value) => String(roundM(value))}
              onChange={(stageFrontZ) => vm.updateLayout({ stageFrontZ })}
              {...historyTx}
            />
            <TheaterBtn onClick={() => vm.updateLayout(centerStageInHall(vm.layout))}>
              В центр зала
            </TheaterBtn>
          </>
        )}
        <TheaterRangeField
          label={labelM("Глубина")}
          min={HALL_SIZE_LIMITS.hallDepth.min}
          max={HALL_SIZE_LIMITS.hallDepth.max}
          step={0.1}
          value={vm.layout.hallDepth}
          formatValue={(value) => String(roundM(value))}
          onChange={(hallDepth) => vm.updateLayout({ hallDepth })}
          {...historyTx}
        />
        <TheaterRangeField
          label={labelM("Высота стен")}
          min={HALL_SIZE_LIMITS.wallHeight.min}
          max={HALL_SIZE_LIMITS.wallHeight.max}
          step={0.1}
          value={vm.layout.wallHeight}
          formatValue={(value) => String(roundM(value))}
          onChange={(wallHeight) => vm.updateLayout({ wallHeight })}
          {...historyTx}
        />
        <TheaterRangeField
          label={labelM("Подъём сцены")}
          min={STAGE_RISE_LIMITS.min}
          max={STAGE_RISE_LIMITS.max}
          step={0.05}
          value={stageRise}
          formatValue={(value) => String(roundM(value))}
          onChange={(nextRise) => vm.updateLayout({ stageRise: nextRise })}
          {...historyTx}
        />
      </div>
    </TheaterCollapsibleSection>
  );
}
