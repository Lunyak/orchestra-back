import { tc } from "../../../../shared/styles/theme-color";
import {
  THEATER_AMBIENT_FILL_INTENSITY,
  THEATER_HEMISPHERE_INTENSITY,
  THEATER_KEY_FILL_INTENSITY,
} from "../../model/theater-scene-lighting";
import { useFrame, useThree } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type {
  TheaterDoor,
  TheaterLayout,
  TheaterWallOpening,
  TheaterWallRecess,
} from "../../../../shared/types/script";
import { resolveLayoutDoors } from "../../model/theater-doors";
import {
  doorPosAlongWall,
  isTheaterDoorWall,
  THEATER_PICK_OPENING,
  THEATER_PICK_RECESS,
  THEATER_PICK_WALL,
  type TheaterDoorContextHit,
  type TheaterFloorContextHit,
  type TheaterOpeningContextHit,
  type TheaterRecessContextHit,
  type TheaterWallContextHit,
} from "../../model/theater-object-context";
import {
  applyOpeningDragPreview,
  getOpeningHighlightPose,
  resolveLayoutWallOpenings,
} from "../../model/theater-wall-openings";
import {
  applyRecessDragPreview,
  getRecessCenterOnWall,
  getRecessFillPose,
  resolveLayoutWallRecesses,
} from "../../model/theater-wall-recesses";
import {
  buildStageWallMeshes,
  findStageWallChainHiddenFromCamera,
  isWallHidden,
  placeOpeningOnWall,
  resolveStageGeometry,
  resolveStageRise,
  type WallHideGroup,
  type WallSegment3D,
} from "../../model/theater-stage-geometry";
import {
  useTheaterObjectContextGesture,
  type TheaterObjectContextOpenEvent,
} from "./use-theater-object-context-gesture";
import { useTheaterWallSlotDrag } from "./use-theater-wall-slot-drag";
import { InstancedAudienceSeats } from "./InstancedAudienceSeats";
import { AudienceBoundaryLine } from "./AudienceBoundaryLine";
import { TheaterStageDoors } from "./TheaterStageDoors";
import { TheaterStageFloor } from "./TheaterStageFloor";
import { TheaterStageGridOverlay } from "./TheaterStageGridOverlay";
import { TheaterStageGridPicker } from "./TheaterStageGridPicker";
import { TheaterSurfaceMaterial } from "./TheaterSurfaceMaterial";
import { resolveHallOffsetX, resolveHallOffsetZ } from "../../model/theater-hall-expand";

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
  hideGroup?: WallHideGroup;
  hallOffsetX?: number;
  hallOffsetZ?: number;
  onWallContextMenu?: (hit: TheaterWallContextHit) => void;
};

function resolveWallContextHit(
  hideGroup: WallHideGroup | undefined,
  event: TheaterObjectContextOpenEvent,
  hallOffsetX: number,
  hallOffsetZ: number,
): TheaterWallContextHit | null {
  if (!isTheaterDoorWall(hideGroup)) return null;
  const localX = event.point.x - hallOffsetX;
  const localZ = event.point.z - hallOffsetZ;
  return {
    kind: "wall",
    wall: hideGroup,
    pos: doorPosAlongWall(hideGroup, localX, localZ),
    clientX: event.clientX,
    clientY: event.clientY,
  };
}

function TheaterWall({
  projectName,
  material,
  position,
  rotation = [0, 0, 0],
  size,
  color,
  wallsOpaque,
  hideGroup,
  hallOffsetX = 0,
  hallOffsetZ = 0,
  onWallContextMenu,
}: TheaterWallProps) {
  const contextEnabled = Boolean(onWallContextMenu) && isTheaterDoorWall(hideGroup);
  const contextHandlers = useTheaterObjectContextGesture(
    contextEnabled,
    (event) => {
      const hit = resolveWallContextHit(hideGroup, event, hallOffsetX, hallOffsetZ);
      if (!hit) return;
      onWallContextMenu?.(hit);
    },
  );

  return (
    <mesh
      position={position}
      rotation={rotation}
      renderOrder={1}
      userData={{ theaterPick: THEATER_PICK_WALL }}
      {...contextHandlers}
    >
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
  walls.front.forEach((segment, index) => {
    items.push({
      key: `wall-front-${index}`,
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
  onWallContextMenu?: (hit: TheaterWallContextHit) => void;
};

function useHiddenWallGroup(
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

function StageWalls({
  projectName,
  layout,
  wallsOpaque,
  wallsHideFromCamera,
  onWallContextMenu,
}: StageWallsProps) {
  const doors = useMemo(() => resolveLayoutDoors(layout), [layout]);
  const walls = useMemo(() => buildStageWallMeshes(layout, doors), [layout, doors]);
  const hiddenGroup = useHiddenWallGroup(layout, wallsHideFromCamera);

  const backColor = tc("--color-surface-1");
  const sideColor = tc("--color-surface-3");
  const portalColor = tc("--color-active-ascent");
  const items = useMemo(
    () => collectWallRenderItems(walls, layout, backColor, sideColor, portalColor),
    [walls, layout, backColor, sideColor, portalColor],
  );
  const hallOffsetX = resolveHallOffsetX(layout);
  const hallOffsetZ = resolveHallOffsetZ(layout);

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
            hallOffsetX={hallOffsetX}
            hallOffsetZ={hallOffsetZ}
            onWallContextMenu={onWallContextMenu}
          />
        );
      })}
    </>
  );
}

function ActiveRecessHighlight({
  layout,
  recess,
}: {
  layout: TheaterLayout;
  recess: TheaterWallRecess;
}) {
  const center = getRecessCenterOnWall(recess, layout);
  const wallHeight = layout.wallHeight;
  const planeGeometry = useMemo(
    () => new THREE.PlaneGeometry(recess.width, wallHeight),
    [recess.width, wallHeight],
  );
  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(planeGeometry),
    [planeGeometry],
  );

  if (!center) return null;

  const { x, z, rotationY } = placeOpeningOnWall(recess.wall, center, 0.06);
  const highlightColor = tc("--color-active-ascent");
  const deckY = resolveStageRise(layout);

  return (
    <group position={[x, deckY + wallHeight / 2, z]} rotation={[0, rotationY, 0]}>
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
  );
}

function RecessFillSlab({
  projectName,
  layout,
  recess,
  hideCeiling,
}: {
  projectName: string;
  layout: TheaterLayout;
  recess: TheaterWallRecess;
  hideCeiling: boolean;
}) {
  const pose = getRecessFillPose(recess, layout);
  const deckY = resolveStageRise(layout);
  const wallHeight = layout.wallHeight;
  const wallMaterial =
    recess.wall === "back" ? layout.backWallMaterial : layout.sideWallsMaterial;
  const wallColor =
    wallMaterial?.color ??
    (recess.wall === "back" ? tc("--color-surface-3") : tc("--color-3d-wood"));
  const floorColor =
    layout.hallFloorMaterial?.color ?? tc("--color-surface-3");

  if (!pose) return null;

  return (
    <group position={[pose.x, 0, pose.z]} rotation={[0, pose.rotationY, 0]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, deckY + 0.005, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry args={[recess.width, recess.depth]} />
        <meshStandardMaterial color={floorColor} side={THREE.DoubleSide} />
      </mesh>
      {hideCeiling ? null : (
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          position={[0, deckY + wallHeight - 0.005, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[recess.width, recess.depth]} />
          <TheaterSurfaceMaterial
            projectName={projectName}
            material={wallMaterial}
            fallbackColor={wallColor}
            surfaceWidth={recess.width}
            surfaceHeight={recess.depth}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}

function TheaterRecessFills({
  projectName,
  layout,
  wallsHideFromCamera,
}: {
  projectName: string;
  layout: TheaterLayout;
  wallsHideFromCamera: boolean;
}) {
  const hiddenGroup = useHiddenWallGroup(layout, wallsHideFromCamera);
  const filled = resolveLayoutWallRecesses(layout).filter((recess) => recess.filled);
  if (filled.length === 0) return null;
  return (
    <>
      {filled.map((recess) => (
        <RecessFillSlab
          key={`recess-fill-${recess.id}`}
          projectName={projectName}
          layout={layout}
          recess={recess}
          hideCeiling={hiddenGroup === recess.wall}
        />
      ))}
    </>
  );
}

function RecessHitVolume({
  layout,
  recess,
  onContextMenu,
  onSelect,
  onMovePreview,
  onMoveCommit,
  onDragStart,
  onDragEnd,
  onDraggingChange,
}: {
  layout: TheaterLayout;
  recess: TheaterWallRecess;
  onContextMenu?: (hit: TheaterRecessContextHit) => void;
  onSelect?: (recessId: number) => void;
  onMovePreview?: (recesses: TheaterWallRecess[]) => void;
  onMoveCommit?: (recesses: TheaterWallRecess[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const pose = getRecessFillPose(recess, layout);
  const deckY = resolveStageRise(layout);
  const wallHeight = layout.wallHeight;
  const contextHandlers = useTheaterObjectContextGesture(Boolean(onContextMenu), (event) => {
    onContextMenu?.({
      kind: "recess",
      recessId: recess.id,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  });
  const { pointerHandlers } = useTheaterWallSlotDrag({
    enabled: Boolean(onMovePreview || onMoveCommit),
    wall: recess.wall,
    layout,
    applyPreview: (source, worldX, worldZ) =>
      applyRecessDragPreview(source, recess.id, "move", worldX, worldZ),
    onSelect: onSelect ? () => onSelect(recess.id) : undefined,
    onMovePreview,
    onMoveCommit,
    onDragStart,
    onDragEnd,
    onDraggingChange,
    contextHandlers,
  });

  if (!pose) return null;

  return (
    <mesh
      position={[pose.x, deckY + wallHeight / 2, pose.z]}
      rotation={[0, pose.rotationY, 0]}
      userData={{ theaterPick: THEATER_PICK_RECESS }}
      {...pointerHandlers}
    >
      <boxGeometry args={[recess.width, wallHeight, recess.depth]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function TheaterRecessHits({
  layout,
  wallsHideFromCamera,
  onContextMenu,
  onSelect,
  onMovePreview,
  onMoveCommit,
  onDragStart,
  onDragEnd,
  onDraggingChange,
}: {
  layout: TheaterLayout;
  wallsHideFromCamera: boolean;
  onContextMenu?: (hit: TheaterRecessContextHit) => void;
  onSelect?: (recessId: number) => void;
  onMovePreview?: (recesses: TheaterWallRecess[]) => void;
  onMoveCommit?: (recesses: TheaterWallRecess[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const hiddenGroup = useHiddenWallGroup(layout, wallsHideFromCamera);
  const recesses = resolveLayoutWallRecesses(layout);
  if (recesses.length === 0) return null;
  return (
    <>
      {recesses.map((recess) => {
        if (isWallHidden(layout, recess.wall)) return null;
        if (hiddenGroup === recess.wall) return null;
        return (
          <RecessHitVolume
            key={`recess-hit-${recess.id}`}
            layout={layout}
            recess={recess}
            onContextMenu={onContextMenu}
            onSelect={onSelect}
            onMovePreview={onMovePreview}
            onMoveCommit={onMoveCommit}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDraggingChange={onDraggingChange}
          />
        );
      })}
    </>
  );
}

function ActiveOpeningHighlight({
  layout,
  opening,
}: {
  layout: TheaterLayout;
  opening: TheaterWallOpening;
}) {
  const pose = getOpeningHighlightPose(opening, layout);
  const wallHeight = layout.wallHeight;
  const sill = opening.sill ?? 0;
  const height = Math.min(opening.height, wallHeight - sill);
  const planeGeometry = useMemo(
    () => new THREE.PlaneGeometry(opening.width, height),
    [opening.width, height],
  );
  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(planeGeometry),
    [planeGeometry],
  );

  if (!pose) return null;

  const highlightColor = tc("--color-active-ascent");
  const deckY = resolveStageRise(layout);

  return (
    <group
      position={[pose.x, deckY + sill + height / 2, pose.z]}
      rotation={[0, pose.rotationY, 0]}
    >
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
  );
}

function OpeningHitVolume({
  layout,
  opening,
  onContextMenu,
  onSelect,
  onMovePreview,
  onMoveCommit,
  onDragStart,
  onDragEnd,
  onDraggingChange,
}: {
  layout: TheaterLayout;
  opening: TheaterWallOpening;
  onContextMenu?: (hit: TheaterOpeningContextHit) => void;
  onSelect?: (openingId: number) => void;
  onMovePreview?: (openings: TheaterWallOpening[]) => void;
  onMoveCommit?: (openings: TheaterWallOpening[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const pose = getOpeningHighlightPose(opening, layout);
  const deckY = resolveStageRise(layout);
  const sill = opening.sill ?? 0;
  const height = Math.min(opening.height, layout.wallHeight - sill);
  const contextHandlers = useTheaterObjectContextGesture(Boolean(onContextMenu), (event) => {
    onContextMenu?.({
      kind: "opening",
      openingId: opening.id,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  });
  const { pointerHandlers } = useTheaterWallSlotDrag({
    enabled: Boolean(onMovePreview || onMoveCommit),
    wall: opening.wall,
    layout,
    applyPreview: (source, worldX, worldZ) =>
      applyOpeningDragPreview(source, opening.id, "move", worldX, worldZ),
    onSelect: onSelect ? () => onSelect(opening.id) : undefined,
    onMovePreview,
    onMoveCommit,
    onDragStart,
    onDragEnd,
    onDraggingChange,
    contextHandlers,
  });

  if (!pose) return null;

  return (
    <mesh
      position={[pose.x, deckY + sill + height / 2, pose.z]}
      rotation={[0, pose.rotationY, 0]}
      userData={{ theaterPick: THEATER_PICK_OPENING }}
      {...pointerHandlers}
    >
      <planeGeometry args={[opening.width, height]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function TheaterOpeningHits({
  layout,
  wallsHideFromCamera,
  onContextMenu,
  onSelect,
  onMovePreview,
  onMoveCommit,
  onDragStart,
  onDragEnd,
  onDraggingChange,
}: {
  layout: TheaterLayout;
  wallsHideFromCamera: boolean;
  onContextMenu?: (hit: TheaterOpeningContextHit) => void;
  onSelect?: (openingId: number) => void;
  onMovePreview?: (openings: TheaterWallOpening[]) => void;
  onMoveCommit?: (openings: TheaterWallOpening[]) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
}) {
  const hiddenGroup = useHiddenWallGroup(layout, wallsHideFromCamera);
  const openings = resolveLayoutWallOpenings(layout);
  if (openings.length === 0) return null;
  return (
    <>
      {openings.map((opening) => {
        if (isWallHidden(layout, opening.wall)) return null;
        if (hiddenGroup === opening.wall) return null;
        return (
          <OpeningHitVolume
            key={`opening-hit-${opening.id}`}
            layout={layout}
            opening={opening}
            onContextMenu={onContextMenu}
            onSelect={onSelect}
            onMovePreview={onMovePreview}
            onMoveCommit={onMoveCommit}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDraggingChange={onDraggingChange}
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
  activeDoorId?: number;
  activeRecessId?: number;
  activeOpeningId?: number;
  highlightGridCell?: { col: number; row: number } | null;
  spotlightAimMode?: "point" | "cell";
  onPickGridCell?: (col: number, row: number) => void;
  onWallContextMenu?: (hit: TheaterWallContextHit) => void;
  onFloorContextMenu?: (hit: TheaterFloorContextHit) => void;
  doorsInteractive?: boolean;
  onSelectDoor?: (doorId: number) => void;
  onDoorMovePreview?: (doors: TheaterDoor[]) => void;
  onDoorMoveCommit?: (doors: TheaterDoor[]) => void;
  onDoorDragStart?: () => void;
  onDoorDragEnd?: () => void;
  onDraggingChange?: (dragging: boolean) => void;
  onDoorContextMenu?: (hit: TheaterDoorContextHit) => void;
  onRecessContextMenu?: (hit: TheaterRecessContextHit) => void;
  onSelectRecess?: (recessId: number) => void;
  onRecessMovePreview?: (recesses: TheaterWallRecess[]) => void;
  onRecessMoveCommit?: (recesses: TheaterWallRecess[]) => void;
  onRecessDragStart?: () => void;
  onRecessDragEnd?: () => void;
  onSelectOpening?: (openingId: number) => void;
  onOpeningMovePreview?: (openings: TheaterWallOpening[]) => void;
  onOpeningMoveCommit?: (openings: TheaterWallOpening[]) => void;
  onOpeningDragStart?: () => void;
  onOpeningDragEnd?: () => void;
  onOpeningContextMenu?: (hit: TheaterOpeningContextHit) => void;
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
  activeDoorId,
  activeRecessId,
  activeOpeningId,
  highlightGridCell,
  spotlightAimMode = "point",
  onPickGridCell,
  onWallContextMenu,
  onFloorContextMenu,
  doorsInteractive = false,
  onSelectDoor,
  onDoorMovePreview,
  onDoorMoveCommit,
  onDoorDragStart,
  onDoorDragEnd,
  onDraggingChange,
  onDoorContextMenu,
  onRecessContextMenu,
  onSelectRecess,
  onRecessMovePreview,
  onRecessMoveCommit,
  onRecessDragStart,
  onRecessDragEnd,
  onSelectOpening,
  onOpeningMovePreview,
  onOpeningMoveCommit,
  onOpeningDragStart,
  onOpeningDragEnd,
  onOpeningContextMenu,
}: TheaterStageProps) => {
  const activeRecess = useMemo(() => {
    if (activeRecessId == null) return null;
    return (
      resolveLayoutWallRecesses(layout).find(
        (recess) => recess.id === activeRecessId,
      ) ?? null
    );
  }, [activeRecessId, layout]);
  const activeOpening = useMemo(() => {
    if (activeOpeningId == null) return null;
    return (
      resolveLayoutWallOpenings(layout).find(
        (opening) => opening.id === activeOpeningId,
      ) ?? null
    );
  }, [activeOpeningId, layout]);

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

      <TheaterStageFloor
        projectName={projectName}
        layout={layout}
        onFloorContextMenu={onFloorContextMenu}
      />
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
        <>
          <StageWalls
            projectName={projectName}
            layout={layout}
            wallsOpaque={wallsOpaque}
            wallsHideFromCamera={wallsHideFromCamera}
            onWallContextMenu={onWallContextMenu}
          />
          <TheaterRecessFills
            projectName={projectName}
            layout={layout}
            wallsHideFromCamera={wallsHideFromCamera}
          />
          {onRecessContextMenu || onSelectRecess || onRecessMovePreview ? (
            <TheaterRecessHits
              layout={layout}
              wallsHideFromCamera={wallsHideFromCamera}
              onContextMenu={onRecessContextMenu}
              onSelect={onSelectRecess}
              onMovePreview={onRecessMovePreview}
              onMoveCommit={onRecessMoveCommit}
              onDragStart={onRecessDragStart}
              onDragEnd={onRecessDragEnd}
              onDraggingChange={onDraggingChange}
            />
          ) : null}
          {onOpeningContextMenu || onSelectOpening || onOpeningMovePreview ? (
            <TheaterOpeningHits
              layout={layout}
              wallsHideFromCamera={wallsHideFromCamera}
              onContextMenu={onOpeningContextMenu}
              onSelect={onSelectOpening}
              onMovePreview={onOpeningMovePreview}
              onMoveCommit={onOpeningMoveCommit}
              onDragStart={onOpeningDragStart}
              onDragEnd={onOpeningDragEnd}
              onDraggingChange={onDraggingChange}
            />
          ) : null}
        </>
      ) : null}

      <TheaterStageDoors
        layout={layout}
        activeDoorId={activeDoorId}
        interactive={doorsInteractive}
        onSelectDoor={onSelectDoor}
        onDoorMovePreview={onDoorMovePreview}
        onDoorMoveCommit={onDoorMoveCommit}
        onDoorDragStart={onDoorDragStart}
        onDoorDragEnd={onDoorDragEnd}
        onDraggingChange={onDraggingChange}
        onDoorContextMenu={onDoorContextMenu}
      />
      {activeRecess ? (
        <ActiveRecessHighlight layout={layout} recess={activeRecess} />
      ) : null}
      {activeOpening ? (
        <ActiveOpeningHighlight layout={layout} opening={activeOpening} />
      ) : null}

      {showSeats && layout.seatRows > 0 ? (
        <InstancedAudienceSeats layout={layout} />
      ) : null}

      <AudienceBoundaryLine layout={layout} />
    </>
  );
};
