import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { snapTheaterHallPoint } from "../../model/theater-hall-grid";
import {
  beginScreenPointerGesture,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";

type DecorFloorPlacerProps = {
  enabled: boolean;
  hallWidth: number;
  hallDepth: number;
  snapEnabled: boolean;
  snapStep: number;
  onPlace: (position: [number, number, number]) => void;
};

export function DecorFloorPlacer({
  enabled,
  hallWidth,
  hallDepth,
  snapEnabled,
  snapStep,
  onPlace,
}: DecorFloorPlacerProps) {
  const activeGestureRef = useRef<{
    gesture: ScreenPointerGesture;
    position: [number, number, number];
    cleanup: () => void;
  } | null>(null);

  const size = useMemo(
    () => [hallWidth, hallDepth] as [number, number],
    [hallWidth, hallDepth],
  );

  useEffect(() => {
    return () => {
      activeGestureRef.current?.cleanup();
      activeGestureRef.current = null;
    };
  }, []);

  if (!enabled) return null;

  const snapPoint = (x: number, z: number): [number, number, number] => {
    const [nextX, nextZ] = snapTheaterHallPoint(
      x,
      z,
      hallWidth,
      hallDepth,
      snapStep,
      snapEnabled,
    );
    return [nextX, 0, nextZ];
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;

    activeGestureRef.current?.cleanup();

    const gesture = beginScreenPointerGesture(
      event.pointerId,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );
    const position = snapPoint(event.point.x, event.point.z);

    const finish = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== gesture.pointerId) return;
      cleanup();
      activeGestureRef.current = null;
      if (gesture.dragged) return;
      nativeEvent.stopPropagation?.();
      onPlace(position);
    };

    const onWindowMove = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== gesture.pointerId) return;
      updateScreenPointerGesture(
        gesture,
        nativeEvent.clientX,
        nativeEvent.clientY,
      );
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", onWindowMove);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };

    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);

    activeGestureRef.current = { gesture, position, cleanup };
  };

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      renderOrder={-1}
      onPointerDown={handlePointerDown}
    >
      <planeGeometry args={size} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
};
