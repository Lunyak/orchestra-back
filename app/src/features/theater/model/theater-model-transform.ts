import * as THREE from "three";
import type { TheaterLayout, TheaterModel } from "../../../shared/types/script";
import {
  applyAlignGuideSnap,
  type ActiveAlignGuide,
} from "./theater-align-guides";
import { snapModelZToAudienceLine } from "./theater-audience-snap";
import { snapTheaterHallPoint } from "./theater-hall-grid";
import { resolveModelHalfDepth } from "./theater-model-placement";
import {
  canIgnoreSeatedHumanCollision,
  isSittingHumanTheaterModel,
} from "./theater-model-seating";

export type TheaterModelTransformPatch = Pick<
  TheaterModel,
  "position" | "rotation" | "scale"
>;

export type ApplyActiveModelTransformArgs = {
  obj: THREE.Object3D;
  activeModelId: number;
  activeModelObjectId: number | null;
  models: TheaterModel[];
  activeModel?: TheaterModel;
  layout: TheaterLayout;
  snapToGrid: boolean;
  gridStep: number;
  modelTransformMode: "translate" | "rotate" | "scale";
  alignGuidesEnabled: boolean;
  isDragging: boolean;
  modelObjectMap: Map<number, THREE.Object3D>;
  historyTransactionActive: boolean;
  dragLastValid: TheaterModelTransformPatch | null;
};

export type ApplyActiveModelTransformResult = {
  patch: TheaterModelTransformPatch | null;
  alignGuides: ActiveAlignGuide[] | null;
  dragLastValid: TheaterModelTransformPatch | null;
};

export function applyActiveModelTransform(
  args: ApplyActiveModelTransformArgs,
): ApplyActiveModelTransformResult {
  const {
    obj,
    activeModelId,
    activeModelObjectId,
    models,
    activeModel,
    layout,
    snapToGrid,
    gridStep,
    modelTransformMode,
    alignGuidesEnabled,
    isDragging,
    modelObjectMap,
    historyTransactionActive,
    dragLastValid: prevDragLastValid,
  } = args;

  if (activeModelObjectId !== activeModelId) {
    return { patch: null, alignGuides: null, dragLastValid: prevDragLastValid };
  }

  const prevModel = models.find((item) => item.id === activeModelId);
  const box = new THREE.Box3().setFromObject(obj);
  const allowBelowFloorAnchor = prevModel ? isSittingHumanTheaterModel(prevModel) : false;
  const lift = !allowBelowFloorAnchor && box.min.y < 0 ? -box.min.y : 0;
  let nextX = obj.position.x;
  let nextZ = obj.position.z;
  const allowOut = activeModel?.allowOutOfBounds ?? false;

  if (!allowOut) {
    const halfW = layout.hallWidth / 2;
    const halfD = layout.hallDepth / 2;
    if (box.min.x < -halfW) {
      nextX += -halfW - box.min.x;
    }
    if (box.max.x > halfW) {
      nextX -= box.max.x - halfW;
    }
    if (box.min.z < -halfD) {
      nextZ += -halfD - box.min.z;
    }
    if (box.max.z > halfD) {
      nextZ -= box.max.z - halfD;
    }
  }

  const clampedY = obj.position.y + lift;
  obj.position.set(nextX, clampedY, nextZ);

  if (snapToGrid && gridStep > 0 && modelTransformMode === "translate") {
    [nextX, nextZ] = snapTheaterHallPoint(
      nextX,
      nextZ,
      layout.hallWidth,
      layout.hallDepth,
      gridStep,
      true,
    );
    obj.position.set(nextX, clampedY, nextZ);
  }

  let alignGuides: ActiveAlignGuide[] | null = null;
  if (modelTransformMode === "translate" && alignGuidesEnabled) {
    const aligned = applyAlignGuideSnap(nextX, nextZ, layout, true);
    nextX = aligned.x;
    nextZ = aligned.z;
    alignGuides = aligned.guides;
    obj.position.set(nextX, clampedY, nextZ);
  } else if (!isDragging) {
    alignGuides = [];
  }

  if (prevModel && modelTransformMode === "translate") {
    nextZ = snapModelZToAudienceLine(
      nextZ,
      resolveModelHalfDepth(prevModel),
      layout.audienceStartZ,
    );
    obj.position.set(nextX, clampedY, nextZ);
  }

  const patch: TheaterModelTransformPatch = {
    position: [nextX, clampedY, nextZ],
    rotation: [obj.rotation.x, obj.rotation.y, obj.rotation.z],
    scale: [obj.scale.x, obj.scale.y, obj.scale.z],
  };

  if (prevModel) {
    if (prevModel.ignoreCollisions) {
      const nextDragLastValid = historyTransactionActive ? patch : prevDragLastValid;
      return { patch, alignGuides, dragLastValid: nextDragLastValid };
    }
    if (
      prevModel.type === "builtin" &&
      (prevModel.builtin === "strawGrid" || prevModel.builtin === "actor")
    ) {
      const nextDragLastValid = historyTransactionActive ? patch : prevDragLastValid;
      return { patch, alignGuides, dragLastValid: nextDragLastValid };
    }

    const activeBox = new THREE.Box3().setFromObject(obj);
    const collision = models.some((item) => {
      if (item.id === activeModelId) return false;
      if (item.type === "builtin" && item.builtin === "strawGrid") return false;
      if (item.ignoreCollisions) return false;
      if (canIgnoreSeatedHumanCollision(prevModel, item)) return false;
      const otherObject = modelObjectMap.get(item.id);
      if (otherObject) {
        const otherBox = new THREE.Box3().setFromObject(otherObject);
        return activeBox.intersectsBox(otherBox);
      }
      const pos = new THREE.Vector3(...item.position);
      const size = new THREE.Vector3(
        Math.max(0.2, Math.abs(item.scale[0]) * 0.8),
        Math.max(0.2, Math.abs(item.scale[1]) * 0.6),
        Math.max(0.2, Math.abs(item.scale[2]) * 0.8),
      );
      const otherBox = new THREE.Box3().setFromCenterAndSize(pos, size);
      return activeBox.intersectsBox(otherBox);
    });

    if (collision) {
      const fallback =
        historyTransactionActive && prevDragLastValid
          ? prevDragLastValid
          : prevModel
            ? {
                position: [...prevModel.position] as [number, number, number],
                rotation: [...prevModel.rotation] as [number, number, number],
                scale: [...prevModel.scale] as [number, number, number],
              }
            : null;
      if (fallback) {
        obj.position.set(...fallback.position);
        obj.rotation.set(
          fallback.rotation[0],
          fallback.rotation[1],
          fallback.rotation[2],
        );
        obj.scale.set(fallback.scale[0], fallback.scale[1], fallback.scale[2]);
        return { patch: fallback, alignGuides, dragLastValid: prevDragLastValid };
      }
    }
  }

  const nextDragLastValid = historyTransactionActive ? patch : prevDragLastValid;
  return { patch, alignGuides, dragLastValid: nextDragLastValid };
}

export type NudgeModelPositionArgs = {
  model: TheaterModel;
  deltaX: number;
  deltaZ: number;
  layout: TheaterLayout;
  snapToGrid: boolean;
  gridStep: number;
  alignGuidesEnabled: boolean;
};

export type NudgeModelPositionResult = {
  position: [number, number, number];
  alignGuides: ActiveAlignGuide[];
};

export function nudgeModelPosition(args: NudgeModelPositionArgs): NudgeModelPositionResult {
  const {
    model,
    deltaX,
    deltaZ,
    layout,
    snapToGrid,
    gridStep,
    alignGuidesEnabled,
  } = args;

  let nextX = model.position[0] + deltaX;
  let nextZ = model.position[2] + deltaZ;

  if (snapToGrid && gridStep > 0) {
    [nextX, nextZ] = snapTheaterHallPoint(
      nextX,
      nextZ,
      layout.hallWidth,
      layout.hallDepth,
      gridStep,
      true,
    );
  }

  let alignGuides: ActiveAlignGuide[] = [];
  if (alignGuidesEnabled) {
    const aligned = applyAlignGuideSnap(nextX, nextZ, layout, true);
    nextX = aligned.x;
    nextZ = aligned.z;
    alignGuides = aligned.guides;
  }

  nextZ = snapModelZToAudienceLine(
    nextZ,
    resolveModelHalfDepth(model),
    layout.audienceStartZ,
  );

  return {
    position: [nextX, model.position[1], nextZ],
    alignGuides,
  };
}

const FLOOR_LIFT_EPSILON = 1e-6;

export function liftModelObjectAboveFloor(obj: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(obj);
  const lift = box.min.y < 0 ? -box.min.y : 0;
  if (lift <= FLOOR_LIFT_EPSILON) return 0;
  obj.position.y += lift;
  return lift;
}
