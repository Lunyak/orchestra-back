import { tc } from "../../../shared/styles/theme-color";
import {
  useCallback,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from "react";
import type { ScriptScene, TheaterLayout, TheaterSpotlight } from "../../../shared/types/script";
import { DEFAULT_SPOTLIGHTS } from "../model/theater-defaults";
import {
  THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
  THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY,
} from "../model/theater-scene-lighting";
import {
  assignSequentialChannelsOrdered,
  buildLightPlotFromSpotlights,
} from "../model/theater-light-channel-link";
import {
  aimSpotlightsByIds,
  cloneSpotlightsByIds,
  patchSpotlightsByIds,
  setSpotlightsVisibilityByIds,
} from "../model/theater-spotlight-selection";
import {
  getGridCellCenter,
  patchLayoutZoneGrid,
  resolveStageGrid,
  formatGridCellLabel,
} from "../model/theater-zone-grid";
import type {
  PlaybookLightFadersDataV1,
  PlaybookLightProgramsDataV1,
} from "../../playbook/model/playbook-slice";
import { applyFadersToSpotlightsPerChannelDisplay } from "../model/theater-light-fader-bindings";
import { readSceneTheaterModels } from "../model/theater-scene-models";
import {
  getOccupiedTrussMountPointIds,
  isLightTrussModel,
  resolveLightTrussMountWorldPosition,
} from "../model/theater-truss-mounts";
import type { TheaterEditMode } from "./use-theater-selection";

export type UseTheaterSpotlightsArgs = {
  currentScene: ScriptScene | undefined;
  updateCurrentScene: (patch: Partial<ScriptScene>) => void;
  recordTheaterHistory: () => void;
  layout: TheaterLayout;
  activeSpotlightId: number | undefined;
  multiSelectedSpotlightIds: number[];
  setMultiSelectedSpotlightIds: Dispatch<SetStateAction<number[]>>;
  updateLayout: (patch: Partial<TheaterLayout>) => void;
  setEditMode: (mode: TheaterEditMode) => void;
  setDecorActionMessage: (message: string | null) => void;
  lightFaders?: PlaybookLightFadersDataV1 | null;
  lightPrograms?: PlaybookLightProgramsDataV1 | null;
  /** Активный канал на пульте — живая доска только для этого K. */
  consoleChannel?: number;
};

export type TrussMountFixtureType = "regular" | "rgb";

export function cloneTheaterSpotlights(source: TheaterSpotlight[]): TheaterSpotlight[] {
  return source.map((item) => ({
    ...item,
    position: [...item.position] as [number, number, number],
    target: [...item.target] as [number, number, number],
  }));
}

export function useTheaterSpotlights({
  currentScene,
  updateCurrentScene,
  recordTheaterHistory,
  layout,
  activeSpotlightId,
  multiSelectedSpotlightIds,
  setMultiSelectedSpotlightIds,
  setEditMode,
  setDecorActionMessage,
  lightFaders,
  lightPrograms,
  consoleChannel,
  updateLayout,
}: UseTheaterSpotlightsArgs) {
  const [trussMountFixtureType, setTrussMountFixtureType] =
    useState<TrussMountFixtureType>("regular");
  const spotlightsRaw = currentScene?.theaterSpotlights;
  const spotlights = spotlightsRaw ?? [];
  const displaySpotlights =
    spotlightsRaw === undefined ? DEFAULT_SPOTLIGHTS : spotlightsRaw;
  const spotlightsConfigured = spotlightsRaw !== undefined;
  const activeSpotlight =
    activeSpotlightId != null
      ? displaySpotlights.find((item) => item.id === activeSpotlightId)
      : undefined;
  const renderSpotlights = useMemo(() => {
    return applyFadersToSpotlightsPerChannelDisplay(
      displaySpotlights,
      lightFaders,
      lightPrograms,
      consoleChannel,
    );
  }, [consoleChannel, displaySpotlights, lightFaders, lightPrograms]);
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
              : item.isRgb
                ? `RGB ${nextId}`
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
          modelLowDetail: item.modelLowDetail ?? false,
          ...(Number.isFinite(item.mountModelId)
            ? { mountModelId: Math.max(1, Math.trunc(item.mountModelId!)) }
            : {}),
          ...(item.mountPointId?.trim()
            ? { mountPointId: item.mountPointId.trim() }
            : {}),
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
      const normalized = normalizeSpotlights(next);
      updateCurrentScene({
        theaterSpotlights: normalized,
        lightPlot: buildLightPlotFromSpotlights(normalized, layout),
      });
    },
    [layout, normalizeSpotlights, recordTheaterHistory, updateCurrentScene],
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
          if (
            patch.position &&
            patch.mountModelId === undefined &&
            patch.mountPointId === undefined
          ) {
            delete next.mountModelId;
            delete next.mountPointId;
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

  const attachSpotlightToTrussMount = useCallback(
    (spotlightId: number, mountModelId: number, mountPointId: string) => {
      const base = ensureSpotlights();
      const spotlight = base.find((item) => item.id === spotlightId);
      const truss = readSceneTheaterModels(currentScene).find(
        (model) => model.id === mountModelId,
      );
      if (!spotlight || !isLightTrussModel(truss)) {
        setDecorActionMessage("Не удалось найти софит или световую ферму");
        return;
      }

      const occupiedMounts = getOccupiedTrussMountPointIds(
        base,
        mountModelId,
        spotlightId,
      );
      if (occupiedMounts.has(mountPointId)) {
        setDecorActionMessage("Эта точка фермы уже занята");
        return;
      }

      const position = resolveLightTrussMountWorldPosition(truss, mountPointId);
      if (!position) {
        setDecorActionMessage("Точка крепления не найдена");
        return;
      }

      updateSpotlights(
        base.map((item) =>
          item.id === spotlightId
            ? { ...item, position, mountModelId, mountPointId }
            : item,
        ),
      );
      setDecorActionMessage(`«${spotlight.label}» закреплён на «${truss.name}»`);
    },
    [
      currentScene,
      ensureSpotlights,
      setDecorActionMessage,
      updateSpotlights,
    ],
  );

  const detachSpotlightFromTruss = useCallback(
    (spotlightId: number) => {
      const base = ensureSpotlights();
      updateSpotlights(
        base.map((item) =>
          item.id === spotlightId
            ? { ...item, mountModelId: undefined, mountPointId: undefined }
            : item,
        ),
      );
      setDecorActionMessage("Софит снят с фермы");
    },
    [ensureSpotlights, setDecorActionMessage, updateSpotlights],
  );

  const installSpotlightOnTrussMount = useCallback(
    (
      mountModelId: number,
      mountPointId: string,
      fixtureType: TrussMountFixtureType = trussMountFixtureType,
    ) => {
      const base = ensureSpotlights();
      const truss = readSceneTheaterModels(currentScene).find(
        (model) => model.id === mountModelId,
      );
      if (!isLightTrussModel(truss)) {
        setDecorActionMessage("Световая ферма не найдена");
        return;
      }
      const occupiedMounts = getOccupiedTrussMountPointIds(base, mountModelId);
      if (occupiedMounts.has(mountPointId)) {
        const mountedSpotlight = base.find(
          (item) =>
            item.mountModelId === mountModelId &&
            item.mountPointId === mountPointId,
        );
        if (mountedSpotlight) {
          setMultiSelectedSpotlightIds([mountedSpotlight.id]);
          updateCurrentScene({
            theaterActiveSpotlightId: mountedSpotlight.id,
          });
          setEditMode("spotlights");
        }
        return;
      }

      const position = resolveLightTrussMountWorldPosition(truss, mountPointId);
      if (!position) {
        setDecorActionMessage("Точка крепления не найдена");
        return;
      }

      const nextId = base.reduce(
        (largestId, item) => Math.max(largestId, item.id),
        0,
      ) + 1;
      const isRgb = fixtureType === "rgb";
      const nextSpotlight: TheaterSpotlight = {
        id: nextId,
        label: isRgb ? `RGB ${nextId}` : `Софит ${nextId}`,
        position,
        target: [...STAGE_AIM_TARGET],
        angleDeg: isRgb ? 26 : 20,
        intensity: isRgb
          ? THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY
          : THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
        color: isRgb ? tc("--color-text-white") : tc("--color-warning"),
        enabled: true,
        channel: nextId,
        isRgb,
        modelLowDetail: false,
        mountModelId,
        mountPointId,
      };
      updateSpotlights([...base, nextSpotlight]);
      setMultiSelectedSpotlightIds([nextId]);
      updateCurrentScene({ theaterActiveSpotlightId: nextId });
      setEditMode("spotlights");
      setDecorActionMessage(
        `${isRgb ? "RGB-софит" : "Софит"} установлен на «${truss.name}»`,
      );
    },
    [
      currentScene,
      ensureSpotlights,
      setDecorActionMessage,
      setEditMode,
      setMultiSelectedSpotlightIds,
      trussMountFixtureType,
      updateCurrentScene,
      updateSpotlights,
    ],
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
        updateCurrentScene({ theaterActiveSpotlightId: next[0]?.id });
      }
    },
    [activeSpotlightId, spotlightsRaw, updateCurrentScene, updateSpotlights],
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
        mountModelId: undefined,
        mountPointId: undefined,
      };
      updateSpotlights([...base, nextItem]);
      updateCurrentScene({ theaterActiveSpotlightId: nextId });
      setEditMode("spotlights");
    },
    [ensureSpotlights, setEditMode, updateCurrentScene, updateSpotlights],
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
    updateCurrentScene({ theaterActiveSpotlightId: nextId });
  }, [ensureSpotlights, updateCurrentScene, updateSpotlights]);

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
    updateCurrentScene({ theaterActiveSpotlightId: nextId });
  }, [ensureSpotlights, updateCurrentScene, updateSpotlights]);

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
    if (multiSelectedSpotlightIds.length === 0 || !currentScene) return;
    const selected = new Set(multiSelectedSpotlightIds);
    const base = spotlightsRaw === undefined ? DEFAULT_SPOTLIGHTS : spotlightsRaw;
    const next = base.filter((item) => !selected.has(item.id));
    updateSpotlights(next);
    setMultiSelectedSpotlightIds(next.length > 0 ? [next[0].id] : []);
    updateCurrentScene({ theaterActiveSpotlightId: next[0]?.id });
    setDecorActionMessage(`Удалено софитов: ${selected.size}`);
  }, [
    currentScene,
    multiSelectedSpotlightIds,
    setMultiSelectedSpotlightIds,
    spotlightsRaw,
    setDecorActionMessage,
    updateCurrentScene,
    updateSpotlights,
  ]);

  const cloneSelectedSpotlights = useCallback(() => {
    if (multiSelectedSpotlightIds.length === 0) return;
    const base = ensureSpotlights();
    const { next, createdIds } = cloneSpotlightsByIds(base, multiSelectedSpotlightIds);
    if (createdIds.length === 0) return;
    updateSpotlights(next);
    setMultiSelectedSpotlightIds(createdIds);
    updateCurrentScene({ theaterActiveSpotlightId: createdIds[0] });
    setDecorActionMessage(`Скопировано софитов: ${createdIds.length}`);
  }, [
    ensureSpotlights,
    multiSelectedSpotlightIds,
    setMultiSelectedSpotlightIds,
    setDecorActionMessage,
    updateCurrentScene,
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
    attachSpotlightToTrussMount,
    detachSpotlightFromTruss,
    installSpotlightOnTrussMount,
    trussMountFixtureType,
    setTrussMountFixtureType,
    updateLayoutZoneGrid,
    removeSpotlight,
    cloneSpotlight,
    addSpotlight,
    addRgbSpotlight,
    applyRgbColorToAll,
    enableSpotlightsByType,
    disableSpotlightsByType,
    blackoutAllSpotlights,
    fullLightAllSpotlights,
    setSelectedSpotlightsVisibility,
    aimSelectedSpotlightsAtStage,
    removeSelectedSpotlights,
    cloneSelectedSpotlights,
    assignSelectedSpotlightChannelsSequential,
  };
}
