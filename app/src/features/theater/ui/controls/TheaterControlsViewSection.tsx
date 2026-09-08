import { LabeledToggle } from "../../../../shared/core/labeled-toggle/LabeledToggle";
import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { TheaterEditorMenubarSeatsSubmenu } from "../menubar/TheaterEditorMenubarSeatsSubmenu";
import { TheaterEditorMenubarTheaterFields } from "../menubar/TheaterEditorMenubarTheaterFields";
import { TheaterEditorMenubarWallsSubmenu } from "../menubar/TheaterEditorMenubarWallsSubmenu";

export type TheaterControlsViewSectionProps = {
  vm: TheaterSceneViewModel;
};

/** Настройки вида сцены — панель в обзоре. */
export function TheaterControlsViewSection({ vm }: TheaterControlsViewSectionProps) {
  return (
    <div className="theater-editor-view-panel" aria-label="Вид">
      <div className="theater-editor-view-panel__group">
        <span className="theater-editor-view-panel__title">ТЕАТР</span>
        <div className="theater-editor-view-panel__list" role="group" aria-label="Театр">
          <LabeledToggle checked={vm.showFloorPlan} onChange={vm.setShowFloorPlan}>
            2D карта
          </LabeledToggle>
          <LabeledToggle checked={vm.showGrid} onChange={vm.setShowGrid}>
            Сетка зала
          </LabeledToggle>
          <LabeledToggle checked={vm.showStageGrid} onChange={vm.setShowStageGrid}>
            Сетка сцены
          </LabeledToggle>
          <LabeledToggle checked={vm.snapToGrid} onChange={vm.setSnapToGrid}>
            Привязка X/Z
          </LabeledToggle>
          <LabeledToggle
            checked={vm.alignGuidesEnabled}
            onChange={vm.setAlignGuidesEnabled}
          >
            Направляющие
          </LabeledToggle>
          <LabeledToggle
            checked={vm.showSpotlightGuideLines}
            onChange={vm.setShowSpotlightGuideLines}
          >
            Линии софитов
          </LabeledToggle>
          <LabeledToggle
            checked={vm.spectaclePreviewMode}
            onChange={vm.setSpectaclePreviewMode}
          >
            Просмотр
          </LabeledToggle>
          <TheaterEditorMenubarTheaterFields vm={vm} />
        </div>
      </div>
      <TheaterEditorMenubarSeatsSubmenu vm={vm} />
      <TheaterEditorMenubarWallsSubmenu vm={vm} />
    </div>
  );
}
