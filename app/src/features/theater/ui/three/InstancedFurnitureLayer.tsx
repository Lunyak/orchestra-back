import { tc } from "../../../../shared/styles/theme-color";
import { Instances, Instance } from "@react-three/drei";
import { useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import type { TheaterModel } from "../../../../shared/types/script";
import { resolveDecorColor } from "../../model/theater-decor-catalog";
import {
  getFurnitureInstanceGeometry,
  getFurnitureInstanceYOffset,
  groupFurnitureInstances,
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

function FurnitureInstanceGroup({
  group,
  activeModelId,
  selectedModelIds,
  hoveredModelId,
  onSelect,
  onContextMenu,
  onHoverChange,
  passThroughPointerEvents,
}: {
  group: ReturnType<typeof groupFurnitureInstances>[number];
  activeModelId?: number;
  selectedModelIds?: number[];
  hoveredModelId: number | null;
  onSelect: (id: number, additive?: boolean) => void;
  onContextMenu: (id: number, clientX: number, clientY: number) => void;
  onHoverChange: (id: number | null) => void;
  passThroughPointerEvents?: boolean;
}) {
  const [width, height, depth] = getFurnitureInstanceGeometry(group.builtin);
  const yOffset = getFurnitureInstanceYOffset(group.builtin);
  const color =
    group.color !== "default"
      ? group.color
      : resolveDecorColor({ builtin: group.builtin }) ?? tc("--color-surface-2");

  const stop = (event: ThreeEvent<PointerEvent | MouseEvent>) => event.stopPropagation();

  return (
    <Instances limit={Math.max(group.models.length, 1)}>
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial color={color} />
      {group.models.map((model) => {
        const isSelected =
          selectedModelIds?.includes(model.id) ?? model.id === activeModelId;
        const isHovered = model.id === hoveredModelId;
        const tint = isSelected
          ? tc("--color-error")
          : isHovered
            ? tc("--color-primary-light")
            : undefined;
        return (
          <Instance
            key={model.id}
            position={[
              model.position[0],
              model.position[1] + yOffset,
              model.position[2],
            ]}
            rotation={model.rotation}
            scale={model.scale}
            color={tint}
            onPointerDown={(event) => {
              if (passThroughPointerEvents) return;
              stop(event);
              if (event.button !== 0) return;
            }}
            onClick={(event) => {
              if (passThroughPointerEvents) return;
              stop(event);
              onSelect(model.id, event.nativeEvent.shiftKey);
            }}
            onContextMenu={(event) => {
              if (passThroughPointerEvents) return;
              stop(event);
              event.nativeEvent.preventDefault();
              onContextMenu(
                model.id,
                event.nativeEvent.clientX,
                event.nativeEvent.clientY,
              );
            }}
            onPointerOver={(event) => {
              if (passThroughPointerEvents) return;
              stop(event);
              onHoverChange(model.id);
            }}
            onPointerOut={(event) => {
              if (passThroughPointerEvents) return;
              stop(event);
              onHoverChange(null);
            }}
          />
        );
      })}
    </Instances>
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

  return (
    <>
      {groups.map((group) => (
        <FurnitureInstanceGroup
          key={group.key}
          group={group}
          activeModelId={activeModelId}
          selectedModelIds={selectedModelIds}
          hoveredModelId={hoveredModelId}
          onSelect={onSelect}
          onContextMenu={onContextMenu}
          onHoverChange={onHoverChange}
          passThroughPointerEvents={passThroughPointerEvents}
        />
      ))}
    </>
  );
}
