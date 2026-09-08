import type { TheaterRoomSectionId } from "../../../model/theater-sidebar-nav";
import type { TheaterControlsTabProps } from "../types";
import type { TheaterControlsLayoutTabModel } from "../use-theater-controls-layout-tab";
import { TheaterControlsLayoutAudienceSection } from "./TheaterControlsLayoutAudienceSection";
import { TheaterControlsLayoutExportSection } from "./TheaterControlsLayoutExportSection";
import { TheaterControlsLayoutHallSizeSection } from "./TheaterControlsLayoutHallSizeSection";
import { TheaterControlsLayoutMaterialsSection } from "./TheaterControlsLayoutMaterialsSection";
import { TheaterControlsLayoutStageGridSection } from "./TheaterControlsLayoutStageGridSection";
import { TheaterControlsLayoutStageSection } from "./TheaterControlsLayoutStageSection";

export type TheaterControlsLayoutRoomPanelProps = TheaterControlsTabProps & {
  layout: TheaterControlsLayoutTabModel;
  section: TheaterRoomSectionId;
};

export function TheaterControlsLayoutRoomPanel({
  vm,
  layout,
  section,
}: TheaterControlsLayoutRoomPanelProps) {
  return (
    <div className="theater-layout-panel__body">
      {section === "hall" ? (
        <TheaterControlsLayoutHallSizeSection vm={vm} layout={layout} />
      ) : null}
      {section === "audience" ? (
        <TheaterControlsLayoutAudienceSection vm={vm} layout={layout} />
      ) : null}
      {section === "stage" ? (
        <TheaterControlsLayoutStageSection vm={vm} layout={layout} />
      ) : null}
      {section === "grid" ? (
        <TheaterControlsLayoutStageGridSection vm={vm} layout={layout} />
      ) : null}
      {section === "materials" ? (
        <TheaterControlsLayoutMaterialsSection vm={vm} layout={layout} />
      ) : null}
      {section === "export" ? (
        <TheaterControlsLayoutExportSection vm={vm} layout={layout} />
      ) : null}
    </div>
  );
}
