import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { TheaterModel } from "../../../../shared/types/script";
import { BuiltinModel } from "./BuiltinModel";

export const BuiltinModelInstance = ({
  model,
  isActive,
  onActiveObjectChange,
  onObjectReady,
  onSelect,
  onActivate,
  isSelected,
  isHovered,
  onHoverChange,
}: {
  model: TheaterModel;
  isActive?: boolean;
  onActiveObjectChange?: (node: THREE.Group | null, id: number) => void;
  onObjectReady?: (node: THREE.Group | null, id: number) => void;
  onSelect?: () => void;
  onActivate?: () => void;
  isSelected?: boolean;
  isHovered?: boolean;
  onHoverChange?: (next: boolean) => void;
}) => {
  const groupRef = useRef<THREE.Group | null>(null);

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
      onPointerDown={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onActivate?.();
      }}
      onPointerOver={(event) => {
        event.stopPropagation();
        onHoverChange?.(true);
      }}
      onPointerOut={(event) => {
        event.stopPropagation();
        onHoverChange?.(false);
      }}
    >
      <BuiltinModel kind={model.builtin} isSelected={isSelected} isHovered={isHovered} />
    </group>
  );
};

