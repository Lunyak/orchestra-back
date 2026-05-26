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

export function TheaterControlsSpotlightsLayoutSection({ vm, spot }: SpotlightsSectionProps) {
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
    spotlightSourceHeightLabel,
  } = spot;
  return (
<>
<TheaterCollapsibleSection
            sectionId="spotlights-layout"
            title="Расстановка"
            summary="Сетка по залу, пресеты"
          >
            <p className="theater-layout-hint">
              Сетка по залу: N рядов, в ряду 3 или 4. Ctrl+Z — отмена.
            </p>
            <div className="theater-spotlight-batch">
              <TheaterField label="Рядов">
                <input
                  type="number"
                  className="native-text-input theater-batch-count"
                  min={1}
                  max={32}
                  step={1}
                  value={spotlightLayoutRows}
                  onChange={(event) =>
                    setSpotlightLayoutRows(
                      Math.max(1, Math.min(32, Number(event.target.value) || 1)),
                    )
                  }
                  disabled={!vm.currentStep}
                />
              </TheaterField>
            </div>
            <div className="theater-layout-subtitle">Сетка по залу</div>
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterBtn
                disabled={!vm.currentStep || regularSpotlights.length === 0}
                onClick={() =>
                  vm.layoutSpotlightsInHallGrid("regular", spotlightLayoutRows, 3)
                }
              >
                Соф.×3
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || regularSpotlights.length === 0}
                onClick={() =>
                  vm.layoutSpotlightsInHallGrid("regular", spotlightLayoutRows, 4)
                }
              >
                Соф.×4
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || rgbSpotlights.length === 0}
                onClick={() => vm.layoutSpotlightsInHallGrid("rgb", spotlightLayoutRows, 3)}
              >
                RGB×3
              </TheaterBtn>
            </div>
            <div className="theater-btn-row">
              <TheaterBtn
                disabled={!vm.currentStep || rgbSpotlights.length === 0}
                onClick={() => vm.layoutSpotlightsInHallGrid("rgb", spotlightLayoutRows, 4)}
              >
                RGB×4
              </TheaterBtn>
            </div>
            <div className="theater-layout-subtitle">Пресеты раскладки</div>
            <div className="theater-btn-row theater-btn-row--3">
              {vm.spotlightLayoutPresets.map((preset) => (
                <TheaterBtn
                  key={preset.id}
                  disabled={!vm.currentStep || regularSpotlights.length === 0}
                  title={preset.description}
                  onClick={() => vm.applySpotlightLayoutPreset("regular", preset.id)}
                >
                  {preset.label}
                </TheaterBtn>
              ))}
            </div>
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterBtn
                disabled={!vm.currentStep || regularSpotlights.length === 0}
                onClick={() => vm.assignSpotlightChannelsSequential("regular")}
              >
                Кан. соф.
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || rgbSpotlights.length === 0}
                onClick={() => vm.assignSpotlightChannelsSequential("rgb")}
              >
                Кан. RGB
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep}
                onClick={() => vm.spawnSpotlightsFromLayoutPreset("classic-6", 6, false)}
              >
                +6 класс.
              </TheaterBtn>
            </div>
            <div className="theater-layout-subtitle">
              Выравнивание · высота {spotlightSourceHeightLabel}
            </div>
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterBtn
                disabled={!vm.currentStep || totalSpotlights === 0}
                onClick={() => vm.aimSpotlightsAtStage("all")}
              >
                Цель
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || totalSpotlights === 0}
                onClick={() => vm.alignSpotlightsSourceHeight("all")}
                title="Выровнять все обычные и RGB-софиты по средней текущей высоте"
              >
                Ровная высота
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || totalSpotlights === 0 || !vm.snapToGrid}
                onClick={() => vm.snapAllSpotlightsToGrid("all")}
              >
                К сетке
              </TheaterBtn>
            </div>
            <div className="theater-btn-row theater-btn-row--3">
              <TheaterBtn
                disabled={!vm.currentStep || totalSpotlights === 0}
                onClick={() => vm.nudgeSpotlightsSourceHeight("all", 0.5)}
                title="Поднять все источники софитов на 0.5 м"
              >
                Выше
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || totalSpotlights === 0}
                onClick={() => vm.nudgeSpotlightsSourceHeight("all", -0.5)}
                title="Опустить все источники софитов на 0.5 м"
              >
                Ниже
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || totalSpotlights === 0}
                onClick={() => vm.alignSpotlightsSourceHeight("all", 6)}
                title="Поставить все источники софитов на 6 м"
              >
                6 м
              </TheaterBtn>
            </div>
            <div className="theater-btn-row">
              <TheaterBtn
                disabled={!vm.currentStep || regularSpotlights.length === 0}
                onClick={() => vm.layoutSpotlightsBeforeAudience("regular")}
              >
                Перед залом
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || rgbSpotlights.length === 0}
                onClick={() => vm.layoutSpotlightsBeforeAudience("rgb")}
              >
                RGB перед
              </TheaterBtn>
              <TheaterBtn
                disabled={!vm.currentStep || rgbSpotlights.length === 0}
                onClick={() => vm.aimSpotlightsStraightDown("rgb")}
                title="Направить все RGB-софиты строго вниз под каждый прибор"
              >
                RGB вниз
              </TheaterBtn>
            </div>
            <div className="theater-layout-subtitle">Пресеты луча (активный)</div>
            <div className="theater-btn-row theater-btn-row--3">
              {vm.spotlightPresets.map((preset) => (
                <TheaterBtn
                  key={preset.id}
                  disabled={!vm.currentStep || !vm.activeSpotlightId}
                  title={preset.description}
                  onClick={() => vm.applySpotlightPreset(preset.id, "active")}
                >
                  {preset.label}
                </TheaterBtn>
              ))}
            </div>
          </TheaterCollapsibleSection>
</>
  );
}
