import { useEffect, useMemo, useRef } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { snapTheaterHallPoint } from "../../model/theater-hall-grid";
import {
  beginScreenPointerGesture,
  updateScreenPointerGesture,
  type ScreenPointerGesture,
} from "../../model/pointer-click-gesture";
import {
  buildStageFloorShape,
  resolveFloorYAt,
} from "../../model/theater-stage-floor";
import { resolveStageRise } from "../../model/theater-stage-geometry";

type DecorFloorPlacerProps = {
  enabled: boolean;
  layout: TheaterLayout;
  hallOffsetX?: number;
  hallOffsetZ?: number;
  snapEnabled: boolean;
  snapStep: number;
  onPlace: (position: [number, number, number]) => void;
};

export function DecorFloorPlacer({
  enabled,
  layout,
  hallOffsetX = 0,
  hallOffsetZ = 0,
  snapEnabled,
  snapStep,
  onPlace,
}: DecorFloorPlacerProps) {
  const activeGestureRef = useRef<{
    gesture: ScreenPointerGesture;
    position: [number, number, number];
    cleanup: () => void;
  } | null>(null);
  const stageShape = useMemo(() => buildStageFloorShape(layout), [layout]);
  const deckY = resolveStageRise(layout);
  const hallSize = useMemo(
    () => [layout.hallWidth, layout.hallDepth] as [number, number],
    [layout.hallDepth, layout.hallWidth],
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
      layout.hallWidth,
      layout.hallDepth,
      snapStep,
      snapEnabled,
    );
    return [nextX, resolveFloorYAt(layout, nextX, nextZ), nextZ];
  };

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;

    activeGestureRef.current?.cleanup();

    const gesture = beginScreenPointerGesture(
      event.pointerId,
      event.nativeEvent.clientX,
      event.nativeEvent.clientY,
    );
    const position = snapPoint(
      event.point.x - hallOffsetX,
      event.point.z - hallOffsetZ,
    );

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
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
        renderOrder={-1}
        onPointerDown={handlePointerDown}
      >
        <planeGeometry args={hallSize} />
        <meshBasicMaterial visible={false} />
      </mesh>
      {stageShape && deckY > 0.02 ? (
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, deckY + 0.03, 0]}
          renderOrder={5}
          onPointerDown={handlePointerDown}
        >
          <shapeGeometry args={[stageShape]} />
          <meshBasicMaterial
            visible={false}
            depthWrite={false}
            depthTest={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </>
  );
}
