import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { labelM } from "../../model/theater-metrics";

export function TheaterEditorMenubarTheaterFields({ vm }: { vm: TheaterSceneViewModel }) {
  return (
    <div
      className="theater-editor-menubar__submenu-fields"
      onClick={(event) => event.stopPropagation()}
    >
      <label className="theater-editor-menubar__field-row">
        <span className="theater-editor-menubar__field-label">{labelM("Шаг сетки")}</span>
        <input
          type="number"
          className="theater-editor-menubar__field-input native-text-input"
          min={0.1}
          step={0.1}
          value={vm.gridStep}
          onChange={(event) =>
            vm.setGridStep(Math.max(0.1, Number(event.target.value) || 0.1))
          }
        />
      </label>
      <label className="theater-editor-menubar__field-row">
        <span className="theater-editor-menubar__field-label">Фон 3D</span>
        <input
          type="color"
          className="theater-editor-menubar__field-color"
          value={vm.sceneBackgroundColor}
          onChange={(event) => vm.setSceneBackgroundColor(event.target.value)}
        />
      </label>
    </div>
  );
}
