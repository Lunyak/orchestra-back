import { useMemo } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { buildStageFloorShape } from "../../model/theater-stage-floor";
import { pointToGridCell } from "../../model/theater-zone-grid";

type TheaterStageGridPickerProps = {
  layout: TheaterLayout;
  enabled: boolean;
  onPickCell: (col: number, row: number) => void;
};

export function TheaterStageGridPicker({
  layout,
  enabled,
  onPickCell,
}: TheaterStageGridPickerProps) {
  const shape = useMemo(() => buildStageFloorShape(layout), [layout]);
  if (!enabled || !shape) return null;

  return (
    <mesh
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      renderOrder={4}
      onPointerDown={(event) => {
        event.stopPropagation();
        const point = event.point;
        const cell = pointToGridCell(layout, point.x, point.z);
        if (cell) onPickCell(cell.col, cell.row);
      }}
    >
      <shapeGeometry args={[shape]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        depthTest={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
