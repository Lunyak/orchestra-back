import type { TheaterControlsTabProps } from "./types";
import { TheaterSceneOutliner } from "../TheaterSceneOutliner";

export function TheaterControlsOutlinerSection({ vm }: TheaterControlsTabProps) {
  return (
    <div className="theater-editor-scene-panel">
      <TheaterSceneOutliner
        groups={vm.sceneOutlinerGroups}
        activeSpotlightId={vm.activeSpotlightId}
        activeModelId={vm.activeModelId}
        activeDoorId={vm.activeDoorId}
        layoutFocused={vm.layoutOutlineFocused}
        audienceSeatsFocused={vm.audienceSeatsFocused}
        stageGridFocused={vm.stageGridFocused}
        pulseTarget={vm.pulseTarget}
        disabled={!vm.currentScene}
        onFocusItem={vm.focusSceneOutlinerItem}
        onToggleVisibility={vm.toggleSceneOutlinerVisibility}
        onToggleGroupVisibility={vm.setSceneOutlinerGroupVisibility}
        onRevealAllHidden={vm.revealAllHiddenInScene}
        onIsolateSelection={vm.isolateSceneSelection}
      />
    </div>
  );
}
