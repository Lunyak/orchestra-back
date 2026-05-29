import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { getAudienceStartZBounds, labelM } from "../../model/theater-metrics";
import { rangeFillStyle } from "../theater-controls-ui";
import type { useTheaterControlsLayoutTab } from "../controls/use-theater-controls-layout-tab";

type LayoutTabState = ReturnType<typeof useTheaterControlsLayoutTab>;

export type TheaterEditorMenubarSeatsFieldsProps = {
  vm: TheaterSceneViewModel;
  layout: LayoutTabState;
};

export function TheaterEditorMenubarSeatsFields({
  vm,
  layout,
}: TheaterEditorMenubarSeatsFieldsProps) {
  const {
    outlineFitSeats,
    setOutlineFitSeats,
    outlineFitSeatsFocusedRef,
    commitOutlineFitSeats,
    layoutSeatBadge,
    isCustomStageOutline,
  } = layout;

  const zBounds = getAudienceStartZBounds(vm.layout);

  return (
    <div
      className="theater-editor-menubar__submenu-fields theater-editor-menubar__submenu-fields--seats"
      onClick={(event) => event.stopPropagation()}
    >
      <p className="theater-editor-menubar__field-meta">{layoutSeatBadge}</p>
      <label className="theater-editor-menubar__field-row theater-editor-menubar__field-row--range">
        <span className="theater-editor-menubar__field-label">{labelM("Кресла Z")}</span>
        <div className="theater-editor-menubar__range-wrap">
          <input
            type="range"
            className="theater-editor-menubar__range"
            min={zBounds.min}
            max={zBounds.max}
            step={0.1}
            value={vm.layout.audienceStartZ}
            style={rangeFillStyle(zBounds.min, zBounds.max, vm.layout.audienceStartZ)}
            onPointerDown={() => {
              vm.setAudienceSeatsHighlight(true);
              vm.beginTheaterHistoryTransaction();
            }}
            onPointerUp={() => {
              vm.setAudienceSeatsHighlight(false);
              vm.endTheaterHistoryTransaction();
            }}
            onPointerCancel={() => {
              vm.setAudienceSeatsHighlight(false);
              vm.endTheaterHistoryTransaction();
            }}
            onBlur={() => {
              vm.setAudienceSeatsHighlight(false);
              vm.endTheaterHistoryTransaction();
            }}
            onChange={(event) =>
              vm.updateLayout({ audienceStartZ: Number(event.target.value) })
            }
          />
          <span className="theater-editor-menubar__range-value">
            {vm.layout.audienceStartZ.toFixed(1)}
          </span>
        </div>
      </label>
      <label className="theater-editor-menubar__field-row">
        <span className="theater-editor-menubar__field-label">{labelM("Шаг рядов")}</span>
        <input
          type="number"
          className="theater-editor-menubar__field-input native-text-input"
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
      </label>
      <label className="theater-editor-menubar__field-row">
        <span className="theater-editor-menubar__field-label">{labelM("Шаг мест")}</span>
        <input
          type="number"
          className="theater-editor-menubar__field-input native-text-input"
          min={0.45}
          step={0.05}
          value={vm.layout.seatSpacing}
          readOnly
          title="Вычисляется по ширине зала и числу мест в ряду"
        />
      </label>
      <label className="theater-editor-menubar__field-row">
        <span className="theater-editor-menubar__field-label">Целевое мест</span>
        <input
          type="number"
          className="theater-editor-menubar__field-input native-text-input"
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
      </label>
      {!isCustomStageOutline ? (
        <button
          type="button"
          className="theater-editor-menubar__field-action"
          onClick={() => {
            vm.beginTheaterHistoryTransaction();
            commitOutlineFitSeats();
            vm.endTheaterHistoryTransaction();
          }}
          title="Применить число мест к рядам/шагу"
        >
          Применить места
        </button>
      ) : (
        <>
          <button
            type="button"
            className="theater-editor-menubar__field-action"
            onClick={() => {
              vm.beginTheaterHistoryTransaction();
              vm.fitLayoutFromOutline(outlineFitSeats);
              vm.endTheaterHistoryTransaction();
            }}
            title="Контур под целевое число мест"
          >
            Контур → места
          </button>
          <button
            type="button"
            className="theater-editor-menubar__field-action"
            onClick={() => {
              vm.beginTheaterHistoryTransaction();
              vm.fitLayoutToSeatCount(outlineFitSeats);
              vm.endTheaterHistoryTransaction();
            }}
            title="Зал и контур под число мест"
          >
            Места → зал
          </button>
        </>
      )}
    </div>
  );
}
