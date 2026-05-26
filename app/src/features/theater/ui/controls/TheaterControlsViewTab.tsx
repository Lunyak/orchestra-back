import type { TheaterControlsTabProps } from "./types";
import { useTheaterControlsLayoutTab } from "./use-theater-controls-layout-tab";
import { TheaterControlsLayoutViewSection } from "./layout/TheaterControlsLayoutViewSection";
import { TheaterControlsLayoutWallsSection } from "./layout/TheaterControlsLayoutWallsSection";

export function TheaterControlsViewTab({ vm }: TheaterControlsTabProps) {
  const layout = useTheaterControlsLayoutTab(vm);

  return (
    <div className="theater-layout-panel">
      <TheaterControlsLayoutViewSection vm={vm} layout={layout} />
      <TheaterControlsLayoutWallsSection vm={vm} layout={layout} />
    </div>
  );
}
