import { tc } from "../../../../shared/styles/theme-color";
import { Billboard, Text } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { getAudienceStartZBounds, roundM } from "../../model/theater-metrics";
import {
  beginScreenPointerGesture,
  isScreenPointerClick,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";

type SeatMoveSide = "front" | "back";

const HANDLE_SIZE = 0.32;
const HANDLE_DEPTH = 0.12;

function snapValue(value: number, step: number, enabled: boolean, origin = 0) {
  if (!enabled || step <= 0) return value;
  return origin + Math.round((value - origin) / step) * step;
}

function seatBlockMetrics(layout: TheaterLayout) {
  const blockDepth =
    layout.seatRows > 0 ? (layout.seatRows - 1) * layout.rowSpacing : 0;
  const startZ = layout.audienceStartZ;
  const endZ = startZ + blockDepth;
  const centerZ = startZ + blockDepth / 2;
  const width = Math.max(
    1,
    (layout.seatsPerRow - 1) * layout.seatSpacing + layout.aisleWidth,
  );
  const boxDepth = Math.max(0.35, blockDepth + 0.35);
  return { blockDepth, startZ, endZ, centerZ, width, boxDepth };
}

type AudienceSeatsHandleProps = {
  layout: TheaterLayout;
  focused: boolean;
  highlighted?: boolean;
  selectable: boolean;
  snapEnabled: boolean;
  snapStep: number;
  onSelect: () => void;
  onAudienceStartZPreview: (nextZ: number) => void;
  onAudienceStartZChange: (nextZ: number) => void;
  onDraggingChange: (value: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export function AudienceSeatsHandle({
  layout,
  focused,
  highlighted = false,
  selectable,
  snapEnabled,
  snapStep,
  onSelect,
  onAudienceStartZPreview,
  onAudienceStartZChange,
  onDraggingChange,
  onDragStart,
  onDragEnd,
}: AudienceSeatsHandleProps) {
  const { gl } = useThree();
  const dragRef = useRef<{
    side: SeatMoveSide;
    startAudienceZ: number;
    startEdge: number;
    plane: THREE.Plane;
    lastZ: number | null;
  } | null>(null);
  const [draggingSide, setDraggingSide] = useState<SeatMoveSide | null>(null);
  const selectGestureRef = useRef<{
    gesture: ScreenPointerGesture;
    cleanup: () => void;
  } | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const { min: minZ, max: maxStartZ } = getAudienceStartZBounds(layout);
  const metrics = seatBlockMetrics(layout);
  const accent = tc("--color-active-ascent");

  useEffect(() => {
    return () => {
      selectGestureRef.current?.cleanup();
      selectGestureRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!draggingSide) return;
    const previous = gl.domElement.style.cursor;
    gl.domElement.style.cursor = "grabbing";
    return () => {
      gl.domElement.style.cursor = previous;
    };
  }, [draggingSide, gl.domElement]);

  if ((!selectable && !focused && !highlighted) || layout.seatRows <= 0) return null;

  const clampAudienceZ = (value: number) =>
    THREE.MathUtils.clamp(
      snapValue(value, snapStep, snapEnabled, -layout.hallDepth / 2),
      minZ,
      maxStartZ,
    );

  const beginSelectGesture = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    selectGestureRef.current?.cleanup();

    const gesture = beginScreenPointerGesture(
      event.pointerId,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );

    const finish = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== gesture.pointerId) return;
      cleanup();
      selectGestureRef.current = null;
      if (!isScreenPointerClick(gesture, nativeEvent.pointerId)) return;
      onSelect();
    };

    const onWindowMove = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== gesture.pointerId) return;
      updateScreenPointerGesture(gesture, nativeEvent.clientX, nativeEvent.clientY);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    selectGestureRef.current = { gesture, cleanup };
  };

  const applyDrag = (clientX: number, clientY: number, camera: THREE.Camera) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = gl.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;

    const pointerDelta = hitPoint.z - drag.startEdge;
    const nextZ = clampAudienceZ(drag.startAudienceZ + pointerDelta);
    drag.lastZ = nextZ;
    onAudienceStartZPreview(nextZ);
  };

  const beginDrag = (side: SeatMoveSide, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(event.point.x, 0.45, event.point.z),
    );

    dragRef.current = {
      side,
      startAudienceZ: layout.audienceStartZ,
      startEdge: event.point.z,
      plane,
      lastZ: null,
    };
    setDraggingSide(side);
    onDraggingChange(true);
    onDragStart();

    const onMove = (native: PointerEvent) => {
      applyDrag(native.clientX, native.clientY, event.camera);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const dragState = dragRef.current;
      dragRef.current = null;
      setDraggingSide(null);
      if (dragState?.lastZ != null) {
        onAudienceStartZChange(dragState.lastZ);
      }
      onDraggingChange(false);
      onDragEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const frontHandlePos: [number, number, number] = [0, 0.45, metrics.endZ];
  const backHandlePos: [number, number, number] = [0, 0.45, metrics.startZ];
  const label = `${roundM(layout.audienceStartZ)} м`;

  return (
    <group>
      {selectable ? (
        <mesh
          position={[0, 0.2, metrics.centerZ]}
          onPointerDown={beginSelectGesture}
        >
          <boxGeometry args={[metrics.width, 0.35, metrics.boxDepth]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ) : null}

      {focused || highlighted ? (
        <>
          <mesh position={[0, 0.45, metrics.centerZ]} raycast={() => null}>
            <boxGeometry args={[metrics.width, 0.12, metrics.boxDepth]} />
            <meshStandardMaterial
              color={accent}
              transparent
              opacity={0.28}
              depthWrite={false}
              emissive={accent}
              emissiveIntensity={0.35}
            />
          </mesh>

          {focused
            ? (
                [
                  {
                    side: "front" as const,
                    position: frontHandlePos,
                    labelOffset: [0, 0.35, 0.4],
                  },
                  {
                    side: "back" as const,
                    position: backHandlePos,
                    labelOffset: [0, 0.35, -0.4],
                  },
                ] as const
              ).map(({ side, position, labelOffset }) => {
                const isDragging = draggingSide === side;
                return (
                  <group key={side} position={position}>
                    <mesh
                      onPointerDown={(event) => {
                        if (event.button !== 0) return;
                        beginDrag(side, event);
                      }}
                    >
                      <boxGeometry
                        args={[
                          Math.min(2.2, metrics.width * 0.45),
                          HANDLE_SIZE,
                          HANDLE_DEPTH,
                        ]}
                      />
                      <meshStandardMaterial
                        color={accent}
                        transparent
                        opacity={isDragging ? 0.95 : 0.72}
                        emissive={accent}
                        emissiveIntensity={isDragging ? 0.55 : 0.28}
                        depthWrite={false}
                      />
                    </mesh>
                    {isDragging ? (
                      <group raycast={() => null}>
                        <Billboard position={labelOffset as [number, number, number]}>
                          <Text
                            fontSize={0.26}
                            color={accent}
                            anchorX="center"
                            anchorY="middle"
                            outlineWidth={0.02}
                            outlineColor={tc("--color-surface-1")}
                          >
                            {label}
                          </Text>
                        </Billboard>
                      </group>
                    ) : null}
                  </group>
                );
              })
            : null}
        </>
      ) : null}
    </group>
  );
}
