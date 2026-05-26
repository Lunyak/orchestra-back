import type { TheaterModel } from "../../../shared/types/script";
import {
  getFurnitureSeatMetrics,
  isHumanTheaterBuiltin,
  isSeatableBuiltin,
  toSittingHumanBuiltin,
} from "./theater-furniture-metrics";

/**
 * The sitting human GLB keeps its origin near the floor, while the pelvis is
 * already raised roughly to chair height. Seat the pelvis, not the model origin.
 */
const SITTING_HUMAN_SEAT_ANCHOR_Y = 1.12;

function rotateOffset(
  x: number,
  z: number,
  rotationY: number,
): [number, number] {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  return [x * cos + z * sin, -x * sin + z * cos];
}

function horizontalDistance(a: TheaterModel, b: TheaterModel): number {
  return Math.hypot(a.position[0] - b.position[0], a.position[2] - b.position[2]);
}

export function findSeatingTargetForHuman(
  human: TheaterModel,
  models: TheaterModel[],
  selectedModelIds: number[],
): TheaterModel | null {
  const selected = new Set(selectedModelIds);
  const candidates = models.filter(
    (model) =>
      model.id !== human.id &&
      model.type !== "file" &&
      isSeatableBuiltin(model.builtin) &&
      !model.hidden,
  );
  if (candidates.length === 0) return null;

  const selectedFurniture = candidates.filter((model) => selected.has(model.id));
  const scoped = selectedFurniture.length > 0 ? selectedFurniture : candidates;
  return [...scoped].sort(
    (a, b) => horizontalDistance(human, a) - horizontalDistance(human, b),
  )[0] ?? null;
}

export function seatHumanOnFurniture(
  human: TheaterModel,
  furniture: TheaterModel,
): TheaterModel | null {
  if (!isHumanTheaterBuiltin(human.builtin) || !isSeatableBuiltin(furniture.builtin)) {
    return null;
  }

  const metrics = getFurnitureSeatMetrics(furniture.builtin);
  const scaleY = Math.abs(furniture.scale[1] || 1);
  const scaleZ = Math.abs(furniture.scale[2] || 1);
  const rotationY = furniture.rotation[1] ?? 0;
  const nextScale: [number, number, number] = [
    Math.max(0.75, Math.min(1.1, human.scale[0] || 0.9)),
    Math.max(0.75, Math.min(1.1, human.scale[1] || 0.9)),
    Math.max(0.75, Math.min(1.1, human.scale[2] || 0.9)),
  ];
  const [offsetX, offsetZ] = rotateOffset(
    0,
    metrics.seatOffsetZ * scaleZ,
    rotationY,
  );
  const seatTopY =
    furniture.position[1] + (metrics.seatHeight + metrics.seatThickness / 2) * scaleY;
  const originY = seatTopY - SITTING_HUMAN_SEAT_ANCHOR_Y * nextScale[1];

  return {
    ...human,
    builtin: toSittingHumanBuiltin(human.builtin),
    position: [
      furniture.position[0] + offsetX,
      originY,
      furniture.position[2] + offsetZ,
    ],
    rotation: [
      human.rotation[0],
      rotationY + metrics.facingOffset,
      human.rotation[2],
    ],
    scale: nextScale,
    allowOutOfBounds: human.allowOutOfBounds,
  };
}

export function isSittingHumanTheaterModel(model: TheaterModel): boolean {
  return model.builtin === "humanSitting" || model.builtin === "humanSmoothSitting";
}

export function canIgnoreSeatedHumanCollision(
  active: TheaterModel,
  other: TheaterModel,
): boolean {
  return (
    (isSittingHumanTheaterModel(active) && isSeatableBuiltin(other.builtin)) ||
    (isSeatableBuiltin(active.builtin) && isSittingHumanTheaterModel(other))
  );
}
