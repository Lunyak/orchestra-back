import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { TheaterModel } from "../../../../shared/types/script";
import {
  getFurnitureBounds,
  isSeatableBuiltin,
  isHumanTheaterBuiltin,
} from "../../model/theater-furniture-metrics";
import { getTheaterAssetLibraryItem } from "../../model/theater-asset-library";
import { BuiltinModel } from "./BuiltinModel";

const FURNITURE_SELECTION_BUILTINS = new Set<
  NonNullable<TheaterModel["builtin"]>
>(["table", "roundTable", "cabinet", "blackCube"]);

function getBuiltinSelectionBox(
  model: TheaterModel,
): { size: [number, number, number]; center: [number, number, number] } | null {
  const libraryItem = getTheaterAssetLibraryItem(model.builtin);
  if (libraryItem) {
    return {
      size: libraryItem.size,
      center: [0, libraryItem.size[1] / 2, 0],
    };
  }

  if (model.builtin && isSeatableBuiltin(model.builtin)) {
    const [width, height, depth] = getFurnitureBounds(model.builtin);
    return {
      size: [width, Math.max(0.55, height), Math.max(0.42, depth)],
      center: [0, height / 2, 0],
    };
  }

  if (model.builtin && FURNITURE_SELECTION_BUILTINS.has(model.builtin)) {
    const [width, height, depth] = getFurnitureBounds(model.builtin);
    return {
      size: [width, height, depth],
      center: [0, height / 2, 0],
    };
  }

  if (model.builtin === "actor") {
    if (model.actorPose === "lie") {
      return { size: [0.85, 0.45, 1.9], center: [0, 0.2, 0] };
    }
    if (model.actorPose === "sit") {
      return { size: [0.75, 1.45, 0.9], center: [0, 0.7, 0.08] };
    }
    return { size: [0.75, 1.8, 0.7], center: [0, 0.9, 0] };
  }

  if (model.builtin === "stageActor") {
    return { size: [0.75, 1.8, 0.7], center: [0, 0.9, 0] };
  }

  if (model.builtin === "stageSpotlight") {
    return { size: [1.5, 1.5, 1.5], center: [0, 0, 0] };
  }

  if (model.builtin === "lightTruss6m") {
    return { size: [6.2, 0.9, 0.4], center: [0, 0, 0] };
  }

  if (isHumanTheaterBuiltin(model.builtin)) {
    const seated =
      model.builtin === "humanSitting" ||
      model.builtin === "humanSmoothSitting";
    return {
      size: seated ? [0.7, 1.25, 0.85] : [0.7, 1.8, 0.7],
      center: seated ? [0, 0.62, 0.08] : [0, 0.9, 0],
    };
  }

  return null;
}

export const BuiltinModelInstance = ({
  projectName,
  model,
  isActive,
  onActiveObjectChange,
  onObjectReady,
  onSelect,
  onActivate,
  onContextMenu,
  isSelected,
  isHovered,
  onHoverChange,
  passThroughPointerEvents,
  selectionBoxEnabled = true,
}: {
  projectName: string;
  model: TheaterModel;
  isActive?: boolean;
  onActiveObjectChange?: (node: THREE.Group | null, id: number) => void;
  onObjectReady?: (node: THREE.Group | null, id: number) => void;
  onSelect?: (additive?: boolean) => void;
  onActivate?: () => void;
  onContextMenu?: (modelId: number, clientX: number, clientY: number) => void;
  isSelected?: boolean;
  isHovered?: boolean;
  onHoverChange?: (next: boolean) => void;
  passThroughPointerEvents?: boolean;
  selectionBoxEnabled?: boolean;
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const selectionBox = getBuiltinSelectionBox(model);

  const handlePointerDown = (event: any) => {
    if (passThroughPointerEvents) return;
    event.stopPropagation();
    if (event.button !== 0) return;
    onSelect?.(event.nativeEvent.shiftKey);
  };

  const handleContextMenu = (event: any) => {
    if (passThroughPointerEvents) return;
    event.stopPropagation();
    event.nativeEvent.preventDefault();
    onContextMenu?.(
      model.id,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );
  };

  const handleDoubleClick = (event: any) => {
    if (passThroughPointerEvents) return;
    event.stopPropagation();
    onActivate?.();
  };

  const handlePointerOver = (event: any) => {
    if (passThroughPointerEvents) return;
    event.stopPropagation();
    onHoverChange?.(true);
  };

  const handlePointerOut = (event: any) => {
    if (passThroughPointerEvents) return;
    event.stopPropagation();
    onHoverChange?.(false);
  };

  useEffect(() => {
    if (!isActive || !onActiveObjectChange) return;
    onActiveObjectChange(groupRef.current, model.id);
    return () => onActiveObjectChange(null, model.id);
  }, [isActive, model.id, onActiveObjectChange]);

  useEffect(() => {
    if (!onObjectReady) return;
    onObjectReady(groupRef.current, model.id);
    return () => onObjectReady(null, model.id);
  }, [model.id, onObjectReady]);

  return (
    <group
      ref={groupRef}
      position={model.position}
      rotation={model.rotation}
      scale={model.scale}
      onPointerDown={handlePointerDown}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <BuiltinModel
        projectName={projectName}
        model={model}
        isSelected={isSelected}
        isHovered={isHovered}
      />
      {selectionBox && selectionBoxEnabled ? (
        <mesh
          position={selectionBox.center}
          userData={{ theaterHelper: true }}
          onPointerDown={handlePointerDown}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleDoubleClick}
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
        >
          <boxGeometry args={selectionBox.size} />
          <meshBasicMaterial
            transparent
            opacity={0.001}
            depthWrite={false}
            colorWrite={false}
          />
        </mesh>
      ) : null}
    </group>
  );
};
