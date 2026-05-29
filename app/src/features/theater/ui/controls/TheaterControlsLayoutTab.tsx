import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsLayoutTab } from "./use-theater-controls-layout-tab";
import { TheaterControlsLayoutTemplateSection } from "./layout/TheaterControlsLayoutTemplateSection";
import { TheaterControlsLayoutStageGridSection } from "./layout/TheaterControlsLayoutStageGridSection";
import { TheaterControlsLayoutHallSizeSection } from "./layout/TheaterControlsLayoutHallSizeSection";
import { TheaterControlsLayoutMaterialsSection } from "./layout/TheaterControlsLayoutMaterialsSection";
import { TheaterControlsLayoutStageSection } from "./layout/TheaterControlsLayoutStageSection";
import { TheaterControlsLayoutRecessesSection } from "./layout/TheaterControlsLayoutRecessesSection";
import { TheaterControlsLayoutDoorsSection } from "./layout/TheaterControlsLayoutDoorsSection";

export function TheaterControlsLayoutTab({ vm }: TheaterControlsTabProps) {
  const layout = useTheaterControlsLayoutTab(vm);
  return (
    <div className="theater-layout-panel">
      <TheaterControlsLayoutHallSizeSection vm={vm} layout={layout} />
      <TheaterControlsLayoutMaterialsSection vm={vm} layout={layout} />
      <TheaterControlsLayoutTemplateSection vm={vm} layout={layout} />
      <TheaterControlsLayoutStageGridSection vm={vm} layout={layout} />
      <TheaterControlsLayoutStageSection vm={vm} layout={layout} />
      <TheaterControlsLayoutRecessesSection vm={vm} layout={layout} />
      <TheaterControlsLayoutDoorsSection vm={vm} layout={layout} />
    </div>
  );
}
