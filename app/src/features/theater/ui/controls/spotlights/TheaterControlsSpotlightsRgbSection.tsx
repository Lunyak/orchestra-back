import cn from "classnames";
import { LabeledCheckbox } from "../../../../../shared/core/labeled-checkbox/LabeledCheckbox";
import { tc, themeColorToHex } from "../../../../../shared/styles/theme-color";
import { THEATER_RGB_COLOR_PRESETS } from "../../../model/theater-rgb-color-presets";
import { TheaterBtn } from "../../theater-controls-ui";
import { TheaterSpotlightNavRow } from "./TheaterSpotlightNavRow";
import type { SpotlightsSectionProps } from "./types";

export function TheaterControlsSpotlightsRgbSection({ vm, spot }: SpotlightsSectionProps) {
  const activeRgbSpotlight = vm.activeSpotlight?.isRgb ? vm.activeSpotlight : null;
  const { rgbSpotlights } = spot;
  const allEnabled =
    rgbSpotlights.length > 0 && rgbSpotlights.every((item) => item.enabled !== false);

  return (
    <div className="theater-spotlight-nav-panel">
      <div className="theater-spotlight-nav-toolbar">
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
      </div>
      <div className="theater-sidebar-home theater-spotlight-nav-list">
        {rgbSpotlights.map((item) => (
          <TheaterSpotlightNavRow
            key={item.id}
            vm={vm}
            spot={spot}
            item={item}
            placeholder={`RGB ${item.id}`}
            deleteTitle="Удалить RGB"
          />
        ))}
        {vm.spotlightsConfigured && rgbSpotlights.length === 0 ? (
          <span className="theater-spotlight-empty">RGB нет</span>
        ) : null}
      </div>
      <div className="theater-spotlight-nav-footer">
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
      </div>
    </div>
  );
}
