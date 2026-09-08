import { tc } from "../../../../shared/styles/theme-color";
import { Billboard, Text } from "@react-three/drei";
import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout, TheaterModel } from "../../../../shared/types/script";
import { snapTheaterHallPoint } from "../../model/theater-hall-grid";
import { roundM } from "../../model/theater-metrics";
import { followFloorY } from "../../model/theater-stage-floor";
import {
  measureObjectWorldBox,
  measureObjectWorldSize,
  resolveTheaterModelWorldSize,
  type TheaterModelWorldSize,
} from "../../model/theater-model-world-size";

type MoveSide = "east" | "west" | "south" | "north" | "center";

const HANDLE_SIZE = 0.28;
const HANDLE_DEPTH = 0.1;
const MIN_HANDLE_Y = 0.12;
const LABEL_OFFSET_Y = 0.28;

type ModelFloorMoveHandlesProps = {
  model: TheaterModel;
  object: THREE.Object3D | null;
  layout: TheaterLayout;
  snapEnabled: boolean;
  snapStep: number;
  lockY?: boolean;
  onPreview: (position: [number, number, number]) => void;
  onCommit: (position: [number, number, number]) => void;
  onDraggingChange: (dragging: boolean) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
};

function resolveFootprint(
  model: TheaterModel,
  object: THREE.Object3D | null,
): TheaterModelWorldSize {
  if (object) {
    const worldSize = measureObjectWorldSize(object);
    if (worldSize) return worldSize;
  }
  const measured = resolveTheaterModelWorldSize(model);
  if (measured) return measured;
  return {
    width: Math.max(0.4, Math.abs(model.scale[0])),
    height: Math.max(0.4, Math.abs(model.scale[1])),
    depth: Math.max(0.4, Math.abs(model.scale[2])),
  };
}

/** Центр высоты модели — хэндлы не лежат на полу и не тонут в соседних объектах. */
function resolveHandlesCenterY(
  model: TheaterModel,
  object: THREE.Object3D | null,
  footprint: TheaterModelWorldSize,
): number {
  if (object) {
    const box = measureObjectWorldBox(object);
    if (box) {
      const centerY = (box.min.y + box.max.y) / 2;
      if (Number.isFinite(centerY)) {
        return Math.max(MIN_HANDLE_Y, centerY);
      }
    }
  }
  return Math.max(MIN_HANDLE_Y, model.position[1] + footprint.height * 0.5);
}

export function ModelFloorMoveHandles({
  model,
  object,
  layout,
  snapEnabled,
  snapStep,
  lockY = false,
  onPreview,
  onCommit,
  onDraggingChange,
  onDragStart,
  onDragEnd,
}: ModelFloorMoveHandlesProps) {
  const { gl } = useThree();
  const dragRef = useRef<{
    side: MoveSide;
    startPosition: [number, number, number];
    startHit: THREE.Vector3;
    plane: THREE.Plane;
    lastPosition: [number, number, number];
  } | null>(null);
  const [draggingSide, setDraggingSide] = useState<MoveSide | null>(null);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);

  const footprint = resolveFootprint(model, object);
  const halfW = Math.max(0.25, footprint.width / 2);
  const halfD = Math.max(0.25, footprint.depth / 2);
  const handlesCenterY = resolveHandlesCenterY(model, object, footprint);
  const accent = tc("--color-active-ascent");
  const position = model.position;

  useEffect(() => {
    if (!draggingSide) return;
    const previous = gl.domElement.style.cursor;
    gl.domElement.style.cursor = "grabbing";
    return () => {
      gl.domElement.style.cursor = previous;
    };
  }, [draggingSide, gl.domElement]);

  const snapPosition = (x: number, z: number): [number, number, number] => {
    const [nextX, nextZ] = snapTheaterHallPoint(
      x,
      z,
      layout.hallWidth,
      layout.hallDepth,
      snapStep,
      snapEnabled,
    );
    const nextY = lockY
      ? position[1]
      : followFloorY(
          layout,
          position[0],
          position[2],
          nextX,
          nextZ,
          position[1],
        );
    return [roundM(nextX), roundM(nextY), roundM(nextZ)];
  };

  const applyDrag = (clientX: number, clientY: number, camera: THREE.Camera) => {
    const drag = dragRef.current;
    if (!drag) return;
    const rect = gl.domElement.getBoundingClientRect();
    pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointerNdc, camera);
    if (!raycaster.ray.intersectPlane(drag.plane, hitPoint)) return;

    const deltaX = hitPoint.x - drag.startHit.x;
    const deltaZ = hitPoint.z - drag.startHit.z;
    let nextX = drag.startPosition[0];
    let nextZ = drag.startPosition[2];

    if (drag.side === "center") {
      nextX = drag.startPosition[0] + deltaX;
      nextZ = drag.startPosition[2] + deltaZ;
    } else if (drag.side === "east" || drag.side === "west") {
      nextX = drag.startPosition[0] + deltaX;
    } else {
      nextZ = drag.startPosition[2] + deltaZ;
    }

    const next = snapPosition(nextX, nextZ);
    drag.lastPosition = next;
    onPreview(next);
  };

  const beginDrag = (side: MoveSide, event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(event.point.x, handlesCenterY, event.point.z),
    );
    const startPosition: [number, number, number] = [
      position[0],
      position[1],
      position[2],
    ];
    dragRef.current = {
      side,
      startPosition,
      startHit: event.point.clone(),
      plane,
      lastPosition: startPosition,
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
      if (dragState) onCommit(dragState.lastPosition);
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
      scale: [HANDLE_DEPTH, HANDLE_SIZE, Math.min(1.6, footprint.depth * 0.45)],
    },
    {
      side: "west",
      position: [-(halfW + 0.18), 0, 0],
      scale: [HANDLE_DEPTH, HANDLE_SIZE, Math.min(1.6, footprint.depth * 0.45)],
    },
    {
      side: "south",
      position: [0, 0, halfD + 0.18],
      scale: [Math.min(1.6, footprint.width * 0.45), HANDLE_SIZE, HANDLE_DEPTH],
    },
    {
      side: "north",
      position: [0, 0, -(halfD + 0.18)],
      scale: [Math.min(1.6, footprint.width * 0.45), HANDLE_SIZE, HANDLE_DEPTH],
    },
  ];

  const padSize: [number, number, number] = [
    Math.max(0.45, footprint.width * 0.55),
    0.04,
    Math.max(0.45, footprint.depth * 0.55),
  ];

  return (
    <group position={[position[0], handlesCenterY, position[2]]}>
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
          {`${position[0].toFixed(2)} · ${position[2].toFixed(2)}`}
        </Text>
      </Billboard>
    </group>
  );
}
