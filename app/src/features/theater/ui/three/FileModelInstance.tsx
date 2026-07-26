import { tc } from "../../../../shared/styles/theme-color";
import { useAnimations, useGLTF } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { TheaterModel } from "../../../../shared/types/script";

export const FileModelInstance = ({
  model,
  url,
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
}: {
  model: TheaterModel;
  url: string;
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
}) => {
  const groupRef = useRef<THREE.Group | null>(null);
  const gltf = useGLTF(url);
  const scene = useMemo(() => SkeletonUtils.clone(gltf.scene), [gltf.scene]);
  const { actions, names } = useAnimations(gltf.animations, scene);

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

  useEffect(() => {
    if (!names.length) return;
    names.forEach((name) => actions[name]?.reset().play());
    return () => {
      names.forEach((name) => actions[name]?.stop());
    };
  }, [actions, names]);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const materials = Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material];
      materials.forEach((material) => {
        const standard = material as THREE.MeshStandardMaterial;
        if (!standard?.color) return;
        const data = standard.userData || (standard.userData = {});
        if (!data.textureStripped) {
          const textureKeys: (keyof THREE.MeshStandardMaterial)[] = [
            "map",
            "normalMap",
            "roughnessMap",
            "metalnessMap",
            "aoMap",
            "emissiveMap",
            "bumpMap",
            "displacementMap",
            "alphaMap",
            "lightMap",
            "envMap",
          ];
          const textureCount = textureKeys.reduce((acc, key) => {
            return (standard as any)[key] ? acc + 1 : acc;
          }, 0);
          if (textureCount > 6) {
            standard.normalMap = null;
            standard.roughnessMap = null;
            standard.metalnessMap = null;
            standard.aoMap = null;
            standard.bumpMap = null;
            standard.displacementMap = null;
            standard.alphaMap = null;
            standard.lightMap = null;
            standard.envMap = null;
            standard.needsUpdate = true;
          }
          data.textureStripped = true;
        }
        if (!data.originalColor) {
          data.originalColor = standard.color.clone();
        }
        if (standard.emissive && !data.originalEmissive) {
          data.originalEmissive = standard.emissive.clone();
        }
        const isRequisite = model.isRequisite === true;
        if (isSelected) {
          standard.color.set(tc("--color-error"));
          if (standard.emissive) {
            standard.emissive.set(tc("--color-danger-emissive"));
            standard.emissiveIntensity = 0.4;
          }
        } else if (isHovered) {
          standard.color.set(tc("--color-primary-light"));
          if (standard.emissive) {
            standard.emissive.set(tc("--color-primary-dark"));
            standard.emissiveIntensity = 0.35;
          }
        } else if (isRequisite) {
          standard.color.copy(data.originalColor);
          if (standard.emissive) {
            standard.emissive.set(tc("--color-active-ascent"));
            standard.emissiveIntensity = 0.22;
          }
        } else {
          standard.color.copy(data.originalColor);
          if (standard.emissive && data.originalEmissive) {
            standard.emissive.copy(data.originalEmissive);
            standard.emissiveIntensity = 1;
          }
        }
      });
    });
  }, [isHovered, isSelected, model.isRequisite]);

  return (
    <group
      ref={groupRef}
      position={model.position}
      rotation={model.rotation}
      scale={model.scale}
      onPointerDown={(event) => {
        if (passThroughPointerEvents) return;
        event.stopPropagation();
        if (event.button !== 0) return;
        onSelect?.(event.nativeEvent.shiftKey);
      }}
      onContextMenu={(event) => {
        if (passThroughPointerEvents) return;
        event.stopPropagation();
        event.nativeEvent.preventDefault();
        onContextMenu?.(
          model.id,
          event.nativeEvent.clientX,
          event.nativeEvent.clientY,
        );
      }}
      onDoubleClick={(event) => {
        if (passThroughPointerEvents) return;
        event.stopPropagation();
        onActivate?.();
      }}
      onPointerOver={(event) => {
        if (passThroughPointerEvents) return;
        event.stopPropagation();
        onHoverChange?.(true);
      }}
      onPointerOut={(event) => {
        if (passThroughPointerEvents) return;
        event.stopPropagation();
        onHoverChange?.(false);
      }}
    >
      <primitive object={scene} />
    </group>
  );
};

