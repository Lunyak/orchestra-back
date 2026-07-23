import { tc } from "../../../../../shared/styles/theme-color";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import {
  formatLightChannelSlot,
  spotlightMatchesChannelSlot,
} from "../../../model/theater-light-channel-link";
import { LightChannelSelect } from "../../LightChannelSelect";
import {
  formatCompactFaderLabel,
  readSpotlightFaderId,
} from "../../../model/theater-light-fader-bindings";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn, TheaterField } from "../../theater-controls-ui";
import { SpotlightListNameInput } from "./SpotlightListNameInput";
import type { SpotlightsSectionProps } from "./types";

export function TheaterControlsSpotlightsRgbSection({ vm, spot }: SpotlightsSectionProps) {
  const activeRgbSpotlight = vm.activeSpotlight?.isRgb ? vm.activeSpotlight : null;
  const {
    rgbBatchCount,
    setRgbBatchCount,
    rgbSpotlights,
    lightChannels,
    lightFaders,
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
                <SpotlightListNameInput
                  item={item}
                  active={
                    item.id === vm.activeSpotlightId ||
                    vm.multiSelectedSpotlightIds.includes(item.id)
                  }
                  disabled={!vm.currentScene}
                  placeholder={`RGB ${item.id}`}
                  onSelect={(shiftKey) => vm.selectTheaterSpotlight(item.id, shiftKey)}
                  onLabelCommit={(label) => vm.updateSpotlight(item.id, { label })}
                />
                <label className="theater-spotlight-channel theater-spotlight-channel--compact" title="K — канал">
                  <LightChannelSelect
                    lightChannels={lightChannels}
                    value={formatLightChannelSlot(item.channel ?? item.id)}
                    allowEmpty={false}
                    onChange={(channel) => {
                      const nextChannel = Math.max(1, Number(channel) || 1);
                      vm.updateSpotlight(item.id, { channel: nextChannel });
                      const faderId = readSpotlightFaderId(item);
                      if (faderId != null) {
                        spot.bindSpotlightToFader(faderId, item.id, nextChannel);
                      }
                    }}
                    disabled={!vm.currentScene}
                    className="native-text-input theater-channel-input theater-channel-input--channel"
                  />
                </label>
                <label className="theater-spotlight-channel theater-spotlight-channel--compact" title="F — фейдер">
                  <select
                    className="native-text-input theater-channel-input theater-channel-input--fader"
                    value={
                      readSpotlightFaderId(item) != null
                        ? String(readSpotlightFaderId(item))
                        : ""
                    }
                    disabled={!vm.currentScene}
                    onChange={(event) => {
                      const raw = event.target.value.trim();
                      if (!raw) {
                        vm.updateSpotlight(item.id, { faderId: undefined });
                        spot.unbindSpotlightFromFader(item.id);
                        return;
                      }
                      const faderId = Math.max(1, Number(raw) || 1);
                      const channel = item.channel ?? item.id;
                      vm.updateSpotlight(item.id, { faderId });
                      spot.bindSpotlightToFader(faderId, item.id, channel);
                    }}
                  >
                    <option value="">—</option>
                    {Array.from(
                      {
                        length: Math.max(lightFaders.length, 8),
                      },
                      (_, index) => {
                      const faderId = index + 1;
                      return (
                        <option key={faderId} value={faderId}>
                          {formatCompactFaderLabel(faderId)}
                        </option>
                      );
                    })}
                  </select>
                </label>
                <TheaterBtn
                  className="theater-btn--visibility"
                  active={item.enabled !== false}
                  onClick={() =>
                    vm.updateSpotlight(item.id, {
                      enabled: !(item.enabled ?? true),
                    })
                  }
                  disabled={!vm.currentScene}
                  title={item.enabled === false ? "Включить" : "Выключить"}
                >
                  <span className="theater-spotlight-power-dot" />
                </TheaterBtn>
                <TheaterBtn
                  className="theater-btn--danger"
                  disabled={!vm.currentScene}
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
            <LabeledCheckbox
              checked={activeRgbSpotlight?.modelLowDetail ?? false}
              onChange={(modelLowDetail) => {
                if (!activeRgbSpotlight) return;
                vm.updateSpotlight(activeRgbSpotlight.id, { modelLowDetail });
              }}
              disabled={!activeRgbSpotlight}
            >
              Упрощённая 3D-модель
            </LabeledCheckbox>
            <div className="theater-btn-row">
              <TheaterBtn onClick={vm.addRgbSpotlight} disabled={!vm.currentScene}>
                + RGB
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.enableSpotlightsByType(true)}
                disabled={!vm.currentScene}
              >
                Вкл все
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.disableSpotlightsByType(true)}
                disabled={!vm.currentScene}
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
                  disabled={!vm.currentScene}
                />
              </TheaterField>
              <TheaterBtn
                disabled={!vm.currentScene}
                onClick={() => vm.addSpotlightsBatch(rgbBatchCount, 3, { isRgb: true })}
              >
                +{rgbBatchCount}×3
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentScene}
                onClick={() => vm.addSpotlightsBatch(rgbBatchCount, 4, { isRgb: true })}
              >
                +{rgbBatchCount}×4
              </TheaterBtn>
            </div>
            <div className="theater-layout-subtitle">Цвет всем RGB</div>
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterBtn
                onClick={() => vm.applyRgbColorToAll(tc("--color-success-accent"))}
                disabled={!vm.currentScene}
                title="Зеленый"
              >
                Зеленый
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.applyRgbColorToAll(tc("--color-primary-light"))}
                disabled={!vm.currentScene}
                title="Синий"
              >
                Синий
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.applyRgbColorToAll(tc("--color-light-pink"))}
                disabled={!vm.currentScene}
                title="Розовый"
              >
                Розовый
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.applyRgbColorToAll(tc("--color-warning-bright"))}
                disabled={!vm.currentScene}
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
                disabled={!vm.currentScene}
              />
            </label>
            <TheaterBtn
              onClick={() => vm.applyRgbColorToAll(vm.rgbBatchColor)}
              disabled={!vm.currentScene}
              title="Применить выбранный цвет ко всем RGB"
            >
              Применить цвет
            </TheaterBtn>
          </TheaterCollapsibleSection>
</>
  );
}
