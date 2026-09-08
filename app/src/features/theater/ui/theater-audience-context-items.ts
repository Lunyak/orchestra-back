import type { TheaterAudienceLayout, TheaterLayout } from "../../../shared/types/script";
import {
  AUDIENCE_LAYOUT_LABELS,
  resolveAudienceLayout,
} from "../model/theater-audience-arc";
import {
  aisleWidthMax,
  canAddTheaterAisle,
  resolveLayoutAisles,
} from "../model/theater-aisles";
import {
  getAudienceStartZBounds,
  labelM,
  resolveAudienceStartZ,
  roundM,
} from "../model/theater-metrics";
import type { TheaterObjectContextMenuItem } from "./TheaterObjectContextMenu";

const AUDIENCE_LAYOUTS: TheaterAudienceLayout[] = ["rows", "arc", "surround"];

function formatMeters(value: number) {
  return String(roundM(value));
}

export function buildAudienceContextMenuItems(
  layout: TheaterLayout,
): TheaterObjectContextMenuItem[] {
  const audienceZBounds = getAudienceStartZBounds(layout);
  const audienceStartZ = resolveAudienceStartZ(layout);
  const audienceLayout = resolveAudienceLayout(layout);
  const aisles = resolveLayoutAisles(layout);
  const aisleMax = aisleWidthMax(layout.hallWidth);
  const halfHallWidth = layout.hallWidth / 2;

  const aisleItems: TheaterObjectContextMenuItem[] = aisles.flatMap((aisle, index) => {
    const labelIndex = aisles.length > 1 ? ` ${index + 1}` : "";
    const aisleHalf = aisle.width / 2;
    return [
      {
        id: `aisle-width:${aisle.id}`,
        label: labelM(`Проход${labelIndex}`),
        range: {
          min: 0,
          max: aisleMax,
          step: 0.1,
          value: aisle.width,
          formatValue: (value) => (value <= 0 ? "нет" : formatMeters(value)),
        },
      },
      {
        id: `aisle-center:${aisle.id}`,
        label: labelM(`Проход${labelIndex}, центр`),
        range: {
          min: -halfHallWidth + aisleHalf,
          max: halfHallWidth - aisleHalf,
          step: 0.1,
          value: aisle.centerX,
          formatValue: formatMeters,
        },
      },
    ];
  });

  return [
    {
      id: "audience-params",
      label: "Параметры",
      children: [
        {
          id: "audience-layout",
          label: "Рассадка",
          children: AUDIENCE_LAYOUTS.map((item) => ({
            id: `audience-layout:${item}`,
            label: AUDIENCE_LAYOUT_LABELS[item],
            active: audienceLayout === item,
          })),
        },
        {
          id: "audience-place-stage",
          label: "Поставить у сцены",
        },
        {
          id: "audience-z",
          label: labelM("Кресла Z"),
          range: {
            min: audienceZBounds.min,
            max: audienceZBounds.max,
            step: 0.1,
            value: audienceStartZ,
            formatValue: formatMeters,
          },
        },
        {
          id: "audience-row-spacing",
          label: labelM("Шаг рядов"),
          range: {
            min: 0.55,
            max: 1.5,
            step: 0.05,
            value: layout.rowSpacing,
            formatValue: formatMeters,
          },
        },
        {
          id: "audience-seat-spacing",
          label: labelM("Шаг мест"),
          disabled: true,
          range: {
            min: 0.45,
            max: 0.55,
            step: 0.01,
            value: layout.seatSpacing,
            formatValue: formatMeters,
          },
        },
        {
          id: "audience-rows",
          label: "Ряды",
          range: {
            min: 0,
            max: 80,
            step: 1,
            value: layout.seatRows,
            formatValue: (value) => String(Math.round(value)),
          },
        },
        {
          id: "audience-seats-per-row",
          label: "Мест/ряд",
          range: {
            min: 1,
            max: 200,
            step: 1,
            value: layout.seatsPerRow,
            formatValue: (value) => String(Math.round(value)),
          },
        },
        {
          id: "audience-row-rise",
          label: labelM("Подъём ряда"),
          range: {
            min: 0,
            max: 0.6,
            step: 0.05,
            value: layout.rowRise,
            formatValue: formatMeters,
          },
        },
        ...aisleItems,
      ],
    },
    {
      id: "audience-add",
      label: "Добавить",
      children: [
        {
          id: "add-aisle",
          label: "Проход",
          disabled: !canAddTheaterAisle(layout),
        },
      ],
    },
  ];
}
