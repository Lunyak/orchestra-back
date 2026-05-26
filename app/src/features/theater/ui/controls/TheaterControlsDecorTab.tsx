import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsDecorTab } from "./use-theater-controls-decor-tab";
import { TheaterControlsDecorModeSection } from "./decor/TheaterControlsDecorModeSection";
import { TheaterControlsDecorMultiSection } from "./decor/TheaterControlsDecorMultiSection";
import { TheaterControlsDecorGridSection } from "./decor/TheaterControlsDecorGridSection";
import { TheaterControlsDecorTemplatesSection } from "./decor/TheaterControlsDecorTemplatesSection";
import { TheaterControlsDecorInventorySection } from "./decor/TheaterControlsDecorInventorySection";
import { TheaterControlsDecorSizeSection } from "./decor/TheaterControlsDecorSizeSection";
import { TheaterControlsDecorAppearanceSection } from "./decor/TheaterControlsDecorAppearanceSection";
import { TheaterControlsDecorSceneSection } from "./decor/TheaterControlsDecorSceneSection";

export function TheaterControlsDecorTab({ vm }: TheaterControlsTabProps) {
  const decor = useTheaterControlsDecorTab(vm);
  return (
    <div className="theater-layout-panel">
      <TheaterControlsDecorModeSection vm={vm} decor={decor} />
      <TheaterControlsDecorMultiSection vm={vm} decor={decor} />
      <TheaterControlsDecorGridSection vm={vm} decor={decor} />
      <TheaterControlsDecorTemplatesSection vm={vm} decor={decor} />
      <TheaterControlsDecorInventorySection vm={vm} decor={decor} />
      <TheaterControlsDecorSizeSection vm={vm} decor={decor} />
      <TheaterControlsDecorAppearanceSection vm={vm} decor={decor} />
      <TheaterControlsDecorSceneSection vm={vm} decor={decor} />
    </div>
  );
}
