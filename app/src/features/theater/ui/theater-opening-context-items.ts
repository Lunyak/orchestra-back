import type { TheaterDoorWall, TheaterLayout } from "../../../shared/types/script";
import { isTheaterDoorWall } from "../model/theater-object-context";
import { labelM, roundM } from "../model/theater-metrics";
import {
  findLayoutWallOpening,
  getOpeningPosBounds,
  OPENING_HEIGHT_LIMITS,
  OPENING_WIDTH_LIMITS,
  THEATER_OPENING_WALL_LABELS,
} from "../model/theater-wall-openings";
import type { TheaterObjectContextMenuItem } from "./TheaterObjectContextMenu";

const OPENING_WALLS: TheaterDoorWall[] = ["left", "right", "back", "front"];

function formatMeters(value: number) {
  return String(roundM(value));
}

export function buildOpeningContextMenuItems(
  layout: TheaterLayout,
  openingId: number,
): TheaterObjectContextMenuItem[] {
  const opening = findLayoutWallOpening(layout, openingId);
  if (!opening) return [];
  const posBounds = getOpeningPosBounds(opening, layout);
  const sill = opening.sill ?? 0;
  const maxSill = Math.max(0, layout.wallHeight - OPENING_HEIGHT_LIMITS.min - 0.05);
  const maxHeight = Math.max(
    OPENING_HEIGHT_LIMITS.min,
    layout.wallHeight - sill - 0.05,
  );

  return [
    {
      id: "opening-wall",
      label: "Стена",
      children: OPENING_WALLS.map((wall) => ({
        id: `opening-wall:${wall}`,
        label: THEATER_OPENING_WALL_LABELS[wall],
        active: opening.wall === wall,
      })),
    },
    {
      id: "opening-pos",
      label: labelM("Позиция"),
      range: {
        min: posBounds.min,
        max: Math.max(posBounds.min, posBounds.max),
        step: 0.1,
        value: opening.pos,
        formatValue: formatMeters,
      },
    },
    {
      id: "opening-width",
      label: labelM("Ширина"),
      range: {
        min: OPENING_WIDTH_LIMITS.min,
        max: OPENING_WIDTH_LIMITS.max,
        step: 0.1,
        value: opening.width,
        formatValue: formatMeters,
      },
    },
    {
      id: "opening-height",
      label: labelM("Высота"),
      range: {
        min: OPENING_HEIGHT_LIMITS.min,
        max: maxHeight,
        step: 0.1,
        value: opening.height,
        formatValue: formatMeters,
      },
    },
    {
      id: "opening-sill",
      label: labelM("От пола"),
      range: {
        min: 0,
        max: maxSill,
        step: 0.1,
        value: sill,
        formatValue: formatMeters,
      },
    },
    {
      id: "opening-delete",
      label: "Удалить",
      danger: true,
    },
  ];
}

export function isOpeningWallPick(id: string): TheaterDoorWall | null {
  if (!id.startsWith("opening-wall:")) return null;
  const wall = id.slice("opening-wall:".length);
  return isTheaterDoorWall(wall) ? wall : null;
}
