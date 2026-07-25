import type {
  TheaterDoor,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import {
  DECOR_CATALOG,
  isTheaterDecorModel,
} from "./theater-decor-catalog";
import { THEATER_DOOR_WALL_LABELS } from "./theater-doors";
import { formatLightChannelSlot } from "./theater-light-channel-link";
import { resolveZoneGrid } from "./theater-zone-grid";

export type SceneOutlinerKind = "spotlight" | "model" | "decor" | "door" | "layout";

/** CSS-класс типа в духе three.js editor (#outliner .Mesh, .Light, …). */
export function sceneOutlinerKindTypeClass(kind: SceneOutlinerKind): string {
  switch (kind) {
    case "spotlight":
      return "Light";
    case "model":
    case "decor":
      return "Mesh";
    case "door":
      return "Object3D";
    case "layout":
      return "Scene";
    default:
      return "Object3D";
  }
}

export type SceneOutlinerItem = {
  id: number;
  kind: SceneOutlinerKind;
  label: string;
  meta?: string;
  muted?: boolean;
  hidden?: boolean;
  canHide?: boolean;
};

export type SceneOutlinerGroup = {
  id: string;
  title: string;
  items: SceneOutlinerItem[];
};

function resolveModelLabel(model: TheaterModel): string {
  if (model.name?.trim()) return model.name.trim();
  if (model.type === "file") {
    const file = model.file ?? "";
    const tail = file.split(/[/\\]/).pop();
    return tail?.trim() ? tail : `GLB #${model.id}`;
  }
  const decorEntry = DECOR_CATALOG.find((entry) => entry.builtin === model.builtin);
  if (decorEntry) return decorEntry.label;
  if (model.builtin) return String(model.builtin);
  return `#${model.id}`;
}

function resolveModelMeta(model: TheaterModel): string | undefined {
  if (model.type === "file") return "GLB";
  if (isTheaterDecorModel(model)) return "декор";
  if (model.builtin) return "встроенная";
  return undefined;
}

export function buildSceneOutlinerGroups(args: {
  spotlights: TheaterSpotlight[];
  models: TheaterModel[];
  doors: TheaterDoor[];
  layout: TheaterLayout;
}): SceneOutlinerGroup[] {
  const groups: SceneOutlinerGroup[] = [];

  groups.push({
    id: "layout",
    title: "План",
    items: [
      {
        id: 0,
        kind: "layout",
        label: "Зал",
        meta: `${args.layout.hallWidth}×${args.layout.hallDepth}`,
        canHide: false,
      },
      ...(args.layout.seatRows > 0
        ? [
            {
              id: 1,
              kind: "layout" as const,
              label: "Кресла",
              meta: `${args.layout.seatRows}×${args.layout.seatsPerRow} мест`,
              canHide: false,
            },
          ]
        : []),
      {
        id: 2,
        kind: "layout",
        label: "Сетка сцены",
        meta: (() => {
          const grid = resolveZoneGrid(args.layout);
          return `${grid.cols}×${grid.rows}`;
        })(),
        canHide: false,
      },
    ],
  });

  if (args.spotlights.length > 0) {
    groups.push({
      id: "spotlights",
      title: "Свет",
      items: args.spotlights.map((spotlight) => ({
        id: spotlight.id,
        kind: "spotlight",
        label: spotlight.label?.trim() || `Софит ${spotlight.id}`,
        meta: [
          spotlight.channel != null
            ? formatLightChannelSlot(Number(spotlight.channel))
            : null,
          spotlight.isRgb ? "RGB" : null,
          spotlight.hidden ? "скрыт" : null,
          spotlight.enabled === false ? "выкл" : null,
        ]
          .filter(Boolean)
          .join(" · "),
        muted: spotlight.enabled === false || spotlight.hidden,
        hidden: spotlight.hidden,
        canHide: true,
      })),
    });
  }

  const furniture = args.models.filter((model) => !isTheaterDecorModel(model));
  if (furniture.length > 0) {
    groups.push({
      id: "models",
      title: "Модели",
      items: furniture.map((model) => ({
        id: model.id,
        kind: "model",
        label: resolveModelLabel(model),
        meta: [resolveModelMeta(model), model.hidden ? "скрыт" : null]
          .filter(Boolean)
          .join(" · "),
        hidden: model.hidden,
        muted: model.hidden,
        canHide: true,
      })),
    });
  }

  const decor = args.models.filter(isTheaterDecorModel);
  if (decor.length > 0) {
    groups.push({
      id: "decor",
      title: "Декор",
      items: decor.map((model) => ({
        id: model.id,
        kind: "decor",
        label: resolveModelLabel(model),
        meta: [resolveModelMeta(model), model.hidden ? "скрыт" : null]
          .filter(Boolean)
          .join(" · "),
        hidden: model.hidden,
        muted: model.hidden,
        canHide: true,
      })),
    });
  }

  if (args.doors.length > 0) {
    groups.push({
      id: "doors",
      title: "Двери",
      items: args.doors.map((door) => ({
        id: door.id,
        kind: "door",
        label: `Дверь #${door.id}`,
        meta: `${THEATER_DOOR_WALL_LABELS[door.wall]} · ${door.width}×${door.height}`,
        canHide: false,
      })),
    });
  }

  return groups;
}

export function filterSceneOutlinerGroups(
  groups: SceneOutlinerGroup[],
  query: string,
  options?: { hideHidden?: boolean },
): SceneOutlinerGroup[] {
  const needle = query.trim().toLowerCase();
  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (options?.hideHidden && item.hidden) return false;
        if (!needle) return true;
        const haystack = `${item.label} ${item.meta ?? ""}`.toLowerCase();
        return haystack.includes(needle);
      }),
    }))
    .filter((group) => group.items.length > 0);
}

export function countSceneOutlinerItems(groups: SceneOutlinerGroup[]): number {
  return groups.reduce((acc, group) => acc + group.items.length, 0);
}

export function resolveSceneOutlinerGroupVisibility(group: SceneOutlinerGroup): {
  hideableCount: number;
  hiddenCount: number;
  allHidden: boolean;
} {
  const hideable = group.items.filter((item) => item.canHide);
  const hiddenCount = hideable.filter((item) => item.hidden === true).length;
  return {
    hideableCount: hideable.length,
    hiddenCount,
    allHidden: hideable.length > 0 && hiddenCount === hideable.length,
  };
}

export function isSceneOutlinerItemActive(
  item: SceneOutlinerItem,
  active: {
    spotlightId?: number;
    modelId?: number;
    doorId?: number;
    layoutFocused?: boolean;
    audienceSeatsFocused?: boolean;
    stageGridFocused?: boolean;
  },
): boolean {
  switch (item.kind) {
    case "spotlight":
      return active.spotlightId === item.id;
    case "model":
    case "decor":
      return active.modelId === item.id;
    case "door":
      return active.doorId === item.id;
    case "layout":
      if (item.id === 1) return active.audienceSeatsFocused === true;
      if (item.id === 2) return active.stageGridFocused === true;
      return active.layoutFocused === true;
    default:
      return false;
  }
}
