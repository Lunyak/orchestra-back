import cn from "classnames";
import type { TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import { useEffect, useMemo, useState } from "react";
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
import {
  getLightTrussMountPoint,
  getOccupiedTrussMountPointIds,
  LIGHT_TRUSS_6M_MOUNT_POINTS,
} from "../model/theater-truss-mounts";

function VisibilityIcon({ hidden }: { hidden: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" />
      <circle cx="12" cy="12" r="2.5" />
      {hidden ? <path d="M4 4l16 16" /> : null}
    </svg>
  );
}

export type TheaterSpotlightFocusPanelProps = {
  spotlight: TheaterSpotlight;
  dragMode: "target" | "source";
  onToggleEnabled: () => void;
  onToggleHidden: () => void;
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
  trusses: TheaterModel[];
  spotlights: TheaterSpotlight[];
  onAttachToTruss: (mountModelId: number, mountPointId: string) => void;
  onDetachFromTruss: () => void;
};

export function TheaterSpotlightFocusPanel({
  spotlight,
  dragMode,
  onToggleEnabled,
  onToggleHidden,
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
  trusses,
  spotlights,
  onAttachToTruss,
  onDetachFromTruss,
}: TheaterSpotlightFocusPanelProps) {
  const enabled = spotlight.enabled !== false;
  const hidden = spotlight.hidden === true;
  const defaultLabel = spotlight.isRgb ? `RGB ${spotlight.id}` : `Софит ${spotlight.id}`;
  const [labelDraft, setLabelDraft] = useState(spotlight.label);
  const [selectedTrussId, setSelectedTrussId] = useState<number | null>(
    spotlight.mountModelId ?? trusses[0]?.id ?? null,
  );
  const [selectedMountPointId, setSelectedMountPointId] = useState("");

  useEffect(() => {
    setLabelDraft(spotlight.label);
  }, [spotlight.id, spotlight.label]);

  useEffect(() => {
    setSelectedTrussId(spotlight.mountModelId ?? trusses[0]?.id ?? null);
  }, [spotlight.id, spotlight.mountModelId, trusses]);

  const occupiedMountPointIds = useMemo(
    () =>
      selectedTrussId == null
        ? new Set<string>()
        : getOccupiedTrussMountPointIds(
            spotlights,
            selectedTrussId,
            spotlight.id,
          ),
    [selectedTrussId, spotlight.id, spotlights],
  );
  const availableMountPoints = LIGHT_TRUSS_6M_MOUNT_POINTS.filter(
    (point) => !occupiedMountPointIds.has(point.id),
  );

  useEffect(() => {
    const currentPointAvailable = availableMountPoints.some(
      (point) => point.id === selectedMountPointId,
    );
    if (currentPointAvailable) return;
    setSelectedMountPointId(availableMountPoints[0]?.id ?? "");
  }, [availableMountPoints, selectedMountPointId]);

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
  const mountedTruss = trusses.find((truss) => truss.id === spotlight.mountModelId);
  const mountedPoint = getLightTrussMountPoint(spotlight.mountPointId);
  const sourceIsMounted = Boolean(mountedTruss && mountedPoint);

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
          className="theater-focus-panel__title-input"
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
        <button
          type="button"
          className={cn(
            "theater-focus-panel__power",
            enabled && "theater-focus-panel__power--on",
          )}
          aria-label={enabled ? "Выключить" : "Включить"}
          title={enabled ? "Выключить" : "Включить"}
          onClick={onToggleEnabled}
        >
          <span className="theater-spotlight-power-dot" />
        </button>
        <button
          type="button"
          className={cn(
            "theater-focus-panel__visibility",
            hidden && "theater-focus-panel__visibility--hidden",
          )}
          aria-label={hidden ? "Показать софит" : "Скрыть софит"}
          title={hidden ? "Показать софит" : "Скрыть софит"}
          onClick={onToggleHidden}
        >
          <VisibilityIcon hidden={hidden} />
        </button>
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
      {sourceIsMounted ? (
        <p className="theater-focus-panel__grid-bind">
          {mountedTruss?.name} · {mountedPoint?.label}
          <button
            type="button"
            className="theater-focus-panel__grid-bind-clear"
            onClick={onDetachFromTruss}
          >
            снять
          </button>
        </p>
      ) : (
        <>
          <label className="theater-field">
            <span className="theater-label">Ферма</span>
            <select
              className="native-text-input"
              value={selectedTrussId ?? ""}
              onChange={(event) => setSelectedTrussId(Number(event.target.value) || null)}
              disabled={trusses.length === 0}
            >
              {trusses.length === 0 ? <option value="">Ферм нет</option> : null}
              {trusses.map((truss) => (
                <option key={truss.id} value={truss.id}>
                  {truss.name}
                </option>
              ))}
            </select>
          </label>
          <label className="theater-field">
            <span className="theater-label">Точка крепления</span>
            <select
              className="native-text-input"
              value={selectedMountPointId}
              onChange={(event) => setSelectedMountPointId(event.target.value)}
              disabled={availableMountPoints.length === 0}
            >
              {availableMountPoints.length === 0 ? (
                <option value="">Свободных точек нет</option>
              ) : null}
              {availableMountPoints.map((point) => (
                <option key={point.id} value={point.id}>
                  {point.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="theater-model-context-menu__item"
            disabled={selectedTrussId == null || !selectedMountPointId}
            onClick={() => {
              if (selectedTrussId == null || !selectedMountPointId) return;
              onAttachToTruss(selectedTrussId, selectedMountPointId);
            }}
          >
            Повесить на ферму
          </button>
        </>
      )}
      <div className="theater-model-context-menu__row">
        <button
          type="button"
          className={cn(
            "theater-model-context-menu__item",
            "theater-model-context-menu__item--compact",
            dragMode === "source" && "theater-model-context-menu__item--active",
          )}
          onClick={() => onPickDragMode("source")}
          disabled={sourceIsMounted}
          title={sourceIsMounted ? "Источник закреплён на ферме" : undefined}
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
