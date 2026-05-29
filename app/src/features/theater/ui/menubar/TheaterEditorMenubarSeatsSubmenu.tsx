import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { useTheaterControlsLayoutTab } from "../controls/use-theater-controls-layout-tab";
import { TheaterEditorMenubarSeatsFields } from "./TheaterEditorMenubarSeatsFields";
import { TheaterEditorMenubarToggle } from "./TheaterEditorMenubarToggle";

export function TheaterEditorMenubarSeatsSubmenu({ vm }: { vm: TheaterSceneViewModel }) {
  const layout = useTheaterControlsLayoutTab(vm);

  return (
    <div className="theater-editor-menubar__submenu-group">
      <span className="theater-editor-menubar__option theater-editor-menubar__option--submenu-title">
        КРЕСЛА
      </span>
      <div
        className="theater-editor-menubar__submenu theater-editor-menubar__submenu--seats"
        role="group"
        aria-label="Кресла"
      >
        <TheaterEditorMenubarToggle checked={vm.showSeats} onChange={vm.setShowSeats}>
          Показать в 3D
        </TheaterEditorMenubarToggle>
        <TheaterEditorMenubarSeatsFields vm={vm} layout={layout} />
      </div>
    </div>
  );
}
