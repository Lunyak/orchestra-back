import { tc } from "../../../shared/styles/theme-color";
import { useCallback, useMemo, type Dispatch, type SetStateAction } from "react";
import type { ScriptStep, TheaterLayout, TheaterSpotlight } from "../../../shared/types/script";
import { DEFAULT_SPOTLIGHTS } from "../model/theater-defaults";
import {
  THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
  THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY,
} from "../model/theater-scene-lighting";
import {
  aimSpotlightsAt,
  applyLayoutSlotsToSpotlights,
  buildEvenLineBeforeAudience,
  buildSpotlightBatchSlots,
  buildSpotlightGridInHall,
  DEFAULT_SOURCE_Y,
  matchesSpotlightScope,
  mergeSpotlightPatches,
  setSpotlightsSourceHeight,
  snapSpotlightsToGrid,
  sortSpotlightsByX,
  STAGE_AIM_TARGET,
  type SpotlightLayoutScope,
  type SpotlightsPerLine,
} from "../model/spotlight-batch-layout";
import {
  applyLightPlotChannelsToSpotlights,
  assignSequentialChannelsOrdered,
  mergeLightPlotFromSpotlights,
  mergeSpotlightsFromLightPlot,
} from "../model/theater-light-channel-link";
import {
  aimSpotlightsByIds,
  cloneSpotlightsByIds,
  patchSpotlightsByIds,
  setSpotlightsVisibilityByIds,
} from "../model/theater-spotlight-selection";
import {
  applySpotlightPresetPatch,
  SPOTLIGHT_PRESETS,
  type SpotlightPresetId,
} from "../model/theater-spotlight-presets";
import {
  buildSpotlightLayoutPresetSlots,
  SPOTLIGHT_LAYOUT_PRESETS,
  type SpotlightLayoutPresetId,
} from "../model/theater-spotlight-layout-presets";
import {
  getGridCellCenter,
  patchLayoutZoneGrid,
  resolveStageGrid,
  formatGridCellLabel,
} from "../model/theater-zone-grid";
import type {
  SceneLightFadersDataV1,
  SceneLightProgramsDataV1,
} from "../../scene/model/scene-slice";
import { applyFadersToSpotlightsPerChannelDisplay } from "../model/theater-light-fader-bindings";
import type { TheaterEditMode } from "./use-theater-selection";

export type UseTheaterSpotlightsArgs = {
  currentStep: ScriptStep | undefined;
  updateCurrentStep: (patch: Partial<ScriptStep>) => void;
  recordTheaterHistory: () => void;
  layout: TheaterLayout;
  gridStep: number;
  activeSpotlightId: number | undefined;
  multiSelectedSpotlightIds: number[];
  setMultiSelectedSpotlightIds: Dispatch<SetStateAction<number[]>>;
  updateLayout: (patch: Partial<TheaterLayout>) => void;
  setEditMode: (mode: TheaterEditMode) => void;
  setDecorActionMessage: (message: string | null) => void;
  rehearsalSpotlights: TheaterSpotlight[] | null;
  lightFaders?: SceneLightFadersDataV1 | null;
  lightPrograms?: SceneLightProgramsDataV1 | null;
  /** Активный канал на пульте — живая доска только для этого K. */
  consoleChannel?: number;
};

const batchSpotlightColors = [
  tc("--color-warning"),
  tc("--color-light-yellow"),
  tc("--color-light-orange"),
  tc("--color-active-ascent"),
] as const;

function clampSpotlightSourceHeight(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_SOURCE_Y;
  return Math.max(0.5, Math.min(20, Math.round(value * 10) / 10));
}

function averageSpotlightSourceHeight(items: TheaterSpotlight[]) {
  if (items.length === 0) return DEFAULT_SOURCE_Y;
  const total = items.reduce((sum, item) => sum + item.position[1], 0);
  return clampSpotlightSourceHeight(total / items.length);
}

export function cloneTheaterSpotlights(source: TheaterSpotlight[]): TheaterSpotlight[] {
  return source.map((item) => ({
    ...item,
    position: [...item.position] as [number, number, number],
    target: [...item.target] as [number, number, number],
  }));
}

export function useTheaterSpotlights({
  currentStep,
  updateCurrentStep,
  recordTheaterHistory,
  layout,
  gridStep,
  activeSpotlightId,
  multiSelectedSpotlightIds,
  setMultiSelectedSpotlightIds,
  setEditMode,
  setDecorActionMessage,
  rehearsalSpotlights,
  lightFaders,
  lightPrograms,
  consoleChannel,
  updateLayout,
}: UseTheaterSpotlightsArgs) {
  const spotlightsRaw = currentStep?.theaterSpotlights;
  const spotlights = spotlightsRaw ?? [];
  const displaySpotlights =
    spotlightsRaw === undefined ? DEFAULT_SPOTLIGHTS : spotlightsRaw;
  const spotlightsConfigured = spotlightsRaw !== undefined;
  const activeSpotlight =
    activeSpotlightId != null
      ? displaySpotlights.find((item) => item.id === activeSpotlightId)
      : undefined;
  const renderSpotlights = useMemo(() => {
    const base = rehearsalSpotlights ?? displaySpotlights;
    return applyFadersToSpotlightsPerChannelDisplay(
      base,
      lightFaders,
      lightPrograms,
      consoleChannel,
    );
  }, [consoleChannel, displaySpotlights, lightFaders, lightPrograms, rehearsalSpotlights]);
  const visibleSpotlights = useMemo(
    () => renderSpotlights.filter((spotlight) => !spotlight.hidden),
    [renderSpotlights],
  );
  const stageGrid = useMemo(() => resolveStageGrid(layout), [layout]);

  const normalizeSpotlights = useCallback(
    (items: TheaterSpotlight[]) =>
      items.map((item, index) => {
        const nextId = Number(item.id) || index + 1;
        const rawLabel = item.label?.trim();
        const labelLooksLikeChannel =
          typeof rawLabel === "string" &&
          (/^(канал)\s*\d+$/i.test(rawLabel) || /^к\s*\d+$/i.test(rawLabel));
        return {
          id: nextId,
          label:
            rawLabel && !labelLooksLikeChannel
              ? rawLabel
              : `Софит ${nextId}`,
          position: item.position ?? [0, 6, 6],
          target: item.target ?? [0, 1, 2],
          angleDeg: Number.isFinite(item.angleDeg) ? item.angleDeg : 20,
          intensity: Number.isFinite(item.intensity)
            ? item.intensity
            : THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
          color: item.color,
          enabled: item.enabled ?? true,
          channel: Number.isFinite(item.channel) ? item.channel : nextId,
          ...(Number.isFinite(item.faderId)
            ? { faderId: Math.max(1, Math.trunc(item.faderId!)) }
            : {}),
          isRgb: item.isRgb ?? false,
          ...(item.hidden ? { hidden: true } : {}),
          ...(Number.isFinite(item.gridCol)
            ? { gridCol: Math.max(0, Math.trunc(item.gridCol!)) }
            : {}),
          ...(Number.isFinite(item.gridRow)
            ? { gridRow: Math.max(0, Math.trunc(item.gridRow!)) }
            : {}),
        };
      }),
    [],
  );

  const updateSpotlights = useCallback(
    (next: TheaterSpotlight[]) => {
      recordTheaterHistory();
      updateCurrentStep({ theaterSpotlights: normalizeSpotlights(next) });
    },
    [normalizeSpotlights, recordTheaterHistory, updateCurrentStep],
  );

  const cloneSpotlights = useCallback(
    (items: TheaterSpotlight[]) => cloneTheaterSpotlights(items),
    [],
  );

  const ensureSpotlights = useCallback(() => {
    if (spotlightsRaw !== undefined) return spotlightsRaw;
    const cloned = cloneSpotlights(DEFAULT_SPOTLIGHTS);
    updateSpotlights(cloned);
    return cloned;
  }, [cloneSpotlights, spotlightsRaw, updateSpotlights]);

  const updateSpotlight = useCallback(
    (id: number, patch: Partial<TheaterSpotlight>) => {
      const base = ensureSpotlights();
      if (!base.find((s) => s.id === id)) return;
      updateSpotlights(
        base.map((s) => {
          if (s.id !== id) return s;
          const next = { ...s, ...patch };
          if (
            patch.target &&
            patch.gridCol === undefined &&
            patch.gridRow === undefined
          ) {
            delete next.gridCol;
            delete next.gridRow;
          }
          if ("faderId" in patch && patch.faderId == null) {
            delete next.faderId;
          }
          return next;
        }),
      );
    },
    [ensureSpotlights, updateSpotlights],
  );

  const aimSpotlightToGridCell = useCallback(
    (id: number, col: number, row: number) => {
      const base = ensureSpotlights();
      const item = base.find((s) => s.id === id);
      if (!item) return;
      const target = getGridCellCenter(layout, col, row, item.target[1]);
      updateSpotlights(
        base.map((s) =>
          s.id === id ? { ...s, target, gridCol: col, gridRow: row } : s,
        ),
      );
      setDecorActionMessage(
        `Цель: ячейка ${formatGridCellLabel(col, row)} (столбец ${col + 1}, ряд ${row + 1})`,
      );
    },
    [ensureSpotlights, layout, setDecorActionMessage, updateSpotlights],
  );

  const aimActiveSpotlightToGridCell = useCallback(
    (col: number, row: number) => {
      if (activeSpotlightId == null) {
        setDecorActionMessage("Сначала выберите софит");
        return;
      }
      aimSpotlightToGridCell(activeSpotlightId, col, row);
    },
    [activeSpotlightId, aimSpotlightToGridCell, setDecorActionMessage],
  );

  const clearSpotlightGridBinding = useCallback(
    (id: number) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((s) => {
          if (s.id !== id) return s;
          const { gridCol: _c, gridRow: _r, ...rest } = s;
          return rest;
        }),
      );
    },
    [ensureSpotlights, updateSpotlights],
  );

  const updateLayoutZoneGrid = useCallback(
    (patch: Partial<{ cols: number; rows: number }>) => {
      updateLayout(patchLayoutZoneGrid(layout, patch));
    },
    [layout, updateLayout],
  );

  const removeSpotlight = useCallback(
    (id: number) => {
      const base = spotlightsRaw === undefined ? DEFAULT_SPOTLIGHTS : spotlightsRaw;
      const next = base.filter((item) => item.id !== id);
      updateSpotlights(next);
      if (activeSpotlightId === id) {
        updateCurrentStep({ theaterActiveSpotlightId: next[0]?.id });
      }
    },
    [activeSpotlightId, spotlightsRaw, updateCurrentStep, updateSpotlights],
  );

  const cloneSpotlight = useCallback(
    (id: number) => {
      const base = ensureSpotlights();
      const source = base.find((item) => item.id === id);
      if (!source) return;
      const nextId = base.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
      const nextItem: TheaterSpotlight = {
        ...source,
        id: nextId,
        label: `${source.label} (копия)`,
        channel: nextId,
        position: [
          source.position[0] + 0.35,
          source.position[1],
          source.position[2] + 0.35,
        ],
      };
      updateSpotlights([...base, nextItem]);
      updateCurrentStep({ theaterActiveSpotlightId: nextId });
      setEditMode("spotlights");
    },
    [ensureSpotlights, setEditMode, updateCurrentStep, updateSpotlights],
  );

  const aimSpotlightAtStage = useCallback(
    (id: number) => {
      updateSpotlight(id, { target: [...STAGE_AIM_TARGET] });
    },
    [updateSpotlight],
  );

  const addSpotlight = useCallback(() => {
    const base = ensureSpotlights();
    const nextId = base.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: TheaterSpotlight = {
      id: nextId,
      label: `Софит ${nextId}`,
      position: [0, 6, 6],
      target: [0, 1, 2],
      angleDeg: 20,
      intensity: THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
      color: tc("--color-warning"),
      enabled: true,
      channel: nextId,
      isRgb: false,
    };
    updateSpotlights([...base, nextItem]);
    updateCurrentStep({ theaterActiveSpotlightId: nextId });
  }, [ensureSpotlights, updateCurrentStep, updateSpotlights]);

  const addRgbSpotlight = useCallback(() => {
    const base = ensureSpotlights();
    const nextId = base.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const rgbIndex =
      base.filter((item) => item.isRgb).reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: TheaterSpotlight = {
      id: nextId,
      label: `RGB ${rgbIndex}`,
      position: [0, 6, 6],
      target: [0, 1, 2],
      angleDeg: 20,
      intensity: THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY,
      color: tc("--color-text-white"),
      enabled: true,
      channel: nextId,
      isRgb: true,
    };
    updateSpotlights([...base, nextItem]);
    updateCurrentStep({ theaterActiveSpotlightId: nextId });
  }, [ensureSpotlights, updateCurrentStep, updateSpotlights]);

  const patchSpotlightsInScope = useCallback(
    (
      scope: SpotlightLayoutScope,
      patch: (items: TheaterSpotlight[]) => TheaterSpotlight[],
    ) => {
      const base = ensureSpotlights();
      const selected = base.filter((item) => matchesSpotlightScope(item, scope));
      if (selected.length === 0) return;
      updateSpotlights(mergeSpotlightPatches(base, patch(selected)));
    },
    [ensureSpotlights, updateSpotlights],
  );

  const addSpotlightsBatch = useCallback(
    (count: number, perLine: SpotlightsPerLine, options?: { isRgb?: boolean }) => {
      const base = ensureSpotlights();
      const total = Math.max(1, Math.min(64, Math.trunc(count)));
      const isRgb = options?.isRgb ?? false;
      const slots = buildSpotlightBatchSlots(total, perLine, layout.hallWidth);
      let nextId = base.reduce((acc, item) => Math.max(acc, item.id), 0);
      let rgbIndex =
        base.filter((item) => item.isRgb).reduce((acc, item) => Math.max(acc, item.id), 0) + 1;

      const created: TheaterSpotlight[] = slots.map((slot, index) => {
        nextId += 1;
        return {
          id: nextId,
          label: isRgb ? `RGB ${rgbIndex++}` : `Софит ${nextId}`,
          position: slot.position,
          target: slot.target,
          angleDeg: isRgb ? 26 : 20,
          intensity: isRgb
            ? THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY
            : THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
          color: isRgb
            ? tc("--color-text-white")
            : batchSpotlightColors[index % batchSpotlightColors.length],
          enabled: true,
          channel: nextId,
          isRgb,
        };
      });

      updateSpotlights([...base, ...created]);
      if (created.length > 0) {
        updateCurrentStep({ theaterActiveSpotlightId: created[0].id });
      }
    },
    [ensureSpotlights, layout.hallWidth, updateCurrentStep, updateSpotlights],
  );

  const layoutSpotlightsInHallGrid = useCallback(
    (scope: SpotlightLayoutScope, rows: number, perLine: SpotlightsPerLine) => {
      patchSpotlightsInScope(scope, (items) => {
        const rowCount = Math.max(1, Math.min(32, Math.trunc(rows)));
        const slots = buildSpotlightGridInHall(items.length, rowCount, perLine, layout);
        return applyLayoutSlotsToSpotlights(sortSpotlightsByX(items), slots);
      });
    },
    [layout, patchSpotlightsInScope],
  );

  const layoutSpotlightsBeforeAudience = useCallback(
    (scope: SpotlightLayoutScope) => {
      patchSpotlightsInScope(scope, (items) => {
        const slots = buildEvenLineBeforeAudience(items.length, layout);
        return applyLayoutSlotsToSpotlights(sortSpotlightsByX(items), slots);
      });
    },
    [layout, patchSpotlightsInScope],
  );

  const applySpotlightLayoutPreset = useCallback(
    (scope: SpotlightLayoutScope, presetId: SpotlightLayoutPresetId) => {
      patchSpotlightsInScope(scope, (items) => {
        const slots = buildSpotlightLayoutPresetSlots(presetId, items.length, layout);
        return applyLayoutSlotsToSpotlights(sortSpotlightsByX(items), slots);
      });
      const label = SPOTLIGHT_LAYOUT_PRESETS.find((item) => item.id === presetId)?.label;
      setDecorActionMessage(label ? `Раскладка «${label}»` : "Раскладка применена");
    },
    [layout, patchSpotlightsInScope, setDecorActionMessage],
  );

  const assignSpotlightChannelsSequential = useCallback(
    (scope: SpotlightLayoutScope) => {
      patchSpotlightsInScope(scope, (items) => assignSequentialChannelsOrdered(items));
      setDecorActionMessage("Каналы света назначены слева направо");
    },
    [patchSpotlightsInScope, setDecorActionMessage],
  );

  const spawnSpotlightsFromLayoutPreset = useCallback(
    (presetId: SpotlightLayoutPresetId, count: number, isRgb = false) => {
      const total = Math.max(1, Math.min(32, Math.trunc(count)));
      const slots = buildSpotlightLayoutPresetSlots(presetId, total, layout);
      const base = ensureSpotlights();
      const startId = base.reduce((acc, item) => Math.max(acc, item.id), 0);
      const created: TheaterSpotlight[] = slots.map((slot, index) => ({
        id: startId + index + 1,
        label: isRgb ? `RGB ${startId + index + 1}` : `Софит ${startId + index + 1}`,
        position: [...slot.position] as [number, number, number],
        target: [...slot.target] as [number, number, number],
        angleDeg: isRgb ? 24 : 18,
        intensity: isRgb
          ? THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY
          : THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
        color: isRgb ? tc("--color-light-sky") : tc("--color-warning"),
        enabled: true,
        channel: index + 1,
        isRgb,
      }));
      updateSpotlights([...base, ...created]);
      if (created[0]) {
        updateCurrentStep({ theaterActiveSpotlightId: created[0].id });
      }
      const label = SPOTLIGHT_LAYOUT_PRESETS.find((item) => item.id === presetId)?.label;
      setDecorActionMessage(
        label
          ? `Добавлено ${created.length} софитов — «${label}»`
          : `Добавлено ${created.length} софитов`,
      );
    },
    [ensureSpotlights, layout, setDecorActionMessage, updateCurrentStep, updateSpotlights],
  );

  const aimSpotlightsAtStage = useCallback(
    (scope: SpotlightLayoutScope) => {
      patchSpotlightsInScope(scope, (items) => aimSpotlightsAt(items, STAGE_AIM_TARGET));
    },
    [patchSpotlightsInScope],
  );

  const aimSpotlightsStraightDown = useCallback(
    (scope: SpotlightLayoutScope) => {
      patchSpotlightsInScope(scope, (items) =>
        items.map((item) => ({
          ...item,
          target: [item.position[0], 0, item.position[2]] as [number, number, number],
          gridCol: undefined,
          gridRow: undefined,
        })),
      );
    },
    [patchSpotlightsInScope],
  );

  const alignSpotlightsSourceHeight = useCallback(
    (scope: SpotlightLayoutScope, y?: number) => {
      patchSpotlightsInScope(scope, (items) =>
        setSpotlightsSourceHeight(
          items,
          clampSpotlightSourceHeight(y ?? averageSpotlightSourceHeight(items)),
        ),
      );
    },
    [patchSpotlightsInScope],
  );

  const nudgeSpotlightsSourceHeight = useCallback(
    (scope: SpotlightLayoutScope, delta: number) => {
      patchSpotlightsInScope(scope, (items) =>
        items.map((item) => ({
          ...item,
          position: [
            item.position[0],
            clampSpotlightSourceHeight(item.position[1] + delta),
            item.position[2],
          ] as [number, number, number],
        })),
      );
    },
    [patchSpotlightsInScope],
  );

  const snapAllSpotlightsToGrid = useCallback(
    (scope: SpotlightLayoutScope) => {
      if (gridStep <= 0) return;
      patchSpotlightsInScope(scope, (items) =>
        snapSpotlightsToGrid(items, gridStep, layout.hallWidth, layout.hallDepth),
      );
    },
    [gridStep, layout.hallDepth, layout.hallWidth, patchSpotlightsInScope],
  );

  const applyRgbColorToAll = useCallback(
    (nextColor: string) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) => (item.isRgb ? { ...item, color: nextColor } : item)),
      );
    },
    [ensureSpotlights, updateSpotlights],
  );

  const enableSpotlightsByType = useCallback(
    (isRgb: boolean) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) => (item.isRgb === isRgb ? { ...item, enabled: true } : item)),
      );
    },
    [ensureSpotlights, updateSpotlights],
  );

  const disableSpotlightsByType = useCallback(
    (isRgb: boolean) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) => (item.isRgb === isRgb ? { ...item, enabled: false } : item)),
      );
    },
    [ensureSpotlights, updateSpotlights],
  );

  const blackoutAllSpotlights = useCallback(() => {
    const base = ensureSpotlights();
    updateSpotlights(base.map((item) => ({ ...item, enabled: false })));
  }, [ensureSpotlights, updateSpotlights]);

  const fullLightAllSpotlights = useCallback(() => {
    const base = ensureSpotlights();
    updateSpotlights(
      base.map((item) => ({
        ...item,
        enabled: true,
        intensity: Math.max(
          item.intensity ?? THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
          THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
        ),
      })),
    );
  }, [ensureSpotlights, updateSpotlights]);

  const applySpotlightPreset = useCallback(
    (presetId: SpotlightPresetId, scope: "active" | "all" = "active") => {
      const base = ensureSpotlights();
      updateSpotlights(applySpotlightPresetPatch(base, presetId, scope, activeSpotlightId));
      const preset = SPOTLIGHT_PRESETS.find((item) => item.id === presetId);
      setDecorActionMessage(
        preset
          ? `Пресет «${preset.label}»${scope === "all" ? " для всех" : ""}`
          : "Пресет применён",
      );
    },
    [activeSpotlightId, ensureSpotlights, setDecorActionMessage, updateSpotlights],
  );

  const syncSpotlightsFromLightPlot = useCallback(
    (lightChannels: string[]) => {
      const fixtures = currentStep?.lightPlot ?? [];
      if (fixtures.length === 0) {
        setDecorActionMessage("Схема света пуста");
        return;
      }
      const base = ensureSpotlights();
      const merged = mergeSpotlightsFromLightPlot(fixtures, base, layout, lightChannels);
      updateSpotlights(merged);
      if (merged.length > 0) {
        updateCurrentStep({ theaterActiveSpotlightId: merged[0].id });
      }
      setDecorActionMessage(`3D-сцена обновлена из схемы (${fixtures.length} поз.)`);
    },
    [
      currentStep?.lightPlot,
      ensureSpotlights,
      layout,
      setDecorActionMessage,
      updateCurrentStep,
      updateSpotlights,
    ],
  );

  const applyLightPlotChannelLabels = useCallback(() => {
    const fixtures = currentStep?.lightPlot;
    if (!fixtures?.length) {
      setDecorActionMessage("Схема света пуста");
      return;
    }
    const base = ensureSpotlights();
    updateSpotlights(applyLightPlotChannelsToSpotlights(base, fixtures));
    setDecorActionMessage("Каналы 3D-софитов приведены к схеме");
  }, [currentStep?.lightPlot, ensureSpotlights, setDecorActionMessage, updateSpotlights]);

  const syncLightPlotFromSpotlights = useCallback(() => {
    const base = ensureSpotlights();
    if (base.length === 0) {
      setDecorActionMessage("На шаге нет 3D-софитов");
      return;
    }
    const merged = mergeLightPlotFromSpotlights(base, currentStep?.lightPlot ?? [], layout);
    updateCurrentStep({ lightPlot: merged });
    setDecorActionMessage(`Схема света обновлена из 3D (${base.length} софитов)`);
  }, [currentStep?.lightPlot, ensureSpotlights, layout, setDecorActionMessage, updateCurrentStep]);

  const setSelectedSpotlightsVisibility = useCallback(
    (hidden: boolean) => {
      if (multiSelectedSpotlightIds.length === 0) return;
      updateSpotlights(
        setSpotlightsVisibilityByIds(
          ensureSpotlights(),
          multiSelectedSpotlightIds,
          hidden,
        ),
      );
      setDecorActionMessage(hidden ? "Выбранные софиты скрыты" : "Выбранные софиты показаны");
    },
    [ensureSpotlights, multiSelectedSpotlightIds, setDecorActionMessage, updateSpotlights],
  );

  const aimSelectedSpotlightsAtStage = useCallback(() => {
    if (multiSelectedSpotlightIds.length === 0) return;
    updateSpotlights(aimSpotlightsByIds(ensureSpotlights(), multiSelectedSpotlightIds));
    setDecorActionMessage(`Наведено софитов: ${multiSelectedSpotlightIds.length}`);
  }, [ensureSpotlights, multiSelectedSpotlightIds, setDecorActionMessage, updateSpotlights]);

  const removeSelectedSpotlights = useCallback(() => {
    if (multiSelectedSpotlightIds.length === 0 || !currentStep) return;
    const selected = new Set(multiSelectedSpotlightIds);
    const base = spotlightsRaw === undefined ? DEFAULT_SPOTLIGHTS : spotlightsRaw;
    const next = base.filter((item) => !selected.has(item.id));
    updateSpotlights(next);
    setMultiSelectedSpotlightIds(next.length > 0 ? [next[0].id] : []);
    updateCurrentStep({ theaterActiveSpotlightId: next[0]?.id });
    setDecorActionMessage(`Удалено софитов: ${selected.size}`);
  }, [
    currentStep,
    multiSelectedSpotlightIds,
    setMultiSelectedSpotlightIds,
    spotlightsRaw,
    setDecorActionMessage,
    updateCurrentStep,
    updateSpotlights,
  ]);

  const cloneSelectedSpotlights = useCallback(() => {
    if (multiSelectedSpotlightIds.length === 0) return;
    const base = ensureSpotlights();
    const { next, createdIds } = cloneSpotlightsByIds(base, multiSelectedSpotlightIds);
    if (createdIds.length === 0) return;
    updateSpotlights(next);
    setMultiSelectedSpotlightIds(createdIds);
    updateCurrentStep({ theaterActiveSpotlightId: createdIds[0] });
    setDecorActionMessage(`Скопировано софитов: ${createdIds.length}`);
  }, [
    ensureSpotlights,
    multiSelectedSpotlightIds,
    setMultiSelectedSpotlightIds,
    setDecorActionMessage,
    updateCurrentStep,
    updateSpotlights,
  ]);

  const assignSelectedSpotlightChannelsSequential = useCallback(() => {
    if (multiSelectedSpotlightIds.length === 0) return;
    updateSpotlights(
      patchSpotlightsByIds(
        ensureSpotlights(),
        multiSelectedSpotlightIds,
        assignSequentialChannelsOrdered,
      ),
    );
    setDecorActionMessage("Каналы света назначены выбранным софитам");
  }, [ensureSpotlights, multiSelectedSpotlightIds, setDecorActionMessage, updateSpotlights]);

  return {
    spotlights,
    displaySpotlights,
    visibleSpotlights,
    spotlightsConfigured,
    activeSpotlight,
    stageGrid,
    normalizeSpotlights,
    updateSpotlights,
    ensureSpotlights,
    cloneTheaterSpotlights: cloneSpotlights,
    updateSpotlight,
    aimSpotlightToGridCell,
    aimActiveSpotlightToGridCell,
    clearSpotlightGridBinding,
    updateLayoutZoneGrid,
    removeSpotlight,
    cloneSpotlight,
    aimSpotlightAtStage,
    addSpotlight,
    addRgbSpotlight,
    addSpotlightsBatch,
    layoutSpotlightsInHallGrid,
    layoutSpotlightsBeforeAudience,
    applySpotlightLayoutPreset,
    assignSpotlightChannelsSequential,
    spawnSpotlightsFromLayoutPreset,
    aimSpotlightsAtStage,
    aimSpotlightsStraightDown,
    alignSpotlightsSourceHeight,
    nudgeSpotlightsSourceHeight,
    snapAllSpotlightsToGrid,
    applyRgbColorToAll,
    enableSpotlightsByType,
    disableSpotlightsByType,
    blackoutAllSpotlights,
    fullLightAllSpotlights,
    applySpotlightPreset,
    syncSpotlightsFromLightPlot,
    applyLightPlotChannelLabels,
    syncLightPlotFromSpotlights,
    setSelectedSpotlightsVisibility,
    aimSelectedSpotlightsAtStage,
    removeSelectedSpotlights,
    cloneSelectedSpotlights,
    assignSelectedSpotlightChannelsSequential,
    spotlightPresets: SPOTLIGHT_PRESETS,
    spotlightLayoutPresets: SPOTLIGHT_LAYOUT_PRESETS,
  };
}
