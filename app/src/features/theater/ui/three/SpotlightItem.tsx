import { tc } from "../../../../shared/styles/theme-color";
import { Billboard, Text, TransformControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout, TheaterSpotlight } from "../../../../shared/types/script";
import { applyAlignGuideSnap } from "../../model/theater-align-guides";
import { snapTheaterHallPoint } from "../../model/theater-hall-grid";
import { formatSpotlightChannelFaderShort } from "../../model/theater-spotlight-labels";
import {
  theaterSpotlightDistance,
  theaterSpotlightLightIntensity,
  THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
  THEATER_SPOTLIGHT_DECAY,
  THEATER_SPOTLIGHT_PENUMBRA,
} from "../../model/theater-scene-lighting";
import { StageSpotlightModel } from "./StageSpotlightModel";
import { SpotlightSmokeBeam } from "./SpotlightSmokeBeam";

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
  showSpotlightLabels = false,
  showGuideLine = true,
  smokeBeamVisible = false,
  smokeSaturation = 1,
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
  /** K / K+F над корпусом софита (все видимые в режиме софитов). */
  showSpotlightLabels?: boolean;
  showGuideLine?: boolean;
  smokeBeamVisible?: boolean;
  smokeSaturation?: number;
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
  const isHighlighted = isActive || isSelected;
  const headLabel = formatSpotlightChannelFaderShort(config);
  const headLabelFontSize =
    isActive ? 0.34 : isHighlighted ? 0.28 : headLabel.length > 3 ? 0.2 : 0.17;
  const isRgb = config.isRgb ?? false;
  const fixtureVariant = isRgb ? "rgb" : "fresnel";
  const fixtureScale = isRgb ? 0.52 : 0.46;
  const sourceIsMounted = config.mountModelId != null && Boolean(config.mountPointId);
  const transformEnabled = dragMode === "target" || !sourceIsMounted;
  const uiIntensity = config.intensity ?? THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY;
  const lightIntensity = theaterSpotlightLightIntensity(uiIntensity, isRgb);
  const beamLineGeometry = useMemo(() => {
    const points = [
      new THREE.Vector3(...displayPosition),
      new THREE.Vector3(...displayTarget),
    ];
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [displayPosition, displayTarget]);
  const highlightFocus = tc("--color-active-ascent");
  const beamLineObject = useMemo(() => {
    const material = new THREE.LineBasicMaterial({
      color: isHighlighted ? highlightFocus : config.color || tc("--color-warning"),
      transparent: true,
      opacity: isHighlighted ? 0.72 : 0.28,
      depthWrite: false,
    });
    return new THREE.Line(beamLineGeometry, material);
  }, [
    beamLineGeometry,
    config.color,
    highlightFocus,
    isHighlighted,
  ]);
  const headLabelVisible = showSpotlightLabels || showHelpers || isHighlighted;
  const helperVisible = showHelpers || isHighlighted;

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
      {smokeBeamVisible && isEnabled ? (
        <SpotlightSmokeBeam
          position={displayPosition}
          target={displayTarget}
          angleRad={angle}
          color={config.color || tc("--color-warning")}
          uiIntensity={uiIntensity}
          smokeSaturation={smokeSaturation}
        />
      ) : null}
      {showGuideLine && helperVisible && isEnabled ? (
        <primitive object={beamLineObject} raycast={() => null} />
      ) : null}
      {showHelpers &&
        isActive &&
        transformEnabled &&
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
                  const ny = y;
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
        visible={helperVisible}
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
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
          colorWrite={false}
        />
      </mesh>
      <group ref={fixtureRef} visible={helperVisible}>
        <group
          scale={fixtureScale}
          onPointerDown={(event) => {
            event.stopPropagation();
            if (event.button !== 0) return;
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
          <StageSpotlightModel
            lowDetail={config.modelLowDetail ?? false}
            variant={fixtureVariant}
          />
        </group>
      </group>
      <Billboard
        position={[config.position[0], config.position[1] + 0.7, config.position[2]]}
        visible={headLabelVisible}
      >
        <Text
          ref={labelRef}
          fontSize={headLabelFontSize}
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
          {headLabel}
        </Text>
      </Billboard>
      <mesh
        ref={targetRef}
        position={config.target}
        visible={helperVisible && isHighlighted}
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

