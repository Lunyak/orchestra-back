import type { TheaterLayout, TheaterStageShape } from "../../../shared/types/script";
import { resolveStageWidth, STAGE_WIDTH_LIMITS } from "../model/theater-hall-expand";
import {
  centerStageInHall,
  getStageBackZ,
  getStageBackZBounds,
  getStageFrontZ,
  getStageFrontZBounds,
  labelM,
  roundM,
} from "../model/theater-metrics";
import {
  patchForStageShape,
  resolveStageRise,
  resolveStageShape,
  STAGE_RISE_LIMITS,
  STAGE_SHAPE_LABELS,
  stageUsesAudienceWidth,
} from "../model/theater-stage-geometry";
import type { TheaterObjectContextMenuItem } from "./TheaterObjectContextMenu";

const STAGE_SHAPES: TheaterStageShape[] = [
  "rectangle",
  "trapezoid",
  "circle",
  "semicircle",
  "t-shape",
  "custom",
];

function formatMeters(value: number) {
  return String(roundM(value));
}

export function isTheaterStageShape(value: string): value is TheaterStageShape {
  return STAGE_SHAPES.includes(value as TheaterStageShape);
}

export function buildStageContextMenuItems(
  layout: TheaterLayout,
): TheaterObjectContextMenuItem[] {
  const stageShape = resolveStageShape(layout);
  const isCustomStage = stageShape === "custom";
  const showSingleStageWidth =
    stageShape === "rectangle" || stageShape === "circle" || stageShape === "semicircle";
  const usesSplitWidth = stageUsesAudienceWidth(stageShape);
  const stageRise = resolveStageRise(layout);
  const stageWidth = resolveStageWidth(layout);
  const stageBackZBounds = getStageBackZBounds(layout);
  const stageFrontZBounds = getStageFrontZBounds(layout);
  const backWidth = layout.stageBackWidth ?? layout.hallWidth;
  const frontWidth = layout.prosceniumWidth ?? layout.hallWidth;

  const sizeItems: TheaterObjectContextMenuItem[] = [];
  if (showSingleStageWidth) {
    sizeItems.push({
      id: "stage-width",
      label: labelM("Ш. сцены"),
      range: {
        min: STAGE_WIDTH_LIMITS.min,
        max: layout.hallWidth,
        step: 0.1,
        value: stageWidth,
        formatValue: formatMeters,
      },
    });
  }
  if (usesSplitWidth) {
    sizeItems.push(
      {
        id: "stage-back-width",
        label: labelM("У задней стены"),
        range: {
          min: STAGE_WIDTH_LIMITS.min,
          max: layout.hallWidth,
          step: 0.1,
          value: backWidth,
          formatValue: formatMeters,
        },
      },
      {
        id: "stage-front-width",
        label: stageShape === "t-shape" ? labelM("У зрителей, ножка") : labelM("У зрителей"),
        range: {
          min: STAGE_WIDTH_LIMITS.min,
          max: layout.hallWidth,
          step: 0.1,
          value: frontWidth,
          formatValue: formatMeters,
        },
      },
    );
  }
  if (!isCustomStage) {
    sizeItems.push(
      {
        id: "stage-back-z",
        label: labelM("З. край сцены"),
        range: {
          min: stageBackZBounds.min,
          max: stageBackZBounds.max,
          step: 0.1,
          value: getStageBackZ(layout),
          formatValue: formatMeters,
        },
      },
      {
        id: "stage-front-z",
        label: labelM("П. край сцены"),
        range: {
          min: stageFrontZBounds.min,
          max: stageFrontZBounds.max,
          step: 0.1,
          value: getStageFrontZ(layout),
          formatValue: formatMeters,
        },
      },
    );
  }

  return [
    {
      id: "stage-params",
      label: "Параметры",
      children: [
        {
          id: "stage-rise",
          label: labelM("Высота сцены"),
          range: {
            min: STAGE_RISE_LIMITS.min,
            max: STAGE_RISE_LIMITS.max,
            step: 0.05,
            value: stageRise,
            formatValue: formatMeters,
          },
        },
        {
          id: "stage-shape",
          label: "Форма",
          children: STAGE_SHAPES.map((shape) => ({
            id: `stage-shape:${shape}`,
            label: STAGE_SHAPE_LABELS[shape],
            active: stageShape === shape,
          })),
        },
        ...sizeItems,
        {
          id: "stage-center",
          label: "В центр зала",
          disabled: isCustomStage,
        },
      ],
    },
  ];
}

export function patchForStageContextRange(
  layout: TheaterLayout,
  id: string,
  value: number,
): Partial<TheaterLayout> | null {
  if (id === "stage-rise") return { stageRise: value };
  if (id === "stage-width") {
    return { stageBackWidth: value, prosceniumWidth: value };
  }
  if (id === "stage-back-width") return { stageBackWidth: value };
  if (id === "stage-front-width") return { prosceniumWidth: value };
  if (id === "stage-back-z") return { stageBackZ: value };
  if (id === "stage-front-z") return { stageFrontZ: value };
  return null;
}

export function patchForStageContextPick(
  layout: TheaterLayout,
  id: string,
): Partial<TheaterLayout> | null {
  if (id === "stage-center") return centerStageInHall(layout);
  if (!id.startsWith("stage-shape:")) return null;
  const nextShape = id.slice("stage-shape:".length);
  if (!isTheaterStageShape(nextShape)) return null;
  return patchForStageShape(layout, nextShape);
}
