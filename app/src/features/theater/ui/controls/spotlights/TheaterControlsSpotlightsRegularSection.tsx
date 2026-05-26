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

export function TheaterControlsSpotlightsRegularSection({ vm, spot }: SpotlightsSectionProps) {
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
            sectionId="spotlights-regular"
            title="Софиты"
            summary="Список и добавление"
            badge={regularSpotlights.length > 0 ? String(regularSpotlights.length) : undefined}
            defaultOpen
          >
            <div className="theater-spotlight-list theater-spotlight-list--scroll">
            {regularSpotlights.map((item) => (
              <div
                key={item.id}
                className={[
                  "theater-spotlight-tab",
                  selectedLightSlot > 0 &&
                  spotlightMatchesChannelSlot(item, selectedLightSlot)
                    ? "theater-spotlight-tab--slot-active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <TheaterBtn
                  active={
                    item.id === vm.activeSpotlightId ||
                    vm.multiSelectedSpotlightIds.includes(item.id)
                  }
                  onClick={(event) => vm.selectTheaterSpotlight(item.id, event.shiftKey)}
                  disabled={!vm.currentStep}
                >
                  {item.label}
                </TheaterBtn>
                <label className="theater-spotlight-channel">
                  Канал
                  <LightChannelSelect
                    lightChannels={lightChannels}
                    value={formatLightChannelSlot(item.channel ?? item.id)}
                    allowEmpty={false}
                    onChange={(channel) =>
                      vm.updateSpotlight(item.id, {
                        channel: Math.max(1, Number(channel) || 1),
                      })
                    }
                    disabled={!vm.currentStep}
                    className="native-text-input theater-channel-input"
                  />
                </label>
                <TheaterBtn
                  active={item.enabled !== false}
                  onClick={() =>
                    vm.updateSpotlight(item.id, {
                      enabled: !(item.enabled ?? true),
                    })
                  }
                  disabled={!vm.currentStep}
                  title={item.enabled === false ? "Включить" : "Выключить"}
                >
                  {item.enabled === false ? "Выкл" : "Вкл"}
                </TheaterBtn>
                <TheaterBtn
                  className="theater-btn--danger"
                  disabled={!vm.currentStep}
                  title="Удалить софит"
                  onClick={() => vm.removeSpotlight(item.id)}
                >
                  ×
                </TheaterBtn>
              </div>
            ))}
            {vm.spotlightsConfigured && regularSpotlights.length === 0 && (
              <span className="theater-spotlight-empty">Софитов нет</span>
            )}
            </div>
            <div className="theater-btn-row">
              <TheaterBtn onClick={vm.addSpotlight} disabled={!vm.currentStep}>
                + Софит
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.enableSpotlightsByType(false)}
                disabled={!vm.currentStep}
              >
                Вкл все
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.disableSpotlightsByType(false)}
                disabled={!vm.currentStep}
              >
                Выкл все
              </TheaterBtn>
            </div>
            <div className="theater-spotlight-batch">
              <TheaterField label="Пакет">
                <input
                  type="number"
                  className="native-text-input theater-batch-count"
                  min={1}
                  max={64}
                  step={1}
                  value={spotlightBatchCount}
                  onChange={(event) =>
                    setSpotlightBatchCount(
                      Math.max(1, Math.min(64, Number(event.target.value) || 1)),
                    )
                  }
                  disabled={!vm.currentStep}
                />
              </TheaterField>
              <TheaterBtn
                disabled={!vm.currentStep}
                onClick={() => vm.addSpotlightsBatch(spotlightBatchCount, 3)}
              >
                +{spotlightBatchCount}×3
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep}
                onClick={() => vm.addSpotlightsBatch(spotlightBatchCount, 4)}
              >
                +{spotlightBatchCount}×4
              </TheaterBtn>
            </div>
          </TheaterCollapsibleSection>
</>
  );
}
