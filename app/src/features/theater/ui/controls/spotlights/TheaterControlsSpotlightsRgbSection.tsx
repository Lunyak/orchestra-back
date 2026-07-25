import cn from "classnames";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { tc, themeColorToHex } from "../../../../../shared/styles/theme-color";
import {
  formatLightChannelSlot,
  spotlightMatchesChannelSlot,
} from "../../../model/theater-light-channel-link";
import { THEATER_RGB_COLOR_PRESETS } from "../../../model/theater-rgb-color-presets";
import { LightChannelSelect } from "../../LightChannelSelect";
import {
  formatCompactFaderLabel,
  readSpotlightFaderId,
} from "../../../model/theater-light-fader-bindings";
import { TheaterCollapsibleSection } from "../../TheaterCollapsibleSection";
import { TheaterBtn } from "../../theater-controls-ui";
import { SpotlightListNameInput } from "./SpotlightListNameInput";
import type { SpotlightsSectionProps } from "./types";

export function TheaterControlsSpotlightsRgbSection({ vm, spot }: SpotlightsSectionProps) {
  const activeRgbSpotlight = vm.activeSpotlight?.isRgb ? vm.activeSpotlight : null;
  const {
    rgbSpotlights,
    lightChannels,
    lightFaders,
    selectedLightSlot,
  } = spot;
  const allEnabled =
    rgbSpotlights.length > 0 && rgbSpotlights.every((item) => item.enabled !== false);

  return (
    <TheaterCollapsibleSection
      sectionId="spotlights-rgb"
      title="RGB"
      badge={rgbSpotlights.length > 0 ? String(rgbSpotlights.length) : undefined}
      headerActions={
        <>
          <TheaterBtn
            onClick={vm.addRgbSpotlight}
            disabled={!vm.currentScene}
            title="Добавить RGB"
          >
            +
          </TheaterBtn>
          <TheaterBtn
            className="theater-btn--visibility"
            active={allEnabled}
            disabled={!vm.currentScene || rgbSpotlights.length === 0}
            title={allEnabled ? "Выключить все" : "Включить все"}
            onClick={() => {
              if (allEnabled) vm.disableSpotlightsByType(true);
              else vm.enableSpotlightsByType(true);
            }}
          >
            <span className="theater-spotlight-power-dot" />
          </TheaterBtn>
        </>
      }
    >
      <div className="theater-spotlight-list theater-spotlight-list--scroll">
        {rgbSpotlights.map((item) => {
          const isSlotActive =
            selectedLightSlot > 0 && spotlightMatchesChannelSlot(item, selectedLightSlot);
          const isSelected =
            item.id === vm.activeSpotlightId ||
            vm.multiSelectedSpotlightIds.includes(item.id);
          return (
            <div
              key={item.id}
              className={cn("theater-spotlight-tab", isSlotActive && "theater-spotlight-tab--slot-active")}
            >
              <SpotlightListNameInput
                item={item}
                active={isSelected}
                disabled={!vm.currentScene}
                placeholder={`RGB ${item.id}`}
                onSelect={(shiftKey) => vm.selectTheaterSpotlight(item.id, shiftKey)}
                onLabelCommit={(label) => vm.updateSpotlight(item.id, { label })}
              />
              <label
                className="theater-spotlight-channel theater-spotlight-channel--compact"
                title="K — канал"
              >
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
                  className="theater-channel-input theater-channel-input--channel"
                />
              </label>
              <label
                className="theater-spotlight-channel theater-spotlight-channel--compact"
                title="F — фейдер"
              >
                <select
                  className="native-select theater-channel-input theater-channel-input--fader"
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
                    },
                  )}
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
          );
        })}
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
      <div className="theater-layout-subtitle">Цвет всем RGB</div>
      <div className="theater-rgb-swatches" role="group" aria-label="Палитра RGB">
        {THEATER_RGB_COLOR_PRESETS.map((preset) => {
          const color = tc(preset.token);
          const hex = themeColorToHex(color)?.toLowerCase() ?? color.toLowerCase();
          const isActive = vm.rgbBatchColor.toLowerCase() === hex;
          return (
            <button
              key={preset.id}
              type="button"
              className={cn(
                "theater-rgb-swatch",
                `theater-rgb-swatch--${preset.id}`,
                isActive && "theater-rgb-swatch--active",
              )}
              title={preset.label}
              aria-label={preset.label}
              disabled={!vm.currentScene}
              onClick={() => {
                vm.setRgbBatchColor(hex);
                vm.applyRgbColorToAll(color);
              }}
            />
          );
        })}
        <label
          className={cn("theater-rgb-swatch", "theater-rgb-swatch--custom")}
          title="Свой цвет"
        >
          <input
            type="color"
            className="theater-rgb-swatch__picker"
            value={vm.rgbBatchColor}
            disabled={!vm.currentScene}
            onChange={(event) => {
              const nextColor = event.target.value;
              vm.setRgbBatchColor(nextColor);
              vm.applyRgbColorToAll(nextColor);
            }}
          />
        </label>
      </div>
    </TheaterCollapsibleSection>
  );
}
