import type { TheaterControlsTabProps } from "../types";
import type { TheaterControlsLayoutTabModel } from "../use-theater-controls-layout-tab";
import { TheaterControlsLayoutHallSizeSection } from "./TheaterControlsLayoutHallSizeSection";
import { TheaterControlsLayoutMaterialsSection } from "./TheaterControlsLayoutMaterialsSection";
import { TheaterControlsLayoutStageSection } from "./TheaterControlsLayoutStageSection";
import { TheaterControlsLayoutStageGridSection } from "./TheaterControlsLayoutStageGridSection";
import { TheaterControlsLayoutExportSection } from "./TheaterControlsLayoutExportSection";

export type TheaterControlsLayoutRoomPanelProps = TheaterControlsTabProps & {
  layout: TheaterControlsLayoutTabModel;
};

/** Параметры помещения: габариты, сцена, сетка, материалы, экспорт. */
export function TheaterControlsLayoutRoomPanel({
  vm,
  layout,
}: TheaterControlsLayoutRoomPanelProps) {
  return (
    <div className="theater-layout-panel__body">
      <TheaterControlsLayoutHallSizeSection vm={vm} layout={layout} />
      <TheaterControlsLayoutStageSection vm={vm} layout={layout} />
      <TheaterControlsLayoutStageGridSection vm={vm} layout={layout} />
      <TheaterControlsLayoutMaterialsSection vm={vm} layout={layout} />
      <TheaterControlsLayoutExportSection vm={vm} layout={layout} />
    </div>
  );
}
