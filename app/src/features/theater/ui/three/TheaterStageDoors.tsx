import { tc } from "../../../../shared/styles/theme-color";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterDoor, TheaterLayout } from "../../../../shared/types/script";
import {
  applyDoorDragPreview,
  resolveLayoutDoors,
} from "../../model/theater-doors";
import {
  THEATER_PICK_DOOR,
  type TheaterDoorContextHit,
} from "../../model/theater-object-context";
import {
  useTheaterObjectContextGesture,
} from "./use-theater-object-context-gesture";
import {
  beginScreenPointerGesture,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";
import { resolveHallOffsetX, resolveHallOffsetZ } from "../../model/theater-hall-expand";
import {
  doorWallNormal,
  getDoorCenterOnWall,
  isWallHidden,
  placeOpeningOnWall,
  resolveStageRise,
} from "../../model/theater-stage-geometry";
import { STAGE_DOOR_MODEL_BASE, StageDoorModel } from "./StageDoorModel";

const WALL_PLANE_MIN_ALIGN = 0.18;

type DoorDragState = {
  doorId: number;
  layout: TheaterLayout;
  plane: THREE.Plane;
  hallOffsetX: number;
  hallOffsetZ: number;
  started: boolean;
  lastDoors: TheaterDoor[] | null;
};

function resolveDoorDragPlane(
  wall: TheaterDoor["wall"],
  worldPoint: THREE.Vector3,
  camera: THREE.Camera,
): THREE.Plane {
  const wallNormal = new THREE.Vector3(...doorWallNormal(wall));
  const camDir = new THREE.Vector3();
  camera.getWorldDirection(camDir);
  const plane = new THREE.Plane();
  const alignment = Math.abs(wallNormal.dot(camDir));
  if (alignment < WALL_PLANE_MIN_ALIGN) {
    plane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), worldPoint);
    return plane;
  }
  plane.setFromNormalAndCoplanarPoint(wallNormal, worldPoint);
  return plane;
}

type TheaterDoorLeafProps = {
  layout: TheaterLayout;
  door: TheaterDoor;
  isActive: boolean;
  interactive: boolean;
  hallOffsetX: number;
  hallOffsetZ: number;
  onSelect?: (doorId: number) => void;
  onMovePreview?: (doors: TheaterDoor[]) => void;
  onMoveCommit?: (doors: TheaterDoor[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
  onContextMenu?: (hit: TheaterDoorContextHit) => void;
};

function TheaterDoorLeaf({
  layout,
  door,
  isActive,
  interactive,
  hallOffsetX,
  hallOffsetZ,
  onSelect,
  onMovePreview,
  onMoveCommit,
  onDragStart,
  onDragEnd,
  onDraggingChange,
  onContextMenu,
}: TheaterDoorLeafProps) {
  const { camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gestureRef = useRef<ScreenPointerGesture | null>(null);
  const dragRef = useRef<DoorDragState | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const center = getDoorCenterOnWall(door, layout);
  const planeGeometry = useMemo(
    () => new THREE.PlaneGeometry(door.width, door.height),
    [door.width, door.height],
  );
  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(planeGeometry),
    [planeGeometry],
  );

  useEffect(() => {
    if (!interactive || (!hovered && !dragging)) return;
    const previous = gl.domElement.style.cursor;
    gl.domElement.style.cursor = dragging ? "grabbing" : "grab";
    return () => {
      gl.domElement.style.cursor = previous;
    };
  }, [dragging, gl.domElement, hovered, interactive]);

  const contextHandlers = useTheaterObjectContextGesture(interactive, (event) => {
    dragRef.current = null;
    gestureRef.current = null;
    onContextMenu?.({
      kind: "door",
      doorId: door.id,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  });

  if (!center) return null;

  const { x, z, rotationY } = placeOpeningOnWall(door.wall, center, 0.05);
  const scaleX = door.width / STAGE_DOOR_MODEL_BASE.width;
  const scaleY = door.height / STAGE_DOOR_MODEL_BASE.height;
  const highlightColor = tc("--color-active-ascent");
  const doorStyle = door.style === "metal" ? "metal" : "wood";
  const deckY = resolveStageRise(layout);

  const applyDrag = (clientX: number, clientY: number, dragCamera: THREE.Camera) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = gl.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, dragCamera);
    if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;
    const nextDoors = applyDoorDragPreview(
      drag.layout,
      drag.doorId,
      "move",
      hitPoint.x - drag.hallOffsetX,
      hitPoint.z - drag.hallOffsetZ,
    );
    if (!nextDoors) return;
    drag.lastDoors = nextDoors;
    onMovePreview?.(nextDoors);
  };

  const endInteraction = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    gestureRef.current = null;
    if (drag?.started && drag.lastDoors) {
      onMoveCommit?.(drag.lastDoors);
    }
    if (drag?.started) {
      setDragging(false);
      onDraggingChange?.(false);
      onDragEnd?.();
    }
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    contextHandlers.onPointerDown?.(event);
    if (event.button !== 0) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    onSelect?.(door.id);

    const gesture = beginScreenPointerGesture(
      event.pointerId,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );
    gestureRef.current = gesture;
    dragRef.current = {
      doorId: door.id,
      layout,
      plane: resolveDoorDragPlane(door.wall, event.point, event.camera),
      hallOffsetX,
      hallOffsetZ,
      started: false,
      lastDoors: null,
    };

    const onMove = (native: PointerEvent) => {
      if (native.pointerId !== gesture.pointerId) return;
      updateScreenPointerGesture(gesture, native.clientX, native.clientY);
      if (!gesture.dragged) return;
      const drag = dragRef.current;
      if (drag && !drag.started) {
        drag.started = true;
        setDragging(true);
        onDraggingChange?.(true);
        onDragStart?.();
      }
      applyDrag(native.clientX, native.clientY, camera);
    };
    const onUp = (native: PointerEvent) => {
      if (native.pointerId !== gesture.pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      endInteraction();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  return (
    <group
      position={[x, deckY, z]}
      rotation={[0, rotationY, 0]}
      onPointerDown={handlePointerDown}
      onContextMenu={contextHandlers.onContextMenu}
      onPointerMove={contextHandlers.onPointerMove}
      onPointerUp={contextHandlers.onPointerUp}
      onPointerCancel={contextHandlers.onPointerCancel}
      onPointerOver={
        interactive
          ? (event) => {
              event.stopPropagation();
              setHovered(true);
            }
          : undefined
      }
      onPointerOut={
        interactive
          ? () => {
              setHovered(false);
            }
          : undefined
      }
    >
      <group scale={[scaleX, scaleY, 1]}>
        <StageDoorModel style={doorStyle} />
      </group>
      {interactive ? (
        <mesh
          position={[0, door.height / 2, 0.1]}
          userData={{ theaterPick: THEATER_PICK_DOOR }}
        >
          <planeGeometry args={[door.width, door.height]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {isActive ? (
        <group position={[0, door.height / 2, 0.12]}>
          <mesh geometry={planeGeometry} raycast={() => null} renderOrder={3}>
            <meshBasicMaterial
              color={highlightColor}
              transparent
              opacity={0.28}
              side={THREE.DoubleSide}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
          <lineSegments geometry={edgesGeometry} raycast={() => null} renderOrder={4}>
            <lineBasicMaterial color={highlightColor} depthTest={false} />
          </lineSegments>
        </group>
      ) : null}
    </group>
  );
}

export type TheaterStageDoorsProps = {
  layout: TheaterLayout;
  activeDoorId?: number;
  interactive?: boolean;
  onSelectDoor?: (doorId: number) => void;
  onDoorMovePreview?: (doors: TheaterDoor[]) => void;
  onDoorMoveCommit?: (doors: TheaterDoor[]) => void;
  onDoorDragStart?: () => void;
  onDoorDragEnd?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
  onDoorContextMenu?: (hit: TheaterDoorContextHit) => void;
};

export function TheaterStageDoors({
  layout,
  activeDoorId,
  interactive = false,
  onSelectDoor,
  onDoorMovePreview,
  onDoorMoveCommit,
  onDoorDragStart,
  onDoorDragEnd,
  onDraggingChange,
  onDoorContextMenu,
}: TheaterStageDoorsProps) {
  const doors = useMemo(() => resolveLayoutDoors(layout), [layout]);
  const hallOffsetX = resolveHallOffsetX(layout);
  const hallOffsetZ = resolveHallOffsetZ(layout);
  if ((layout.stageShape ?? "rectangle") === "circle") return null;
  return (
    <>
      {doors.map((door) =>
        isWallHidden(layout, door.wall) ? null : (
          <TheaterDoorLeaf
            key={door.id}
            layout={layout}
            door={door}
            isActive={Number(door.id) === Number(activeDoorId)}
            interactive={interactive}
            hallOffsetX={hallOffsetX}
            hallOffsetZ={hallOffsetZ}
            onSelect={onSelectDoor}
            onMovePreview={onDoorMovePreview}
            onMoveCommit={onDoorMoveCommit}
            onDragStart={onDoorDragStart}
            onDragEnd={onDoorDragEnd}
            onDraggingChange={onDraggingChange}
            onContextMenu={onDoorContextMenu}
          />
        ),
      )}
    </>
  );
}
