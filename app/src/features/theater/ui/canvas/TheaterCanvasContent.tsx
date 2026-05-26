import { TransformControls } from "@react-three/drei";
import { Suspense } from "react";
import type * as THREE from "three";
import type { TheaterLayout, TheaterModel, TheaterSpotlight } from "../../../../shared/types/script";
import type { ActiveAlignGuide } from "../../model/theater-align-guides";
import type { StageGridCell } from "../../scene/use-stage-grid-highlight";
import { TheaterStage } from "../three/TheaterStage";
import { DecorFloorPlacer } from "../three/DecorFloorPlacer";
import { AudienceSeatsHandle } from "../three/AudienceSeatsHandle";
import { TheaterFloorGrid } from "../three/TheaterFloorGrid";
import { TheaterAlignGuides } from "../three/TheaterAlignGuides";
import { SpotlightItem } from "../three/SpotlightItem";
import { InstancedFurnitureLayer } from "../three/InstancedFurnitureLayer";
import { BuiltinModelInstance } from "../three/BuiltinModelInstance";
import { FileModelInstance } from "../three/FileModelInstance";
import { TheaterOrbitControls } from "../three/TheaterOrbitControls";

export type TheaterCanvasContentProps = {
  projectName: string;
  layout: TheaterLayout;
  initialCamera: { position: [number, number, number]; fov: number };
  showEditorHelpers: boolean;
  showSeats: boolean;
  showGrid: boolean;
  showStageGrid: boolean;
  showSpotlights: boolean;
  showSpotlightGuideLines: boolean;
  showOnlyActiveSpotlight: boolean;
  wallsOpaque: boolean;
  wallsHidden: boolean;
  wallsHideFromCamera: boolean;
  dutyLightEnabled: boolean;
  snapToGrid: boolean;
  gridStep: number;
  alignGuidesEnabled: boolean;
  activeAlignGuides: ActiveAlignGuide[];
  onAlignGuidesChange: (guides: ActiveAlignGuide[]) => void;
  activeTab: "spotlights" | "models" | "layout" | "decor";
  editMode: "spotlights" | "models" | "decor";
  decorPlaceMode: boolean;
  isDragging: boolean;
  dragMode: "target" | "source";
  highlightGridCell: StageGridCell | null;
  spotlightAimMode: "point" | "cell";
  onPickGridCell: (col: number, row: number) => void;
  visibleSpotlights: TheaterSpotlight[];
  activeSpotlightId: number | undefined;
  multiSelectedSpotlightIds: number[];
  pulseTarget: { kind: "spotlight" | "model" | "door" | "recess"; id: number } | null;
  onSpotlightTargetChange: (id: number, target: [number, number, number]) => void;
  onSpotlightPositionChange: (id: number, position: [number, number, number]) => void;
  onSpotlightSelect: (id: number, additive?: boolean) => void;
  onSpotlightContextMenu: (id: number) => void;
  onSpotlightDragStart: () => void;
  onSpotlightDragEnd: () => void;
  onDraggingChange: (dragging: boolean) => void;
  instancedFurnitureModels: TheaterModel[];
  individualModels: TheaterModel[];
  activeModelId: number | undefined;
  multiSelectedModelIds: number[];
  hoveredModelId: number | null;
  isModelEditMode: boolean;
  onModelSelect: (id: number, additive?: boolean) => void;
  onModelContextMenu: (id: number) => void;
  onModelHoverChange: (id: number | null) => void;
  onModelActivate: (id: number) => void;
  resolveModelSrc: (file: string) => string;
  activeModelObject: THREE.Object3D | null;
  activeModelObjectId: number | undefined;
  modelTransformMode: "translate" | "rotate" | "scale";
  onModelTransformStart: () => void;
  onModelTransformEnd: () => void;
  onModelTransformChange: () => void;
  onActiveObjectChange: (object: THREE.Object3D | null) => void;
  onObjectReady: (id: number, object: THREE.Object3D) => void;
  onDecorPlace: (position: [number, number, number]) => void;
  audienceSeatsHighlight: boolean;
  onAudienceStartZPreview: (z: number) => void;
  onAudienceStartZChange: (z: number) => void;
  onAudienceDragStart: () => void;
  onAudienceDragEnd: () => void;
};

export function TheaterCanvasContent({
  projectName,
  layout,
  initialCamera,
  showEditorHelpers,
  showSeats,
  showGrid,
  showStageGrid,
  showSpotlights,
  showSpotlightGuideLines,
  showOnlyActiveSpotlight,
  wallsOpaque,
  wallsHidden,
  wallsHideFromCamera,
  dutyLightEnabled,
  snapToGrid,
  gridStep,
  alignGuidesEnabled,
  activeAlignGuides,
  onAlignGuidesChange,
  activeTab,
  editMode,
  decorPlaceMode,
  isDragging,
  dragMode,
  highlightGridCell,
  spotlightAimMode,
  onPickGridCell,
  visibleSpotlights,
  activeSpotlightId,
  multiSelectedSpotlightIds,
  pulseTarget,
  onSpotlightTargetChange,
  onSpotlightPositionChange,
  onSpotlightSelect,
  onSpotlightContextMenu,
  onSpotlightDragStart,
  onSpotlightDragEnd,
  onDraggingChange,
  instancedFurnitureModels,
  individualModels,
  activeModelId,
  multiSelectedModelIds,
  hoveredModelId,
  isModelEditMode,
  onModelSelect,
  onModelContextMenu,
  onModelHoverChange,
  onModelActivate,
  resolveModelSrc,
  activeModelObject,
  activeModelObjectId,
  modelTransformMode,
  onModelTransformStart,
  onModelTransformEnd,
  onModelTransformChange,
  onActiveObjectChange,
  onObjectReady,
  onDecorPlace,
  audienceSeatsHighlight,
  onAudienceStartZPreview,
  onAudienceStartZChange,
  onAudienceDragStart,
  onAudienceDragEnd,
}: TheaterCanvasContentProps) {
  const pickingSpotlightGridCell =
    activeTab === "spotlights" && editMode === "spotlights" && spotlightAimMode === "cell";
  const passModelPointerEventsThrough = pickingSpotlightGridCell;
  const hasActiveVisibleSpotlight =
    activeSpotlightId != null &&
    visibleSpotlights.some((item) => item.id === activeSpotlightId);
  const showOnlyActiveVisibleSpotlight =
    showOnlyActiveSpotlight && hasActiveVisibleSpotlight;

  return (
    <>
      <TheaterStage
        projectName={projectName}
        layout={layout}
        showSeats={showSeats}
        wallsOpaque={wallsOpaque}
        wallsHidden={wallsHidden}
        wallsHideFromCamera={wallsHideFromCamera}
        dutyLightEnabled={dutyLightEnabled}
        showStageGrid={showStageGrid}
        highlightGridCell={highlightGridCell}
        spotlightAimMode={pickingSpotlightGridCell ? "cell" : "point"}
        onPickGridCell={onPickGridCell}
      />
      <DecorFloorPlacer
        enabled={
          showEditorHelpers &&
          activeTab === "decor" &&
          decorPlaceMode &&
          !isDragging &&
          activeModelId == null
        }
        hallWidth={layout.hallWidth}
        hallDepth={layout.hallDepth}
        snapEnabled={snapToGrid}
        snapStep={gridStep}
        onPlace={onDecorPlace}
      />
      <AudienceSeatsHandle
        layout={layout}
        active={showEditorHelpers && activeTab === "layout" && showSeats}
        highlighted={audienceSeatsHighlight}
        snapEnabled={snapToGrid}
        snapStep={gridStep}
        onAudienceStartZPreview={onAudienceStartZPreview}
        onAudienceStartZChange={onAudienceStartZChange}
        onDraggingChange={(dragging) => {
          onDraggingChange(dragging);
          if (dragging) onAudienceDragStart();
          else onAudienceDragEnd();
        }}
      />
      {showGrid && showEditorHelpers ? (
        <TheaterFloorGrid
          hallWidth={layout.hallWidth}
          hallDepth={layout.hallDepth}
          step={gridStep}
        />
      ) : null}
      <TheaterAlignGuides
        layout={layout}
        guides={activeAlignGuides}
        visible={
          showEditorHelpers &&
          alignGuidesEnabled &&
          isDragging &&
          (isModelEditMode || editMode === "spotlights")
        }
      />
      {visibleSpotlights.map((item) => (
        <SpotlightItem
          key={item.id}
          config={item}
          isActive={item.id === activeSpotlightId && editMode === "spotlights"}
          isSelected={multiSelectedSpotlightIds.includes(item.id)}
          isPulsing={pulseTarget?.kind === "spotlight" && pulseTarget.id === item.id}
          dragMode={dragMode}
          snapEnabled={snapToGrid}
          snapStep={gridStep}
          hallWidth={layout.hallWidth}
          hallDepth={layout.hallDepth}
          layout={layout}
          alignGuidesEnabled={alignGuidesEnabled}
          onAlignGuidesChange={onAlignGuidesChange}
          showHelpers={
            showEditorHelpers &&
            showSpotlights &&
            (!showOnlyActiveVisibleSpotlight || item.id === activeSpotlightId)
          }
          showGuideLine={showSpotlightGuideLines}
          onTargetChange={onSpotlightTargetChange}
          onPositionChange={onSpotlightPositionChange}
          onDraggingChange={onDraggingChange}
          sceneDragging={isDragging}
          onDragStart={onSpotlightDragStart}
          onDragEnd={onSpotlightDragEnd}
          onContextMenu={onSpotlightContextMenu}
          onSelect={onSpotlightSelect}
        />
      ))}
      <Suspense fallback={null}>
        <InstancedFurnitureLayer
          models={instancedFurnitureModels}
          activeModelId={activeModelId}
          selectedModelIds={multiSelectedModelIds}
          hoveredModelId={hoveredModelId}
          onSelect={onModelSelect}
          onContextMenu={onModelContextMenu}
          onHoverChange={onModelHoverChange}
          passThroughPointerEvents={passModelPointerEventsThrough}
        />
        {individualModels.map((model) => {
          const isActive = isModelEditMode && model.id === activeModelId;
          const onSelect = (additive = false) => onModelSelect(model.id, additive);
          const onActivate = () => {
            onModelSelect(model.id);
            onModelActivate(model.id);
          };
          const onHoverChange = (next: boolean) => {
            onModelHoverChange(next ? model.id : null);
          };
          if (model.type === "builtin") {
            return (
              <BuiltinModelInstance
                key={model.id}
                projectName={projectName}
                model={model}
                isActive={isActive}
                onActiveObjectChange={onActiveObjectChange}
                onObjectReady={onObjectReady}
                onSelect={onSelect}
                onActivate={onActivate}
                onContextMenu={onModelContextMenu}
                isSelected={multiSelectedModelIds.includes(model.id)}
                isHovered={model.id === hoveredModelId}
                onHoverChange={onHoverChange}
                passThroughPointerEvents={passModelPointerEventsThrough}
              />
            );
          }
          if (model.file) {
            return (
              <FileModelInstance
                key={model.id}
                model={model}
                url={resolveModelSrc(model.file)}
                isActive={isActive}
                onActiveObjectChange={onActiveObjectChange}
                onObjectReady={onObjectReady}
                onSelect={onSelect}
                onActivate={onActivate}
                onContextMenu={onModelContextMenu}
                isSelected={multiSelectedModelIds.includes(model.id)}
                isHovered={model.id === hoveredModelId}
                onHoverChange={onHoverChange}
                passThroughPointerEvents={passModelPointerEventsThrough}
              />
            );
          }
          return null;
        })}
      </Suspense>
      {isModelEditMode &&
        showEditorHelpers &&
        activeModelObject &&
        activeModelObjectId === activeModelId &&
        activeModelObject.parent && (
          <TransformControls
            mode={modelTransformMode}
            object={activeModelObject}
            onMouseDown={onModelTransformStart}
            onMouseUp={onModelTransformEnd}
            onObjectChange={onModelTransformChange}
          />
        )}
      <TheaterOrbitControls
        projectName={projectName}
        initialCamera={initialCamera}
        enabled={!isDragging}
      />
    </>
  );
}
