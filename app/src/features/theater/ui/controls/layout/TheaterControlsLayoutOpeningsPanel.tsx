import type { TheaterControlsTabProps } from "../types";
import type { TheaterControlsLayoutTabModel } from "../use-theater-controls-layout-tab";
import { TheaterControlsLayoutDoorsSection } from "./TheaterControlsLayoutDoorsSection";
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

  if (isCustomStage) {
    return (
      <div className="theater-layout-panel__body">
        <p className="theater-layout-hint theater-layout-panel__empty-hint">
          Для произвольного контура сцены двери и ниши пока недоступны.
        </p>
      </div>
    );
  }

  return (
    <div className="theater-layout-panel__body">
      <TheaterControlsLayoutDoorsSection vm={vm} layout={layout} />
      <TheaterControlsLayoutRecessesSection vm={vm} layout={layout} />
    </div>
  );
}
