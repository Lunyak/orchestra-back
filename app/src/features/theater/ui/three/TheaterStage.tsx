import { tc } from "../../../../shared/styles/theme-color";
import {
  THEATER_AMBIENT_FILL_INTENSITY,
  THEATER_HEMISPHERE_INTENSITY,
  THEATER_KEY_FILL_INTENSITY,
} from "../../model/theater-scene-lighting";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { TheaterLayout } from "../../../../shared/types/script";
import { resolveLayoutDoors } from "../../model/theater-doors";
import {
  buildStageWallMeshes,
  findStageWallChainHiddenFromCamera,
  resolveStageGeometry,
  type WallHideGroup,
  type WallSegment3D,
} from "../../model/theater-stage-geometry";
import { InstancedAudienceSeats } from "./InstancedAudienceSeats";
import { AudienceBoundaryLine } from "./AudienceBoundaryLine";
import { TheaterStageFloor } from "./TheaterStageFloor";
import { TheaterStageGridOverlay } from "./TheaterStageGridOverlay";
import { TheaterStageGridPicker } from "./TheaterStageGridPicker";
import { TheaterSurfaceMaterial } from "./TheaterSurfaceMaterial";

const WALL_OPACITY = 0.38;

type WallMaterialProps = {
  projectName: string;
  material: TheaterLayout["backWallMaterial"];
  color: string;
  wallsOpaque: boolean;
  surfaceWidth: number;
  surfaceHeight: number;
};

function WallMaterial({
  projectName,
  material,
  color,
  wallsOpaque,
  surfaceWidth,
  surfaceHeight,
}: WallMaterialProps) {
  const opaque = wallsOpaque;
  return (
    <TheaterSurfaceMaterial
      projectName={projectName}
      material={material}
      fallbackColor={color}
      surfaceWidth={surfaceWidth}
      surfaceHeight={surfaceHeight}
      transparent={!opaque}
      opacity={opaque ? 1 : WALL_OPACITY}
      side={THREE.DoubleSide}
    />
  );
}

type TheaterWallProps = {
  projectName: string;
  material: TheaterLayout["backWallMaterial"];
  position: [number, number, number];
  rotation?: [number, number, number];
  size: [number, number];
  color: string;
  wallsOpaque: boolean;
};

function TheaterWall({
  projectName,
  material,
  position,
  rotation = [0, 0, 0],
  size,
  color,
  wallsOpaque,
}: TheaterWallProps) {
  return (
    <mesh position={position} rotation={rotation} renderOrder={1}>
      <planeGeometry args={size} />
      <WallMaterial
        projectName={projectName}
        material={material}
        color={color}
        wallsOpaque={wallsOpaque}
        surfaceWidth={size[0]}
        surfaceHeight={size[1]}
      />
    </mesh>
  );
}

type WallRenderItem = {
  key: string;
  segment: WallSegment3D;
  color: string;
  material: TheaterLayout["backWallMaterial"];
  wallsOpaque: boolean;
};

function collectWallRenderItems(
  walls: ReturnType<typeof buildStageWallMeshes>,
  layout: TheaterLayout,
  backColor: string,
  sideColor: string,
  portalColor: string,
): WallRenderItem[] {
  const items: WallRenderItem[] = [];
  walls.back.forEach((segment, index) => {
    items.push({
      key: `wall-back-${index}`,
      segment,
      color: backColor,
      material: layout.backWallMaterial,
      wallsOpaque: false,
    });
  });
  walls.left.forEach((segment, index) => {
    items.push({
      key: `wall-left-${index}`,
      segment,
      color: sideColor,
      material: layout.sideWallsMaterial,
      wallsOpaque: false,
    });
  });
  walls.right.forEach((segment, index) => {
    items.push({
      key: `wall-right-${index}`,
      segment,
      color: sideColor,
      material: layout.sideWallsMaterial,
      wallsOpaque: false,
    });
  });
  walls.custom.forEach((segment, index) => {
    items.push({
      key: `wall-custom-${index}`,
      segment,
      color: sideColor,
      material: layout.sideWallsMaterial,
      wallsOpaque: false,
    });
  });
  if (walls.lintel) {
    items.push({
      key: "wall-lintel",
      segment: walls.lintel,
      color: portalColor,
      material: layout.portalMaterial,
      wallsOpaque: true,
    });
  }
  if (walls.leftPillar) {
    items.push({
      key: "wall-left-pillar",
      segment: walls.leftPillar,
      color: portalColor,
      material: layout.portalMaterial,
      wallsOpaque: true,
    });
  }
  if (walls.rightPillar) {
    items.push({
      key: "wall-right-pillar",
      segment: walls.rightPillar,
      color: portalColor,
      material: layout.portalMaterial,
      wallsOpaque: true,
    });
  }
  return items;
}

type StageWallsProps = {
  projectName: string;
  layout: TheaterLayout;
  wallsOpaque: boolean;
  wallsHideFromCamera: boolean;
};

function StageWalls({
  projectName,
  layout,
  wallsOpaque,
  wallsHideFromCamera,
}: StageWallsProps) {
  const { camera } = useThree();
  const doors = useMemo(() => resolveLayoutDoors(layout), [layout]);
  const walls = useMemo(() => buildStageWallMeshes(layout, doors), [layout, doors]);
  const viewTarget = useMemo(() => {
    const geom = resolveStageGeometry(layout);
    return new THREE.Vector3(0, geom.wallHeight * 0.35, (geom.backZ + geom.prosceniumZ) / 2);
  }, [layout]);

  const hiddenGroupRef = useRef<WallHideGroup | null>(null);
  const [, bumpRender] = useState(0);

  useFrame(() => {
    const nextHidden = wallsHideFromCamera
      ? findStageWallChainHiddenFromCamera(
          layout,
          [camera.position.x, camera.position.y, camera.position.z],
          [viewTarget.x, viewTarget.y, viewTarget.z],
        )
      : null;
    if (hiddenGroupRef.current !== nextHidden) {
      hiddenGroupRef.current = nextHidden;
      bumpRender((value) => value + 1);
    }
  });

  const backColor = tc("--color-surface-1");
  const sideColor = tc("--color-surface-3");
  const portalColor = tc("--color-active-ascent");
  const items = useMemo(
    () => collectWallRenderItems(walls, layout, backColor, sideColor, portalColor),
    [walls, layout, backColor, sideColor, portalColor],
  );
  const hiddenGroup = wallsHideFromCamera ? hiddenGroupRef.current : null;

  return (
    <>
      {items.map(({ key, segment, color, material, wallsOpaque: segmentOpaque }) => {
        if (hiddenGroup && segment.hideGroup === hiddenGroup) {
          return null;
        }
        return (
          <TheaterWall
            key={key}
            projectName={projectName}
            {...segment}
            material={material}
            color={color}
            wallsOpaque={wallsOpaque || segmentOpaque}
          />
        );
      })}
    </>
  );
}

type TheaterStageProps = {
  projectName: string;
  layout: TheaterLayout;
  showSeats?: boolean;
  wallsOpaque?: boolean;
  wallsHidden?: boolean;
  wallsHideFromCamera?: boolean;
  showStageGrid?: boolean;
  dutyLightEnabled?: boolean;
  highlightGridCell?: { col: number; row: number } | null;
  spotlightAimMode?: "point" | "cell";
  onPickGridCell?: (col: number, row: number) => void;
};

export const TheaterStage = ({
  projectName,
  layout,
  showSeats = true,
  wallsOpaque = false,
  wallsHidden = false,
  wallsHideFromCamera = true,
  showStageGrid = true,
  dutyLightEnabled = true,
  highlightGridCell,
  spotlightAimMode = "point",
  onPickGridCell,
}: TheaterStageProps) => {
  return (
    <>
      <hemisphereLight
        color={tc("--color-light-sky")}
        groundColor={tc("--color-3d-wood")}
        intensity={dutyLightEnabled ? THEATER_HEMISPHERE_INTENSITY : 0}
      />
      <ambientLight intensity={dutyLightEnabled ? THEATER_AMBIENT_FILL_INTENSITY : 0} />
      <directionalLight
        position={[10, 14, 8]}
        intensity={dutyLightEnabled ? THEATER_KEY_FILL_INTENSITY : 0}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[layout.hallWidth, layout.hallDepth]} />
        <TheaterSurfaceMaterial
          projectName={projectName}
          material={layout.hallFloorMaterial}
          fallbackColor={layout.hallFloorMaterial?.color ?? tc("--color-surface-3")}
          surfaceWidth={layout.hallWidth}
          surfaceHeight={layout.hallDepth}
        />
      </mesh>

      <TheaterStageFloor projectName={projectName} layout={layout} />
      <TheaterStageGridOverlay
        layout={layout}
        showGrid={showStageGrid}
        highlightCell={highlightGridCell}
      />
      <TheaterStageGridPicker
        layout={layout}
        enabled={spotlightAimMode === "cell" && !!onPickGridCell}
        onPickCell={(col, row) => onPickGridCell?.(col, row)}
      />

      {!wallsHidden ? (
        <StageWalls
          projectName={projectName}
          layout={layout}
          wallsOpaque={wallsOpaque}
          wallsHideFromCamera={wallsHideFromCamera}
        />
      ) : null}

      {showSeats && layout.seatRows > 0 ? (
        <InstancedAudienceSeats layout={layout} />
      ) : null}

      <AudienceBoundaryLine layout={layout} />
    </>
  );
};
