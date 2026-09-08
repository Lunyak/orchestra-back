import { tc } from "../../../../shared/styles/theme-color";
import { Billboard, Text } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import {
  THEATER_PICK_FLOOR,
  type TheaterFloorContextHit,
} from "../../model/theater-object-context";
import { buildStageFloorShape } from "../../model/theater-stage-floor";
import { useTheaterObjectContextGesture } from "./use-theater-object-context-gesture";
import {
  getStageGridHandleBounds,
  stageGridExpandDeltaFromPointer,
  stageGridExpandPatch,
  stageGridLabel,
  stageGridSideAxis,
  stageGridSideWorldPosition,
  type StageGridHandleSide,
} from "../../model/theater-stage-grid-expand";
import {
  beginScreenPointerGesture,
  isScreenPointerClick,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";

const SIDES: StageGridHandleSide[] = ["east", "west", "front", "back"];
const HANDLE_SIZE = 0.28;
const HANDLE_DEPTH = 0.1;

type StageGridHandlesProps = {
  layout: TheaterLayout;
  focused: boolean;
  selectable: boolean;
  onSelect: () => void;
  onPreview: (patch: Partial<TheaterLayout>) => void;
  onCommit: (patch: Partial<TheaterLayout>) => void;
  onDraggingChange: (dragging: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onFloorContextMenu?: (hit: TheaterFloorContextHit) => void;
};

export function StageGridHandles({
  layout,
  focused,
  selectable,
  onSelect,
  onPreview,
  onCommit,
  onDraggingChange,
  onDragStart,
  onDragEnd,
  onFloorContextMenu,
}: StageGridHandlesProps) {
  const { gl } = useThree();
  const dragRef = useRef<{
    side: StageGridHandleSide;
    startLayout: TheaterLayout;
    startEdge: number;
    plane: THREE.Plane;
    lastPatch: Partial<TheaterLayout>;
  } | null>(null);
  const [draggingSide, setDraggingSide] = useState<StageGridHandleSide | null>(null);
  const selectGestureRef = useRef<{
    gesture: ScreenPointerGesture;
    cleanup: () => void;
  } | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const bounds = useMemo(() => getStageGridHandleBounds(layout), [layout]);
  const floorShape = useMemo(() => buildStageFloorShape(layout), [layout]);
  const contextEnabled = Boolean(onFloorContextMenu);
  const contextHandlers = useTheaterObjectContextGesture(
    contextEnabled,
    (event) => {
      onFloorContextMenu?.({
        kind: "floor",
        surface: "stage",
        clientX: event.clientX,
        clientY: event.clientY,
      });
    },
  );
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

  if ((!selectable && !focused && !contextEnabled) || !floorShape) return null;

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

  const readAxisValue = (side: StageGridHandleSide, point: THREE.Vector3) => {
    return stageGridSideAxis(side) === "x" ? point.x : point.z;
  };

  const applyDrag = (clientX: number, clientY: number, camera: THREE.Camera) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = gl.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;
    const rawDelta = stageGridExpandDeltaFromPointer(
      drag.side,
      drag.startEdge,
      readAxisValue(drag.side, hitPoint),
    );
    const patch = stageGridExpandPatch(drag.startLayout, drag.side, rawDelta);
    if (Object.keys(patch).length === 0) return;
    drag.lastPatch = patch;
    onPreview(patch);
  };

  const beginDrag = (side: StageGridHandleSide, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(event.point.x, bounds.midY, event.point.z),
    );

    dragRef.current = {
      side,
      startLayout: layout,
      startEdge: readAxisValue(side, event.point),
      plane,
      lastPatch: {},
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
      if (dragState && Object.keys(dragState.lastPatch).length > 0) {
        onCommit(dragState.lastPatch);
      }
      onDraggingChange(false);
      onDragEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const label = stageGridLabel(layout);

  return (
    <group>
      {selectable || contextEnabled ? (
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, 0.09, 0]}
          renderOrder={3}
          userData={{ theaterPick: THEATER_PICK_FLOOR }}
          onPointerDown={(event) => {
            contextHandlers.onPointerDown?.(event);
            if (selectable) beginSelectGesture(event);
          }}
          onPointerMove={contextHandlers.onPointerMove}
          onPointerUp={contextHandlers.onPointerUp}
          onPointerCancel={contextHandlers.onPointerCancel}
          onContextMenu={contextHandlers.onContextMenu}
        >
          <shapeGeometry args={[floorShape]} />
          <meshBasicMaterial visible={false} side={THREE.DoubleSide} />
        </mesh>
      ) : null}

      {focused ? (
        <>
          <mesh
            rotation={[Math.PI / 2, 0, 0]}
            position={[0, 0.018, 0]}
            raycast={() => null}
            renderOrder={2}
          >
            <shapeGeometry args={[floorShape]} />
            <meshBasicMaterial
              color={accent}
              transparent
              opacity={0.12}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          {SIDES.map((side) => {
            const position = stageGridSideWorldPosition(bounds, side);
            const isDragging = draggingSide === side;
            const alongX = side === "east" || side === "west";
            const scale: [number, number, number] = alongX
              ? [HANDLE_DEPTH, HANDLE_SIZE, Math.min(1.8, bounds.depth * 0.35)]
              : [Math.min(1.8, bounds.width * 0.35), HANDLE_SIZE, HANDLE_DEPTH];
            const labelOffset: [number, number, number] =
              side === "east"
                ? [0.4, 0.2, 0]
                : side === "west"
                  ? [-0.4, 0.2, 0]
                  : side === "front"
                    ? [0, 0.2, 0.4]
                    : [0, 0.2, -0.4];

            return (
              <group key={side} position={position}>
                <mesh
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    beginDrag(side, event);
                  }}
                >
                  <boxGeometry args={scale} />
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
                    <Billboard position={labelOffset}>
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
          })}
        </>
      ) : null}
    </group>
  );
}
