import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterDoorWall, TheaterLayout } from "../../../../shared/types/script";
import {
  beginScreenPointerGesture,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";
import { resolveHallOffsetX, resolveHallOffsetZ } from "../../model/theater-hall-expand";
import { doorWallNormal } from "../../model/theater-stage-geometry";

const WALL_PLANE_MIN_ALIGN = 0.18;

type WallSlotDragState<T> = {
  layout: TheaterLayout;
  plane: THREE.Plane;
  hallOffsetX: number;
  hallOffsetZ: number;
  started: boolean;
  lastValue: T | null;
};

export function resolveWallSlotDragPlane(
  wall: TheaterDoorWall,
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

type ContextPointerHandlers = {
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
  onContextMenu?: (event: ThreeEvent<MouseEvent>) => void;
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerUp?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerCancel?: (event: ThreeEvent<PointerEvent>) => void;
};

export function useTheaterWallSlotDrag<T>({
  enabled,
  wall,
  layout,
  applyPreview,
  onSelect,
  onMovePreview,
  onMoveCommit,
  onDragStart,
  onDragEnd,
  onDraggingChange,
  contextHandlers,
}: {
  enabled: boolean;
  wall: TheaterDoorWall;
  layout: TheaterLayout;
  applyPreview: (layout: TheaterLayout, worldX: number, worldZ: number) => T | null;
  onSelect?: () => void;
  onMovePreview?: (value: T) => void;
  onMoveCommit?: (value: T) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
  contextHandlers?: ContextPointerHandlers;
}) {
  const { camera, gl } = useThree();
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const gestureRef = useRef<ScreenPointerGesture | null>(null);
  const dragRef = useRef<WallSlotDragState<T> | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const canDrag = enabled && Boolean(onMovePreview || onMoveCommit);

  useEffect(() => {
    if (!canDrag || (!hovered && !dragging)) return;
    const previous = gl.domElement.style.cursor;
    gl.domElement.style.cursor = dragging ? "grabbing" : "grab";
    return () => {
      gl.domElement.style.cursor = previous;
    };
  }, [canDrag, dragging, gl.domElement, hovered]);

  const applyDrag = (clientX: number, clientY: number, dragCamera: THREE.Camera) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = gl.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, dragCamera);
    if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;
    const nextValue = applyPreview(
      drag.layout,
      hitPoint.x - drag.hallOffsetX,
      hitPoint.z - drag.hallOffsetZ,
    );
    if (!nextValue) return;
    drag.lastValue = nextValue;
    onMovePreview?.(nextValue);
  };

  const endInteraction = () => {
    const drag = dragRef.current;
    dragRef.current = null;
    gestureRef.current = null;
    if (drag?.started && drag.lastValue) {
      onMoveCommit?.(drag.lastValue);
    }
    if (drag?.started) {
      setDragging(false);
      onDraggingChange?.(false);
      onDragEnd?.();
    }
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    contextHandlers?.onPointerDown?.(event);
    if (!canDrag && !onSelect) return;
    if (event.button !== 0) {
      event.stopPropagation();
      return;
    }
    event.stopPropagation();
    onSelect?.();
    if (!canDrag) return;

    const gesture = beginScreenPointerGesture(
      event.pointerId,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );
    gestureRef.current = gesture;
    dragRef.current = {
      layout,
      plane: resolveWallSlotDragPlane(wall, event.point, event.camera),
      hallOffsetX: resolveHallOffsetX(layout),
      hallOffsetZ: resolveHallOffsetZ(layout),
      started: false,
      lastValue: null,
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

  return {
    pointerHandlers: {
      onPointerDown: handlePointerDown,
      onContextMenu: contextHandlers?.onContextMenu,
      onPointerMove: contextHandlers?.onPointerMove,
      onPointerUp: contextHandlers?.onPointerUp,
      onPointerCancel: contextHandlers?.onPointerCancel,
      onPointerOver: canDrag
        ? (event: ThreeEvent<PointerEvent>) => {
            event.stopPropagation();
            setHovered(true);
          }
        : undefined,
      onPointerOut: canDrag
        ? () => {
            setHovered(false);
          }
        : undefined,
    },
  };
}
