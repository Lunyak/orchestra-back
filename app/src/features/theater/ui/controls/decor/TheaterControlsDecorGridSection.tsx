import { DECOR_CATALOG, type DecorCatalogKey } from "../../../model/theater-decor-catalog";
import { decorGridItemCount } from "../../../model/theater-decor-grid";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import type { DecorSectionProps } from "./types";

export function TheaterControlsDecorGridSection({ vm }: DecorSectionProps) {
  return (
    <>
      <TheaterCollapsibleSection
        sectionId="decor-grid"
        title="Расстановка"
        summary="Сетка и каталог"
        defaultOpen
      >
        <div className="theater-layout-grid">
          <TheaterField label="Столбцов">
            <input
              type="number"
              className="native-text-input"
              min={1}
              max={20}
              value={vm.decorGridCols}
              onChange={(event) =>
                vm.setDecorGridCols(
                  Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                )
              }
            />
          </TheaterField>
          <TheaterField label="Рядов">
            <input
              type="number"
              className="native-text-input"
              min={1}
              max={20}
              value={vm.decorGridRows}
              onChange={(event) =>
                vm.setDecorGridRows(
                  Math.max(1, Math.min(20, Number(event.target.value) || 1)),
                )
              }
            />
          </TheaterField>
        </div>
        <p className="theater-layout-hint">
          Клик по полу поставит{" "}
          {decorGridItemCount({ cols: vm.decorGridCols, rows: vm.decorGridRows })} предмет(ов).
          Шаг между предметами — «Шаг сетки» (вкладка План).
        </p>
        <div className="theater-decor-palette">
          {DECOR_CATALOG.map((entry) => (
            <TheaterBtn
              key={entry.key}
              active={vm.decorCatalogKey === entry.key}
              onClick={() => {
                vm.setDecorCatalogKey(entry.key as DecorCatalogKey);
                vm.setDecorDraftSize(null);
                vm.setDecorDraftColor(null);
                vm.enterDecorPlaceMode();
              }}
            >
              {entry.label}
            </TheaterBtn>
          ))}
        </div>
      </TheaterCollapsibleSection>
    </>
  );
}
