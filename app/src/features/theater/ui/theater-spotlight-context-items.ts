import type { TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import { tc, themeColorToHex } from "../../../shared/styles/theme-color";
import { formatGridCellLabel } from "../model/theater-zone-grid";
import { THEATER_RGB_COLOR_PRESETS } from "../model/theater-rgb-color-presets";
import {
  THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
  THEATER_SPOTLIGHT_UI_INTENSITY_MAX,
  THEATER_SPOTLIGHT_UI_INTENSITY_MIN,
  THEATER_SPOTLIGHT_UI_INTENSITY_STEP,
} from "../model/theater-scene-lighting";
import {
  formatCompactChannelSlot,
  formatCompactFaderLabel,
  readSpotlightFaderId,
} from "../model/theater-light-fader-bindings";
import { LIGHT_CHANNEL_SLOT_COUNT } from "../model/theater-light-channel-link";
import {
  getLightTrussMountPoint,
  getOccupiedTrussMountPointIds,
  LIGHT_TRUSS_6M_MOUNT_POINTS,
} from "../model/theater-truss-mounts";
import type { TheaterObjectContextMenuItem } from "./TheaterObjectContextMenu";

export type SpotlightContextInput = {
  spotlight: TheaterSpotlight;
  dragMode: "target" | "source" | null;
  aimMode: "point" | "cell";
  gridCol?: number;
  gridRow?: number;
  trusses: TheaterModel[];
  spotlights: TheaterSpotlight[];
  channelCount: number;
  faderCount: number;
};

function hexOf(color: string) {
  return (themeColorToHex(color) ?? color).toLowerCase();
}

export function buildSpotlightContextMenuItems(
  input: SpotlightContextInput,
): TheaterObjectContextMenuItem[] {
  const { spotlight, trusses, spotlights } = input;
  const enabled = spotlight.enabled !== false;
  const hidden = spotlight.hidden === true;
  const mounted = spotlight.mountModelId != null && Boolean(spotlight.mountPointId);
  const mountedTruss = trusses.find((truss) => truss.id === spotlight.mountModelId);
  const mountedPoint = getLightTrussMountPoint(spotlight.mountPointId);
  const hasGridBinding =
    input.gridCol != null &&
    input.gridRow != null &&
    Number.isFinite(input.gridCol) &&
    Number.isFinite(input.gridRow);
  const channel = spotlight.channel ?? spotlight.id;
  const faderId = readSpotlightFaderId(spotlight);
  const channelSlots = Math.max(LIGHT_CHANNEL_SLOT_COUNT, input.channelCount);
  const faderSlots = Math.max(8, input.faderCount);
  const currentColor = spotlight.color ?? tc("--color-warning");

  const mountChildren: TheaterObjectContextMenuItem[] = trusses.map((truss) => {
    const occupied = getOccupiedTrussMountPointIds(spotlights, truss.id, spotlight.id);
    const points = LIGHT_TRUSS_6M_MOUNT_POINTS.filter((point) => !occupied.has(point.id));
    return {
      id: `mount-truss:${truss.id}`,
      label: truss.name,
      active: spotlight.mountModelId === truss.id,
      disabled: points.length === 0,
      children: points.map((point) => ({
        id: `mount:${truss.id}:${point.id}`,
        label: point.label,
        active:
          spotlight.mountModelId === truss.id && spotlight.mountPointId === point.id,
      })),
    };
  });
  if (mounted) {
    mountChildren.unshift({
      id: "mount:detach",
      label:
        mountedTruss && mountedPoint
          ? `Снять · ${mountedTruss.name}, ${mountedPoint.label}`
          : "Снять с фермы",
    });
  }
  if (trusses.length === 0) {
    mountChildren.push({ id: "mount:none", label: "Ферм нет", disabled: true });
  }

  const lightChildren: TheaterObjectContextMenuItem[] = [
    {
      id: "light:angle",
      label: "Угол",
      range: {
        min: 5,
        max: 60,
        step: 1,
        value: spotlight.angleDeg ?? 20,
        formatValue: (value) => `${value}°`,
      },
    },
    {
      id: "light:intensity",
      label: "Свет",
      range: {
        min: THEATER_SPOTLIGHT_UI_INTENSITY_MIN,
        max: THEATER_SPOTLIGHT_UI_INTENSITY_MAX,
        step: THEATER_SPOTLIGHT_UI_INTENSITY_STEP,
        value: spotlight.intensity ?? THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
        formatValue: (value) => value.toFixed(1),
      },
    },
    {
      id: "light:color",
      label: "Цвет",
      colorValue: currentColor,
    },
  ];
  if (spotlight.isRgb) {
    lightChildren.push({
      id: "light:presets",
      label: "Палитра",
      children: THEATER_RGB_COLOR_PRESETS.map((preset) => {
        const color = tc(preset.token);
        return {
          id: `light:preset:${preset.id}`,
          label: preset.label,
          active: hexOf(currentColor) === hexOf(color),
        };
      }),
    });
  }

  const aimChildren: TheaterObjectContextMenuItem[] = [
    {
      id: "aim:point",
      label: "Точка",
      active: input.aimMode === "point",
    },
    {
      id: "aim:cell",
      label: "Ячейка",
      active: input.aimMode === "cell",
    },
    {
      id: "aim:stage",
      label: "На центр сцены",
    },
    {
      id: "drag:source",
      label: "Двигать источник",
      active: input.dragMode === "source",
      disabled: mounted,
    },
    {
      id: "drag:target",
      label: "Двигать цель",
      active: input.dragMode === "target",
    },
  ];
  if (hasGridBinding) {
    aimChildren.splice(2, 0, {
      id: "aim:clear-cell",
      label: `Снять ${formatGridCellLabel(Math.trunc(input.gridCol!), Math.trunc(input.gridRow!))}`,
    });
  }

  return [
    {
      id: "group:state",
      label: "Состояние",
      children: [
        {
          id: "state:power",
          label: enabled ? "Выключить" : "Включить",
          active: enabled,
        },
        {
          id: "state:visibility",
          label: hidden ? "Показать" : "Скрыть",
          active: hidden,
        },
      ],
    },
    {
      id: "group:aim",
      label: "Наведение",
      children: aimChildren,
    },
    {
      id: "group:light",
      label: "Свет",
      children: lightChildren,
    },
    {
      id: "group:mount",
      label: "Крепление",
      children: mountChildren,
    },
    {
      id: "group:patch",
      label: "Патч",
      children: [
        {
          id: "patch:channel",
          label: "Канал",
          children: Array.from({ length: channelSlots }, (_, index) => {
            const slot = index + 1;
            return {
              id: `channel:${slot}`,
              label: formatCompactChannelSlot(slot),
              active: channel === slot,
            };
          }),
        },
        {
          id: "patch:fader",
          label: "Фейдер",
          children: [
            { id: "fader:none", label: "—", active: faderId == null },
            ...Array.from({ length: faderSlots }, (_, index) => {
              const slot = index + 1;
              return {
                id: `fader:${slot}`,
                label: formatCompactFaderLabel(slot),
                active: faderId === slot,
              };
            }),
          ],
        },
      ],
    },
    {
      id: "group:model",
      label: "Модель",
      children: [
        {
          id: "model:low-detail",
          label: "Упрощённая 3D",
          active: spotlight.modelLowDetail === true,
        },
      ],
    },
    {
      id: "group:object",
      label: "Объект",
      children: [
        { id: "object:clone", label: "Клонировать" },
        { id: "object:delete", label: "Удалить", danger: true },
      ],
    },
  ];
}

export function spotlightPresetColor(presetId: string): string | null {
  const preset = THEATER_RGB_COLOR_PRESETS.find((item) => item.id === presetId);
  if (!preset) return null;
  return tc(preset.token);
}
