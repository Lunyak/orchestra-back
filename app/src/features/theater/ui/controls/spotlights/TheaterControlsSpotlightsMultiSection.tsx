import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn } from "../../theater-controls-ui";
import type { SpotlightsSectionProps } from "./types";

export function TheaterControlsSpotlightsMultiSection({ vm }: SpotlightsSectionProps) {
  if (vm.multiSelectedSpotlightIds.length < 2) return null;

  return (
    <TheaterCollapsibleSection
      sectionId="spotlights-multi"
      title="Выделение"
      summary="Групповые действия"
      badge={String(vm.multiSelectedSpotlightIds.length)}
      defaultOpen
    >
      <div className="theater-btn-row theater-btn-row--3">
        <TheaterBtn
          disabled={!vm.currentScene}
          onClick={() => vm.aimSelectedSpotlightsAtStage()}
        >
          Цель
        </TheaterBtn>
        <TheaterBtn
          disabled={!vm.currentScene}
          onClick={() => vm.assignSelectedSpotlightChannelsSequential()}
        >
          Каналы
        </TheaterBtn>
        <TheaterBtn disabled={!vm.currentScene} onClick={vm.cloneSelectedSpotlights}>
          Клон
        </TheaterBtn>
        <TheaterBtn
          disabled={!vm.currentScene}
          onClick={() => vm.setSelectedSpotlightsVisibility(true)}
        >
          Скрыть
        </TheaterBtn>
        <TheaterBtn
          disabled={!vm.currentScene}
          onClick={() => vm.setSelectedSpotlightsVisibility(false)}
        >
          Показать
        </TheaterBtn>
        <TheaterBtn disabled={!vm.currentScene} onClick={vm.removeSelectedSpotlights}>
          Удалить
        </TheaterBtn>
      </div>
    </TheaterCollapsibleSection>
  );
}
