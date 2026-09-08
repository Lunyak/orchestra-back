import cn from "classnames";
import { useEffect, useState } from "react";
import { LabeledCheckbox } from "../../../shared/core/labeled-checkbox/LabeledCheckbox";
import type { ModelPlacementPreset } from "../model/theater-model-placement";
import type { TheaterModelWorldSize } from "../model/theater-model-world-size";
import { TheaterModelSizeFields } from "./TheaterModelSizeFields";

export type TheaterModelTransformMode = "translate" | "rotate" | "scale";

const PLACEMENT_GRID_COLUMN_CLASSES: Record<number, string> = {
  1: "theater-model-placement-map__grid--cols-1",
  2: "theater-model-placement-map__grid--cols-2",
  3: "theater-model-placement-map__grid--cols-3",
  4: "theater-model-placement-map__grid--cols-4",
  5: "theater-model-placement-map__grid--cols-5",
  6: "theater-model-placement-map__grid--cols-6",
  7: "theater-model-placement-map__grid--cols-7",
  8: "theater-model-placement-map__grid--cols-8",
  9: "theater-model-placement-map__grid--cols-9",
  10: "theater-model-placement-map__grid--cols-10",
  11: "theater-model-placement-map__grid--cols-11",
  12: "theater-model-placement-map__grid--cols-12",
};

function TransformModeIcon({ mode }: { mode: TheaterModelTransformMode }) {
  if (mode === "rotate") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M18.5 8A7 7 0 1 0 19 15" />
        <path d="M18.5 3v5h-5" />
      </svg>
    );
  }
  if (mode === "scale") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden>
        <path d="M8 3H3v5M16 21h5v-5M3 3l7 7M21 21l-7-7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M22 12l-3-3M22 12l-3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3" />
    </svg>
  );
}

function VisibilityIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {hidden ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

export type TheaterModelFocusPanelProps = {
  modelName: string;
  modelId: number;
  onNameChange?: (name: string) => void;
  size?: TheaterModelWorldSize | null;
  sizeAxisLabels?: Record<keyof TheaterModelWorldSize, string>;
  onSizeCommit?: (next: Partial<TheaterModelWorldSize>) => void;
  transformMode: TheaterModelTransformMode;
  showDecorActions: boolean;
  hidden?: boolean;
  onToggleHidden?: () => void;
  isRequisite?: boolean;
  onToggleRequisite?: (next: boolean) => void;
  onPickTransform: (mode: TheaterModelTransformMode) => void;
  onRotateQuarter: (direction: "cw" | "ccw") => void;
  placementGrid?: { cols: number; rows: number };
  onPlace?: (preset: ModelPlacementPreset) => void;
  onResetTransform?: () => void;
  onClone?: () => void;
  onDelete?: () => void;
};

export function TheaterModelFocusPanel({
  modelName,
  modelId,
  onNameChange,
  size,
  sizeAxisLabels,
  onSizeCommit,
  transformMode,
  showDecorActions,
  hidden = false,
  onToggleHidden,
  isRequisite = false,
  onToggleRequisite,
  onPickTransform,
  onRotateQuarter,
  placementGrid,
  onPlace,
  onResetTransform,
  onClone,
  onDelete,
}: TheaterModelFocusPanelProps) {
  const defaultName = `Модель ${modelId}`;
  const [nameDraft, setNameDraft] = useState(modelName);

  useEffect(() => {
    setNameDraft(modelName);
  }, [modelId, modelName]);

  const commitName = () => {
    if (!onNameChange) return;
    const trimmed = nameDraft.trim();
    const next = trimmed || defaultName;
    if (next !== modelName) {
      onNameChange(next);
      return;
    }
    if (nameDraft !== modelName) {
      setNameDraft(modelName);
    }
  };

  const placementCells = placementGrid
    ? Array.from(
        { length: placementGrid.cols * placementGrid.rows },
        (_, index) => ({
          col: index % placementGrid.cols,
          row: Math.floor(index / placementGrid.cols),
        }),
      )
    : [];
  const placementGridClass = placementGrid
    ? PLACEMENT_GRID_COLUMN_CLASSES[placementGrid.cols]
    : undefined;

  return (
    <div
      className="theater-focus-panel theater-focus-panel--scene"
      role="dialog"
      aria-label={`Объект: ${modelName}`}
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="theater-focus-panel__title">
        {onNameChange ? (
          <input
            type="text"
            className="theater-focus-panel__title-input"
            value={nameDraft}
            placeholder={defaultName}
            aria-label="Название модели"
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={commitName}
            onKeyDown={(event) => {
              event.stopPropagation();
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                setNameDraft(modelName);
                event.currentTarget.blur();
              }
            }}
          />
        ) : (
          <span>{modelName}</span>
        )}
        {onToggleHidden ? (
          <button
            type="button"
            className={cn(
              "theater-focus-panel__visibility",
              hidden && "theater-focus-panel__visibility--hidden",
            )}
            aria-label={hidden ? "Показать модель" : "Скрыть модель"}
            title={hidden ? "Показать модель" : "Скрыть модель"}
            onClick={onToggleHidden}
          >
            <VisibilityIcon hidden={hidden} />
          </button>
        ) : null}
      </div>
      {size && onSizeCommit ? (
        <TheaterModelSizeFields
          size={size}
          labels={sizeAxisLabels}
          className="theater-focus-panel__size-fields"
          onCommit={onSizeCommit}
        />
      ) : null}
      {onToggleRequisite ? (
        <LabeledCheckbox
          className="theater-focus-panel__requisite"
          checked={isRequisite}
          onChange={onToggleRequisite}
        >
          Реквизит
        </LabeledCheckbox>
      ) : null}
      <div className="theater-model-context-menu__row theater-model-focus-transform-row">
        {(["translate", "rotate", "scale"] as const).map((mode) => {
          const label =
            mode === "translate"
              ? "Перемещение"
              : mode === "rotate"
                ? "Вращение"
                : "Масштаб";
          return (
            <button
              key={mode}
              type="button"
              aria-label={label}
              title={label}
              className={cn(
                "theater-model-context-menu__item",
                "theater-model-context-menu__item--compact",
                "theater-model-focus-transform-btn",
                transformMode === mode &&
                  "theater-model-context-menu__item--active",
              )}
              onClick={() => onPickTransform(mode)}
            >
              <TransformModeIcon mode={mode} />
            </button>
          );
        })}
      </div>
      <div className="theater-model-context-menu__row">
        <button
          type="button"
          className="theater-model-context-menu__item theater-model-context-menu__item--compact"
          onClick={() => onRotateQuarter("ccw")}
        >
          ↺ 90°
        </button>
        <button
          type="button"
          className="theater-model-context-menu__item theater-model-context-menu__item--compact"
          onClick={() => onRotateQuarter("cw")}
        >
          ↻ 90°
        </button>
      </div>
      {showDecorActions && onPlace && placementGrid ? (
        <>
          <div className="theater-model-context-menu__section">
            Позиция · {placementGrid.cols}×{placementGrid.rows}
          </div>
          <div className="theater-model-placement-map">
            <span className="theater-model-placement-map__edge">Задник</span>
            <div
              className={cn(
                "theater-model-placement-map__grid",
                placementGridClass,
              )}
              role="group"
              aria-label="Быстрая позиция модели на сцене"
            >
              {placementCells.map((cell) => {
                const cellLabel = `Ряд ${cell.row + 1}, колонка ${cell.col + 1}`;
                return (
                <button
                  key={`${cell.col}-${cell.row}`}
                  type="button"
                  className="theater-model-placement-map__cell"
                  aria-label={cellLabel}
                  title={cellLabel}
                  onClick={() => onPlace(cell)}
                >
                  <span className="theater-model-placement-map__marker" />
                </button>
                );
              })}
            </div>
            <span className="theater-model-placement-map__edge">Авансцена</span>
          </div>
        </>
      ) : null}
      {onResetTransform || onClone ? (
        <div className="theater-model-context-menu__row">
          {onResetTransform ? (
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact"
              onClick={onResetTransform}
              title="Позиция 0, вращение 0°, масштаб 1"
            >
              Сбросить
            </button>
          ) : null}
          {onClone ? (
            <button
              type="button"
              className="theater-model-context-menu__item theater-model-context-menu__item--compact"
              onClick={onClone}
            >
              Клонировать
            </button>
          ) : null}
        </div>
      ) : null}
      {onDelete ? (
        <div className="theater-model-context-menu__row">
          <button
            type="button"
            className="theater-model-context-menu__item theater-model-context-menu__item--compact theater-model-context-menu__item--danger"
            onClick={onDelete}
          >
            Удалить
          </button>
        </div>
      ) : null}
    </div>
  );
}
