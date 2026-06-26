import cn from "classnames";
import type { TheaterSpotlight } from "../../../shared/types/script";
import { useEffect, useState } from "react";
import {
  THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
  THEATER_SPOTLIGHT_UI_INTENSITY_MAX,
  THEATER_SPOTLIGHT_UI_INTENSITY_MIN,
  THEATER_SPOTLIGHT_UI_INTENSITY_STEP,
} from "../model/theater-scene-lighting";
import { formatGridCellLabel } from "../model/theater-zone-grid";
import {
  formatSpotlightChannelFaderShort,
} from "../model/theater-spotlight-labels";
import { TheaterRangeField } from "./theater-controls-ui";
import { tc } from "../../../shared/styles/theme-color";

export type TheaterSpotlightFocusPanelProps = {
  spotlight: TheaterSpotlight;
  dragMode: "target" | "source";
  showOnlyActive: boolean;
  onShowOnlyActiveChange: (value: boolean) => void;
  onToggleEnabled: () => void;
  onToggleHidden: () => void;
  onAimAtStage: () => void;
  onPickDragMode: (mode: "target" | "source") => void;
  onAngleChange: (angleDeg: number) => void;
  onIntensityChange: (intensity: number) => void;
  onColorChange: (color: string) => void;
  onLabelChange: (label: string) => void;
  onInteractStart?: () => void;
  onInteractEnd?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
  spotlightAimMode: "point" | "cell";
  onPickAimMode: (mode: "point" | "cell") => void;
  gridCol?: number;
  gridRow?: number;
  onClearGridBinding?: () => void;
};

export function TheaterSpotlightFocusPanel({
  spotlight,
  dragMode,
  showOnlyActive,
  onShowOnlyActiveChange,
  onToggleEnabled,
  onToggleHidden,
  onAimAtStage,
  onPickDragMode,
  onAngleChange,
  onIntensityChange,
  onColorChange,
  onLabelChange,
  onInteractStart,
  onInteractEnd,
  onClone,
  onDelete,
  spotlightAimMode,
  onPickAimMode,
  gridCol,
  gridRow,
  onClearGridBinding,
}: TheaterSpotlightFocusPanelProps) {
  const enabled = spotlight.enabled !== false;
  const hidden = spotlight.hidden === true;
  const defaultLabel = spotlight.isRgb ? `RGB ${spotlight.id}` : `Софит ${spotlight.id}`;
  const [labelDraft, setLabelDraft] = useState(spotlight.label);

  useEffect(() => {
    setLabelDraft(spotlight.label);
  }, [spotlight.id, spotlight.label]);

  const commitLabel = () => {
    const trimmed = labelDraft.trim();
    const next = trimmed || defaultLabel;
    if (next !== spotlight.label) {
      onLabelChange(next);
      return;
    }
    if (labelDraft !== spotlight.label) {
      setLabelDraft(spotlight.label);
    }
  };
  const hasGridBinding =
    gridCol != null &&
    gridRow != null &&
    Number.isFinite(gridCol) &&
    Number.isFinite(gridRow);

  return (
    <div
      className="theater-focus-panel theater-focus-panel--scene"
      role="dialog"
      aria-label={`Софит: ${spotlight.label}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="theater-focus-panel__title">
        <input
          type="text"
          className="native-text-input theater-focus-panel__title-input"
          value={labelDraft}
          placeholder={defaultLabel}
          aria-label="Название софита"
          onChange={(event) => setLabelDraft(event.target.value)}
          onBlur={commitLabel}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === "Enter") {
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              setLabelDraft(spotlight.label);
              event.currentTarget.blur();
            }
          }}
        />
        <span className="theater-focus-panel__tech">
          {formatSpotlightChannelFaderShort(spotlight)}
        </span>
      </div>
      <div className="theater-model-context-menu__row">
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            spotlightAimMode === "point" && "theater-model-context-menu__item--active",
          )}
          onClick={() => onPickAimMode("point")}
        >
          Точка
        </button>
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            spotlightAimMode === "cell" && "theater-model-context-menu__item--active",
          )}
          onClick={() => onPickAimMode("cell")}
        >
          Ячейка
        </button>
      </div>
      {hasGridBinding ? (
        <p className="theater-focus-panel__grid-bind">
          Ячейка {formatGridCellLabel(Math.trunc(gridCol!), Math.trunc(gridRow!))}
          {onClearGridBinding ? (
            <button
              type="button"
              className="theater-focus-panel__grid-bind-clear"
              onClick={onClearGridBinding}
            >
              снять
            </button>
          ) : null}
        </p>
      ) : spotlightAimMode === "cell" ? (
        <p className="theater-focus-panel__grid-bind theater-focus-panel__grid-bind--hint">
          Клик по ячейке на плане или полу сцены
        </p>
      ) : null}
      <div className="theater-model-context-menu__row">
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            enabled && "theater-model-context-menu__item--active",
          )}
          onClick={onToggleEnabled}
        >
          {enabled ? "Вкл" : "Выкл"}
        </button>
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            !hidden && "theater-model-context-menu__item--active",
          )}
          onClick={onToggleHidden}
        >
          {hidden ? "3D скрыт" : "3D виден"}
        </button>
      </div>
      <label className="theater-focus-panel__check">
        <input
          type="checkbox"
          checked={showOnlyActive}
          onChange={(event) => onShowOnlyActiveChange(event.target.checked)}
        />
        <span>Только этот в 3D</span>
      </label>
      <div className="theater-model-context-menu__row">
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            dragMode === "source" && "theater-model-context-menu__item--active",
          )}
          onClick={() => onPickDragMode("source")}
        >
          Источник
        </button>
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            dragMode === "target" && "theater-model-context-menu__item--active",
          )}
          onClick={() => onPickDragMode("target")}
        >
          Цель
        </button>
      </div>
      <button
        type="button"
        className="theater-model-context-menu__item"
        onClick={onAimAtStage}
      >
        На сцену
      </button>
      <TheaterRangeField
        label="Угол"
        min={5}
        max={60}
        step={1}
        value={spotlight.angleDeg ?? 20}
        formatValue={(v) => `${v}°`}
        onChange={onAngleChange}
        onInteractStart={onInteractStart}
        onInteractEnd={onInteractEnd}
      />
      <TheaterRangeField
        label="Свет"
        min={THEATER_SPOTLIGHT_UI_INTENSITY_MIN}
        max={THEATER_SPOTLIGHT_UI_INTENSITY_MAX}
        step={THEATER_SPOTLIGHT_UI_INTENSITY_STEP}
        value={spotlight.intensity ?? THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY}
        formatValue={(v) => v.toFixed(1)}
        onChange={onIntensityChange}
        onInteractStart={onInteractStart}
        onInteractEnd={onInteractEnd}
      />
      <label className="theater-color-field theater-focus-panel__color">
        <span className="theater-label">Цвет</span>
        <input
          type="color"
          className="theater-color-input"
          value={spotlight.color ?? tc("--color-warning")}
          onChange={(event) => onColorChange(event.target.value)}
        />
      </label>
      {onClone || onDelete ? (
        <div className="theater-model-context-menu__row">
          {onClone ? (
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact"
              onClick={onClone}
            >
              Клон
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact theater-model-context-menu__item--danger"
              onClick={onDelete}
            >
              Удалить
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
