import type { TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import { themeColorToHex } from "../../../shared/styles/theme-color";
import { formatSpotlightChannelFaderShort, isDefaultSpotlightLabel } from "./theater-spotlight-labels";
import { STAGE_AIM_TARGET } from "./spotlight-batch-layout";
import { getLightTrussMountPoint } from "./theater-truss-mounts";
import { formatGridCellLabel } from "./theater-zone-grid";

export type InstrumentScheduleRow = {
  id: number;
  numberLabel: string;
  name: string | null;
  channelLabel: string;
  colorHex: string;
  colorLabel: string;
  trussLabel: string;
  aimLabel: string;
  enabled: boolean;
};

const COLOR_NAMES: Record<string, string> = {
  "#f8fafc": "Белый",
  "#ffffff": "Белый",
  "#ef4444": "Красный",
  "#22c55e": "Зелёный",
  "#2563eb": "Синий",
  "#22d3ee": "Голубой",
  "#d946ef": "Пурпурный",
  "#facc15": "Жёлтый",
  "#f97316": "Янтарный",
  "#ec4899": "Розовый",
  "#a855f7": "Фиолетовый",
  "#38bdf8": "Небесный",
  "#f59e0b": "Тёплый",
  "#fbbf24": "Открытый",
};

const CENTER_AIM_EPSILON = 0.2;

function roundMeter(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function resolveColor(color: string | undefined): { hex: string; label: string } {
  const raw = color?.trim() || "#fbbf24";
  const hex = (themeColorToHex(raw) ?? (raw.startsWith("#") ? raw : "#fbbf24")).toLowerCase();
  const normalized = hex.length === 7 ? hex : "#fbbf24";
  return {
    hex: normalized,
    label: COLOR_NAMES[normalized] ?? normalized,
  };
}

function resolveTrussLabel(spotlight: TheaterSpotlight, models: TheaterModel[]): string {
  if (spotlight.mountModelId == null) return "—";
  const truss = models.find((model) => model.id === spotlight.mountModelId);
  const point = getLightTrussMountPoint(spotlight.mountPointId);
  const trussName = truss?.name?.trim() || `Ферма ${spotlight.mountModelId}`;
  if (!point) return trussName;
  return `${trussName}, ${point.label.toLowerCase()}`;
}

function resolveAimLabel(spotlight: TheaterSpotlight): string {
  if (
    spotlight.gridCol != null &&
    spotlight.gridRow != null &&
    Number.isFinite(spotlight.gridCol) &&
    Number.isFinite(spotlight.gridRow)
  ) {
    return `ячейка ${formatGridCellLabel(spotlight.gridCol, spotlight.gridRow)}`;
  }
  const [x, , z] = spotlight.target;
  const nearCenter =
    Math.abs(x - STAGE_AIM_TARGET[0]) < CENTER_AIM_EPSILON &&
    Math.abs(z - STAGE_AIM_TARGET[2]) < CENTER_AIM_EPSILON;
  if (nearCenter) return "центр сцены";
  return `x ${roundMeter(x)} м, z ${roundMeter(z)} м`;
}

export function buildInstrumentScheduleRows(
  spotlights: TheaterSpotlight[],
  models: TheaterModel[],
): InstrumentScheduleRow[] {
  return [...spotlights]
    .sort((left, right) => {
      const leftChannel = left.channel ?? left.id;
      const rightChannel = right.channel ?? right.id;
      if (leftChannel !== rightChannel) return leftChannel - rightChannel;
      return left.id - right.id;
    })
    .map((spotlight) => {
      const color = resolveColor(spotlight.color);
      const customName = spotlight.label?.trim();
      const name =
        customName && !isDefaultSpotlightLabel(customName, spotlight)
          ? customName
          : null;
      return {
        id: spotlight.id,
        numberLabel: spotlight.isRgb ? `RGB ${spotlight.id}` : String(spotlight.id),
        name,
        channelLabel: formatSpotlightChannelFaderShort(spotlight),
        colorHex: color.hex,
        colorLabel: color.label,
        trussLabel: resolveTrussLabel(spotlight, models),
        aimLabel: resolveAimLabel(spotlight),
        enabled: spotlight.enabled !== false,
      };
    });
}
