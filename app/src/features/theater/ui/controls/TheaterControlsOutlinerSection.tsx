import { useState } from "react";
import type { TheaterControlsTabProps } from "./types";
import { TheaterSceneOutliner } from "../TheaterSceneOutliner";
import { TheaterBtn, TheaterField } from "../theater-controls-ui";

export function TheaterControlsOutlinerSection({ vm }: TheaterControlsTabProps) {
  const [bookmarkLabel, setBookmarkLabel] = useState("");

  return (
    <>
      <TheaterSceneOutliner
        groups={vm.sceneOutlinerGroups}
        activeSpotlightId={vm.activeSpotlightId}
        activeModelId={vm.activeModelId}
        activeDoorId={vm.activeDoorId}
        layoutFocused={vm.layoutOutlineFocused}
        pulseTarget={vm.pulseTarget}
        disabled={!vm.currentStep}
        onFocusItem={vm.focusSceneOutlinerItem}
        onToggleVisibility={vm.toggleSceneOutlinerVisibility}
        onToggleGroupVisibility={vm.setSceneOutlinerGroupVisibility}
        showHidden={vm.showHiddenInOutliner}
        onShowHiddenChange={vm.setShowHiddenInOutliner}
        onRevealAllHidden={vm.revealAllHiddenInScene}
        onIsolateSelection={vm.isolateSceneSelection}
      />
      <section className="theater-camera-bookmarks theater-camera-bookmarks--stage-brutal">
        <div className="theater-layout-title">Закладки камеры</div>
        <div className="theater-spotlight-batch theater-camera-bookmark-form">
          <TheaterField label="Название">
            <input
              type="text"
              className="native-text-input"
              value={bookmarkLabel}
              placeholder="Вид со зрителей"
              onChange={(event) => setBookmarkLabel(event.target.value)}
              disabled={!vm.currentStep}
            />
          </TheaterField>
          <TheaterBtn
            disabled={!vm.currentStep}
            onClick={() => void vm.saveCameraBookmark(bookmarkLabel)}
            title="Сохранить текущий ракурс 3D"
          >
            Сохранить вид
          </TheaterBtn>
        </div>
        {vm.cameraBookmarks.length > 0 ? (
          <div className="theater-camera-bookmark-list">
            {vm.cameraBookmarks.map((bookmark) => (
              <div key={bookmark.id} className="theater-camera-bookmark-row">
                <span title={bookmark.label}>{bookmark.label}</span>
                <TheaterBtn
                  onClick={() => vm.applyCameraBookmark(bookmark)}
                  disabled={!vm.currentStep}
                >
                  Перейти
                </TheaterBtn>
                <TheaterBtn
                  onClick={() => vm.deleteCameraBookmark(bookmark.id)}
                  disabled={!vm.currentStep}
                >
                  ×
                </TheaterBtn>
              </div>
            ))}
          </div>
        ) : (
          <p className="theater-layout-hint">Нет сохранённых ракурсов</p>
        )}
      </section>
    </>
  );
}
