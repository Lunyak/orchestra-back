import type { TheaterLayout, TheaterWallRecessWall } from "../../../shared/types/script";
import { labelM, roundM } from "../model/theater-metrics";
import {
  findLayoutWallRecess,
  getRecessPosBounds,
  THEATER_RECESS_WALL_LABELS,
} from "../model/theater-wall-recesses";
import type { TheaterObjectContextMenuItem } from "./TheaterObjectContextMenu";

const RECESS_WALLS: TheaterWallRecessWall[] = ["left", "right", "back"];

function formatMeters(value: number) {
  return String(roundM(value));
}

export function buildRecessContextMenuItems(
  layout: TheaterLayout,
  recessId: number,
): TheaterObjectContextMenuItem[] {
  const recess = findLayoutWallRecess(layout, recessId);
  if (!recess) return [];
  const posBounds = getRecessPosBounds(recess, layout);

  return [
    {
      id: "recess-wall",
      label: "Стена",
      children: RECESS_WALLS.map((wall) => ({
        id: `recess-wall:${wall}`,
        label: THEATER_RECESS_WALL_LABELS[wall],
        active: recess.wall === wall,
      })),
    },
    {
      id: "recess-pos",
      label: labelM("Позиция"),
      range: {
        min: posBounds.min,
        max: Math.max(posBounds.min, posBounds.max),
        step: 0.1,
        value: recess.pos,
        formatValue: formatMeters,
      },
    },
    {
      id: "recess-width",
      label: labelM("Длина"),
      range: {
        min: 0.6,
        max: 4,
        step: 0.1,
        value: recess.width,
        formatValue: formatMeters,
      },
    },
    {
      id: "recess-depth",
      label: labelM("Глубина"),
      range: {
        min: 0.3,
        max: 2.5,
        step: 0.1,
        value: recess.depth,
        formatValue: formatMeters,
      },
    },
    {
      id: "recess-filled",
      label: "Заполнить пол и потолок",
      active: Boolean(recess.filled),
    },
    {
      id: "recess-delete",
      label: "Удалить",
      danger: true,
    },
  ];
}
