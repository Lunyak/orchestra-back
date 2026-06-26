import type { TheaterSceneViewModel } from "../../model/use-theater-scene";
import { TheaterEditorMenubarSeatsSubmenu } from "./TheaterEditorMenubarSeatsSubmenu";
import { TheaterEditorMenubarTheaterFields } from "./TheaterEditorMenubarTheaterFields";
import { TheaterEditorMenubarToggle } from "./TheaterEditorMenubarToggle";
import { TheaterEditorMenubarWallsSubmenu } from "./TheaterEditorMenubarWallsSubmenu";

export type TheaterEditorViewMenuProps = {
  vm: TheaterSceneViewModel;
};

export function TheaterEditorViewMenu({ vm }: TheaterEditorViewMenuProps) {
  return (
    <div className="theater-editor-menubar__menu">
      <span className="theater-editor-menubar__menu-title">Вид</span>
      <div className="theater-editor-menubar__options" role="menu">
        <div className="theater-editor-menubar__submenu-group">
          <span className="theater-editor-menubar__option theater-editor-menubar__option--submenu-title">
            ТЕАТР
          </span>
          <div className="theater-editor-menubar__submenu" role="group" aria-label="Театр">
            <TheaterEditorMenubarToggle checked={vm.showGrid} onChange={vm.setShowGrid}>
              Сетка зала
            </TheaterEditorMenubarToggle>
            <TheaterEditorMenubarToggle
              checked={vm.showStageGrid}
              onChange={vm.setShowStageGrid}
            >
              Сетка сцены
            </TheaterEditorMenubarToggle>
            <TheaterEditorMenubarToggle checked={vm.snapToGrid} onChange={vm.setSnapToGrid}>
              Привязка X/Z
            </TheaterEditorMenubarToggle>
            <TheaterEditorMenubarToggle
              checked={vm.alignGuidesEnabled}
              onChange={vm.setAlignGuidesEnabled}
            >
              Направляющие
            </TheaterEditorMenubarToggle>
            <TheaterEditorMenubarToggle
              checked={vm.showSpotlightGuideLines}
              onChange={vm.setShowSpotlightGuideLines}
            >
              Линии софитов
            </TheaterEditorMenubarToggle>
            <TheaterEditorMenubarToggle
              checked={vm.showFloorPlan}
              onChange={vm.setShowFloorPlan}
            >
              План сверху
            </TheaterEditorMenubarToggle>
            {vm.showFloorPlan ? (
              <TheaterEditorMenubarToggle
                checked={vm.floorPlanExpanded}
                onChange={vm.setFloorPlanExpanded}
              >
                План развёрнут
              </TheaterEditorMenubarToggle>
            ) : null}
            <TheaterEditorMenubarToggle
              checked={vm.spectaclePreviewMode}
              onChange={vm.setSpectaclePreviewMode}
            >
              Просмотр
            </TheaterEditorMenubarToggle>
            <TheaterEditorMenubarToggle
              checked={vm.sceneRehearsalMode}
              onChange={vm.setSceneRehearsalMode}
            >
              Репетиция сцены
            </TheaterEditorMenubarToggle>
            <TheaterEditorMenubarTheaterFields vm={vm} />
          </div>
        </div>
        <TheaterEditorMenubarSeatsSubmenu vm={vm} />
        <TheaterEditorMenubarWallsSubmenu vm={vm} />
      </div>
    </div>
  );
}
