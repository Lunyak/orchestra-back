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

export function TheaterControlsSpotlightsSceneSection({ vm, spot }: SpotlightsSectionProps) {
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
            sectionId="spotlights-scene"
            title="Сцена"
            summary="Копирование, блекаут"
            badge={spotlightCountBadge}
          >
            <div className="theater-btn-row">
              <TheaterBtn
                onClick={vm.copyFromPreviousScene}
                disabled={!vm.currentScene || vm.currentPage === 0}
              >
                Софиты ← сцена
              </TheaterBtn>
              <TheaterBtn
                onClick={vm.copyTheaterFromPreviousScene}
                disabled={!vm.currentScene || vm.currentPage === 0}
              >
                Расстановка ← сцена
              </TheaterBtn>
            </div>
            <div className="theater-btn-row">
              <TheaterBtn
                onClick={vm.copyTheaterToNextScene}
                disabled={!vm.currentScene || vm.currentPage >= vm.sceneCount - 1}
              >
                Расстановка → сцена
              </TheaterBtn>
              <TheaterBtn
                active={vm.dutyLightEnabled}
                onClick={() => vm.setDutyLightEnabled(!vm.dutyLightEnabled)}
                title={
                  vm.dutyLightEnabled
                    ? "Выключить рабочий свет: останутся только софиты"
                    : "Включить рабочий свет сцены"
                }
              >
                Дежурка
              </TheaterBtn>
              <TheaterBtn onClick={vm.fullLightAllSpotlights} disabled={!vm.currentScene}>
                Полный свет
              </TheaterBtn>
              <TheaterBtn onClick={vm.blackoutAllSpotlights} disabled={!vm.currentScene}>
                Блекаут
              </TheaterBtn>
            </div>
          </TheaterCollapsibleSection>
</>
  );
}
