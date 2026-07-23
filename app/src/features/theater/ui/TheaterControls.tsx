import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterRightSidebar } from "./TheaterRightSidebar";

export type TheaterControlsProps = {
  vm: TheaterSceneViewModel;
  controlsInPanel?: boolean;
  /** sidebar — содержимое справа (вкладки внутри панели) */
  panel?: "toolbar" | "sidebar";
};

export function TheaterControls({
  vm,
  controlsInPanel,
  panel = "sidebar",
}: TheaterControlsProps) {
  if (!vm.showControls) return null;
  if (panel === "toolbar") return null;
  if (!controlsInPanel) return null;

  return (
    <div className="theater-controls theater-controls-panel theater-controls-outliner-panel theater-controls--editor-sidebar">
      <TheaterRightSidebar vm={vm} />
    </div>
  );
}
