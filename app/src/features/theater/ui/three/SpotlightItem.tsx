import { Billboard, Text, TransformControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import type { TheaterSpotlight } from "../../../../shared/types/script";
import { SpotlightCone } from "./SpotlightCone";

export const SpotlightItem = ({
  config,
  isActive,
  dragMode,
  snapEnabled,
  snapStep,
  showHelpers,
  onTargetChange,
  onPositionChange,
  onDraggingChange,
}: {
  config: TheaterSpotlight;
  isActive: boolean;
  dragMode: "target" | "source";
  snapEnabled: boolean;
  snapStep: number;
  showHelpers: boolean;
  onTargetChange: (id: number, next: [number, number, number]) => void;
  onPositionChange: (id: number, next: [number, number, number]) => void;
  onDraggingChange: (value: boolean) => void;
}) => {
  const spotRef = useRef<THREE.SpotLight | null>(null);
  const targetRef = useRef<THREE.Mesh | null>(null);
  const sourceRef = useRef<THREE.Mesh | null>(null);
  const fixtureRef = useRef<THREE.Group | null>(null);
  const labelRef = useRef<THREE.Mesh | null>(null);
  const labelWorld = useRef(new THREE.Vector3());
  const { camera } = useThree();
  const angle = THREE.MathUtils.degToRad(config.angleDeg);
  const isEnabled = config.enabled ?? true;
  const channelLabel = config.channel ?? config.id;
  const isRgb = config.isRgb ?? false;

  useEffect(() => {
    if (spotRef.current && targetRef.current) {
      spotRef.current.target = targetRef.current;
    }
  }, []);

  useEffect(() => {
    if (!fixtureRef.current) return;
    const start = new THREE.Vector3(...config.position);
    const end = new THREE.Vector3(...config.target);
    fixtureRef.current.position.copy(start);
    fixtureRef.current.lookAt(end);
  }, [config.position, config.target]);

  useFrame(() => {
    if (!labelRef.current) return;
    labelRef.current.getWorldPosition(labelWorld.current);
    const distance = labelWorld.current.distanceTo(camera.position);
    const scale = THREE.MathUtils.clamp(distance / 12, 0.85, 1.6);
    labelRef.current.scale.setScalar(scale);
  });

  return (
    <>
      {isEnabled && (
        <spotLight
          ref={spotRef}
          position={config.position}
          angle={angle}
          penumbra={0.4}
          intensity={config.intensity}
          distance={30}
          decay={2}
          castShadow={!isRgb}
          color={config.color || "#fbbf24"}
        />
      )}
      {isEnabled && (
        <SpotlightCone
          position={config.position}
          target={config.target}
          angleDeg={config.angleDeg}
          intensity={config.intensity}
          color={config.color}
        />
      )}
      {showHelpers &&
        isActive &&
        ((dragMode === "target" && targetRef.current) ||
          (dragMode === "source" && sourceRef.current)) && (
          <TransformControls
            mode="translate"
            onMouseDown={() => onDraggingChange(true)}
            onMouseUp={() => onDraggingChange(false)}
            onObjectChange={() => {
              const applySnap = (x: number, y: number, z: number) => {
                if (!snapEnabled || snapStep <= 0) return [x, y, z] as const;
                const snap = (value: number) => Math.round(value / snapStep) * snapStep;
                return [snap(x), y, snap(z)] as const;
              };
              if (dragMode === "target" && targetRef.current) {
                const { x, y, z } = targetRef.current.position;
                const [sx, sy, sz] = applySnap(x, y, z);
                targetRef.current.position.set(sx, sy, sz);
                onTargetChange(config.id, [sx, sy, sz]);
              }
              if (dragMode === "source" && sourceRef.current) {
                const { x, y, z } = sourceRef.current.position;
                const [sx, sy, sz] = applySnap(x, y, z);
                sourceRef.current.position.set(sx, sy, sz);
                onPositionChange(config.id, [sx, sy, sz]);
              }
            }}
            showX
            showY
            showZ
            object={dragMode === "target" ? targetRef.current! : sourceRef.current!}
          />
        )}
      <mesh ref={sourceRef} position={config.position} castShadow visible={showHelpers}>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color={config.color || "#fbbf24"} />
      </mesh>
      <group ref={fixtureRef} visible={showHelpers}>
        <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
          <cylinderGeometry args={[0.28, 0.24, isRgb ? 0.24 : 0.6, 20]} />
          <meshStandardMaterial color={isEnabled ? "#1f2937" : "#334155"} />
        </mesh>
        <mesh
          position={[0, 0, isRgb ? -0.2 : -0.45]}
          rotation={[Math.PI / 2, 0, 0]}
          castShadow
        >
          <coneGeometry args={[0.32, isRgb ? 0.18 : 0.35, 20]} />
          <meshStandardMaterial color={isEnabled ? "#0f172a" : "#475569"} />
        </mesh>
        <mesh position={[0, -0.2, 0]} castShadow>
          <boxGeometry args={[0.35, 0.08, 0.2]} />
          <meshStandardMaterial color={isEnabled ? "#475569" : "#64748b"} />
        </mesh>
        {isRgb && null}
      </group>
      <Billboard
        position={[config.position[0], config.position[1] + 0.55, config.position[2]]}
        visible={showHelpers}
      >
        <Text
          ref={labelRef}
          fontSize={0.38}
          color={isEnabled ? "#e2e8f0" : "#64748b"}
          outlineWidth={0.02}
          outlineColor="#0f172a"
          anchorX="center"
          anchorY="bottom"
        >
          {String(channelLabel)}
        </Text>
      </Billboard>
      <mesh
        ref={targetRef}
        position={config.target}
        castShadow
        visible={showHelpers && isActive}
      >
        <sphereGeometry args={[0.14, 16, 16]} />
        <meshStandardMaterial color="#38bdf8" />
      </mesh>
    </>
  );
};

