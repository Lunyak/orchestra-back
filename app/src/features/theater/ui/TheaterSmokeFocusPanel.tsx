import type { TheaterSmokePosition } from "../model/theater-smoke-settings";
import {
  THEATER_SMOKE_INTENSITY_MAX,
  THEATER_SMOKE_INTENSITY_MIN,
  THEATER_SMOKE_INTENSITY_STEP,
  THEATER_SMOKE_SATURATION_MAX,
  THEATER_SMOKE_SATURATION_MIN,
  THEATER_SMOKE_SATURATION_STEP,
  THEATER_SMOKE_SIZE_MAX,
  THEATER_SMOKE_SIZE_MIN,
  THEATER_SMOKE_SIZE_STEP,
} from "../model/theater-smoke-settings";
import { TheaterBtn, TheaterField, TheaterRangeField } from "./theater-controls-ui";

export type TheaterSmokeFocusPanelProps = {
  position: TheaterSmokePosition;
  intensity: number;
  saturation: number;
  size: number;
  onPositionChange: (position: TheaterSmokePosition) => void;
  onIntensityChange: (value: number) => void;
  onSaturationChange: (value: number) => void;
  onSizeChange: (value: number) => void;
  onResetPosition: () => void;
  onHide: () => void;
  onDisable: () => void;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSize(value: number) {
  return `${value.toFixed(2)}×`;
}

function parseCoord(raw: string, fallback: number) {
  const next = Number(raw);
  return Number.isFinite(next) ? next : fallback;
}

export function TheaterSmokeFocusPanel({
  position,
  intensity,
  saturation,
  size,
  onPositionChange,
  onIntensityChange,
  onSaturationChange,
  onSizeChange,
  onResetPosition,
  onHide,
  onDisable,
}: TheaterSmokeFocusPanelProps) {
  const [x, y, z] = position;

  return (
    <div
      className="theater-focus-panel theater-focus-panel--scene"
      role="dialog"
      aria-label="Дым-машина"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="theater-focus-panel__title">
        <span>Дым-машина</span>
        <div className="theater-smoke-focus__title-actions">
          <TheaterBtn active={false} onClick={onHide} title="Скрыть панель, дым останется">
            Скрыть
          </TheaterBtn>
          <TheaterBtn active onClick={onDisable} title="Выключить дым">
            Выкл
          </TheaterBtn>
        </div>
      </div>

      <TheaterRangeField
        label="Интенсивность"
        min={THEATER_SMOKE_INTENSITY_MIN}
        max={THEATER_SMOKE_INTENSITY_MAX}
        step={THEATER_SMOKE_INTENSITY_STEP}
        value={intensity}
        formatValue={formatPercent}
        onChange={onIntensityChange}
      />
      <TheaterRangeField
        label="Насыщенность"
        min={THEATER_SMOKE_SATURATION_MIN}
        max={THEATER_SMOKE_SATURATION_MAX}
        step={THEATER_SMOKE_SATURATION_STEP}
        value={saturation}
        formatValue={formatPercent}
        onChange={onSaturationChange}
      />
      <TheaterRangeField
        label="Размер"
        min={THEATER_SMOKE_SIZE_MIN}
        max={THEATER_SMOKE_SIZE_MAX}
        step={THEATER_SMOKE_SIZE_STEP}
        value={size}
        formatValue={formatSize}
        onChange={onSizeChange}
      />

      <div className="theater-smoke-focus__coords">
        <TheaterField label="X">
          <input
            type="number"
            className="native-text-input"
            step={0.1}
            value={Number(x.toFixed(2))}
            aria-label="Позиция X"
            onChange={(event) => {
              onPositionChange([parseCoord(event.target.value, x), y, z]);
            }}
          />
        </TheaterField>
        <TheaterField label="Y">
          <input
            type="number"
            className="native-text-input"
            step={0.1}
            min={0.05}
            value={Number(y.toFixed(2))}
            aria-label="Позиция Y"
            onChange={(event) => {
              const nextY = Math.max(0.05, parseCoord(event.target.value, y));
              onPositionChange([x, nextY, z]);
            }}
          />
        </TheaterField>
        <TheaterField label="Z">
          <input
            type="number"
            className="native-text-input"
            step={0.1}
            value={Number(z.toFixed(2))}
            aria-label="Позиция Z"
            onChange={(event) => {
              onPositionChange([x, y, parseCoord(event.target.value, z)]);
            }}
          />
        </TheaterField>
      </div>

      <TheaterBtn active={false} onClick={onResetPosition} title="Вернуть в центр сцены">
        Точка по умолчанию
      </TheaterBtn>
      <p className="theater-smoke-focus__hint">В 3D можно тащить корпус машины гизмо.</p>
    </div>
  );
}
