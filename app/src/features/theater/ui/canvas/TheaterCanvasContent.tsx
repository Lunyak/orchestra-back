import { TransformControls } from "@react-three/drei";
import { Suspense } from "react";
import type * as THREE from "three";
import type {
  TheaterDoor,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
  TheaterWallOpening,
  TheaterWallRecess,
} from "../../../../shared/types/script";
import {
  canAddTheaterLayoutDoors,
  type TheaterDoorContextHit,
  type TheaterFloorContextHit,
  type TheaterOpeningContextHit,
  type TheaterRecessContextHit,
  type TheaterWallContextHit,
  type TheaterAudienceContextHit,
} from "../../model/theater-object-context";
import type { ActiveAlignGuide } from "../../model/theater-align-guides";
import type { StageGridCell } from "../../playbook-stage/use-stage-grid-highlight";
import { TheaterStage } from "../three/TheaterStage";
import { DecorFloorPlacer } from "../three/DecorFloorPlacer";
import { BuiltinTemplateFloorDrop } from "../three/BuiltinTemplateFloorDrop";
import { ModelFloorMoveHandles } from "../three/ModelFloorMoveHandles";
import { LightRigMoveHandle } from "../three/LightRigMoveHandle";
import type { HallExpandResult } from "../../model/theater-hall-expand";
import type { TheaterBuiltinTemplateKey } from "../../model/theater-model-builtin";
import {
  resolveHallOffsetX,
  resolveHallOffsetZ,
} from "../../model/theater-hall-expand";
import { AudienceSeatsHandle } from "../three/AudienceSeatsHandle";
import { HallSizeHandles } from "../three/HallSizeHandles";
import { StageGridHandles } from "../three/StageGridHandles";
import { TheaterFloorGrid } from "../three/TheaterFloorGrid";
import { TheaterAlignGuides } from "../three/TheaterAlignGuides";
import { SpotlightItem } from "../three/SpotlightItem";
import { InstancedFurnitureLayer } from "../three/InstancedFurnitureLayer";
import { BuiltinModelInstance } from "../three/BuiltinModelInstance";
import { FileModelInstanceLoader } from "../three/FileModelInstanceLoader";
import { isTheaterRightClickNav } from "../../model/theater-right-click-nav";
import { isLightTrussModel } from "../../model/theater-truss-mounts";
import { TheaterOrbitControls } from "../three/TheaterOrbitControls";
import { LightTrussMountPoints } from "../three/LightTrussMountPoints";
import type { TheaterCameraState } from "../../model/theater-camera-storage";
import type { SceneOutlinerKind } from "../../model/theater-scene-outliner";
import type { TheaterViewPrefs } from "../../model/theater-view-prefs-storage";
import type { TheaterSmokePosition } from "../../model/theater-smoke-settings";
import {
  THEATER_SMOKE_FOG_FAR,
  THEATER_SMOKE_FOG_NEAR,
} from "../../model/theater-scene-lighting";
import { TheaterSmokeMachine } from "../three/TheaterSmokeMachine";

export type TheaterCanvasContentProps = {
  projectName: string;
  layout: TheaterLayout;
  initialCamera: TheaterCameraState;
  showEditorHelpers: boolean;
  showSeats: boolean;
  showGrid: boolean;
  showStageGrid: boolean;
  activeDoorId?: number;
  activeRecessId?: number;
  activeOpeningId?: number;
  showSpotlights: boolean;
  showSpotlightGuideLines: boolean;
  wallsOpaque: boolean;
  wallsHidden: boolean;
  wallsHideFromCamera: boolean;
  dutyLightEnabled: boolean;
  smokeMachineEnabled: boolean;
  smokePosition: TheaterSmokePosition;
  smokeIntensity: number;
  smokeSaturation: number;
  smokeSize: number;
  sceneBackgroundColor: string;
  onSmokePositionChange: (position: TheaterSmokePosition) => void;
  snapToGrid: boolean;
  gridStep: number;
  alignGuidesEnabled: boolean;
  activeAlignGuides: ActiveAlignGuide[];
  onAlignGuidesChange: (guides: ActiveAlignGuide[]) => void;
  activeTab: TheaterViewPrefs["activeTab"];
  editMode: "spotlights" | "models" | "decor";
  decorPlaceMode: boolean;
  onDecorPlace: (position: [number, number, number]) => void;
  onBuiltinTemplateDrop: (
    key: TheaterBuiltinTemplateKey,
    position: [number, number, number],
  ) => void;
  isDragging: boolean;
  dragMode: "target" | "source";
  highlightGridCell: StageGridCell | null;
  spotlightAimMode: "point" | "cell";
  onPickGridCell: (col: number, row: number) => void;
  spotlights: TheaterSpotlight[];
  visibleSpotlights: TheaterSpotlight[];
  activeSpotlightId: number | undefined;
  multiSelectedSpotlightIds: number[];
  pulseTarget: { kind: SceneOutlinerKind | "recess"; id: number } | null;
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
  activeModelObject: THREE.Object3D | null;
  activeModelObjectId: number | undefined;
  modelTransformMode: "translate" | "rotate" | "scale";
  onModelTransformStart: () => void;
  onTrussMountPointClick: (
    modelId: number,
    mountPointId: string,
    occupiedSpotlightId?: number,
  ) => void;
  onModelTransformEnd: () => void;
  onModelTransformChange: () => void;
  activeModel: TheaterModel | undefined;
  onModelFloorMovePreview: (position: [number, number, number]) => void;
  onModelFloorMoveCommit: (position: [number, number, number]) => void;
  onModelFloorMoveDragStart: () => void;
  onModelFloorMoveDragEnd: () => void;
  onLightRigMovePreview: (deltaX: number, deltaZ: number) => void;
  onLightRigMoveCommit: (deltaX: number, deltaZ: number) => void;
  onLightRigMoveDragStart: () => void;
  onLightRigMoveDragEnd: () => void;
  lightRigFocused: boolean;
  onSelectLightRig: () => void;
  onActiveObjectChange: (node: THREE.Object3D | null, id: number) => void;
  onObjectReady: (node: THREE.Object3D | null, id: number) => void;
  audienceSeatsHighlight: boolean;
  audienceSeatsFocused: boolean;
  onSelectAudienceSeats: () => void;
  onAudienceStartZPreview: (z: number) => void;
  onAudienceStartZChange: (z: number) => void;
  onAudienceDragStart: () => void;
  onAudienceDragEnd: () => void;
  layoutOutlineFocused: boolean;
  onSelectLayout: () => void;
  onLayoutSizePreview: (result: HallExpandResult) => void;
  onLayoutSizeCommit: (result: HallExpandResult) => void;
  onLayoutSizeDragStart: () => void;
  onLayoutSizeDragEnd: () => void;
  stageGridFocused: boolean;
  onSelectStageGrid: () => void;
  onStageGridPreview: (patch: Partial<TheaterLayout>) => void;
  onStageGridCommit: (patch: Partial<TheaterLayout>) => void;
  onStageGridDragStart: () => void;
  onStageGridDragEnd: () => void;
  onWallContextMenu?: (hit: TheaterWallContextHit) => void;
  onFloorContextMenu?: (hit: TheaterFloorContextHit) => void;
  onSelectDoor?: (doorId: number) => void;
  onDoorMovePreview?: (doors: TheaterDoor[]) => void;
  onDoorMoveCommit?: (doors: TheaterDoor[]) => void;
  onDoorDragStart?: () => void;
  onDoorDragEnd?: () => void;
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
  onAudienceContextMenu?: (hit: TheaterAudienceContextHit) => void;
};

export function TheaterCanvasContent({
  projectName,
  layout,
  initialCamera,
  showEditorHelpers,
  showSeats,
  showGrid,
  showStageGrid,
  activeDoorId,
  activeRecessId,
  activeOpeningId,
  showSpotlights,
  showSpotlightGuideLines,
  wallsOpaque,
  wallsHidden,
  wallsHideFromCamera,
  dutyLightEnabled,
  smokeMachineEnabled,
  smokePosition,
  smokeIntensity,
  smokeSaturation,
  smokeSize,
  sceneBackgroundColor,
  onSmokePositionChange,
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
  spotlights,
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
  activeModelObject,
  activeModelObjectId,
  modelTransformMode,
  onModelTransformStart,
  onTrussMountPointClick,
  onModelTransformEnd,
  onModelTransformChange,
  activeModel,
  onModelFloorMovePreview,
  onModelFloorMoveCommit,
  onModelFloorMoveDragStart,
  onModelFloorMoveDragEnd,
  onLightRigMovePreview,
  onLightRigMoveCommit,
  onLightRigMoveDragStart,
  onLightRigMoveDragEnd,
  lightRigFocused,
  onSelectLightRig,
  onActiveObjectChange,
  onObjectReady,
  onDecorPlace,
  onBuiltinTemplateDrop,
  audienceSeatsHighlight,
  audienceSeatsFocused,
  onSelectAudienceSeats,
  onAudienceStartZPreview,
  onAudienceStartZChange,
  onAudienceDragStart,
  onAudienceDragEnd,
  layoutOutlineFocused,
  onSelectLayout,
  onLayoutSizePreview,
  onLayoutSizeCommit,
  onLayoutSizeDragStart,
  onLayoutSizeDragEnd,
  stageGridFocused,
  onSelectStageGrid,
  onStageGridPreview,
  onStageGridCommit,
  onStageGridDragStart,
  onStageGridDragEnd,
  onWallContextMenu,
  onFloorContextMenu,
  onSelectDoor,
  onDoorMovePreview,
  onDoorMoveCommit,
  onDoorDragStart,
  onDoorDragEnd,
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
  onAudienceContextMenu,
}: TheaterCanvasContentProps) {
  const pickingSpotlightGridCell =
    activeTab === "spotlights" && editMode === "spotlights" && spotlightAimMode === "cell";
  const passModelPointerEventsThrough = pickingSpotlightGridCell;
  const hoveredLightTruss = individualModels.find(
    (model) =>
      model.id === hoveredModelId && model.builtin === "lightTruss6m",
  );
  const lightTrusses = individualModels.filter(isLightTrussModel);
  const mountPointTruss =
    activeModel?.builtin === "lightTruss6m"
      ? activeModel
      : hoveredLightTruss;
  const modelUsesVerticalRotation =
    (activeModel?.builtin === "actor" ||
      activeModel?.builtin === "stageActor" ||
      activeModel?.builtin === "lightTruss6m") &&
    modelTransformMode === "rotate";
  const hallOffsetX = resolveHallOffsetX(layout);
  const hallOffsetZ = resolveHallOffsetZ(layout);
  const handleModelContextMenu = (id: number) => {
    if (isTheaterRightClickNav()) return;
    onModelContextMenu(id);
  };
  const handleSpotlightContextMenu = (id: number) => {
    if (isTheaterRightClickNav()) return;
    onSpotlightContextMenu(id);
  };

  return (
    <>
      {smokeMachineEnabled ? (
        <fog
          attach="fog"
          args={[sceneBackgroundColor, THEATER_SMOKE_FOG_NEAR, THEATER_SMOKE_FOG_FAR]}
        />
      ) : null}
      <group position={[hallOffsetX, 0, hallOffsetZ]}>
      <TheaterStage
        projectName={projectName}
        layout={layout}
        showSeats={showSeats}
        wallsOpaque={wallsOpaque}
        wallsHidden={wallsHidden}
        wallsHideFromCamera={wallsHideFromCamera}
        dutyLightEnabled={dutyLightEnabled}
        showStageGrid={showStageGrid}
        activeDoorId={activeDoorId}
        activeRecessId={activeRecessId}
        activeOpeningId={activeOpeningId}
        highlightGridCell={highlightGridCell}
        spotlightAimMode={pickingSpotlightGridCell ? "cell" : "point"}
        onPickGridCell={onPickGridCell}
        onWallContextMenu={onWallContextMenu}
        onFloorContextMenu={onFloorContextMenu}
        doorsInteractive={showEditorHelpers && canAddTheaterLayoutDoors(layout)}
        onSelectDoor={onSelectDoor}
        onDoorMovePreview={onDoorMovePreview}
        onDoorMoveCommit={onDoorMoveCommit}
        onDoorDragStart={onDoorDragStart}
        onDoorDragEnd={onDoorDragEnd}
        onDraggingChange={onDraggingChange}
        onDoorContextMenu={onDoorContextMenu}
        onRecessContextMenu={onRecessContextMenu}
        onSelectRecess={onSelectRecess}
        onRecessMovePreview={onRecessMovePreview}
        onRecessMoveCommit={onRecessMoveCommit}
        onRecessDragStart={onRecessDragStart}
        onRecessDragEnd={onRecessDragEnd}
        onSelectOpening={onSelectOpening}
        onOpeningMovePreview={onOpeningMovePreview}
        onOpeningMoveCommit={onOpeningMoveCommit}
        onOpeningDragStart={onOpeningDragStart}
        onOpeningDragEnd={onOpeningDragEnd}
        onOpeningContextMenu={onOpeningContextMenu}
      />
      <TheaterSmokeMachine
        layout={layout}
        enabled={smokeMachineEnabled}
        position={smokePosition}
        intensity={smokeIntensity}
        saturation={smokeSaturation}
        size={smokeSize}
        draggable={showEditorHelpers && smokeMachineEnabled}
        onPositionChange={onSmokePositionChange}
        onDraggingChange={onDraggingChange}
      />
      <DecorFloorPlacer
        enabled={
          showEditorHelpers &&
          activeTab === "decor" &&
          decorPlaceMode &&
          !isDragging &&
          activeModelId == null
        }
        layout={layout}
        hallOffsetX={hallOffsetX}
        hallOffsetZ={hallOffsetZ}
        snapEnabled={snapToGrid}
        snapStep={gridStep}
        onPlace={onDecorPlace}
      />
      <BuiltinTemplateFloorDrop
        enabled={showEditorHelpers && !isDragging}
        layout={layout}
        hallOffsetX={hallOffsetX}
        hallOffsetZ={hallOffsetZ}
        snapEnabled={snapToGrid}
        snapStep={gridStep}
        onDropTemplate={onBuiltinTemplateDrop}
      />
      <AudienceSeatsHandle
        layout={layout}
        focused={showEditorHelpers && audienceSeatsFocused && showSeats}
        highlighted={audienceSeatsHighlight}
        selectable={
          showEditorHelpers && showSeats && !isDragging && !decorPlaceMode
        }
        snapEnabled={snapToGrid}
        snapStep={gridStep}
        onSelect={onSelectAudienceSeats}
        onAudienceStartZPreview={onAudienceStartZPreview}
        onAudienceStartZChange={onAudienceStartZChange}
        onDraggingChange={(dragging) => {
          onDraggingChange(dragging);
          if (dragging) onAudienceDragStart();
          else onAudienceDragEnd();
        }}
        onDragStart={onAudienceDragStart}
        onDragEnd={onAudienceDragEnd}
        onAudienceContextMenu={onAudienceContextMenu}
      />
      <StageGridHandles
        layout={layout}
        focused={showEditorHelpers && stageGridFocused && showStageGrid}
        selectable={
          showEditorHelpers &&
          showStageGrid &&
          !isDragging &&
          !decorPlaceMode &&
          !(activeTab === "spotlights" && editMode === "spotlights" && spotlightAimMode === "cell")
        }
        onSelect={onSelectStageGrid}
        onPreview={onStageGridPreview}
        onCommit={onStageGridCommit}
        onDraggingChange={onDraggingChange}
        onDragStart={onStageGridDragStart}
        onDragEnd={onStageGridDragEnd}
        onFloorContextMenu={onFloorContextMenu}
      />
      <HallSizeHandles
        layout={layout}
        active={showEditorHelpers && layoutOutlineFocused}
        selectable={showEditorHelpers && !isDragging && !decorPlaceMode}
        snapEnabled={snapToGrid}
        snapStep={gridStep}
        onSelect={onSelectLayout}
        onPreview={onLayoutSizePreview}
        onCommit={onLayoutSizeCommit}
        onDraggingChange={onDraggingChange}
        onDragStart={onLayoutSizeDragStart}
        onDragEnd={onLayoutSizeDragEnd}
      />
      {showGrid ? (
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
          showHelpers={showEditorHelpers && showSpotlights}
          showSpotlightLabels={showEditorHelpers && showSpotlights}
          showGuideLine={showSpotlightGuideLines}
          smokeBeamVisible={smokeMachineEnabled}
          smokeSaturation={smokeSaturation}
          onTargetChange={onSpotlightTargetChange}
          onPositionChange={onSpotlightPositionChange}
          onDraggingChange={onDraggingChange}
          sceneDragging={isDragging}
          onDragStart={onSpotlightDragStart}
          onDragEnd={onSpotlightDragEnd}
          onContextMenu={handleSpotlightContextMenu}
          onSelect={onSpotlightSelect}
        />
      ))}
      <InstancedFurnitureLayer
        models={instancedFurnitureModels}
        activeModelId={activeModelId}
        selectedModelIds={multiSelectedModelIds}
        hoveredModelId={hoveredModelId}
        onSelect={onModelSelect}
        onContextMenu={handleModelContextMenu}
        onHoverChange={onModelHoverChange}
        passThroughPointerEvents={passModelPointerEventsThrough}
      />
      {individualModels.map((model) => {
        const hideTrussInPreview =
          !showEditorHelpers && model.builtin === "lightTruss6m";
        if (hideTrussInPreview) return null;

        const isActive = isModelEditMode && model.id === activeModelId;
        const onSelect = (additive = false) => onModelSelect(model.id, additive);
        const onActivate = () => {
          onModelSelect(model.id);
          onModelActivate(model.id);
        };
        const onHoverChange = (next: boolean) => {
          onModelHoverChange(next ? model.id : null);
        };
        const selectionBoxEnabled =
          activeTab !== "spotlights" || model.builtin !== "lightTruss6m";
        if (model.type === "builtin") {
          return (
            <Suspense key={model.id} fallback={null}>
              <BuiltinModelInstance
                projectName={projectName}
                model={model}
                isActive={isActive}
                onActiveObjectChange={onActiveObjectChange}
                onObjectReady={onObjectReady}
                onSelect={onSelect}
                onActivate={onActivate}
                onContextMenu={handleModelContextMenu}
                isSelected={multiSelectedModelIds.includes(model.id)}
                isHovered={model.id === hoveredModelId}
                onHoverChange={onHoverChange}
                passThroughPointerEvents={passModelPointerEventsThrough}
                selectionBoxEnabled={selectionBoxEnabled}
              />
            </Suspense>
          );
        }
        if (model.file) {
          return (
            <Suspense key={model.id} fallback={null}>
              <FileModelInstanceLoader
                projectName={projectName}
                model={model}
                isActive={isActive}
                onActiveObjectChange={onActiveObjectChange}
                onObjectReady={onObjectReady}
                onSelect={onSelect}
                onActivate={onActivate}
                onContextMenu={handleModelContextMenu}
                isSelected={multiSelectedModelIds.includes(model.id)}
                isHovered={model.id === hoveredModelId}
                onHoverChange={onHoverChange}
                passThroughPointerEvents={passModelPointerEventsThrough}
              />
            </Suspense>
          );
        }
        return null;
      })}
      {showEditorHelpers && activeTab === "spotlights" && mountPointTruss ? (
        <LightTrussMountPoints
          model={mountPointTruss}
          spotlights={spotlights}
          onMountPointClick={(mountPointId, occupiedSpotlightId) =>
            onTrussMountPointClick(
              mountPointTruss.id,
              mountPointId,
              occupiedSpotlightId,
            )
          }
        />
      ) : null}
      {isModelEditMode &&
        !decorPlaceMode &&
        activeModel &&
        activeModelId != null ? (
        <ModelFloorMoveHandles
          model={activeModel}
          object={
            activeModelObjectId === activeModelId ? activeModelObject : null
          }
          layout={layout}
          snapEnabled={snapToGrid}
          snapStep={gridStep}
          lockY={isLightTrussModel(activeModel)}
          onPreview={onModelFloorMovePreview}
          onCommit={onModelFloorMoveCommit}
          onDraggingChange={onDraggingChange}
          onDragStart={onModelFloorMoveDragStart}
          onDragEnd={onModelFloorMoveDragEnd}
        />
      ) : null}
      {showEditorHelpers &&
      !decorPlaceMode &&
      !pickingSpotlightGridCell &&
      lightTrusses.length > 1 ? (
        <LightRigMoveHandle
          trusses={lightTrusses}
          layout={layout}
          focused={lightRigFocused}
          selectable={!isDragging}
          snapEnabled={snapToGrid}
          snapStep={gridStep}
          onSelect={onSelectLightRig}
          onPreview={onLightRigMovePreview}
          onCommit={onLightRigMoveCommit}
          onDraggingChange={onDraggingChange}
          onDragStart={onLightRigMoveDragStart}
          onDragEnd={onLightRigMoveDragEnd}
        />
      ) : null}
      {isModelEditMode &&
        activeModelObject &&
        activeModelObjectId === activeModelId &&
        activeModelObject.parent && (
          <TransformControls
            mode={modelTransformMode}
            object={activeModelObject}
            space="world"
            showX={!modelUsesVerticalRotation && modelTransformMode !== "translate"}
            showY
            showZ={!modelUsesVerticalRotation && modelTransformMode !== "translate"}
            onMouseDown={onModelTransformStart}
            onMouseUp={onModelTransformEnd}
            onObjectChange={onModelTransformChange}
          />
        )}
      </group>
      <TheaterOrbitControls
        projectName={projectName}
        initialCamera={initialCamera}
        enabled={!isDragging}
      />
    </>
  );
}
