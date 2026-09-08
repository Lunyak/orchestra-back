import { useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { tc } from "../../../../shared/styles/theme-color";
import type { TheaterLayout } from "../../../../shared/types/script";
import { snapTheaterHallPoint } from "../../model/theater-hall-grid";
import {
  isTheaterBuiltinTemplateDrag,
  readTheaterBuiltinTemplateDrag,
} from "../../model/theater-builtin-template-dnd";
import type { TheaterBuiltinTemplateKey } from "../../model/theater-model-builtin";
import {
  buildStageFloorShape,
  intersectTheaterFloor,
  resolveFloorYAt,
} from "../../model/theater-stage-floor";
import { resolveStageRise } from "../../model/theater-stage-geometry";

type BuiltinTemplateFloorDropProps = {
  enabled: boolean;
  layout: TheaterLayout;
  hallOffsetX?: number;
  hallOffsetZ?: number;
  snapEnabled: boolean;
  snapStep: number;
  onDropTemplate: (
    key: TheaterBuiltinTemplateKey,
    position: [number, number, number],
  ) => void;
};

export function BuiltinTemplateFloorDrop({
  enabled,
  layout,
  hallOffsetX = 0,
  hallOffsetZ = 0,
  snapEnabled,
  snapStep,
  onDropTemplate,
}: BuiltinTemplateFloorDropProps) {
  const { camera, gl } = useThree();
  const [hovering, setHovering] = useState(false);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const pointerNdc = useMemo(() => new THREE.Vector2(), []);
  const hitPoint = useMemo(() => new THREE.Vector3(), []);
  const stageShape = useMemo(() => buildStageFloorShape(layout), [layout]);
  const deckY = resolveStageRise(layout);

  useEffect(() => {
    if (!enabled) {
      setHovering(false);
      return;
    }

    const canvas = gl.domElement;

    const snapPoint = (worldX: number, worldZ: number): [number, number, number] => {
      const localX = worldX - hallOffsetX;
      const localZ = worldZ - hallOffsetZ;
      const [nextX, nextZ] = snapTheaterHallPoint(
        localX,
        localZ,
        layout.hallWidth,
        layout.hallDepth,
        snapStep,
        snapEnabled,
      );
      return [nextX, resolveFloorYAt(layout, nextX, nextZ), nextZ];
    };

    const hitFloor = (clientX: number, clientY: number) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      if (!intersectTheaterFloor(raycaster.ray, layout, hallOffsetX, hallOffsetZ, hitPoint)) {
        return null;
      }
      return snapPoint(hitPoint.x, hitPoint.z);
    };

    const onDragOver = (event: DragEvent) => {
      if (!isTheaterBuiltinTemplateDrag(event.dataTransfer)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
      setHovering(true);
    };

    const onDragLeave = (event: DragEvent) => {
      if (event.relatedTarget && canvas.contains(event.relatedTarget as Node)) {
        return;
      }
      setHovering(false);
    };

    const onDrop = (event: DragEvent) => {
      setHovering(false);
      const key = readTheaterBuiltinTemplateDrag(event.dataTransfer);
      if (!key) return;
      event.preventDefault();
      event.stopPropagation();
      const position = hitFloor(event.clientX, event.clientY);
      if (!position) return;
      onDropTemplate(key, position);
    };

    const onDragEnd = () => setHovering(false);

    canvas.addEventListener("dragover", onDragOver);
    canvas.addEventListener("dragleave", onDragLeave);
    canvas.addEventListener("drop", onDrop);
    window.addEventListener("dragend", onDragEnd);
    return () => {
      canvas.removeEventListener("dragover", onDragOver);
      canvas.removeEventListener("dragleave", onDragLeave);
      canvas.removeEventListener("drop", onDrop);
      window.removeEventListener("dragend", onDragEnd);
    };
  }, [
    camera,
    enabled,
    gl.domElement,
    hallOffsetX,
    hallOffsetZ,
    hitPoint,
    layout,
    onDropTemplate,
    pointerNdc,
    raycaster,
    snapEnabled,
    snapStep,
  ]);

  if (!enabled || !hovering) return null;

  const accent = tc("--color-active-ascent");
  const hallHighlightY = 0.02;
  const stageHighlightY = deckY + 0.02;

  return (
    <>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, hallHighlightY, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[layout.hallWidth, layout.hallDepth]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>
      {stageShape && deckY > 0.02 ? (
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, stageHighlightY, 0]}
          raycast={() => null}
        >
          <shapeGeometry args={[stageShape]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.16}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
    </>
  );
}
