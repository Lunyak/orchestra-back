import { tc } from "../../../../shared/styles/theme-color";
import { Billboard, Text } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout, TheaterModel } from "../../../../shared/types/script";
import { snapTheaterHallPoint } from "../../model/theater-hall-grid";
import {
  getLightRigHandleBounds,
  type LightRigHandleBounds,
} from "../../model/theater-light-rig";
import { roundM } from "../../model/theater-metrics";
import {
  beginScreenPointerGesture,
  isScreenPointerClick,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";

type MoveSide = "east" | "west" | "south" | "north" | "center";

const HANDLE_SIZE = 0.28;
const HANDLE_DEPTH = 0.1;
const LABEL_OFFSET_Y = 0.32;
const IDLE_HIT_SIZE: [number, number, number] = [0.55, 0.16, 0.55];

type LightRigMoveHandleProps = {
  trusses: TheaterModel[];
  layout: TheaterLayout;
  focused: boolean;
  selectable: boolean;
  snapEnabled: boolean;
  snapStep: number;
  onSelect: () => void;
  onPreview: (deltaX: number, deltaZ: number) => void;
  onCommit: (deltaX: number, deltaZ: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export function LightRigMoveHandle({
  trusses,
  layout,
  focused,
  selectable,
  snapEnabled,
  snapStep,
  onSelect,
  onPreview,
  onCommit,
  onDraggingChange,
  onDragStart,
  onDragEnd,
}: LightRigMoveHandleProps) {
  const bounds = getLightRigHandleBounds(trusses);
  if (!bounds || trusses.length < 2) return null;
  if (!focused && !selectable) return null;
  return (
    <LightRigMoveHandleInner
      bounds={bounds}
      layout={layout}
      focused={focused}
      selectable={selectable}
      snapEnabled={snapEnabled}
      snapStep={snapStep}
      onSelect={onSelect}
      onPreview={onPreview}
      onCommit={onCommit}
      onDraggingChange={onDraggingChange}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    />
  );
}

function LightRigMoveHandleInner({
  bounds,
  layout,
  focused,
  selectable,
  snapEnabled,
  snapStep,
  onSelect,
  onPreview,
  onCommit,
  onDraggingChange,
  onDragStart,
  onDragEnd,
}: {
  bounds: LightRigHandleBounds;
  layout: TheaterLayout;
  focused: boolean;
  selectable: boolean;
  snapEnabled: boolean;
  snapStep: number;
  onSelect: () => void;
  onPreview: (deltaX: number, deltaZ: number) => void;
  onCommit: (deltaX: number, deltaZ: number) => void;
  onDraggingChange: (dragging: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const { gl } = useThree();
  const dragRef = useRef<{
    side: MoveSide;
    startCenter: [number, number];
    startHit: THREE.Vector3;
    plane: THREE.Plane;
    lastDelta: [number, number];
  } | null>(null);
  const [draggingSide, setDraggingSide] = useState<MoveSide | null>(null);
  const selectGestureRef = useRef<{
    gesture: ScreenPointerGesture;
    cleanup: () => void;
  } | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const accent = tc("--color-active-ascent");
  const halfW = bounds.width / 2;
  const halfD = bounds.depth / 2;

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

  const snapDelta = (nextX: number, nextZ: number): [number, number] => {
    const [snappedX, snappedZ] = snapTheaterHallPoint(
      nextX,
      nextZ,
      layout.hallWidth,
      layout.hallDepth,
      snapStep,
      snapEnabled,
    );
    return [roundM(snappedX), roundM(snappedZ)];
  };

  const applyDrag = (clientX: number, clientY: number, camera: THREE.Camera) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = gl.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;

    const rawX = hitPoint.x - drag.startHit.x;
    const rawZ = hitPoint.z - drag.startHit.z;
    let nextX = drag.startCenter[0];
    let nextZ = drag.startCenter[1];

    if (drag.side === "center") {
      nextX = drag.startCenter[0] + rawX;
      nextZ = drag.startCenter[1] + rawZ;
    } else if (drag.side === "east" || drag.side === "west") {
      nextX = drag.startCenter[0] + rawX;
    } else {
      nextZ = drag.startCenter[1] + rawZ;
    }

    const [snappedX, snappedZ] = snapDelta(nextX, nextZ);
    const deltaX = snappedX - drag.startCenter[0];
    const deltaZ = snappedZ - drag.startCenter[1];
    drag.lastDelta = [deltaX, deltaZ];
    onPreview(deltaX, deltaZ);
  };

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

  const beginDrag = (side: MoveSide, event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const startCenter: [number, number] = [bounds.x, bounds.z];
    dragRef.current = {
      side,
      startCenter,
      startHit: event.point.clone(),
      plane: new THREE.Plane().setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(event.point.x, bounds.y, event.point.z),
      ),
      lastDelta: [0, 0],
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
      if (dragState) onCommit(dragState.lastDelta[0], dragState.lastDelta[1]);
      onDraggingChange(false);
      onDragEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const runners: Array<{
    side: MoveSide;
    position: [number, number, number];
    scale: [number, number, number];
  }> = [
    {
      side: "east",
      position: [halfW + 0.18, 0, 0],
      scale: [HANDLE_DEPTH, HANDLE_SIZE, Math.min(1.6, bounds.depth * 0.45)],
    },
    {
      side: "west",
      position: [-(halfW + 0.18), 0, 0],
      scale: [HANDLE_DEPTH, HANDLE_SIZE, Math.min(1.6, bounds.depth * 0.45)],
    },
    {
      side: "south",
      position: [0, 0, halfD + 0.18],
      scale: [Math.min(1.6, bounds.width * 0.45), HANDLE_SIZE, HANDLE_DEPTH],
    },
    {
      side: "north",
      position: [0, 0, -(halfD + 0.18)],
      scale: [Math.min(1.6, bounds.width * 0.45), HANDLE_SIZE, HANDLE_DEPTH],
    },
  ];

  const padSize: [number, number, number] = [
    Math.max(0.5, bounds.width * 0.4),
    0.04,
    Math.max(0.5, bounds.depth * 0.4),
  ];

  return (
    <group position={[bounds.x, bounds.y, bounds.z]}>
      {selectable && !focused ? (
        <mesh
          renderOrder={20}
          onPointerDown={(event) => beginSelectGesture(event)}
        >
          <boxGeometry args={IDLE_HIT_SIZE} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ) : null}

      {focused ? (
        <>
          <mesh
            renderOrder={20}
            onPointerDown={(event) => beginDrag("center", event)}
          >
            <boxGeometry args={padSize} />
            <meshStandardMaterial
              color={accent}
              transparent
              opacity={draggingSide === "center" ? 0.55 : 0.28}
              depthTest={false}
              depthWrite={false}
            />
          </mesh>

          {runners.map((runner) => {
            const isDragging = draggingSide === runner.side;
            return (
              <group key={runner.side} position={runner.position}>
                <mesh
                  renderOrder={21}
                  onPointerDown={(event) => beginDrag(runner.side, event)}
                >
                  <boxGeometry args={runner.scale} />
                  <meshStandardMaterial
                    color={accent}
                    emissive={accent}
                    emissiveIntensity={isDragging ? 0.55 : 0.2}
                    transparent
                    opacity={isDragging ? 1 : 0.9}
                    depthTest={false}
                    depthWrite={false}
                  />
                </mesh>
              </group>
            );
          })}

          <Billboard position={[0, LABEL_OFFSET_Y, 0]} follow>
            <Text
              fontSize={0.18}
              color={accent}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.012}
              outlineColor="#111"
              depthOffset={-1}
            >
              Ярус
            </Text>
          </Billboard>
        </>
      ) : null}
    </group>
  );
}
