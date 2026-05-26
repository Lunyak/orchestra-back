import { tc } from "../../../../../shared/styles/theme-color";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import {
  formatLightChannelSlot,
  spotlightMatchesChannelSlot,
} from "../../../model/theater-light-channel-link";
import { LightChannelSelect } from "../../LightChannelSelect";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import type { SpotlightsSectionProps } from "./types";

export function TheaterControlsSpotlightsLightplotSection({ vm, spot }: SpotlightsSectionProps) {
  const {
    spotlightBatchCount,
    setSpotlightBatchCount,
    rgbBatchCount,
    setRgbBatchCount,
    spotlightLayoutRows,
    setSpotlightLayoutRows,
    regularSpotlights,
    rgbSpotlights,
    totalSpotlights,
    linkStats,
    spotlightLinkBadge,
    spotlightCountBadge,
    lightChannels,
    selectedLightSlot,
  } = spot;
  return (
<>
<TheaterCollapsibleSection
            sectionId="spotlights-lightplot"
            title="Схема света"
            summary="Каналы 1–8, связь с 3D"
            badge={spotlightLinkBadge}
            defaultOpen
          >
            <p className="theater-layout-hint">
              Слот {selectedLightSlot} подсвечен при совпадении канала на софите.
            </p>
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterBtn
                onClick={() => vm.syncSpotlightsFromLightPlot(lightChannels)}
                disabled={!vm.currentStep || linkStats.fixtures === 0}
                title="Схема → 3D"
              >
                Из схемы
              </TheaterBtn>
              <TheaterBtn
                onClick={vm.syncLightPlotFromSpotlights}
                disabled={!vm.currentStep || totalSpotlights === 0}
                title="3D → схема"
              >
                В схему
              </TheaterBtn>
              <TheaterBtn
                onClick={vm.applyLightPlotChannelLabels}
                disabled={!vm.currentStep || linkStats.fixtures === 0}
                title="Подписи каналов"
              >
                Каналы
              </TheaterBtn>
            </div>
            <div className="theater-btn-row">
              <TheaterBtn
                disabled={!vm.currentStep}
                title="Ctrl+A"
                onClick={vm.selectAllVisibleInEditMode}
              >
                Выбрать все
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || (!vm.activeSpotlightId && vm.multiSelectedSpotlightIds.length === 0)}
                title="Esc"
                onClick={vm.clearSceneSelection}
              >
                Снять выдел.
              </TheaterBtn>
            </div>
            <div className="theater-btn-row">
              <LabeledCheckbox checked={vm.showSpotlights} onChange={vm.setShowSpotlights}>
                Показать в 3D
              </LabeledCheckbox>
              <LabeledCheckbox
                checked={vm.showOnlyActiveSpotlight}
                onChange={vm.setShowOnlyActiveSpotlight}
                disabled={!vm.activeSpotlight}
              >
                Только активный
              </LabeledCheckbox>
            </div>
            <p className="theater-layout-hint">
              Клик по софиту — панель настроек. Режим «Ячейка»: клик по сетке на плане или полу
              ставит цель активного софита в центр ячейки.
            </p>
            <div className="theater-model-context-menu__row">
              <TheaterBtn
                active={vm.spotlightAimMode === "point"}
                onClick={() => vm.setSpotlightAimMode("point")}
                disabled={!vm.currentStep}
              >
                Точка
              </TheaterBtn>
              <TheaterBtn
                active={vm.spotlightAimMode === "cell"}
                onClick={() => vm.setSpotlightAimMode("cell")}
                disabled={!vm.currentStep}
              >
                Ячейка
              </TheaterBtn>
            </div>
          </TheaterCollapsibleSection>
</>
  );
}
