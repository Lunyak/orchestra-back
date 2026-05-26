import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { labelM } from "../../../model/theater-metrics";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { useTheaterControlsLightChannels } from "../use-theater-controls-light-channels";
import type { LayoutSectionProps } from "./types";

export function TheaterControlsLayoutViewSection({ vm, layout }: LayoutSectionProps) {
  const { layoutHallBadge } = layout;
  const { lightChannels } = useTheaterControlsLightChannels();

  return (
    <>
      <TheaterCollapsibleSection
        sectionId="layout-view"
        title="Вид и план"
        summary="Сетка, кресла, режимы просмотра"
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
          {vm.showFloorPlan ? (
            <LabeledCheckbox
              checked={vm.floorPlanExpanded}
              onChange={vm.setFloorPlanExpanded}
            >
              План развёрнут
            </LabeledCheckbox>
          ) : null}
          <LabeledCheckbox
            checked={vm.spectaclePreviewMode}
            onChange={vm.setSpectaclePreviewMode}
          >
            Просмотр
          </LabeledCheckbox>
          <LabeledCheckbox
            checked={vm.stepRehearsalMode}
            onChange={vm.setStepRehearsalMode}
          >
            Репетиция шага
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
        <TheaterBtn
          disabled={!vm.currentStep || (vm.currentStep.lightCues?.length ?? 0) === 0}
          title="Скопировать таймлайн light cue в буфер"
          onClick={() => void vm.copyLightCuesToClipboard(lightChannels)}
        >
          Cue → буфер
        </TheaterBtn>
        {vm.floorPlanExpanded ? (
          <p className="theater-layout-hint">
            Колёсико — масштаб, Alt+перетаскивание — сдвиг плана.
          </p>
        ) : null}
      </TheaterCollapsibleSection>
    </>
  );
}
