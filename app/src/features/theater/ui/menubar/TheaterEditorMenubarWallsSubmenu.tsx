import { LabeledToggle } from "../../../../shared/core/labeled-toggle/LabeledToggle";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";

export function TheaterEditorMenubarWallsSubmenu({ vm }: { vm: TheaterSceneViewModel }) {
  return (
    <div className="theater-editor-menubar__submenu-group">
      <span className="theater-editor-menubar__option theater-editor-menubar__option--submenu-title">
        СТЕНЫ
      </span>
      <div className="theater-editor-menubar__submenu" role="group" aria-label="Стены">
        <LabeledToggle
          checked={vm.wallsHideFromCamera}
          disabled={vm.wallsHidden}
          onChange={vm.setWallsHideFromCamera}
        >
          Скрыть перед камерой
        </LabeledToggle>
        <LabeledToggle
          checked={vm.wallsOpaque}
          disabled={vm.wallsHidden}
          onChange={(checked) => {
            vm.setWallsOpaque(checked);
            if (checked) vm.setWallsHidden(false);
          }}
        >
          Непрозрачные
        </LabeledToggle>
        <LabeledToggle
          checked={vm.wallsHidden}
          onChange={(checked) => {
            vm.setWallsHidden(checked);
            if (checked) vm.setWallsOpaque(false);
          }}
        >
          Скрыть все
        </LabeledToggle>
      </div>
    </div>
  );
}
