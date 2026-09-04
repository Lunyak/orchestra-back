import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledToggle } from "../../../../../shared/core/labeled-toggle/LabeledToggle";
import { HALL_SIZE_LIMITS } from "../../../model/theater-hall-expand";
import {
  getAudienceStartZBounds,
  labelM,
  roundM,
} from "../../../model/theater-metrics";
import { TheaterField, TheaterRangeField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutHallSizeSection({ vm, layout }: LayoutSectionProps) {
  const { layoutHallBadge } = layout;
  const audienceZBounds = getAudienceStartZBounds(vm.layout);
  const historyTx = {
    onInteractStart: vm.beginTheaterHistoryTransaction,
    onInteractEnd: vm.endTheaterHistoryTransaction,
  };

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-hall-size"
        title="Габариты зала"
        badge={layoutHallBadge}
        defaultOpen={vm.layoutOutlineFocused}
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
          <div className="theater-layout-subtitle">Помещение</div>
          <TheaterRangeField
            label={labelM("Ширина")}
            min={HALL_SIZE_LIMITS.hallWidth.min}
            max={HALL_SIZE_LIMITS.hallWidth.max}
            step={0.1}
            value={vm.layout.hallWidth}
            formatValue={(value) => String(roundM(value))}
            onChange={(hallWidth) => vm.updateLayout({ hallWidth })}
            {...historyTx}
          />
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
          <div className="theater-layout-subtitle">Зрительные места</div>
          <TheaterRangeField
            label={labelM("Кресла Z")}
            min={audienceZBounds.min}
            max={audienceZBounds.max}
            step={0.1}
            value={vm.layout.audienceStartZ}
            formatValue={(value) => String(roundM(value))}
            onChange={(audienceStartZ) => vm.updateLayout({ audienceStartZ })}
            onInteractStart={() => {
              vm.setAudienceSeatsHighlight(true);
              vm.beginTheaterHistoryTransaction();
            }}
            onInteractEnd={() => {
              vm.setAudienceSeatsHighlight(false);
              vm.endTheaterHistoryTransaction();
            }}
          />
          <TheaterField label={labelM("Шаг рядов")}>
            <input
              type="number"
              className="native-text-input"
              min={0.55}
              step={0.05}
              value={vm.layout.rowSpacing}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({
                  rowSpacing: Number(event.target.value) || 0,
                })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Шаг мест")}>
            <input
              type="number"
              className="native-text-input"
              min={0.45}
              step={0.05}
              value={vm.layout.seatSpacing}
              readOnly
              title="Шаг центров 0.55 м, ширина сиденья не больше 0.6 м"
            />
          </TheaterField>
          <TheaterField label={labelM("Проход")}>
            <input
              type="number"
              className="native-text-input"
              min={0}
              step={0.1}
              value={vm.layout.aisleWidth}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ aisleWidth: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Проход X")}>
            <input
              type="number"
              className="native-text-input"
              step={0.1}
              value={vm.layout.aisleCenterX}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ aisleCenterX: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label="Ряды">
            <input
              type="number"
              className="native-text-input"
              min={0}
              step={1}
              value={vm.layout.seatRows}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({
                  seatRows: Math.max(0, Number(event.target.value) || 0),
                })
              }
            />
          </TheaterField>
          <TheaterField label="Мест/ряд">
            <input
              type="number"
              className="native-text-input"
              min={1}
              step={1}
              value={vm.layout.seatsPerRow}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({
                  seatsPerRow: Math.max(1, Number(event.target.value) || 1),
                })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Подъём ряда")}>
            <input
              type="number"
              className="native-text-input"
              min={0}
              step={0.05}
              value={vm.layout.rowRise}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ rowRise: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
        </div>
      </TheaterCollapsibleSection>
    </>
  );
}
