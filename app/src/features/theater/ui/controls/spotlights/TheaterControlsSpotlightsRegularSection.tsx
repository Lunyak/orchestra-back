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

export function TheaterControlsSpotlightsRegularSection({ vm, spot }: SpotlightsSectionProps) {
  const activeRegularSpotlight = vm.activeSpotlight?.isRgb ? null : vm.activeSpotlight;
  const {
    spotlightBatchCount,
    setSpotlightBatchCount,
    regularSpotlights,
    lightChannels,
    lightFaders,
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
                <SpotlightListNameInput
                  item={item}
                  active={
                    item.id === vm.activeSpotlightId ||
                    vm.multiSelectedSpotlightIds.includes(item.id)
                  }
                  disabled={!vm.currentScene}
                  placeholder={`Софит ${item.id}`}
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
            <LabeledCheckbox
              checked={activeRegularSpotlight?.modelLowDetail ?? false}
              onChange={(modelLowDetail) => {
                if (!activeRegularSpotlight) return;
                vm.updateSpotlight(activeRegularSpotlight.id, { modelLowDetail });
              }}
              disabled={!activeRegularSpotlight}
            >
              Упрощённая 3D-модель
            </LabeledCheckbox>
            <div className="theater-btn-row">
              <TheaterBtn onClick={vm.addSpotlight} disabled={!vm.currentScene}>
                + Софит
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.enableSpotlightsByType(false)}
                disabled={!vm.currentScene}
              >
                Вкл все
              </TheaterBtn>
              <TheaterBtn
                onClick={() => vm.disableSpotlightsByType(false)}
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
                  value={spotlightBatchCount}
                  onChange={(event) =>
                    setSpotlightBatchCount(
                      Math.max(1, Math.min(64, Number(event.target.value) || 1)),
                    )
                  }
                  disabled={!vm.currentScene}
                />
              </TheaterField>
              <TheaterBtn
                disabled={!vm.currentScene}
                onClick={() => vm.addSpotlightsBatch(spotlightBatchCount, 3)}
              >
                +{spotlightBatchCount}×3
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentScene}
                onClick={() => vm.addSpotlightsBatch(spotlightBatchCount, 4)}
              >
                +{spotlightBatchCount}×4
              </TheaterBtn>
            </div>
          </TheaterCollapsibleSection>
</>
  );
}
