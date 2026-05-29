import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { labelM } from "../../model/theater-metrics";
import { useTheaterControlsLightChannels } from "../controls/use-theater-controls-light-channels";

export function TheaterEditorMenubarTheaterFields({ vm }: { vm: TheaterSceneViewModel }) {
  const { lightChannels } = useTheaterControlsLightChannels();

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
      <button
        type="button"
        className="theater-editor-menubar__field-action"
        disabled={!vm.currentStep || (vm.currentStep.lightCues?.length ?? 0) === 0}
        title="Скопировать таймлайн light cue в буфер"
        onClick={() => void vm.copyLightCuesToClipboard(lightChannels)}
      >
        Cue → буфер
      </button>
    </div>
  );
}
