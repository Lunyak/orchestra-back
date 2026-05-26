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

export function TheaterControlsSpotlightsRgbSection({ vm, spot }: SpotlightsSectionProps) {
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
            sectionId="spotlights-rgb"
            title="RGB"
            summary="Цветные софиты"
            badge={rgbSpotlights.length > 0 ? String(rgbSpotlights.length) : undefined}
          >
            <div className="theater-spotlight-list theater-spotlight-list--scroll">
            {rgbSpotlights.map((item) => (
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
                  title="Удалить RGB"
                  onClick={() => vm.removeSpotlight(item.id)}
                >
                  ×
                </TheaterBtn>
              </div>
            ))}
            {vm.spotlightsConfigured && rgbSpotlights.length === 0 && (
              <span className="theater-spotlight-empty">RGB нет</span>
            )}
            </div>
            <div className="theater-btn-row">
              <TheaterBtn onClick={vm.addRgbSpotlight} disabled={!vm.currentStep}>
                + RGB
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.enableSpotlightsByType(true)}
                disabled={!vm.currentStep}
              >
                Вкл все
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.disableSpotlightsByType(true)}
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
                  value={rgbBatchCount}
                  onChange={(event) =>
                    setRgbBatchCount(Math.max(1, Math.min(64, Number(event.target.value) || 1)))
                  }
                  disabled={!vm.currentStep}
                />
              </TheaterField>
              <TheaterBtn
                disabled={!vm.currentStep}
                onClick={() => vm.addSpotlightsBatch(rgbBatchCount, 3, { isRgb: true })}
              >
                +{rgbBatchCount}×3
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep}
                onClick={() => vm.addSpotlightsBatch(rgbBatchCount, 4, { isRgb: true })}
              >
                +{rgbBatchCount}×4
              </TheaterBtn>
            </div>
            <div className="theater-layout-subtitle">Цвет всем RGB</div>
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterBtn
                onClick={() => vm.applyRgbColorToAll(tc("--color-success-accent"))}
                disabled={!vm.currentStep}
                title="Зеленый"
              >
                Зеленый
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.applyRgbColorToAll(tc("--color-primary-light"))}
                disabled={!vm.currentStep}
                title="Синий"
              >
                Синий
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.applyRgbColorToAll(tc("--color-light-pink"))}
                disabled={!vm.currentStep}
                title="Розовый"
              >
                Розовый
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.applyRgbColorToAll(tc("--color-warning-bright"))}
                disabled={!vm.currentStep}
                title="Желтый"
              >
                Желтый
              </TheaterBtn>
            </div>
            <label className="theater-color-field">
              <span className="theater-label">Цвет всем RGB</span>
              <input
                type="color"
                className="theater-color-input"
                value={vm.rgbBatchColor}
                onChange={(event) => vm.setRgbBatchColor(event.target.value)}
                disabled={!vm.currentStep}
              />
            </label>
            <TheaterBtn
              onClick={() => vm.applyRgbColorToAll(vm.rgbBatchColor)}
              disabled={!vm.currentStep}
              title="Применить выбранный цвет ко всем RGB"
            >
              Применить цвет
            </TheaterBtn>
          </TheaterCollapsibleSection>
</>
  );
}
