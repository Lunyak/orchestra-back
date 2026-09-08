import { tc } from "../../../../shared/styles/theme-color";
import { useMemo } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import {
  buildGridCellOutline,
  buildStageGridLinePositions,
} from "../../model/theater-zone-grid";
import { resolveStageRise } from "../../model/theater-stage-geometry";

function highlightY(layout: TheaterLayout) {
  return resolveStageRise(layout) + 0.016;
}

type TheaterStageGridOverlayProps = {
  layout: TheaterLayout;
  showGrid?: boolean;
  highlightCell?: { col: number; row: number } | null;
};

function buildCellHighlightGeometry(
  layout: TheaterLayout,
  col: number,
  row: number,
): THREE.BufferGeometry | null {
  const outline = buildGridCellOutline(layout, col, row);
  if (outline.length < 3) return null;
  const positions: number[] = [];
  const [x0, z0] = outline[0];
  const y = highlightY(layout);
  for (let i = 1; i < outline.length - 1; i += 1) {
    const [x1, z1] = outline[i];
    const [x2, z2] = outline[i + 1];
    positions.push(x0, y, z0, x1, y, z1, x2, y, z2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  return geometry;
}

export function TheaterStageGridOverlay({
  layout,
  showGrid = true,
  highlightCell,
}: TheaterStageGridOverlayProps) {
  const accent = tc("--color-active-ascent");
  const gridGeometry = useMemo(() => {
    const positions = buildStageGridLinePositions(layout);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [layout]);

  const highlightGeometry = useMemo(() => {
    if (!highlightCell) return null;
    return buildCellHighlightGeometry(
      layout,
      highlightCell.col,
      highlightCell.row,
    );
  }, [highlightCell, layout]);

  return (
    <group>
      {highlightGeometry ? (
        <mesh geometry={highlightGeometry} renderOrder={1}>
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={0.28}
            depthWrite={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      ) : null}
      {showGrid ? (
        <lineSegments geometry={gridGeometry} renderOrder={2}>
          <lineBasicMaterial
            color={accent}
            transparent
            opacity={0.38}
            depthWrite={false}
          />
        </lineSegments>
      ) : null}
    </group>
  );
}
