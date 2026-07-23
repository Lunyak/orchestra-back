import { tc } from "../../../../shared/styles/theme-color";
import { Billboard, Text } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import {
  hallExpandDeltaFromPointer,
  hallExpandLayoutPatch,
  hallSideAxis,
  hallSideLabel,
  hallSideWorldPosition,
  type HallExpandResult,
  type HallExpandSide,
} from "../../model/theater-hall-expand";
import {
  beginScreenPointerGesture,
  isScreenPointerClick,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";
import { buildStageOutline } from "../../model/theater-stage-geometry";
import { isPointInZoneOutline } from "../../model/theater-zone-grid";

const SIDES: HallExpandSide[] = ["east", "west", "south", "north", "up"];
const HANDLE_SIZE = 0.35;
const HANDLE_DEPTH = 0.12;

function snapDelta(value: number, step: number, enabled: boolean) {
  if (!enabled || step <= 0) return value;
  return Math.round(value / step) * step;
}

function handleScale(
  layout: Pick<TheaterLayout, "hallWidth" | "hallDepth" | "wallHeight">,
  side: HallExpandSide,
): [number, number, number] {
  if (side === "up") {
    return [
      Math.min(1.2, layout.hallWidth * 0.2),
      HANDLE_DEPTH,
      Math.min(1.2, layout.hallDepth * 0.2),
    ];
  }
  if (side === "east" || side === "west") {
    return [HANDLE_DEPTH, HANDLE_SIZE, Math.min(2.4, layout.hallDepth * 0.35)];
  }
  return [Math.min(2.4, layout.hallWidth * 0.35), HANDLE_SIZE, HANDLE_DEPTH];
}

function labelOffsetForSide(side: HallExpandSide): [number, number, number] {
  if (side === "up") return [0, 0.4, 0];
  if (side === "east") return [0.5, 0, 0];
  if (side === "west") return [-0.5, 0, 0];
  if (side === "south") return [0, 0, 0.5];
  return [0, 0, -0.5];
}

type HallSizeHandlesProps = {
  layout: TheaterLayout;
  active: boolean;
  selectable: boolean;
  snapEnabled: boolean;
  snapStep: number;
  onSelect: () => void;
  onPreview: (result: HallExpandResult) => void;
  onCommit: (result: HallExpandResult) => void;
  onDraggingChange: (dragging: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

export function HallSizeHandles({
  layout,
  active,
  selectable,
  snapEnabled,
  snapStep,
  onSelect,
  onPreview,
  onCommit,
  onDraggingChange,
  onDragStart,
  onDragEnd,
}: HallSizeHandlesProps) {
  const { gl } = useThree();
  const dragRef = useRef<{
    side: HallExpandSide;
    startLayout: TheaterLayout;
    startEdge: number;
    plane: THREE.Plane;
    lastResult: HallExpandResult;
  } | null>(null);
  const [draggingSide, setDraggingSide] = useState<HallExpandSide | null>(null);
  const selectGestureRef = useRef<{
    gesture: ScreenPointerGesture;
    cleanup: () => void;
  } | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const hallSelectMeshRef = useRef<THREE.Mesh | null>(null);
  const stageOutline = useMemo(() => {
    const points = buildStageOutline(layout);
    return points.map((point): [number, number] => [point.x, point.z]);
  }, [layout]);
  const localHit = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const mesh = hallSelectMeshRef.current;
    if (!mesh) return;
    const outline = stageOutline;
    const scratch = localHit;
    mesh.raycast = (raycasterArg, intersects) => {
      const hits: THREE.Intersection[] = [];
      THREE.Mesh.prototype.raycast.call(mesh, raycasterArg, hits);
      for (const hit of hits) {
        scratch.copy(hit.point);
        mesh.parent?.worldToLocal(scratch);
        const hitsStage =
          outline.length >= 3 && isPointInZoneOutline(scratch.x, scratch.z, outline);
        if (hitsStage) continue;
        intersects.push(hit);
      }
    };
    return () => {
      mesh.raycast = THREE.Mesh.prototype.raycast;
    };
  }, [localHit, selectable, stageOutline]);

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

  if (!selectable && !active) return null;

  const accent = tc("--color-active-ascent");

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

  const readAxisValue = (side: HallExpandSide, point: THREE.Vector3) => {
    const axis = hallSideAxis(side);
    if (axis === "x") return point.x;
    if (axis === "y") return point.y;
    return point.z;
  };

  const applyDrag = (clientX: number, clientY: number, camera: THREE.Camera) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = gl.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;
    const rawDelta = hallExpandDeltaFromPointer(
      drag.side,
      drag.startEdge,
      readAxisValue(drag.side, hitPoint),
    );
    const delta = snapDelta(rawDelta, snapStep, snapEnabled);
    const result = hallExpandLayoutPatch(drag.startLayout, drag.side, delta);
    drag.lastResult = result;
    onPreview(result);
  };

  const beginDrag = (side: HallExpandSide, event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const edge = readAxisValue(side, event.point);
    const axis = hallSideAxis(side);
    const plane = new THREE.Plane();
    if (axis === "y") {
      const camDir = new THREE.Vector3();
      event.camera.getWorldDirection(camDir);
      camDir.y = 0;
      if (camDir.lengthSq() < 1e-6) camDir.set(0, 0, 1);
      camDir.normalize();
      plane.setFromNormalAndCoplanarPoint(camDir, event.point);
    } else {
      plane.setFromNormalAndCoplanarPoint(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(event.point.x, layout.wallHeight / 2, event.point.z),
      );
    }

    dragRef.current = {
      side,
      startLayout: layout,
      startEdge: edge,
      plane,
      lastResult: { patch: {}, objectShift: [0, 0, 0] },
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
      if (dragState && Object.keys(dragState.lastResult.patch).length > 0) {
        onCommit(dragState.lastResult);
      }
      onDraggingChange(false);
      onDragEnd();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <group>
      {selectable ? (
        <mesh
          ref={hallSelectMeshRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.05, 0]}
          renderOrder={-1}
          onPointerDown={beginSelectGesture}
        >
          <planeGeometry args={[layout.hallWidth, layout.hallDepth]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      ) : null}

      {active ? (
        <>
          <mesh position={[0, layout.wallHeight / 2, 0]} raycast={() => null}>
            <boxGeometry args={[layout.hallWidth, layout.wallHeight, layout.hallDepth]} />
            <meshBasicMaterial
              color={accent}
              transparent
              opacity={0.08}
              depthWrite={false}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, layout.wallHeight / 2, 0]} raycast={() => null}>
            <boxGeometry args={[layout.hallWidth, layout.wallHeight, layout.hallDepth]} />
            <meshBasicMaterial color={accent} wireframe transparent opacity={0.85} />
          </mesh>

          {SIDES.map((side) => {
            const position = hallSideWorldPosition(layout, side);
            const scale = handleScale(layout, side);
            const isDragging = draggingSide === side;

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
                    <Billboard position={labelOffsetForSide(side)}>
                      <Text
                        fontSize={0.28}
                        color={accent}
                        anchorX="center"
                        anchorY="middle"
                        outlineWidth={0.02}
                        outlineColor={tc("--color-surface-1")}
                      >
                        {hallSideLabel(layout, side)}
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
