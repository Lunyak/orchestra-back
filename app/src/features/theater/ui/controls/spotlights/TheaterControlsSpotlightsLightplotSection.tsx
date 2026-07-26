import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn } from "../../theater-controls-ui";
import type { SpotlightsSectionProps } from "./types";

export function TheaterControlsSpotlightsLightplotSection({ vm, spot }: SpotlightsSectionProps) {
  const { spotlightCountBadge } = spot;
  return (
    <TheaterCollapsibleSection
      sectionId="spotlights-lightplot"
      title="Управление"
      badge={spotlightCountBadge}
      defaultOpen
    >
      <div className="theater-btn-row">
        <TheaterBtn
          disabled={!vm.currentScene}
          title="Ctrl+A"
          onClick={vm.selectAllVisibleInEditMode}
        >
          Выбрать все
        </TheaterBtn>
        <TheaterBtn
          disabled={
            !vm.currentScene ||
            (!vm.activeSpotlightId && vm.multiSelectedSpotlightIds.length === 0)
          }
          title="Esc"
          onClick={vm.clearSceneSelection}
        >
          Снять выдел.
        </TheaterBtn>
      </div>
      <div className="theater-btn-row">
        <TheaterBtn
          onClick={() => {
            vm.setLiveBlackoutEnabled(false);
            vm.fullLightAllSpotlights();
          }}
          disabled={!vm.currentScene}
        >
          Полный свет
        </TheaterBtn>
        <TheaterBtn
          active={vm.liveBlackoutEnabled}
          onClick={() => vm.setLiveBlackoutEnabled(!vm.liveBlackoutEnabled)}
          disabled={!vm.currentScene}
          title={
            vm.liveBlackoutEnabled
              ? "Снять блекаут — снова работают фейдеры"
              : "Блекаут: погасить сцену, фейдеры не менять"
          }
        >
          Блекаут
        </TheaterBtn>
      </div>
    </TheaterCollapsibleSection>
  );
}
