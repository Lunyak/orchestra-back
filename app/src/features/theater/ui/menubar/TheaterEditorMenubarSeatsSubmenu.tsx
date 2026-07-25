import { LabeledToggle } from "../../../../shared/core/labeled-toggle/LabeledToggle";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export function TheaterEditorMenubarSeatsSubmenu({ vm }: { vm: TheaterSceneViewModel }) {
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
        <LabeledToggle checked={vm.showSeats} onChange={vm.setShowSeats}>
          Показать в 3D
        </LabeledToggle>
      </div>
    </div>
  );
}
