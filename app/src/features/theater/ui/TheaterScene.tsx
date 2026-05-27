import { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useTheaterScene } from "../model/use-theater-scene";
import type { TheaterSceneProps } from "../model/theater-scene-types";
import { useStageGridHighlight } from "../scene/use-stage-grid-highlight";
import {
  DEFAULT_THEATER_CAMERA,
  readTheaterCamera,
} from "../model/theater-camera-storage";
import { countMatchingBuiltin } from "../model/theater-model-align";
import { splitModelsForFurnitureInstancing } from "../model/theater-furniture-instancing";
import type { ModelPlacementPreset } from "../model/theater-model-placement";
import {
  focusCameraForModel,
  requestTheaterCameraFocus,
} from "../model/theater-camera-focus";
import { TheaterControls } from "./TheaterControls";
import { TheaterBtn } from "./theater-controls-ui";
import { TheaterFloorPlan } from "./TheaterFloorPlan";
import { TheaterModelFocusPanel } from "./TheaterModelFocusPanel";
import { TheaterSpotlightFocusPanel } from "./TheaterSpotlightFocusPanel";
import { TheaterLightConsolePanel } from "./TheaterLightConsolePanel";
import { TheaterCanvasShell } from "./canvas/TheaterCanvasShell";
import { TheaterCanvasContent } from "./canvas/TheaterCanvasContent";
import "./style.css";

export type { TheaterSceneProps } from "../model/theater-scene-types";

export const TheaterScene = ({
  projectName = "fools",
  theaterLayout,
  onTheaterLayoutChange,
  isPanelsSwapped,
  onTogglePanels,
  controlsHost,
  mainControlsHost,
  outlinerHost,
  controlsInPanel,
}: TheaterSceneProps) => {
  const vm = useTheaterScene({
    projectName,
    theaterLayout,
    onTheaterLayoutChange,
  });



  const isModelEditMode = vm.editMode === "models" || vm.editMode === "decor";
  const showEditorHelpers = !vm.spectaclePreviewMode;

  const resolvedMainHost = mainControlsHost ?? controlsHost;

  const mainControlsRender =
    controlsInPanel && resolvedMainHost
      ? createPortal(
          <TheaterControls vm={vm} controlsInPanel panel="main" />,
          resolvedMainHost,
        )
      : null;

  const outlinerRender =
    controlsInPanel && outlinerHost
      ? createPortal(
          <TheaterControls vm={vm} controlsInPanel panel="outliner" />,
          outlinerHost,
        )
      : null;

  const initialCamera = useMemo(
    () => readTheaterCamera(vm.projectName) ?? DEFAULT_THEATER_CAMERA,
    [vm.projectName],
  );

  const excludeFromFurnitureInstancing = useMemo(() => {
    const ids = new Set<number>();
    if (vm.activeModelId != null) ids.add(vm.activeModelId);
    if (vm.hoveredModelId != null) ids.add(vm.hoveredModelId);
    return ids;
  }, [vm.activeModelId, vm.hoveredModelId]);

  const { instanced: instancedFurnitureModels, individual: individualModels } =
    useMemo(
      () =>
        splitModelsForFurnitureInstancing(vm.visibleModels, excludeFromFurnitureInstancing),
      [vm.visibleModels, excludeFromFurnitureInstancing],
    );

  const activeSpotlight = useMemo(
    () => vm.displaySpotlights.find((item) => item.id === vm.activeSpotlightId),
    [vm.activeSpotlightId, vm.displaySpotlights],
  );

  const highlightGridCell = useStageGridHighlight(
    vm.layout,
    activeSpotlight,
    vm.spotlightAimMode,
  );

  const showSpotlightFocusPanel =
    showEditorHelpers &&
    vm.activeTab === "spotlights" &&
    vm.editMode === "spotlights" &&
    vm.activeSpotlightId != null &&
    activeSpotlight != null;

  const isDecorTab = vm.activeTab === "decor";

  const showModelFocusPanel =
    showEditorHelpers &&
    isModelEditMode &&
    vm.activeModelId != null &&
    vm.activeModel != null &&
    ((vm.activeTab === "models" && vm.editMode === "models") ||
      (vm.activeTab === "decor" && vm.editMode === "decor"));

  const modelFocusMatchingCount = vm.activeModel
    ? countMatchingBuiltin(vm.models, vm.activeModel.id)
    : 0;

  const selectSpotlight = useCallback(
    (id: number, additive = false) => {
      vm.selectTheaterSpotlight(id, additive);
      vm.setEditMode("spotlights");
    },
    [vm.selectTheaterSpotlight, vm.setEditMode],
  );

  const selectModel = useCallback(
    (id: number, additive = false) => {
      if (vm.activeTab === "decor") {
        vm.exitDecorPlaceMode();
        vm.setEditMode("decor");
      } else {
        vm.setActiveTab("models");
        vm.setEditMode("models");
      }
      vm.selectTheaterModel(id, additive);
    },
    [
      vm.activeTab,
      vm.exitDecorPlaceMode,
      vm.selectTheaterModel,
      vm.setActiveTab,
      vm.setEditMode,
    ],
  );

  const focusModel = useCallback(
    (modelId: number) => {
      selectModel(modelId, false);
    },
    [selectModel],
  );

  const focusSpotlight = useCallback(
    (spotlightId: number) => {
      selectSpotlight(spotlightId, false);
    },
    [selectSpotlight],
  );

  const spotlightFocusPanelProps = activeSpotlight
    ? {
        spotlight: activeSpotlight,
        dragMode: vm.dragMode,
        showOnlyActive: vm.showOnlyActiveSpotlight,
        onShowOnlyActiveChange: vm.setShowOnlyActiveSpotlight,
        onToggleEnabled: () =>
          vm.updateSpotlight(activeSpotlight.id, {
            enabled: !(activeSpotlight.enabled ?? true),
          }),
        onToggleHidden: () =>
          vm.updateSpotlight(activeSpotlight.id, {
            hidden: activeSpotlight.hidden !== true,
          }),
        onAimAtStage: () => vm.aimSpotlightAtStage(activeSpotlight.id),
        onPickDragMode: (mode: "target" | "source") => vm.setDragMode(mode),
        onAngleChange: (angleDeg: number) =>
          vm.updateSpotlight(activeSpotlight.id, { angleDeg }),
        onIntensityChange: (intensity: number) =>
          vm.updateSpotlight(activeSpotlight.id, { intensity }),
        onColorChange: (color: string) =>
          vm.updateSpotlight(activeSpotlight.id, { color }),
        onInteractStart: vm.beginTheaterHistoryTransaction,
        onInteractEnd: vm.endTheaterHistoryTransaction,
        onClone: () => vm.cloneSpotlight(activeSpotlight.id),
        onDelete: () => vm.removeSpotlight(activeSpotlight.id),
        spotlightAimMode: vm.spotlightAimMode,
        onPickAimMode: vm.setSpotlightAimMode,
        gridCol: highlightGridCell?.col ?? activeSpotlight.gridCol,
        gridRow: highlightGridCell?.row ?? activeSpotlight.gridRow,
        onClearGridBinding: () => vm.clearSpotlightGridBinding(activeSpotlight.id),
      }
    : null;

  const modelFocusPanelProps = (() => {
    const activeModel = vm.activeModel;
    if (!activeModel || !showModelFocusPanel) return null;
    const modelId = activeModel.id;
    return {
      modelName: activeModel.name,
      transformMode: vm.modelTransformMode,
      matchingBuiltinCount: modelFocusMatchingCount,
      showDecorActions: isDecorTab,
      hidden: activeModel.hidden === true,
      onToggleHidden: () =>
        vm.updateModel(modelId, {
          hidden: activeModel.hidden !== true,
        }),
      onPickTransform: (mode: "translate" | "rotate" | "scale") => {
        vm.exitDecorPlaceMode();
        vm.setEditMode(isDecorTab ? "decor" : "models");
        vm.setModelTransformMode(mode);
      },
      onRotateQuarter: (direction: "cw" | "ccw") => vm.rotateActiveModel(direction),
      onPlace: isDecorTab
        ? (preset: ModelPlacementPreset) => vm.placeActiveModel(preset)
        : undefined,
      onAlign: isDecorTab ? (axis: "x" | "z") => vm.alignModelsByActive(axis) : undefined,
      onDistribute: isDecorTab
        ? (axis: "x" | "z") => vm.distributeModelsByActive(axis)
        : undefined,
      onClone: () => vm.cloneModel(modelId),
      onMirror: isDecorTab ? (axis: "x" | "z") => vm.mirrorModel(modelId, axis) : undefined,
      onDelete: () => vm.removeModel(modelId),
    };
  })();

  return (
    <div className="theater-scene">
      {onTogglePanels && (
        <div className="theater-panels-toggle">
          <TheaterBtn
            active={!isPanelsSwapped}
            onClick={onTogglePanels}
            title={
              isPanelsSwapped
                ? "Плейлист слева и шаги справа, сцена на весь экран"
                : "Слева — настройки, справа — элементы сцены"
            }
          >
            {isPanelsSwapped ? "Музыка и шаги" : "Настройки сцены"}
          </TheaterBtn>
        </div>
      )}
      {mainControlsRender}
      {outlinerRender}
      {showSpotlightFocusPanel && spotlightFocusPanelProps ? (
        <TheaterSpotlightFocusPanel {...spotlightFocusPanelProps} />
      ) : null}
      {showModelFocusPanel && modelFocusPanelProps ? (
        <TheaterModelFocusPanel {...modelFocusPanelProps} />
      ) : null}
      {vm.showFloorPlan ? (
        <TheaterFloorPlan
          layout={vm.layout}
          models={vm.visibleModels}
          spotlights={vm.visibleSpotlights}
          showSeats={vm.showSeats}
          showSpotlights={vm.showSpotlights}
          expanded={vm.floorPlanExpanded}
          onToggleExpanded={() => vm.setFloorPlanExpanded((value) => !value)}
          activeTab={vm.activeTab}
          editMode={vm.editMode}
          decorPlaceMode={vm.decorPlaceMode}
          modelTransformMode={vm.modelTransformMode}
          activeModelId={vm.activeModelId}
          selectedModelIds={vm.multiSelectedModelIds}
          activeSpotlightId={vm.activeSpotlightId}
          selectedSpotlightIds={vm.multiSelectedSpotlightIds}
          activeDoorId={vm.activeDoorId}
          activeRecessId={vm.activeRecessId}
          hoveredModelId={vm.hoveredModelId}
          snapToGrid={vm.snapToGrid}
          gridStep={vm.gridStep}
          onSelectModel={(id, additive) => selectModel(id, additive)}
          onModelContextMenu={(id) => focusModel(id)}
          onSelectSpotlight={(id, additive) => selectSpotlight(id, additive)}
          onSelectDoor={vm.setActiveDoorId}
          onSelectRecess={vm.setActiveRecessId}
          onPlaceDecor={vm.addDecorAt}
          onPreviewModel={(id, position) => vm.previewModel(id, { position })}
          onCommitModel={(id, position) => vm.updateModel(id, { position })}
          onMoveSpotlight={(id, patch) => vm.updateSpotlight(id, patch)}
          onDragStart={() => {
            vm.beginTheaterHistoryTransaction();
            vm.setIsDragging(true);
          }}
          onDragEnd={() => {
            vm.endTheaterHistoryTransaction();
            vm.setIsDragging(false);
          }}
          onPreviewLayout={vm.previewLayout}
          onCommitLayout={vm.updateLayout}
          onLayoutInteractStart={vm.beginTheaterHistoryTransaction}
          onLayoutInteractEnd={vm.endTheaterHistoryTransaction}
          outlineDrawMode={vm.outlineDrawMode}
          activeOutlineVertexIndex={vm.activeOutlineVertexIndex}
          onSelectOutlineVertex={vm.setActiveOutlineVertexIndex}
          showStageGrid={vm.showStageGrid}
          spotlightAimMode={vm.spotlightAimMode}
          showSpotlightGuideLines={vm.showSpotlightGuideLines}
          highlightGridCell={highlightGridCell}
          onPickGridCell={(col, row) => vm.aimActiveSpotlightToGridCell(col, row)}
        />
      ) : null}
      <div className="theater-canvas-history-actions" aria-label="История изменений сцены">
        <button
          type="button"
          className="theater-canvas-history-btn"
          disabled={!vm.currentStep || !vm.canUndoTheater}
          onClick={vm.undoTheater}
          title="Отменить (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          type="button"
          className="theater-canvas-history-btn"
          disabled={!vm.currentStep || !vm.canRedoTheater}
          onClick={vm.redoTheater}
          title="Повторить (Ctrl+Y)"
        >
          ↷
        </button>
      </div>
      <TheaterLightConsolePanel
        projectName={vm.projectName}
        spotlights={vm.displaySpotlights}
        updateSpotlights={vm.updateSpotlights}
      />
      <TheaterCanvasShell
        camera={initialCamera}
        backgroundColor={vm.sceneBackgroundColor}
      >
        <TheaterCanvasContent
          projectName={vm.projectName}
          layout={vm.layout}
          initialCamera={initialCamera}
          showEditorHelpers={showEditorHelpers}
          showSeats={vm.showSeats}
          showGrid={vm.showGrid}
          showStageGrid={vm.showStageGrid}
          showSpotlights={vm.showSpotlights}
          showSpotlightGuideLines={vm.showSpotlightGuideLines}
          showOnlyActiveSpotlight={vm.showOnlyActiveSpotlight}
          wallsOpaque={vm.wallsOpaque}
          wallsHidden={vm.wallsHidden}
          wallsHideFromCamera={vm.wallsHideFromCamera}
          dutyLightEnabled={vm.dutyLightEnabled}
          snapToGrid={vm.snapToGrid}
          gridStep={vm.gridStep}
          alignGuidesEnabled={vm.alignGuidesEnabled}
          activeAlignGuides={vm.activeAlignGuides}
          onAlignGuidesChange={vm.setActiveAlignGuides}
          activeTab={vm.activeTab}
          editMode={vm.editMode}
          decorPlaceMode={vm.decorPlaceMode}
          isDragging={vm.isDragging}
          dragMode={vm.dragMode}
          highlightGridCell={highlightGridCell}
          spotlightAimMode={vm.spotlightAimMode}
          onPickGridCell={(col, row) => vm.aimActiveSpotlightToGridCell(col, row)}
          visibleSpotlights={vm.visibleSpotlights}
          activeSpotlightId={vm.activeSpotlightId}
          multiSelectedSpotlightIds={vm.multiSelectedSpotlightIds}
          pulseTarget={vm.pulseTarget}
          onSpotlightTargetChange={(id, target) => vm.updateSpotlight(id, { target })}
          onSpotlightPositionChange={(id, position) => vm.updateSpotlight(id, { position })}
          onSpotlightSelect={(id, additive) => selectSpotlight(id, additive)}
          onSpotlightContextMenu={(id) => focusSpotlight(id)}
          onSpotlightDragStart={vm.beginTheaterHistoryTransaction}
          onSpotlightDragEnd={vm.endTheaterHistoryTransaction}
          onDraggingChange={vm.setIsDragging}
          instancedFurnitureModels={instancedFurnitureModels}
          individualModels={individualModels}
          activeModelId={vm.activeModelId}
          multiSelectedModelIds={vm.multiSelectedModelIds}
          hoveredModelId={vm.hoveredModelId}
          isModelEditMode={isModelEditMode}
          onModelSelect={(id, additive) => selectModel(id, additive)}
          onModelContextMenu={(id) => focusModel(id)}
          onModelHoverChange={vm.setHoveredModelId}
          onModelActivate={(id) => {
            selectModel(id);
            vm.setModelTransformMode("translate");
            const model = vm.models.find((item) => item.id === id);
            if (model) requestTheaterCameraFocus(focusCameraForModel(model));
          }}
          resolveModelSrc={vm.resolveModelSrc}
          activeModelObject={vm.activeModelObject}
          activeModelObjectId={vm.activeModelObjectId ?? undefined}
          modelTransformMode={vm.modelTransformMode}
          onModelTransformStart={vm.handleModelTransformStart}
          onModelTransformEnd={vm.handleModelTransformEnd}
          onModelTransformChange={vm.handleModelTransformChange}
          onActiveObjectChange={vm.handleActiveObjectChange}
          onObjectReady={vm.handleObjectReady}
          onDecorPlace={vm.addDecorAt}
          audienceSeatsHighlight={vm.audienceSeatsHighlight}
          onAudienceStartZPreview={(audienceStartZ) =>
            vm.previewLayout({ audienceStartZ })
          }
          onAudienceStartZChange={(audienceStartZ) =>
            vm.updateLayout({ audienceStartZ })
          }
          onAudienceDragStart={vm.beginTheaterHistoryTransaction}
          onAudienceDragEnd={vm.endTheaterHistoryTransaction}
        />
      </TheaterCanvasShell>
    </div>
  );
};
