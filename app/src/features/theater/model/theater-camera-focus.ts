import type { TheaterDoor, TheaterLayout, TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import type { SceneOutlinerItem } from "./theater-scene-outliner";
import { getDoorCenterOnWall } from "./theater-stage-geometry";
import { resolveHallOffsetX, resolveHallOffsetZ } from "./theater-hall-expand";

export const THEATER_CAMERA_FOCUS_EVENT = "orchestra:theater-camera-focus";

export type TheaterCameraFocusRequest = {
  target: [number, number, number];
  position?: [number, number, number];
  fov?: number;
};

export const THEATER_SCENE_PULSE_EVENT = "orchestra:theater-scene-pulse";

export type TheaterScenePulseRequest = {
  kind: SceneOutlinerItem["kind"];
  id: number;
};

export function requestTheaterScenePulse(request: TheaterScenePulseRequest) {
  window.dispatchEvent(
    new CustomEvent(THEATER_SCENE_PULSE_EVENT, { detail: request }),
  );
}

export function requestTheaterCameraFocus(request: TheaterCameraFocusRequest) {
  window.dispatchEvent(
    new CustomEvent(THEATER_CAMERA_FOCUS_EVENT, { detail: request }),
  );
}

function computeOrbitPosition(
  target: [number, number, number],
  distance = 12,
  height = 6,
): [number, number, number] {
  return [target[0] + distance * 0.25, target[1] + height, target[2] + distance];
}

function withHallOffset(
  layout: Pick<TheaterLayout, "hallOffsetX" | "hallOffsetZ"> | undefined,
  point: [number, number, number],
): [number, number, number] {
  if (!layout) return point;
  return [
    point[0] + resolveHallOffsetX(layout),
    point[1],
    point[2] + resolveHallOffsetZ(layout),
  ];
}

export function focusCameraForSpotlight(
  spotlight: TheaterSpotlight,
  layout?: Pick<TheaterLayout, "hallOffsetX" | "hallOffsetZ">,
): TheaterCameraFocusRequest {
  const target = withHallOffset(layout, [
    (spotlight.position[0] + spotlight.target[0]) / 2,
    Math.max(0.8, (spotlight.position[1] + spotlight.target[1]) / 2),
    (spotlight.position[2] + spotlight.target[2]) / 2,
  ]);
  return { target, position: computeOrbitPosition(target, 14, 7) };
}

export function focusCameraForModel(
  model: TheaterModel,
  layout?: Pick<TheaterLayout, "hallOffsetX" | "hallOffsetZ">,
): TheaterCameraFocusRequest {
  const target = withHallOffset(layout, [...model.position]);
  return { target, position: computeOrbitPosition(target, 11, 5) };
}

export function focusCameraForDoor(
  door: TheaterDoor,
  layout: TheaterLayout,
): TheaterCameraFocusRequest {
  const center = getDoorCenterOnWall(door, layout);
  const halfD = layout.hallDepth / 2;
  let target: [number, number, number];
  if (center && (door.wall === "left" || door.wall === "right")) {
    const inward = door.wall === "left" ? 1.2 : -1.2;
    target = [center.x + inward, door.height / 2, center.z];
  } else if (door.wall === "back" && center) {
    target = [center.x, door.height / 2, center.z + 1.2];
  } else if (door.wall === "front") {
    target = [door.pos, door.height / 2, halfD - 1.2];
  } else {
    target = [0, door.height / 2, 0];
  }
  target = withHallOffset(layout, target);
  return { target, position: computeOrbitPosition(target, 12, 5) };
}

export function focusCameraForLayout(layout: TheaterLayout): TheaterCameraFocusRequest {
  const offsetX = resolveHallOffsetX(layout);
  const offsetZ = resolveHallOffsetZ(layout);
  return {
    target: [offsetX, 1.2, offsetZ + layout.audienceStartZ * 0.25],
    position: [
      offsetX,
      layout.wallHeight + 4,
      offsetZ + layout.hallDepth * 0.85,
    ],
  };
}

export function focusCameraForAudienceSeats(
  layout: TheaterLayout,
): TheaterCameraFocusRequest {
  const offsetX = resolveHallOffsetX(layout);
  const offsetZ = resolveHallOffsetZ(layout);
  const blockDepth =
    layout.seatRows > 0 ? (layout.seatRows - 1) * layout.rowSpacing : 0;
  const centerZ = layout.audienceStartZ + blockDepth / 2;
  const target: [number, number, number] = [offsetX, 1.0, offsetZ + centerZ];
  return { target, position: computeOrbitPosition(target, 10, 5) };
}

export function resolveOutlinerCameraFocus(
  item: SceneOutlinerItem,
  ctx: {
    spotlights: TheaterSpotlight[];
    models: TheaterModel[];
    doors: TheaterDoor[];
    layout: TheaterLayout;
  },
): TheaterCameraFocusRequest | null {
  switch (item.kind) {
    case "spotlight": {
      const spotlight = ctx.spotlights.find((entry) => entry.id === item.id);
      return spotlight ? focusCameraForSpotlight(spotlight, ctx.layout) : null;
    }
    case "model":
    case "decor": {
      const model = ctx.models.find((entry) => entry.id === item.id);
      return model ? focusCameraForModel(model, ctx.layout) : null;
    }
    case "door": {
      const door = ctx.doors.find((entry) => entry.id === item.id);
      return door ? focusCameraForDoor(door, ctx.layout) : null;
    }
    case "layout":
      if (item.id === 1) return focusCameraForAudienceSeats(ctx.layout);
      return focusCameraForLayout(ctx.layout);
    default:
      return null;
  }
}
