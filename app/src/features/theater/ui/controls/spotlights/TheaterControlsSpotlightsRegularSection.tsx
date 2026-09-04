import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { TheaterBtn } from "../../theater-controls-ui";
import { TheaterSpotlightNavEmpty } from "./TheaterSpotlightNavEmpty";
import { TheaterSpotlightNavRow } from "./TheaterSpotlightNavRow";
import type { SpotlightsSectionProps } from "./types";

export function TheaterControlsSpotlightsRegularSection({ vm, spot }: SpotlightsSectionProps) {
  const activeRegularSpotlight = vm.activeSpotlight?.isRgb ? null : vm.activeSpotlight;
  const { regularSpotlights } = spot;
  const isEmpty = regularSpotlights.length === 0;
  const allEnabled =
    regularSpotlights.length > 0 &&
    regularSpotlights.every((item) => item.enabled !== false);

  if (isEmpty) {
    return (
      <div className="theater-spotlight-nav-panel">
        <TheaterSpotlightNavEmpty
          title="Софитов нет"
          hint="Добавьте первый софит на сцену"
          actionLabel="Добавить софит"
          disabled={!vm.currentScene}
          onAdd={vm.addSpotlight}
          icon={<path d="M12 3v4M9 7h6l5 13H4L9 7Z" />}
        />
      </div>
    );
  }

  return (
    <div className="theater-spotlight-nav-panel">
      <div className="theater-spotlight-nav-toolbar">
        <TheaterBtn
          onClick={vm.addSpotlight}
          disabled={!vm.currentScene}
          title="Добавить софит"
        >
          +
        </TheaterBtn>
        <TheaterBtn
          className="theater-btn--visibility"
          active={allEnabled}
          disabled={!vm.currentScene}
          title={allEnabled ? "Выключить все" : "Включить все"}
          onClick={() => {
            if (allEnabled) vm.disableSpotlightsByType(false);
            else vm.enableSpotlightsByType(false);
          }}
        >
          <span className="theater-spotlight-power-dot" />
        </TheaterBtn>
      </div>
      <div className="theater-sidebar-home theater-spotlight-nav-list">
        {regularSpotlights.map((item) => (
          <TheaterSpotlightNavRow
            key={item.id}
            vm={vm}
            spot={spot}
            item={item}
            placeholder={`Софит ${item.id}`}
            deleteTitle="Удалить софит"
          />
        ))}
      </div>
      <div className="theater-spotlight-nav-footer">
        <LabeledCheckbox
          checked={activeRegularSpotlight?.modelLowDetail ?? false}
          onChange={(modelLowDetail) => {
            if (!activeRegularSpotlight) return;
            vm.updateSpotlight(activeRegularSpotlight.id, { modelLowDetail });
          }}
          disabled={!activeRegularSpotlight}
        >
          Упрощённая 3D-модель
        </LabeledCheckbox>
      </div>
    </div>
  );
}
