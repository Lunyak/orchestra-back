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

export function TheaterControlsSpotlightsMultiSection({ vm, spot }: SpotlightsSectionProps) {
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
{vm.multiSelectedSpotlightIds.length >= 2 ? (
            <TheaterCollapsibleSection
              sectionId="spotlights-multi"
              title="Выделение"
              summary="Групповые действия"
              badge={String(vm.multiSelectedSpotlightIds.length)}
              defaultOpen
            >
              <div className="theater-btn-row theater-btn-row--3">
                <TheaterBtn
                  disabled={!vm.currentStep}
                  onClick={() => vm.aimSelectedSpotlightsAtStage()}
                >
                  Цель
                </TheaterBtn>
                <TheaterBtn
                  disabled={!vm.currentStep}
                  onClick={() => vm.assignSelectedSpotlightChannelsSequential()}
                >
                  Каналы
                </TheaterBtn>
                <TheaterBtn
                  disabled={!vm.currentStep}
                  onClick={vm.cloneSelectedSpotlights}
                >
                  Клон
                </TheaterBtn>
                <TheaterBtn
                  disabled={!vm.currentStep}
                  onClick={() => vm.setSelectedSpotlightsVisibility(true)}
                >
                  Скрыть
                </TheaterBtn>
                <TheaterBtn
                  disabled={!vm.currentStep}
                  onClick={() => vm.setSelectedSpotlightsVisibility(false)}
                >
                  Показать
                </TheaterBtn>
                <TheaterBtn disabled={!vm.currentStep} onClick={vm.removeSelectedSpotlights}>
                  Удалить
                </TheaterBtn>
              </div>
            </TheaterCollapsibleSection>
          ) : null}
</>
  );
}
