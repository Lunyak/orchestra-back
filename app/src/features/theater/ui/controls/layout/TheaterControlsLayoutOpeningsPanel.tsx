import type { TheaterControlsTabProps } from "../types";
import type { TheaterControlsLayoutTabModel } from "../use-theater-controls-layout-tab";
import { TheaterControlsLayoutDoorsSection } from "./TheaterControlsLayoutDoorsSection";
import { TheaterControlsLayoutOpeningsSection } from "./TheaterControlsLayoutOpeningsSection";
import { TheaterControlsLayoutRecessesSection } from "./TheaterControlsLayoutRecessesSection";

export type TheaterControlsLayoutOpeningsPanelProps = TheaterControlsTabProps & {
  layout: TheaterControlsLayoutTabModel;
};

/** Наполнение стен: двери, ниши и прочие проёмы. */
export function TheaterControlsLayoutOpeningsPanel({
  vm,
  layout,
}: TheaterControlsLayoutOpeningsPanelProps) {
  const isCustomStage = layout.isCustomStageOutline;
  const isCircleStage = (vm.layout.stageShape ?? "rectangle") === "circle";

  if (isCustomStage || isCircleStage) {
    return (
      <div className="theater-layout-panel__body">
        <p className="theater-layout-hint theater-layout-panel__empty-hint">
          {isCircleStage
            ? "Круглая сцена — открытый планшет без стен. Двери, ниши и проёмы не нужны."
            : "Для произвольного контура сцены двери, ниши и проёмы пока недоступны."}
        </p>
      </div>
    );
  }

  return (
    <div className="theater-layout-panel__body">
      <TheaterControlsLayoutDoorsSection vm={vm} layout={layout} />
      <TheaterControlsLayoutOpeningsSection vm={vm} layout={layout} />
      <TheaterControlsLayoutRecessesSection vm={vm} layout={layout} />
    </div>
  );
}
