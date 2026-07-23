import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsDecorTab } from "./use-theater-controls-decor-tab";
import { TheaterControlsDecorMultiSection } from "./decor/TheaterControlsDecorMultiSection";
import { TheaterControlsDecorAppearanceSection } from "./decor/TheaterControlsDecorAppearanceSection";

export function TheaterControlsDecorTab({ vm }: TheaterControlsTabProps) {
  const decor = useTheaterControlsDecorTab(vm);
  return (
    <div className="theater-layout-panel">
      <TheaterControlsDecorMultiSection vm={vm} decor={decor} />
      <TheaterControlsDecorAppearanceSection vm={vm} decor={decor} />
    </div>
  );
}
