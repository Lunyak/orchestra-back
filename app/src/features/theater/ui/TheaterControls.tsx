import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import { TheaterControlsToolbar } from "./controls/TheaterControlsToolbar";
import { TheaterRightSidebar } from "./TheaterRightSidebar";

export type TheaterControlsProps = {
  vm: TheaterSceneViewModel;
  controlsInPanel?: boolean;
  /** toolbar — вкладки слева; sidebar — содержимое справа */
  panel?: "toolbar" | "sidebar";
};

export function TheaterControls({
  vm,
  controlsInPanel,
  panel = "toolbar",
}: TheaterControlsProps) {
  if (!vm.showControls) return null;

  if (panel === "sidebar") {
    if (!controlsInPanel) return null;
    return (
      <div className="theater-controls theater-controls-panel theater-controls-outliner-panel theater-controls--editor-sidebar">
        <TheaterRightSidebar vm={vm} />
      </div>
    );
  }

  return (
    <aside className="theater-controls theater-controls--toolbar" aria-label="Разделы театра">
      <TheaterControlsToolbar vm={vm} />
    </aside>
  );
}
