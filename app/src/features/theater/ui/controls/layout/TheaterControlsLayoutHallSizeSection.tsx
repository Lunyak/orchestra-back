import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { labelM } from "../../../model/theater-metrics";
import { TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutHallSizeSection({ vm, layout }: LayoutSectionProps) {
  const { layoutHallBadge } = layout;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-hall-size"
        title="Габариты зала"
        summary="Ширина, глубина, ряды"
        badge={layoutHallBadge}
      >
        <div className="theater-layout-grid">
          <TheaterField label={labelM("Ширина")}>
            <input
              type="number"
              className="native-text-input"
              min={6}
              step={0.5}
              value={vm.layout.hallWidth}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ hallWidth: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Глубина")}>
            <input
              type="number"
              className="native-text-input"
              min={6}
              step={0.5}
              value={vm.layout.hallDepth}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ hallDepth: Number(event.target.value) || 0 })
              }
            />
          </TheaterField>
          <TheaterField label={labelM("Высота стен")}>
            <input
              type="number"
              className="native-text-input"
              min={2.5}
              step={0.1}
              value={vm.layout.wallHeight}
              onFocus={vm.beginTheaterHistoryTransaction}
              onBlur={vm.endTheaterHistoryTransaction}
              onChange={(event) =>
                vm.updateLayout({ wallHeight: Number(event.target.value) || 0 })
              }
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
