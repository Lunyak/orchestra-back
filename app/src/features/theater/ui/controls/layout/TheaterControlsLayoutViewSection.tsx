import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { labelM } from "../../../model/theater-metrics";
import { TheaterField } from "../../theater-controls-ui";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutViewSection({ vm, layout }: LayoutSectionProps) {
  const { layoutHallBadge } = layout;

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-view"
        title="Вид и привязка"
        summary="Что показывать и как перемещать"
        badge={layoutHallBadge}
        defaultOpen
      >
        <div className="theater-compact-checks">
          <LabeledCheckbox checked={vm.showSeats} onChange={vm.setShowSeats}>
            Кресла
          </LabeledCheckbox>
          <LabeledCheckbox checked={vm.showGrid} onChange={vm.setShowGrid}>
            Сетка зала
          </LabeledCheckbox>
          <LabeledCheckbox checked={vm.showStageGrid} onChange={vm.setShowStageGrid}>
            Сетка сцены
          </LabeledCheckbox>
          <LabeledCheckbox checked={vm.snapToGrid} onChange={vm.setSnapToGrid}>
            Привязка X/Z
          </LabeledCheckbox>
          <LabeledCheckbox
            checked={vm.alignGuidesEnabled}
            onChange={vm.setAlignGuidesEnabled}
          >
            Направляющие
          </LabeledCheckbox>
          <LabeledCheckbox
            checked={vm.showSpotlightGuideLines}
            onChange={vm.setShowSpotlightGuideLines}
          >
            Линии софитов
          </LabeledCheckbox>
          <LabeledCheckbox checked={vm.showFloorPlan} onChange={vm.setShowFloorPlan}>
            План сверху
          </LabeledCheckbox>
          <LabeledCheckbox
            checked={vm.spectaclePreviewMode}
            onChange={vm.setSpectaclePreviewMode}
          >
            Просмотр
          </LabeledCheckbox>
          <LabeledCheckbox
            checked={vm.sceneRehearsalMode}
            onChange={vm.setSceneRehearsalMode}
          >
            Репетиция сцены
          </LabeledCheckbox>
        </div>
        <TheaterField label={labelM("Шаг сетки")}>
          <input
            type="number"
            className="native-text-input"
            min={0.1}
            step={0.1}
            value={vm.gridStep}
            onChange={(event) =>
              vm.setGridStep(Math.max(0.1, Number(event.target.value) || 0.1))
            }
          />
        </TheaterField>
        <TheaterField label="Фон 3D">
          <input
            type="color"
            className="theater-color-input"
            value={vm.sceneBackgroundColor}
            onChange={(event) => vm.setSceneBackgroundColor(event.target.value)}
          />
        </TheaterField>
        {vm.showFloorPlan ? (
          <p className="theater-layout-hint">
            Угол плана — размер. Колёсико — масштаб, Alt+перетаскивание — сдвиг.
          </p>
        ) : null}
      </TheaterCollapsibleSection>
    </>
  );
}
