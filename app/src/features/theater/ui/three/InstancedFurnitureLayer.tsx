import { Instances, Instance, useGLTF } from "@react-three/drei";
import { Suspense, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { InstancedMesh, Matrix4 } from "three";
import type { ThreeEvent } from "@react-three/fiber";
import type { TheaterModel } from "../../../../shared/types/script";
import { tc } from "../../../../shared/styles/theme-color";
import { resolvePublicAssetUrl } from "../../../../shared/utils/public-asset-url";
import { getTheaterAssetLibraryItem } from "../../model/theater-asset-library";
import {
  getFurnitureParts,
  groupFurnitureInstances,
  INSTANCED_LIBRARY_BUILTINS,
  type FurnitureInstanceGroup,
  type FurniturePartSpec,
} from "../../model/theater-furniture-instancing";

type InstancedFurnitureLayerProps = {
  models: TheaterModel[];
  activeModelId?: number;
  selectedModelIds?: number[];
  hoveredModelId: number | null;
  onSelect: (id: number, additive?: boolean) => void;
  onContextMenu: (id: number, clientX: number, clientY: number) => void;
  onHoverChange: (id: number | null) => void;
  passThroughPointerEvents?: boolean;
};

type PointerHandlers = {
  onSelect: (id: number, additive?: boolean) => void;
  onContextMenu: (id: number, clientX: number, clientY: number) => void;
  onHoverChange: (id: number | null) => void;
  passThroughPointerEvents?: boolean;
};

const partScratch = new THREE.Vector3();
const partEuler = new THREE.Euler();
const partScale = new THREE.Vector3();
const partOrigin = new THREE.Vector3();

function partParentPosition(
  model: TheaterModel,
  local: [number, number, number],
): [number, number, number] {
  partScratch.set(local[0], local[1], local[2]);
  partScale.set(model.scale[0], model.scale[1], model.scale[2]);
  partScratch.multiply(partScale);
  partEuler.set(model.rotation[0], model.rotation[1], model.rotation[2]);
  partScratch.applyEuler(partEuler);
  partOrigin.set(model.position[0], model.position[1], model.position[2]);
  partScratch.add(partOrigin);
  return [partScratch.x, partScratch.y, partScratch.z];
}

function stopPointer(event: ThreeEvent<PointerEvent | MouseEvent>) {
  event.stopPropagation();
}

function FurniturePartInstances({
  group,
  part,
  activeModelId,
  selectedModelIds,
  hoveredModelId,
  onSelect,
  onContextMenu,
  onHoverChange,
  passThroughPointerEvents,
}: PointerHandlers & {
  group: FurnitureInstanceGroup;
  part: FurniturePartSpec;
  activeModelId?: number;
  selectedModelIds?: number[];
  hoveredModelId: number | null;
}) {
  const meshRef = useRef<InstancedMesh>(null);
  const tinted = group.color !== "default";
  const materialColor = tinted ? group.color : tc(part.colorToken);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    return () => {
      if (!mesh) return;
      mesh.count = 0;
      mesh.removeFromParent();
    };
  }, []);

  return (
    <Instances
      ref={meshRef}
      limit={Math.max(group.models.length, 1)}
      range={group.models.length}
    >
      <boxGeometry args={part.size} />
      <meshStandardMaterial color={materialColor} />
      {group.models.map((model) => {
        const isSelected =
          selectedModelIds?.includes(model.id) ?? model.id === activeModelId;
        const isHovered = model.id === hoveredModelId;
        const tint = isSelected
          ? tc("--color-active-ascent")
          : isHovered
            ? tc("--color-primary-light")
            : undefined;
        return (
          <Instance
            key={model.id}
            position={partParentPosition(model, part.position)}
            rotation={model.rotation}
            scale={model.scale}
            color={tint}
            onPointerDown={(event) => {
              if (passThroughPointerEvents) return;
              stopPointer(event);
            }}
            onClick={(event) => {
              if (passThroughPointerEvents) return;
              stopPointer(event);
              onSelect(model.id, event.nativeEvent.shiftKey);
            }}
            onContextMenu={(event) => {
              if (passThroughPointerEvents) return;
              stopPointer(event);
              event.nativeEvent.preventDefault();
              onContextMenu(
                model.id,
                event.nativeEvent.clientX,
                event.nativeEvent.clientY,
              );
            }}
            onPointerOver={(event) => {
              if (passThroughPointerEvents) return;
              stopPointer(event);
              onHoverChange(model.id);
            }}
            onPointerOut={(event) => {
              if (passThroughPointerEvents) return;
              stopPointer(event);
              onHoverChange(null);
            }}
          />
        );
      })}
    </Instances>
  );
}

function FurnitureInstanceGroupView(
  props: PointerHandlers & {
    group: FurnitureInstanceGroup;
    activeModelId?: number;
    selectedModelIds?: number[];
    hoveredModelId: number | null;
  },
) {
  const parts = getFurnitureParts(props.group.builtin);
  if (!parts) return null;
  return (
    <>
      {parts.map((part) => (
        <FurniturePartInstances key={part.id} part={part} {...props} />
      ))}
    </>
  );
}

type LibraryMeshPart = {
  geometry: THREE.BufferGeometry;
  material: THREE.Material;
  matrix: Matrix4;
};

function collectLibraryParts(scene: THREE.Object3D): LibraryMeshPart[] {
  scene.updateMatrixWorld(true);
  const parts: LibraryMeshPart[] = [];
  scene.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    if (!material) return;
    parts.push({
      geometry: mesh.geometry,
      material,
      matrix: mesh.matrixWorld.clone(),
    });
  });
  return parts;
}

function LibraryPartMesh({
  part,
  models,
  onSelect,
  onContextMenu,
  onHoverChange,
  passThroughPointerEvents,
}: PointerHandlers & {
  part: LibraryMeshPart;
  models: TheaterModel[];
}) {
  const meshRef = useRef<InstancedMesh>(null);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const matrix = new THREE.Matrix4();
    models.forEach((model, index) => {
      dummy.position.set(model.position[0], model.position[1], model.position[2]);
      dummy.rotation.set(model.rotation[0], model.rotation[1], model.rotation[2]);
      dummy.scale.set(model.scale[0], model.scale[1], model.scale[2]);
      dummy.updateMatrix();
      matrix.multiplyMatrices(dummy.matrix, part.matrix);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.count = models.length;
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [models, part.matrix]);

  const pickModel = (event: ThreeEvent<MouseEvent>) => {
    const instanceId = event.instanceId;
    if (instanceId == null) return null;
    return models[instanceId] ?? null;
  };

  return (
    <instancedMesh
      key={models.length}
      ref={meshRef}
      args={[part.geometry, part.material, Math.max(models.length, 1)]}
      onClick={(event) => {
        if (passThroughPointerEvents) return;
        stopPointer(event);
        const model = pickModel(event);
        if (!model) return;
        onSelect(model.id, event.nativeEvent.shiftKey);
      }}
      onContextMenu={(event) => {
        if (passThroughPointerEvents) return;
        stopPointer(event);
        event.nativeEvent.preventDefault();
        const model = pickModel(event);
        if (!model) return;
        onContextMenu(model.id, event.nativeEvent.clientX, event.nativeEvent.clientY);
      }}
      onPointerOver={(event) => {
        if (passThroughPointerEvents) return;
        stopPointer(event);
        const model = pickModel(event);
        if (!model) return;
        onHoverChange(model.id);
      }}
      onPointerOut={(event) => {
        if (passThroughPointerEvents) return;
        stopPointer(event);
        onHoverChange(null);
      }}
    />
  );
}

function LibraryInstanceGroupView({
  group,
  ...handlers
}: PointerHandlers & { group: FurnitureInstanceGroup }) {
  const item = getTheaterAssetLibraryItem(group.builtin);
  const detailSuffix = group.lowDetail ? "-low" : "";
  const url = item
    ? resolvePublicAssetUrl(`theater/library/${item.assetKey}${detailSuffix}.glb`)
    : "";
  const gltf = useGLTF(url);
  const parts = useMemo(() => collectLibraryParts(gltf.scene), [gltf.scene]);

  if (!item) return null;

  return (
    <>
      {parts.map((part, index) => (
        <LibraryPartMesh
          key={`${group.key}-${index}`}
          part={part}
          models={group.models}
          {...handlers}
        />
      ))}
    </>
  );
}

export function InstancedFurnitureLayer({
  models,
  activeModelId,
  selectedModelIds,
  hoveredModelId,
  onSelect,
  onContextMenu,
  onHoverChange,
  passThroughPointerEvents,
}: InstancedFurnitureLayerProps) {
  const groups = useMemo(() => groupFurnitureInstances(models), [models]);
  if (groups.length === 0) return null;

  const handlers = {
    onSelect,
    onContextMenu,
    onHoverChange,
    passThroughPointerEvents,
  };

  return (
    <>
      {groups.map((group) =>
        INSTANCED_LIBRARY_BUILTINS.has(group.builtin) ? (
          <Suspense key={group.key} fallback={null}>
            <LibraryInstanceGroupView group={group} {...handlers} />
          </Suspense>
        ) : (
          <FurnitureInstanceGroupView
            key={group.key}
            group={group}
            activeModelId={activeModelId}
            selectedModelIds={selectedModelIds}
            hoveredModelId={hoveredModelId}
            {...handlers}
          />
        ),
      )}
    </>
  );
}
