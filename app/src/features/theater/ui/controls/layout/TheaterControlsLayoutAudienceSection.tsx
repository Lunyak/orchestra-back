import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import {
  countFittingAudienceRows,
  countFittingSeatsPerRow,
  getAudienceStartZBounds,
  labelM,
  resolveAudienceStartZ,
  roundM,
} from "../../../model/theater-metrics";
import {
  AUDIENCE_LAYOUT_HINTS,
  countFittingArcRows,
  countFittingArcSeatsPerRow,
  isRadialAudience,
  resolveAudienceLayout,
} from "../../../model/theater-audience-arc";
import { TheaterBtn, TheaterRangeField } from "../../theater-controls-ui";
import { TheaterAudienceLayoutPicker } from "./TheaterAudienceLayoutPicker";
import type { LayoutSectionProps } from "./types";
import {
  aisleWidthMax,
  canAddTheaterAisle,
  createLayoutAisle,
  layoutPatchFromAisles,
  patchLayoutAisle,
  resolveLayoutAisles,
} from "../../../model/theater-aisles";

export function TheaterControlsLayoutAudienceSection({ vm, layout }: LayoutSectionProps) {
  const { layoutSeatBadge } = layout;
  const audienceZBounds = getAudienceStartZBounds(vm.layout);
  const audienceStartZ = resolveAudienceStartZ(vm.layout);
  const radialSeats = isRadialAudience(vm.layout);
  const audienceLayout = resolveAudienceLayout(vm.layout);
  const fittingRows = radialSeats
    ? countFittingArcRows(vm.layout)
    : countFittingAudienceRows(vm.layout);
  const fittingSeats = radialSeats
    ? countFittingArcSeatsPerRow(vm.layout)
    : countFittingSeatsPerRow(vm.layout);
  const seatsOverflow = vm.layout.seatRows > fittingRows;
  const seatsWidthOverflow = vm.layout.seatsPerRow > fittingSeats;
  const seatsHidden = vm.showSeats === false;
  const halfHallWidth = vm.layout.hallWidth / 2;
  const aisles = resolveLayoutAisles(vm.layout);
  const aisleMax = aisleWidthMax(vm.layout.hallWidth);
  const canAddAisle = canAddTheaterAisle(vm.layout);
  const historyTx = {
    onInteractStart: vm.beginTheaterHistoryTransaction,
    onInteractEnd: vm.endTheaterHistoryTransaction,
  };

  return (
    <TheaterCollapsibleSection
      sectionId="layout-audience-seats"
      title="Кресла"
      badge={layoutSeatBadge}
      static
      className="theater-panel-section--compact-labels"
    >
      <div className="theater-layout-grid">
        <TheaterAudienceLayoutPicker
          value={audienceLayout}
          onChange={(nextLayout) => vm.updateLayout({ audienceLayout: nextLayout })}
        />
        <p className="theater-layout-hint">{AUDIENCE_LAYOUT_HINTS[audienceLayout]}</p>
        {seatsHidden ? (
          <p className="theater-layout-hint theater-layout-hint--warn">
            Кресла скрыты. Меню «Кресла» → «Показать в 3D».
          </p>
        ) : null}
        {seatsOverflow ? (
          <p className="theater-layout-hint theater-layout-hint--warn">
            После сцены помещается {fittingRows} рядов — остальные уходили за стену.
          </p>
        ) : null}
        {seatsWidthOverflow ? (
          <p className="theater-layout-hint theater-layout-hint--warn">
            В ширину зала входит {fittingSeats} мест из {vm.layout.seatsPerRow}.
          </p>
        ) : null}
        <TheaterBtn
          onClick={() => vm.updateLayout({ audienceStartZ: audienceZBounds.min })}
        >
          Поставить у сцены
        </TheaterBtn>
        <TheaterRangeField
          label={labelM("Кресла Z")}
          min={audienceZBounds.min}
          max={audienceZBounds.max}
          step={0.1}
          value={audienceStartZ}
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
        <TheaterRangeField
          label={labelM("Шаг рядов")}
          min={0.55}
          max={1.5}
          step={0.05}
          value={vm.layout.rowSpacing}
          formatValue={(value) => String(roundM(value))}
          onChange={(rowSpacing) => vm.updateLayout({ rowSpacing })}
          {...historyTx}
        />
        <TheaterRangeField
          label={labelM("Шаг мест")}
          min={0.45}
          max={0.55}
          step={0.01}
          value={vm.layout.seatSpacing}
          disabled
          formatValue={(value) => String(roundM(value))}
          onChange={() => undefined}
        />
        {aisles.map((aisle, index) => {
          const labelIndex = aisles.length > 1 ? ` ${index + 1}` : "";
          const aisleHalf = aisle.width / 2;
          return (
            <div key={aisle.id} className="theater-layout-aisle-fields">
              <TheaterRangeField
                label={labelM(`Проход${labelIndex}`)}
                min={0}
                max={aisleMax}
                step={0.1}
                value={aisle.width}
                formatValue={(value) => (value <= 0 ? "нет" : String(roundM(value)))}
                onChange={(aisleWidth) =>
                  vm.updateLayout(
                    layoutPatchFromAisles(
                      patchLayoutAisle(vm.layout, aisle.id, { width: aisleWidth }),
                      vm.layout,
                    ),
                  )
                }
                {...historyTx}
              />
              {aisle.width > 0 ? (
                <TheaterRangeField
                  label={labelM(`Проход${labelIndex}, центр`)}
                  min={-halfHallWidth + aisleHalf}
                  max={halfHallWidth - aisleHalf}
                  step={0.1}
                  value={aisle.centerX}
                  formatValue={(value) => String(roundM(value))}
                  onChange={(aisleCenterX) =>
                    vm.updateLayout(
                      layoutPatchFromAisles(
                        patchLayoutAisle(vm.layout, aisle.id, { centerX: aisleCenterX }),
                        vm.layout,
                      ),
                    )
                  }
                  {...historyTx}
                />
              ) : null}
            </div>
          );
        })}
        <TheaterBtn
          disabled={!canAddAisle}
          onClick={() =>
            vm.updateLayout(layoutPatchFromAisles(createLayoutAisle(vm.layout), vm.layout))
          }
        >
          Добавить проход
        </TheaterBtn>
        <TheaterRangeField
          label="Ряды"
          min={0}
          max={80}
          step={1}
          value={vm.layout.seatRows}
          formatValue={(value) => String(Math.round(value))}
          onChange={(seatRows) => vm.updateLayout({ seatRows: Math.round(seatRows) })}
          {...historyTx}
        />
        <TheaterRangeField
          label="Мест/ряд"
          min={1}
          max={200}
          step={1}
          value={vm.layout.seatsPerRow}
          formatValue={(value) => String(Math.round(value))}
          onChange={(seatsPerRow) =>
            vm.updateLayout({ seatsPerRow: Math.round(seatsPerRow) })
          }
          {...historyTx}
        />
        <TheaterRangeField
          label={labelM("Подъём ряда")}
          min={0}
          max={0.6}
          step={0.05}
          value={vm.layout.rowRise}
          formatValue={(value) => String(roundM(value))}
          onChange={(rowRise) => vm.updateLayout({ rowRise })}
          {...historyTx}
        />
      </div>
    </TheaterCollapsibleSection>
  );
}
