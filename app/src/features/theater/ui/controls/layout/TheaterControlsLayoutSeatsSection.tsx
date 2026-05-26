import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { getAudienceStartZBounds, labelM } from "../../../model/theater-metrics";
import { TheaterBtn, TheaterField, TheaterRangeField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutSeatsSection({ vm, layout }: LayoutSectionProps) {
  const {
    outlineFitSeats,
    setOutlineFitSeats,
    outlineFitSeatsFocusedRef,
    commitOutlineFitSeats,
    layoutSeatBadge,
    isCustomStageOutline,
  } = layout;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-seats"
        title="Кресла"
        summary="Позиция рядов и число мест"
        badge={layoutSeatBadge}
        defaultOpen
      >
        <p className="theater-layout-hint">
          Z: ползунок ниже или перетаскивание блока кресел в 3D.
        </p>
        <div className="theater-layout-grid">
          <TheaterRangeField
            label={labelM("Кресла Z")}
            min={getAudienceStartZBounds(vm.layout).min}
            max={getAudienceStartZBounds(vm.layout).max}
            step={0.1}
            value={vm.layout.audienceStartZ}
            formatValue={(v) => v.toFixed(1)}
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
              title="Вычисляется по ширине зала и числу мест в ряду"
            />
          </TheaterField>
        </div>
        <div className="theater-layout-subtitle">Число мест</div>
        <p className="theater-layout-hint">
          Enter в поле — применить. Кнопки ниже — подогнать зал под целевое число мест.
        </p>
        <div className="theater-custom-outline-fit-row">
          <TheaterField label="Целевое мест">
            <input
              type="number"
              className="native-text-input"
              min={1}
              max={2000}
              step={1}
              value={outlineFitSeats}
              onFocus={() => {
                outlineFitSeatsFocusedRef.current = true;
              }}
              onBlur={() => {
                outlineFitSeatsFocusedRef.current = false;
                commitOutlineFitSeats();
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.currentTarget.blur();
                }
              }}
              onChange={(event) =>
                setOutlineFitSeats(Math.max(1, Number(event.target.value) || 1))
              }
            />
          </TheaterField>
          {!isCustomStageOutline ? (
            <TheaterBtn
              onClick={() => {
                vm.beginTheaterHistoryTransaction();
                commitOutlineFitSeats();
                vm.endTheaterHistoryTransaction();
              }}
              title="Применить число мест к рядам/шагу"
            >
              Применить места
            </TheaterBtn>
          ) : (
            <>
              <TheaterBtn
                onClick={() => {
                  vm.beginTheaterHistoryTransaction();
                  vm.fitLayoutFromOutline(outlineFitSeats);
                  vm.endTheaterHistoryTransaction();
                }}
                title="Контур под целевое число мест"
              >
                Контур → места
              </TheaterBtn>
              <TheaterBtn
                onClick={() => {
                  vm.beginTheaterHistoryTransaction();
                  vm.fitLayoutToSeatCount(outlineFitSeats);
                  vm.endTheaterHistoryTransaction();
                }}
                title="Зал и контур под число мест"
              >
                Места → зал
              </TheaterBtn>
            </>
          )}
        </div>
      </TheaterCollapsibleSection>
    </>
  );
}
