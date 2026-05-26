import type { TheaterLayout, TheaterModel } from "../../../shared/types/script";
import { getAudienceBoundaryZ } from "./theater-metrics";
import {
  isParametricDecorBuiltin,
  resolveDecorSize,
} from "./theater-decor-catalog";
import { snapTheaterHallPoint } from "./theater-hall-grid";

export function resolveModelHalfDepth(model: TheaterModel): number {
  if (isParametricDecorBuiltin(model.builtin)) {
    const [, , depth] = resolveDecorSize(model);
    return (depth * Math.abs(model.scale[2])) / 2;
  }
  return 0.5 * Math.abs(model.scale[2]);
}

export function resolveModelHalfWidth(model: TheaterModel): number {
  if (isParametricDecorBuiltin(model.builtin)) {
    const [width] = resolveDecorSize(model);
    return (width * Math.abs(model.scale[0])) / 2;
  }
  return 0.5 * Math.abs(model.scale[0]);
}

function maybeSnapPosition(
  x: number,
  z: number,
  layout: TheaterLayout,
  snapEnabled: boolean,
  gridStep: number,
): [number, number] {
  if (!snapEnabled || gridStep <= 0) return [x, z];
  return snapTheaterHallPoint(
    x,
    z,
    layout.hallWidth,
    layout.hallDepth,
    gridStep,
    true,
  );
}

export function positionAtBackWall(
  model: TheaterModel,
  layout: TheaterLayout,
  snapEnabled: boolean,
  gridStep: number,
): [number, number, number] {
  const halfD = layout.hallDepth / 2;
  const [x, z] = maybeSnapPosition(
    model.position[0],
    -halfD + resolveModelHalfDepth(model),
    layout,
    snapEnabled,
    gridStep,
  );
  return [x, model.position[1], z];
}

export function positionAtAudienceBoundary(
  model: TheaterModel,
  layout: TheaterLayout,
  snapEnabled: boolean,
  gridStep: number,
): [number, number, number] {
  const boundaryZ = getAudienceBoundaryZ(layout);
  const [x, z] = maybeSnapPosition(
    model.position[0],
    boundaryZ - resolveModelHalfDepth(model),
    layout,
    snapEnabled,
    gridStep,
  );
  return [x, model.position[1], z];
}

export function positionAtHallCenter(
  model: TheaterModel,
  layout: TheaterLayout,
  snapEnabled: boolean,
  gridStep: number,
): [number, number, number] {
  const [x, z] = maybeSnapPosition(0, 0, layout, snapEnabled, gridStep);
  return [x, model.position[1], z];
}

export function positionAtLeftWall(
  model: TheaterModel,
  layout: TheaterLayout,
  snapEnabled: boolean,
  gridStep: number,
): [number, number, number] {
  const halfW = layout.hallWidth / 2;
  const [x, z] = maybeSnapPosition(
    -halfW + resolveModelHalfWidth(model),
    model.position[2],
    layout,
    snapEnabled,
    gridStep,
  );
  return [x, model.position[1], z];
}

export function positionAtRightWall(
  model: TheaterModel,
  layout: TheaterLayout,
  snapEnabled: boolean,
  gridStep: number,
): [number, number, number] {
  const halfW = layout.hallWidth / 2;
  const [x, z] = maybeSnapPosition(
    halfW - resolveModelHalfWidth(model),
    model.position[2],
    layout,
    snapEnabled,
    gridStep,
  );
  return [x, model.position[1], z];
}

export function rotateModelByQuarterTurn(
  model: TheaterModel,
  direction: "cw" | "ccw",
): [number, number, number] {
  const delta = direction === "cw" ? -Math.PI / 2 : Math.PI / 2;
  const nextY = model.rotation[1] + delta;
  return [model.rotation[0], nextY, model.rotation[2]];
}

export type ModelPlacementPreset =
  | "backWall"
  | "frontWall"
  | "center"
  | "leftWall"
  | "rightWall";

export function resolveModelPlacementPosition(
  preset: ModelPlacementPreset,
  model: TheaterModel,
  layout: TheaterLayout,
  snapEnabled: boolean,
  gridStep: number,
): [number, number, number] {
  switch (preset) {
    case "backWall":
      return positionAtBackWall(model, layout, snapEnabled, gridStep);
    case "frontWall":
      return positionAtAudienceBoundary(model, layout, snapEnabled, gridStep);
    case "center":
      return positionAtHallCenter(model, layout, snapEnabled, gridStep);
    case "leftWall":
      return positionAtLeftWall(model, layout, snapEnabled, gridStep);
    case "rightWall":
      return positionAtRightWall(model, layout, snapEnabled, gridStep);
  }
}
