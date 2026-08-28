import type { ReactNode } from "react";
import cn from "classnames";
import type { TheaterModel } from "../../../shared/types/script";
import type { TheaterCameraState } from "../model/theater-camera-storage";
import {
  focusCameraForModel,
  requestTheaterCameraFocus,
} from "../model/theater-camera-focus";
import type { HallExpandResult } from "../model/theater-hall-expand";
import type { TheaterSmokePosition } from "../model/theater-smoke-settings";
import type { TheaterSceneViewModel } from "../model/use-theater-scene";
import type { StageGridCell } from "../playbook-stage/use-stage-grid-highlight";
import { TheaterCanvasContent } from "./canvas/TheaterCanvasContent";
import { TheaterCanvasShell } from "./canvas/TheaterCanvasShell";
import { TheaterViewportCaptureBridge } from "./canvas/TheaterViewportCaptureBridge";
import { TheaterEditorToolsBar } from "./menubar/TheaterEditorToolsBar";
import { TheaterBtn } from "./theater-controls-ui";
import { TheaterFloorPlan } from "./TheaterFloorPlan";
import { TheaterHallQuickStartModal } from "./TheaterHallQuickStartModal";
import { TheaterLightConsolePanel } from "./TheaterLightConsolePanel";
import { TheaterMobileActionBar } from "./TheaterMobileActionBar";
import {
  TheaterModelFocusPanel,
  type TheaterModelFocusPanelProps,
} from "./TheaterModelFocusPanel";
import { TheaterSchemeTabs } from "./TheaterSchemeTabs";
import { TheaterSmokeFocusPanel } from "./TheaterSmokeFocusPanel";
import {
  TheaterSpotlightFocusPanel,
  type TheaterSpotlightFocusPanelProps,
} from "./TheaterSpotlightFocusPanel";
import { TheaterViewportKadrStrip } from "./TheaterViewportKadrStrip";

export type TheaterSceneLayoutProps = {
  vm: TheaterSceneViewModel;
  immersiveMode?: boolean;
  onImmersiveModeChange?: (next: boolean) => void;
  sidebarRender: ReactNode;
  mobileTheaterLayout: boolean;
  showEditorChrome: boolean;
  showTheaterToolsBar: boolean;
  controlsInSidebar: boolean;
  embedLight: boolean;
  showHallQuickStart: boolean;
  onHallQuickStartFinish: (templateId?: string) => void;
  onTogglePanels?: () => void;
  isPanelsSwapped?: boolean;
  showSpotlightFocusPanel: boolean;
  spotlightFocusPanelProps: TheaterSpotlightFocusPanelProps | null;
  showModelFocusPanel: boolean;
  modelFocusPanelProps: TheaterModelFocusPanelProps | null;
  showSmokeFocusPanel: boolean;
  showSmokePanelTab: boolean;
  smokePosition: TheaterSmokePosition;
  highlightGridCell: StageGridCell | null;
  initialCamera: TheaterCameraState;
  showEditorHelpers: boolean;
  instancedFurnitureModels: TheaterModel[];
  individualModels: TheaterModel[];
  isModelEditMode: boolean;
  onSelectModel: (id: number, additive?: boolean) => void;
  onFocusModel: (id: number) => void;
  onSelectSpotlight: (id: number, additive?: boolean) => void;
  onFocusSpotlight: (id: number) => void;
  onLayoutSizePreview: (result: HallExpandResult) => void;
  onLayoutSizeCommit: (result: HallExpandResult) => void;
  onLayoutSizeDragStart: () => void;
  onLayoutSizeDragEnd: () => void;
};

export function TheaterSceneLayout({
  vm,
  immersiveMode = false,
  onImmersiveModeChange,
  sidebarRender,
  mobileTheaterLayout,
  showEditorChrome,
  showTheaterToolsBar,
  controlsInSidebar,
  embedLight,
  showHallQuickStart,
  onHallQuickStartFinish,
  onTogglePanels,
  isPanelsSwapped,
  showSpotlightFocusPanel,
  spotlightFocusPanelProps,
  showModelFocusPanel,
  modelFocusPanelProps,
  showSmokeFocusPanel,
  showSmokePanelTab,
  smokePosition,
  highlightGridCell,
  initialCamera,
  showEditorHelpers,
  instancedFurnitureModels,
  individualModels,
  isModelEditMode,
  onSelectModel,
  onFocusModel,
  onSelectSpotlight,
  onFocusSpotlight,
  onLayoutSizePreview,
  onLayoutSizeCommit,
  onLayoutSizeDragStart,
  onLayoutSizeDragEnd,
}: TheaterSceneLayoutProps) {
  const sceneTree = (
    <div
      className={cn(
        "theater-scene",
        showEditorChrome && "theater-scene--editor-chrome",
        mobileTheaterLayout && "theater-scene--mobile-layout",
        embedLight && "theater-scene--light-rehearsal-embed",
      )}
    >
      {sidebarRender}
      {showTheaterToolsBar ? (
        <TheaterEditorToolsBar
          vm={vm}
          immersiveMode={immersiveMode}
          onImmersiveModeChange={onImmersiveModeChange}
        />
      ) : null}
      <div className="theater-scene-main">
        <div className="theater-scene-body">
          {mobileTheaterLayout && controlsInSidebar && !vm.showControls ? (
            <div className="theater-mobile-open-panel">
              <TheaterBtn active={false} onClick={() => vm.setShowControls(true)}>
                Панель
              </TheaterBtn>
            </div>
          ) : null}
          {showSpotlightFocusPanel && spotlightFocusPanelProps ? (
            <TheaterSpotlightFocusPanel {...spotlightFocusPanelProps} />
          ) : null}
          {showModelFocusPanel && modelFocusPanelProps ? (
            <TheaterModelFocusPanel {...modelFocusPanelProps} />
          ) : null}
          {showSmokeFocusPanel ? (
            <TheaterSmokeFocusPanel
              position={smokePosition}
              intensity={vm.smokeIntensity}
              saturation={vm.smokeSaturation}
              size={vm.smokeSize}
              onPositionChange={vm.setSmokePosition}
              onIntensityChange={vm.setSmokeIntensity}
              onSaturationChange={vm.setSmokeSaturation}
              onSizeChange={vm.setSmokeSize}
              onResetPosition={() => vm.setSmokePosition(null)}
              onHide={() => vm.setSmokePanelOpen(false)}
              onDisable={() => vm.setSmokeMachineEnabled(false)}
            />
          ) : null}
          {showSmokePanelTab ? (
            <button
              type="button"
              className="theater-smoke-panel-tab"
              title="Показать настройки дыма"
              onClick={() => vm.setSmokePanelOpen(true)}
            >
              Дым
            </button>
          ) : null}
          {vm.showFloorPlan && !embedLight ? (
            <TheaterFloorPlan
              layout={vm.layout}
              models={vm.visibleModels}
              spotlights={vm.visibleSpotlights}
              showSeats={vm.showSeats}
              showSpotlights={vm.showSpotlights}
              maxSide={vm.floorPlanMaxSide}
              onChangeMaxSide={(value) => vm.setFloorPlanMaxSide(value)}
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
              onSelectModel={(id, additive) => onSelectModel(id, additive)}
              onModelContextMenu={(id) => onFocusModel(id)}
              onSelectSpotlight={(id, additive) => onSelectSpotlight(id, additive)}
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
          {!embedLight ? (
            <div className="theater-canvas-history-actions" aria-label="История изменений сцены">
              <button
                type="button"
                className="theater-canvas-history-btn"
                disabled={!vm.currentScene || !vm.canUndoTheater}
                onClick={vm.undoTheater}
                title="Отменить (Ctrl+Z)"
              >
                ↶
              </button>
              <button
                type="button"
                className="theater-canvas-history-btn"
                disabled={!vm.currentScene || !vm.canRedoTheater}
                onClick={vm.redoTheater}
                title="Повторить (Ctrl+Y)"
              >
                ↷
              </button>
            </div>
          ) : null}
          {!embedLight ? (
            <TheaterLightConsolePanel
              projectName={vm.projectName}
              spotlights={vm.displaySpotlights}
              updateSpotlights={vm.updateSpotlights}
              collapsed={!vm.lightConsoleExpanded}
            />
          ) : null}
          <TheaterHallQuickStartModal
            open={showHallQuickStart}
            templates={vm.hallTemplates}
            onPick={onHallQuickStartFinish}
            onSkip={() => onHallQuickStartFinish()}
          />
          {!embedLight ? (
            <TheaterMobileActionBar
              vm={vm}
              onTogglePanels={onTogglePanels}
              isPanelsSwapped={isPanelsSwapped}
            />
          ) : null}
          <TheaterCanvasShell
            camera={initialCamera}
            backgroundColor={vm.sceneBackgroundColor}
          >
            <TheaterViewportCaptureBridge />
            <TheaterCanvasContent
              projectName={vm.projectName}
              layout={vm.layout}
              initialCamera={initialCamera}
              showEditorHelpers={showEditorHelpers}
              showSeats={vm.showSeats}
              showGrid={vm.showGrid}
              showStageGrid={vm.showStageGrid}
              activeDoorId={vm.activeDoorId}
              activeRecessId={vm.activeRecessId}
              showSpotlights={vm.showSpotlights}
              showSpotlightGuideLines={vm.showSpotlightGuideLines}
              wallsOpaque={vm.wallsOpaque}
              wallsHidden={vm.wallsHidden}
              wallsHideFromCamera={vm.wallsHideFromCamera}
              dutyLightEnabled={vm.dutyLightEnabled && !vm.liveBlackoutEnabled}
              smokeMachineEnabled={vm.smokeMachineEnabled}
              smokePosition={smokePosition}
              smokeIntensity={vm.smokeIntensity}
              smokeSaturation={vm.smokeSaturation}
              smokeSize={vm.smokeSize}
              sceneBackgroundColor={vm.sceneBackgroundColor}
              onSmokePositionChange={vm.setSmokePosition}
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
              spotlights={vm.spotlights}
              visibleSpotlights={vm.visibleSpotlights}
              activeSpotlightId={vm.activeSpotlightId}
              multiSelectedSpotlightIds={vm.multiSelectedSpotlightIds}
              pulseTarget={vm.pulseTarget}
              onSpotlightTargetChange={(id, target) => vm.updateSpotlight(id, { target })}
              onSpotlightPositionChange={(id, position) => vm.updateSpotlight(id, { position })}
              onSpotlightSelect={(id, additive) => onSelectSpotlight(id, additive)}
              onSpotlightContextMenu={(id) => onFocusSpotlight(id)}
              onSpotlightDragStart={vm.beginTheaterHistoryTransaction}
              onSpotlightDragEnd={vm.endTheaterHistoryTransaction}
              onDraggingChange={vm.setIsDragging}
              instancedFurnitureModels={instancedFurnitureModels}
              individualModels={individualModels}
              activeModelId={vm.activeModelId}
              multiSelectedModelIds={vm.multiSelectedModelIds}
              hoveredModelId={vm.hoveredModelId}
              isModelEditMode={isModelEditMode}
              onModelSelect={(id, additive) => onSelectModel(id, additive)}
              onModelContextMenu={(id) => onFocusModel(id)}
              onModelHoverChange={vm.setHoveredModelId}
              onModelActivate={(id) => {
                onSelectModel(id);
                vm.setModelTransformMode("translate");
                const model = vm.models.find((item) => item.id === id);
                if (model) requestTheaterCameraFocus(focusCameraForModel(model, vm.layout));
              }}
              activeModelObject={vm.activeModelObject}
              activeModelObjectId={vm.activeModelObjectId ?? undefined}
              modelTransformMode={vm.modelTransformMode}
              onModelTransformStart={vm.handleModelTransformStart}
              onTrussMountPointClick={(
                modelId,
                mountPointId,
                occupiedSpotlightId,
              ) => {
                if (occupiedSpotlightId != null) {
                  onSelectSpotlight(occupiedSpotlightId);
                  return;
                }
                vm.installSpotlightOnTrussMount(
                  modelId,
                  mountPointId,
                  vm.trussMountFixtureType,
                );
              }}
              onModelTransformEnd={vm.handleModelTransformEnd}
              onModelTransformChange={vm.handleModelTransformChange}
              activeModel={vm.activeModel}
              onModelFloorMovePreview={(position) => {
                const active = vm.activeModel;
                if (!active) return;
                const dx = position[0] - active.position[0];
                const dz = position[2] - active.position[2];
                const selectedIds =
                  vm.multiSelectedModelIds.length > 1
                    ? vm.multiSelectedModelIds
                    : [active.id];
                for (const id of selectedIds) {
                  const model = vm.models.find((item) => item.id === id);
                  if (!model) continue;
                  const nextPosition: [number, number, number] =
                    id === active.id
                      ? position
                      : [
                          model.position[0] + dx,
                          model.position[1],
                          model.position[2] + dz,
                        ];
                  vm.previewModel(id, { position: nextPosition });
                }
              }}
              onModelFloorMoveCommit={(position) => {
                const active = vm.activeModel;
                if (!active) return;
                const selectedIds =
                  vm.multiSelectedModelIds.length > 1
                    ? vm.multiSelectedModelIds
                    : [active.id];
                if (selectedIds.length <= 1) {
                  vm.updateModel(active.id, { position });
                  vm.setPendingSnapModelId(active.id);
                  return;
                }
                const selected = new Set(selectedIds);
                vm.updateModels(
                  vm.models.map((model) => {
                    if (!selected.has(model.id)) return model;
                    if (model.id === active.id) return { ...model, position };
                    return model;
                  }),
                );
                vm.setPendingSnapModelId(active.id);
              }}
              onModelFloorMoveDragStart={vm.beginTheaterHistoryTransaction}
              onModelFloorMoveDragEnd={vm.endTheaterHistoryTransaction}
              onActiveObjectChange={vm.handleActiveObjectChange}
              onObjectReady={vm.handleObjectReady}
              onDecorPlace={vm.addDecorAt}
              onBuiltinTemplateDrop={vm.addBuiltinModelAt}
              audienceSeatsHighlight={vm.audienceSeatsHighlight}
              audienceSeatsFocused={vm.audienceSeatsFocused}
              onSelectAudienceSeats={vm.focusAudienceSeats}
              onAudienceStartZPreview={(audienceStartZ) =>
                vm.previewLayout({ audienceStartZ })
              }
              onAudienceStartZChange={(audienceStartZ) =>
                vm.updateLayout({ audienceStartZ })
              }
              onAudienceDragStart={vm.beginTheaterHistoryTransaction}
              onAudienceDragEnd={vm.endTheaterHistoryTransaction}
              layoutOutlineFocused={vm.layoutOutlineFocused}
              onSelectLayout={vm.focusLayoutHall}
              onLayoutSizePreview={onLayoutSizePreview}
              onLayoutSizeCommit={onLayoutSizeCommit}
              onLayoutSizeDragStart={onLayoutSizeDragStart}
              onLayoutSizeDragEnd={onLayoutSizeDragEnd}
              stageGridFocused={vm.stageGridFocused}
              onSelectStageGrid={vm.focusStageGrid}
              onStageGridPreview={(patch) => vm.previewLayout(patch)}
              onStageGridCommit={(patch) => vm.updateLayout(patch)}
              onStageGridDragStart={vm.beginTheaterHistoryTransaction}
              onStageGridDragEnd={vm.endTheaterHistoryTransaction}
            />
          </TheaterCanvasShell>
          {!embedLight ? <TheaterViewportKadrStrip vm={vm} /> : null}
        </div>
      </div>
    </div>
  );

  if (embedLight) return sceneTree;
  return <TheaterSchemeTabs>{sceneTree}</TheaterSchemeTabs>;
}
