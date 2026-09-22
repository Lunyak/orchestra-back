import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { resolveHallOffsetX, resolveHallOffsetZ } from "../../model/theater-hall-expand";
import {
  findStageWallChainHiddenFromCamera,
  resolveStageGeometry,
  type WallHideGroup,
} from "../../model/theater-stage-geometry";

export function useHiddenWallGroup(
  layout: TheaterLayout,
  wallsHideFromCamera: boolean,
): WallHideGroup | null {
  const { camera } = useThree();
  const viewTarget = useMemo(() => {
    const geom = resolveStageGeometry(layout);
    return new THREE.Vector3(
      0,
      geom.wallHeight * 0.35,
      (geom.backZ + geom.prosceniumZ) / 2,
    );
  }, [layout]);
  const hiddenGroupRef = useRef<WallHideGroup | null>(null);
  const [, bumpRender] = useState(0);

  useFrame(() => {
    const offsetX = resolveHallOffsetX(layout);
    const offsetZ = resolveHallOffsetZ(layout);
    const nextHidden = wallsHideFromCamera
      ? findStageWallChainHiddenFromCamera(
          layout,
          [
            camera.position.x - offsetX,
            camera.position.y,
            camera.position.z - offsetZ,
          ],
          [viewTarget.x, viewTarget.y, viewTarget.z],
        )
      : null;
    if (hiddenGroupRef.current !== nextHidden) {
      hiddenGroupRef.current = nextHidden;
      bumpRender((value) => value + 1);
    }
  });

  return wallsHideFromCamera ? hiddenGroupRef.current : null;
}
