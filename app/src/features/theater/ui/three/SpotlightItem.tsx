import { tc } from "../../../../shared/styles/theme-color";
import { Billboard, Text, TransformControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout, TheaterSpotlight } from "../../../../shared/types/script";
import { applyAlignGuideSnap } from "../../model/theater-align-guides";
import { snapTheaterHallPoint } from "../../model/theater-hall-grid";
import {
  theaterSpotlightDistance,
  theaterSpotlightLightIntensity,
  THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
  THEATER_SPOTLIGHT_DECAY,
  THEATER_SPOTLIGHT_PENUMBRA,
} from "../../model/theater-scene-lighting";

export const SpotlightItem = ({
  config,
  isActive,
  isSelected = false,
  isPulsing = false,
  dragMode,
  snapEnabled,
  snapStep,
  hallWidth,
  hallDepth,
  layout,
  alignGuidesEnabled = false,
  onAlignGuidesChange,
  showHelpers,
  showGuideLine = true,
  onTargetChange,
  onPositionChange,
  onDraggingChange,
  sceneDragging = false,
  onDragStart,
  onDragEnd,
  onContextMenu,
  onSelect,
}: {
  config: TheaterSpotlight;
  isActive: boolean;
  isSelected?: boolean;
  isPulsing?: boolean;
  dragMode: "target" | "source";
  snapEnabled: boolean;
  snapStep: number;
  hallWidth: number;
  hallDepth: number;
  layout: TheaterLayout;
  alignGuidesEnabled?: boolean;
  onAlignGuidesChange?: (guides: ReturnType<typeof applyAlignGuideSnap>["guides"]) => void;
  showHelpers: boolean;
  showGuideLine?: boolean;
  onTargetChange: (id: number, next: [number, number, number]) => void;
  onPositionChange: (id: number, next: [number, number, number]) => void;
  onDraggingChange: (value: boolean) => void;
  /** Parent isDragging; false while Escape cancels an in-progress gizmo drag. */
  sceneDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onContextMenu?: (id: number, clientX: number, clientY: number) => void;
  onSelect?: (id: number, additive: boolean, clientX?: number, clientY?: number) => void;
}) => {
  const spotRef = useRef<THREE.SpotLight | null>(null);
  const targetRef = useRef<THREE.Mesh | null>(null);
  const sourceRef = useRef<THREE.Mesh | null>(null);
  const fixtureRef = useRef<THREE.Group | null>(null);
  const labelRef = useRef<THREE.Mesh | null>(null);
  const labelWorld = useRef(new THREE.Vector3());
  const pulseRef = useRef(0);
  const aimTarget = useRef(new THREE.Vector3(...config.target));
  const [dragPreviewTarget, setDragPreviewTarget] = useState<
    [number, number, number] | null
  >(null);
  const [dragPreviewSource, setDragPreviewSource] = useState<
    [number, number, number] | null
  >(null);

  useEffect(() => {
    if (isPulsing) pulseRef.current = 1;
  }, [isPulsing]);
  const dragGestureRef = useRef(false);
  const pendingDragPositionRef = useRef<[number, number, number] | null>(null);
  const prevSceneDraggingRef = useRef(sceneDragging);
  const { camera } = useThree();

  useEffect(() => {
    if (prevSceneDraggingRef.current && !sceneDragging && dragGestureRef.current) {
      dragGestureRef.current = false;
      pendingDragPositionRef.current = null;
      setDragPreviewTarget(null);
      setDragPreviewSource(null);
      aimTarget.current.set(...config.target);
      if (targetRef.current) {
        targetRef.current.position.set(...config.target);
      }
      if (sourceRef.current) {
        sourceRef.current.position.set(...config.position);
      }
      onAlignGuidesChange?.([]);
    }
    prevSceneDraggingRef.current = sceneDragging;
  }, [
    config.position,
    config.target,
    onAlignGuidesChange,
    sceneDragging,
  ]);
  const displayTarget = dragPreviewTarget ?? config.target;
  const displayPosition = dragPreviewSource ?? config.position;
  const angle = THREE.MathUtils.degToRad(config.angleDeg);
  const beamDistance = useMemo(
    () => theaterSpotlightDistance(displayPosition, displayTarget),
    [displayPosition, displayTarget],
  );
  const isEnabled = config.enabled ?? true;
  const channelLabel = config.channel ?? config.id;
  const isRgb = config.isRgb ?? false;
  const uiIntensity = config.intensity ?? THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY;
  const lightIntensity = theaterSpotlightLightIntensity(uiIntensity, isRgb);
  const beamLineGeometry = useMemo(() => {
    const points = [
      new THREE.Vector3(...displayPosition),
      new THREE.Vector3(...displayTarget),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [displayPosition, displayTarget]);
  const isHighlighted = isActive || isSelected;
  const highlightFocus = tc("--color-active-ascent");
  const sourceColor = isHighlighted
    ? highlightFocus
    : config.color || tc("--color-warning");
  const labelVisible = showHelpers || isHighlighted;
  const fixtureVisible = showHelpers || isHighlighted;

  useEffect(() => {
    aimTarget.current.set(...config.target);
    if (dragPreviewTarget) return;
    if (targetRef.current) {
      targetRef.current.position.set(...config.target);
    }
  }, [config.target, dragPreviewTarget]);

  useEffect(() => {
    if (!fixtureRef.current) return;
    const start = new THREE.Vector3(...displayPosition);
    const end = new THREE.Vector3(...displayTarget);
    fixtureRef.current.position.copy(start);
    fixtureRef.current.lookAt(end);
  }, [displayPosition, displayTarget]);

  useFrame((_, delta) => {
    const spot = spotRef.current;
    if (spot) {
      if (!spot.target.parent && spot.parent) {
        spot.parent.add(spot.target);
      }
      if (dragMode === "source" && sourceRef.current && dragGestureRef.current) {
        spot.position.copy(sourceRef.current.position);
      } else {
        spot.position.set(...displayPosition);
      }
      if (dragMode === "target" && targetRef.current && dragGestureRef.current) {
        aimTarget.current.copy(targetRef.current.position);
      } else {
        aimTarget.current.set(...displayTarget);
      }
      spot.target.position.copy(aimTarget.current);
      spot.target.updateMatrixWorld();
    }
    if (pulseRef.current > 0) {
      pulseRef.current = Math.max(0, pulseRef.current - delta * 0.9);
    }
    if (sourceRef.current) {
      const pulseScale = pulseRef.current > 0 ? 1 + pulseRef.current * 0.25 : 1;
      const pickScale = isHighlighted ? (isActive ? 1.45 : 1.28) : 1;
      sourceRef.current.scale.setScalar(pulseScale * pickScale);
    }
    if (fixtureRef.current && pulseRef.current > 0) {
      const pulseScale = 1 + pulseRef.current * 0.35;
      fixtureRef.current.scale.setScalar(pulseScale);
    } else if (fixtureRef.current) {
      fixtureRef.current.scale.setScalar(isHighlighted ? 1.08 : 1);
    }
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
          position={displayPosition}
          angle={angle}
          penumbra={THEATER_SPOTLIGHT_PENUMBRA}
          intensity={lightIntensity}
          distance={beamDistance}
          decay={THEATER_SPOTLIGHT_DECAY}
          color={config.color || tc("--color-warning")}
        />
      )}
      {showGuideLine && labelVisible && isEnabled ? (
        <line geometry={beamLineGeometry} raycast={() => null}>
          <lineBasicMaterial
            color={
              isHighlighted
                ? highlightFocus
                : config.color || tc("--color-warning")
            }
            transparent
            opacity={isHighlighted ? 0.72 : 0.28}
            depthWrite={false}
          />
        </line>
      ) : null}
      {showHelpers &&
        isActive &&
        ((dragMode === "target" && targetRef.current) ||
          (dragMode === "source" && sourceRef.current)) && (
          <TransformControls
            mode="translate"
            onMouseDown={() => {
              dragGestureRef.current = true;
              pendingDragPositionRef.current = null;
              onDragStart?.();
              onDraggingChange(true);
            }}
              onMouseUp={() => {
                const pending = pendingDragPositionRef.current;
                pendingDragPositionRef.current = null;
                dragGestureRef.current = false;
                setDragPreviewTarget(null);
                setDragPreviewSource(null);
                if (pending) {
                  if (dragMode === "target") {
                    onTargetChange(config.id, pending);
                  } else {
                    onPositionChange(config.id, pending);
                  }
                }
                onAlignGuidesChange?.([]);
                onDraggingChange(false);
                onDragEnd?.();
              }}
              onObjectChange={() => {
                if (!dragGestureRef.current) {
                  dragGestureRef.current = true;
                  onDragStart?.();
                  onDraggingChange(true);
                }
                const applyPositionSnap = (x: number, y: number, z: number) => {
                  let nx = x;
                  let ny = y;
                  let nz = z;
                  if (snapEnabled && snapStep > 0) {
                    [nx, nz] = snapTheaterHallPoint(
                      nx,
                      nz,
                      hallWidth,
                      hallDepth,
                      snapStep,
                      true,
                    );
                  }
                  if (alignGuidesEnabled) {
                    const aligned = applyAlignGuideSnap(nx, nz, layout, true, {
                      spotlightWashLine: dragMode === "source",
                    });
                    nx = aligned.x;
                    nz = aligned.z;
                    onAlignGuidesChange?.(aligned.guides);
                  }
                  return [nx, ny, nz] as const;
                };
                if (dragMode === "target" && targetRef.current) {
                  const { x, y, z } = targetRef.current.position;
                  const [sx, sy, sz] = applyPositionSnap(x, y, z);
                  targetRef.current.position.set(sx, sy, sz);
                  pendingDragPositionRef.current = [sx, sy, sz];
                  setDragPreviewTarget([sx, sy, sz]);
                }
                if (dragMode === "source" && sourceRef.current) {
                  const { x, y, z } = sourceRef.current.position;
                  const [sx, sy, sz] = applyPositionSnap(x, y, z);
                  sourceRef.current.position.set(sx, sy, sz);
                  pendingDragPositionRef.current = [sx, sy, sz];
                  setDragPreviewSource([sx, sy, sz]);
                }
              }}
            showX
            showY
            showZ
            object={dragMode === "target" ? targetRef.current! : sourceRef.current!}
          />
        )}
      <mesh
        ref={sourceRef}
        position={config.position}
        visible={labelVisible}
        onPointerDown={(event) => {
          event.stopPropagation();
          onSelect?.(
            config.id,
            event.shiftKey,
            event.nativeEvent.clientX,
            event.nativeEvent.clientY,
          );
        }}
        onContextMenu={(event) => {
          event.stopPropagation();
          event.nativeEvent.preventDefault();
          onContextMenu?.(
            config.id,
            event.nativeEvent.clientX,
            event.nativeEvent.clientY,
          );
        }}
      >
        <sphereGeometry args={[isHighlighted ? 0.22 : 0.18, 16, 16]} />
        <meshStandardMaterial
          color={sourceColor}
          emissive={isHighlighted ? sourceColor : tc("--color-text-secondary")}
          emissiveIntensity={isHighlighted ? (isActive ? 1.4 : 1) : 0}
          toneMapped={false}
        />
      </mesh>
      <group ref={fixtureRef} visible={fixtureVisible}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.28, 0.24, isRgb ? 0.24 : 0.6, 20]} />
          <meshStandardMaterial
            color={isEnabled ? tc("--color-border-default") : tc("--color-border-lighter")}
            emissive={isHighlighted ? highlightFocus : tc("--color-text-secondary")}
            emissiveIntensity={isHighlighted ? 0.35 : 0}
          />
        </mesh>
        <mesh
          position={[0, 0, isRgb ? -0.2 : -0.45]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <coneGeometry args={[0.32, isRgb ? 0.18 : 0.35, 20]} />
          <meshStandardMaterial
            color={isEnabled ? tc("--color-surface-1") : tc("--color-slate-600")}
            emissive={isHighlighted ? highlightFocus : tc("--color-text-secondary")}
            emissiveIntensity={isHighlighted ? 0.25 : 0}
          />
        </mesh>
        <mesh position={[0, -0.2, 0]}>
          <boxGeometry args={[0.35, 0.08, 0.2]} />
          <meshStandardMaterial color={isEnabled ? tc("--color-slate-600") : tc("--color-text-dimmer")} />
        </mesh>
        {isRgb && null}
      </group>
      <Billboard
        position={[config.position[0], config.position[1] + 0.7, config.position[2]]}
        visible={labelVisible}
      >
        <Text
          ref={labelRef}
          fontSize={isActive ? 0.72 : isHighlighted ? 0.58 : 0.38}
          color={
            isHighlighted
              ? highlightFocus
              : isEnabled
                ? tc("--color-text-ui")
                : tc("--color-text-dimmer")
          }
          outlineWidth={isHighlighted ? 0.08 : 0.02}
          outlineColor={tc("--color-surface-1")}
          anchorX="center"
          anchorY="bottom"
          fontWeight={isHighlighted ? "bold" : "normal"}
        >
          {String(channelLabel)}
        </Text>
      </Billboard>
      <mesh
        ref={targetRef}
        position={config.target}
        visible={labelVisible && isHighlighted}
        onContextMenu={(event) => {
          event.stopPropagation();
          event.nativeEvent.preventDefault();
          onContextMenu?.(
            config.id,
            event.nativeEvent.clientX,
            event.nativeEvent.clientY,
          );
        }}
      >
        <sphereGeometry args={[isActive ? 0.2 : 0.16, 16, 16]} />
        <meshStandardMaterial
          color={isHighlighted ? highlightFocus : tc("--color-light-sky")}
          emissive={isHighlighted ? highlightFocus : tc("--color-text-secondary")}
          emissiveIntensity={isHighlighted ? (isActive ? 0.8 : 0.45) : 0.2}
        />
      </mesh>
    </>
  );
};

