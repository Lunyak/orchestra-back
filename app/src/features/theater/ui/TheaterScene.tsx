import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import cn from "classnames";
import {
  useAppEditorMenubarActionsRender,
} from "@shared/components/app-editor-menubar";
import { usePlaybook } from "../../playbook";
import {
  patchSceneFaderFromSpotlightIntensity,
  patchSceneFaderLevel,
} from "../model/sync-spotlight-fader-level";
import {
  readSpotlightChannel,
  readSpotlightFaderId,
} from "../model/theater-light-fader-bindings";
import {
  resolveLightProgramMinCount,
  resolveLightPrograms,
  upsertChannelMemorySnapshot,
} from "../../../shared/components/light-console/light-console-data";
import {
  THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY,
  THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY,
} from "../model/theater-scene-lighting";
import { useTheaterScene, type TheaterSceneViewModel } from "../model/use-theater-scene";
import type { TheaterSceneProps } from "../model/theater-scene-types";
import { useStageGridHighlight } from "../playbook-stage/use-stage-grid-highlight";
import {
  DEFAULT_THEATER_CAMERA,
  readTheaterCamera,
} from "../model/theater-camera-storage";
import { splitModelsForFurnitureInstancing } from "../model/theater-furniture-instancing";
import type { ModelPlacementPreset } from "../model/theater-model-placement";
import {
  focusCameraForModel,
  requestTheaterCameraFocus,
} from "../model/theater-camera-focus";
import {
  shiftTheaterModels,
  shiftTheaterSpotlights,
  type HallExpandResult,
} from "../model/theater-hall-expand";
import { buildLightPlotFromSpotlights } from "../model/theater-light-channel-link";
import { buildTheaterModelSizePatch, type TheaterModelWorldSize } from "../model/theater-model-world-size";
import { writeSceneTheaterModels } from "../model/theater-scene-models";
import type { TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import { TheaterControls } from "./TheaterControls";
import { TheaterEditorToolsBar } from "./menubar/TheaterEditorToolsBar";
import { TheaterBtn } from "./theater-controls-ui";
import { TheaterFloorPlan } from "./TheaterFloorPlan";
import { isTheaterDecorModel } from "../model/theater-decor-catalog";
import { resolveSmokePosition } from "../model/theater-smoke-settings";
import { TheaterModelFocusPanel } from "./TheaterModelFocusPanel";
import { TheaterSmokeFocusPanel } from "./TheaterSmokeFocusPanel";
import { TheaterSpotlightFocusPanel } from "./TheaterSpotlightFocusPanel";
import { TheaterLightConsolePanel } from "./TheaterLightConsolePanel";
import { TheaterHallQuickStartModal } from "./TheaterHallQuickStartModal";
import { TheaterCanvasShell } from "./canvas/TheaterCanvasShell";
import { TheaterCanvasContent } from "./canvas/TheaterCanvasContent";
import { TheaterControlsLayoutTab } from "./controls/TheaterControlsLayoutTab";
import "./style.css";
import "./theater-editor-sidebar.css";

export type { TheaterSceneProps } from "../model/theater-scene-types";

export const TheaterScene = ({
  projectName = "fools",
  theaterLayout,
  onTheaterLayoutChange,
  isPanelsSwapped,
  onTogglePanels,
  outlinerHost,
  controlsInPanel,
  embeddedLightRehearsal = false,
  immersiveMode = false,
  onImmersiveModeChange,
}: TheaterSceneProps) => {
  const vm = useTheaterScene({
    projectName,
    theaterLayout,
    onTheaterLayoutChange,
  });
  const { playbookData, setPlaybookData, saveScenesForLightPlot } = usePlaybook();

  useEffect(() => {
    if (!embeddedLightRehearsal) return;
    vm.setSpectaclePreviewMode(false);
    vm.setActiveTab("spotlights");
    vm.setEditMode("spotlights");
    vm.setShowFloorPlan(false);
    vm.setShowControls(false);
    vm.setShowSpotlights(true);
    vm.setLightConsoleExpanded(false);
    vm.setSpotlightAimMode("point");
  }, [embeddedLightRehearsal]);

  useEffect(() => {
    if (!immersiveMode || !onImmersiveModeChange) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      onImmersiveModeChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [immersiveMode, onImmersiveModeChange]);

  const isModelEditMode = vm.editMode === "models" || vm.editMode === "decor";
  const showEditorHelpers = embeddedLightRehearsal
    ? vm.activeTab === "spotlights"
    : !vm.spectaclePreviewMode;
  const mobileTheaterLayout = useMobileTheaterLayout();
  const controlsInSidebar = Boolean(controlsInPanel);
  const showEditorChrome = controlsInSidebar && vm.showControls && !mobileTheaterLayout;

  const showTheaterToolsBar = !embeddedLightRehearsal && !mobileTheaterLayout;

  const sceneSettingsActive = !isPanelsSwapped;
  const panelsToggleLabel = isPanelsSwapped ? "Музыка и сцены" : "Настройки сцены";
  const panelsToggleTitle = isPanelsSwapped
    ? "Плейлист слева и сцены справа, сцена на весь экран"
    : "Слева — вкладки (включая «Обзор»), справа — содержимое";

  useAppEditorMenubarActionsRender(
    "theater-panels-toggle",
    15,
    () =>
      onTogglePanels && !embeddedLightRehearsal ? (
        <button
          type="button"
          className={cn(
            "app-editor-menubar__panel-btn",
            "theater-panels-menubar-btn",
            sceneSettingsActive
              ? "app-editor-menubar__panel-btn--active"
              : "app-editor-menubar__panel-btn--muted",
          )}
          onClick={onTogglePanels}
          title={panelsToggleTitle}
          aria-label={panelsToggleLabel}
          aria-pressed={sceneSettingsActive}
        >
          {panelsToggleLabel}
        </button>
      ) : null,
  );

  const sidebarRender =
    controlsInSidebar && outlinerHost
      ? createPortal(
          <TheaterControls
            vm={vm}
            controlsInPanel={controlsInSidebar}
            panel="sidebar"
          />,
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
    vm.editMode === "spotlights" &&
    vm.activeSpotlightId != null &&
    activeSpotlight != null;

  const isDecorEditMode = vm.editMode === "decor";

  const showModelFocusPanel =
    isModelEditMode &&
    vm.activeModelId != null &&
    vm.activeModel != null;

  const smokePosition = resolveSmokePosition(vm.layout, vm.smokePosition);
  const showSmokeFocusPanel = vm.smokeMachineEnabled && vm.smokePanelOpen;
  const showSmokePanelTab = vm.smokeMachineEnabled && !vm.smokePanelOpen;

  const hallExpandStartRef = useRef<{
    models: TheaterModel[];
    spotlights: TheaterSpotlight[];
  } | null>(null);

  const applyHallExpandResult = useCallback(
    (result: HallExpandResult, mode: "preview" | "commit") => {
      if (Object.keys(result.patch).length === 0) return;
      if (mode === "preview") vm.previewLayout(result.patch);
      else vm.updateLayout(result.patch);

      if (!vm.hallResizeKeepObjects) return;
      const start = hallExpandStartRef.current;
      const [sx, sy, sz] = result.objectShift;
      if (!start || (sx === 0 && sy === 0 && sz === 0)) return;
      const nextSpotlights = shiftTheaterSpotlights(start.spotlights, result.objectShift);
      vm.updateCurrentScene({
        ...writeSceneTheaterModels(shiftTheaterModels(start.models, result.objectShift)),
        theaterSpotlights: nextSpotlights,
        lightPlot: buildLightPlotFromSpotlights(nextSpotlights, vm.layout),
      });
    },
    [vm],
  );

  const handleHallExpandDragStart = useCallback(() => {
    hallExpandStartRef.current = {
      models: vm.models,
      spotlights: vm.displaySpotlights,
    };
    vm.beginTheaterHistoryTransaction();
  }, [vm]);

  const handleHallExpandDragEnd = useCallback(() => {
    hallExpandStartRef.current = null;
    vm.endTheaterHistoryTransaction();
  }, [vm]);

  const selectSpotlight = useCallback(
    (id: number, additive = false) => {
      vm.setLayoutOutlineFocused(false);
      vm.setAudienceSeatsFocused(false);
      vm.setStageGridFocused(false);
      vm.selectTheaterSpotlight(id, additive);
      vm.setEditMode("spotlights");
    },
    [
      vm.selectTheaterSpotlight,
      vm.setAudienceSeatsFocused,
      vm.setEditMode,
      vm.setLayoutOutlineFocused,
      vm.setStageGridFocused,
    ],
  );

  const selectModel = useCallback(
    (id: number, additive = false) => {
      vm.setLayoutOutlineFocused(false);
      vm.setAudienceSeatsFocused(false);
      vm.setStageGridFocused(false);
      const model = vm.models.find((entry) => entry.id === id);
      const isDecor = model != null && isTheaterDecorModel(model);

      vm.exitDecorPlaceMode();
      if (vm.spectaclePreviewMode) {
        vm.setSpectaclePreviewMode(false);
      }
      vm.setEditMode(isDecor ? "decor" : "models");
      vm.selectTheaterModel(id, additive);
    },
    [
      vm.exitDecorPlaceMode,
      vm.models,
      vm.selectTheaterModel,
      vm.setAudienceSeatsFocused,
      vm.setEditMode,
      vm.setLayoutOutlineFocused,
      vm.setSpectaclePreviewMode,
      vm.setStageGridFocused,
      vm.spectaclePreviewMode,
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
        onToggleEnabled: () => {
          const nextEnabled = !(activeSpotlight.enabled ?? true);
          const currentIntensity =
            typeof activeSpotlight.intensity === "number" && Number.isFinite(activeSpotlight.intensity)
              ? activeSpotlight.intensity
              : undefined;
          const restoredIntensity = activeSpotlight.isRgb
            ? THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY
            : THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY;
          const nextSpotlightPatch =
            nextEnabled && (currentIntensity == null || currentIntensity <= 0)
              ? { enabled: nextEnabled, intensity: restoredIntensity }
              : { enabled: nextEnabled };
          vm.updateSpotlight(activeSpotlight.id, {
            ...nextSpotlightPatch,
          });

          const faderId = readSpotlightFaderId(activeSpotlight);
          const channel = readSpotlightChannel(activeSpotlight);
          if (faderId != null && channel != null) {
            setPlaybookData((prev) => {
              const nextFaders = patchSceneFaderLevel(
                prev?.lightFaders ?? playbookData?.lightFaders ?? null,
                faderId,
                nextEnabled ? 1 : 0,
              );
              const channelCount = Math.max(
                channel,
                Array.isArray(playbookData?.lightChannels)
                  ? playbookData.lightChannels.length
                  : channel,
              );
              const programs = resolveLightPrograms(
                prev?.lightPrograms ?? playbookData?.lightPrograms,
                resolveLightProgramMinCount(
                  channelCount,
                  prev?.lightPrograms ?? playbookData?.lightPrograms,
                  channel,
                ),
                channelCount,
              );
              return {
                ...(prev ?? {}),
                lightFaders: nextFaders,
                lightPrograms: upsertChannelMemorySnapshot(
                  programs,
                  channel,
                  nextFaders,
                  channelCount,
                ),
              };
            });
          }
          window.setTimeout(() => {
            void saveScenesForLightPlot({ force: true });
          }, 0);
        },
        onToggleHidden: () =>
          vm.updateSpotlight(activeSpotlight.id, {
            hidden: activeSpotlight.hidden !== true,
          }),
        onPickDragMode: (mode: "target" | "source") => vm.setDragMode(mode),
        onAngleChange: (angleDeg: number) =>
          vm.updateSpotlight(activeSpotlight.id, { angleDeg }),
        onIntensityChange: (intensity: number) => {
          vm.updateSpotlight(activeSpotlight.id, { intensity });
          const nextFaders = patchSceneFaderFromSpotlightIntensity(
            playbookData?.lightFaders ?? null,
            activeSpotlight,
            intensity,
          );
          if (nextFaders) {
            setPlaybookData((prev) => ({ ...(prev ?? {}), lightFaders: nextFaders }));
          }
        },
        onColorChange: (color: string) =>
          vm.updateSpotlight(activeSpotlight.id, { color }),
        onLabelChange: (label: string) =>
          vm.updateSpotlight(activeSpotlight.id, { label }),
        onInteractStart: vm.beginTheaterHistoryTransaction,
        onInteractEnd: vm.endTheaterHistoryTransaction,
        onClone: () => vm.cloneSpotlight(activeSpotlight.id),
        onDelete: () => vm.removeSpotlight(activeSpotlight.id),
        spotlightAimMode: vm.spotlightAimMode,
        onPickAimMode: vm.setSpotlightAimMode,
        gridCol: highlightGridCell?.col ?? activeSpotlight.gridCol,
        gridRow: highlightGridCell?.row ?? activeSpotlight.gridRow,
        onClearGridBinding: () => vm.clearSpotlightGridBinding(activeSpotlight.id),
        trusses: vm.models.filter((model) => model.builtin === "lightTruss6m"),
        spotlights: vm.spotlights,
        onAttachToTruss: (mountModelId: number, mountPointId: string) =>
          vm.attachSpotlightToTrussMount(
            activeSpotlight.id,
            mountModelId,
            mountPointId,
          ),
        onDetachFromTruss: () =>
          vm.detachSpotlightFromTruss(activeSpotlight.id),
      }
    : null;

  const modelFocusPanelProps = (() => {
    const activeModel = vm.activeModel;
    if (!activeModel || !showModelFocusPanel) return null;
    const modelId = activeModel.id;
    return {
      modelName: activeModel.name,
      modelId,
      onNameChange: (name: string) => vm.updateModel(modelId, { name }),
      size: vm.activeModelWorldSize,
      onSizeCommit: (next: Partial<TheaterModelWorldSize>) => {
        const current = vm.activeModelWorldSize;
        if (!current) return;
        const patch = buildTheaterModelSizePatch(activeModel, current, next);
        if (!patch) return;
        vm.updateModel(modelId, patch);
        vm.setPendingSnapModelId(modelId);
      },
      transformMode: vm.modelTransformMode,
      showDecorActions: isDecorEditMode,
      hidden: activeModel.hidden === true,
      onToggleHidden: () =>
        vm.updateModel(modelId, {
          hidden: activeModel.hidden !== true,
        }),
      isRequisite: activeModel.isRequisite === true,
      onToggleRequisite: (next: boolean) => {
        vm.updateModel(modelId, { isRequisite: next });
      },
      onPickTransform: (mode: "translate" | "rotate" | "scale") => {
        vm.exitDecorPlaceMode();
        vm.setEditMode(isDecorEditMode ? "decor" : "models");
        vm.setModelTransformMode(mode);
      },
      onRotateQuarter: (direction: "cw" | "ccw") => vm.rotateActiveModel(direction),
      placementGrid: isDecorEditMode ? vm.stageGrid : undefined,
      onPlace: isDecorEditMode
        ? (preset: ModelPlacementPreset) => vm.placeActiveModel(preset)
        : undefined,
      onResetTransform: () => {
        const resetY = activeModel.builtin === "lightTruss6m" ? 6 : 0;
        vm.updateModel(modelId, {
          position: [0, resetY, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        });
        vm.setPendingSnapModelId(modelId);
      },
      onClone: () => vm.cloneModel(modelId),
      onDelete: () => vm.removeModel(modelId),
    };
  })();

  const embedLight = embeddedLightRehearsal;
  const showHallQuickStart =
    !embedLight && Boolean(vm.currentScene) && !vm.hallQuickStartDone;

  const finishHallQuickStart = (templateId?: string) => {
    if (templateId) vm.applyHallTemplate(templateId);
    vm.setHallQuickStartDone(true);
  };

  return (
    <div
      className={[
        "theater-scene",
        showEditorChrome ? "theater-scene--editor-chrome" : "",
        mobileTheaterLayout ? "theater-scene--mobile-layout" : "",
        embedLight ? "theater-scene--light-rehearsal-embed" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
        onPick={finishHallQuickStart}
        onSkip={() => finishHallQuickStart()}
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
              selectSpotlight(occupiedSpotlightId);
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
          onLayoutSizePreview={(result: HallExpandResult) =>
            applyHallExpandResult(result, "preview")
          }
          onLayoutSizeCommit={(result: HallExpandResult) =>
            applyHallExpandResult(result, "commit")
          }
          onLayoutSizeDragStart={handleHallExpandDragStart}
          onLayoutSizeDragEnd={handleHallExpandDragEnd}
          stageGridFocused={vm.stageGridFocused}
          onSelectStageGrid={vm.focusStageGrid}
          onStageGridPreview={(patch) => vm.previewLayout(patch)}
          onStageGridCommit={(patch) => vm.updateLayout(patch)}
          onStageGridDragStart={vm.beginTheaterHistoryTransaction}
          onStageGridDragEnd={vm.endTheaterHistoryTransaction}
        />
      </TheaterCanvasShell>
        </div>
      </div>
    </div>
  );
};

function useMobileTheaterLayout() {
  const readMobile = () => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(max-width: 1024px)").matches ||
      window.matchMedia("(pointer: coarse)").matches
    );
  };

  const [mobile, setMobile] = useState(readMobile);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 1024px)");
    const pointer = window.matchMedia("(pointer: coarse)");
    const update = () => setMobile(readMobile());
    update();
    media.addEventListener("change", update);
    pointer.addEventListener("change", update);
    window.addEventListener("resize", update);
    return () => {
      media.removeEventListener("change", update);
      pointer.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return mobile;
}

type TheaterMobileSheet = "view" | "objects" | "scene" | "save";

type TheaterMobileActionBarProps = {
  vm: TheaterSceneViewModel;
  onTogglePanels?: () => void;
  isPanelsSwapped?: boolean;
};

function theaterMobileSaveKey(projectName: string) {
  return `orchestra-theater-mobile-save:${projectName || "default"}`;
}

function slugifyTheaterFilename(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "theater";
}

function buildTheaterMobileSnapshot(vm: TheaterSceneViewModel) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    projectName: vm.projectName,
    scene: vm.currentScene
      ? {
          id: vm.currentScene.id,
          title: vm.currentScene.title,
          page: vm.currentPage,
        }
      : null,
    layout: vm.layout,
    spotlights: vm.displaySpotlights,
    models: vm.models,
    active: {
      tab: vm.activeTab,
      modelId: vm.activeModelId ?? null,
      spotlightId: vm.activeSpotlightId ?? null,
    },
    view: {
      showGrid: vm.showGrid,
      showStageGrid: vm.showStageGrid,
      showSeats: vm.showSeats,
      showFloorPlan: vm.showFloorPlan,
      floorPlanMaxSide: vm.floorPlanMaxSide,
      wallsHidden: vm.wallsHidden,
      wallsOpaque: vm.wallsOpaque,
      spectaclePreviewMode: vm.spectaclePreviewMode,
    },
  };
}

function serializeTheaterMobileSnapshot(vm: TheaterSceneViewModel) {
  return JSON.stringify(buildTheaterMobileSnapshot(vm), null, 2);
}

function downloadTheaterMobileSnapshot(vm: TheaterSceneViewModel) {
  const text = serializeTheaterMobileSnapshot(vm);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const title = vm.currentScene?.title?.trim() || vm.projectName;
  anchor.href = url;
  anchor.download = `${slugifyTheaterFilename(title)}-theater.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function TheaterMobileActionBar({
  vm,
  onTogglePanels,
  isPanelsSwapped,
}: TheaterMobileActionBarProps) {
  const [sheet, setSheet] = useState<TheaterMobileSheet | null>(null);
  const [saveMessage, setSaveMessage] = useState("Автосохранение активно");

  const selectedTitle = useMemo(() => {
    if (vm.activeModel) return vm.activeModel.name;
    if (vm.activeSpotlight) return vm.activeSpotlight.label;
    return vm.currentScene?.title || "Театр";
  }, [vm.activeModel, vm.activeSpotlight, vm.currentScene?.title]);

  const openSheet = (next: TheaterMobileSheet) => {
    setSheet((current) => (current === next ? null : next));
  };

  const saveLocalSnapshot = () => {
    try {
      localStorage.setItem(
        theaterMobileSaveKey(vm.projectName),
        serializeTheaterMobileSnapshot(vm),
      );
      setSaveMessage("Снимок театра сохранён на устройстве");
    } catch {
      setSaveMessage("Не удалось сохранить на устройстве");
    }
  };

  const copySnapshotJson = async () => {
    try {
      await navigator.clipboard.writeText(serializeTheaterMobileSnapshot(vm));
      setSaveMessage("JSON театра скопирован");
    } catch {
      setSaveMessage("Не удалось скопировать JSON");
    }
  };

  const downloadSnapshotJson = () => {
    try {
      downloadTheaterMobileSnapshot(vm);
      setSaveMessage("JSON театра сохранён файлом");
    } catch {
      setSaveMessage("Не удалось сохранить файл");
    }
  };

  return (
    <div className="theater-mobile-actions" aria-label="Мобильные действия театра">
      <div className="theater-mobile-actions__status">
        <span>{selectedTitle}</span>
        <strong>{saveMessage}</strong>
      </div>
      {sheet ? (
        <section
          className={cn(
            "theater-mobile-sheet",
            sheet === "scene" &&
              vm.activeTab === "layout" &&
              "theater-mobile-sheet--layout",
          )}
          aria-label="Быстрые действия"
        >
          <header className="theater-mobile-sheet__header">
            <strong>
              {sheet === "view"
                ? "Вид"
                : sheet === "objects"
                  ? "Объекты"
                  : sheet === "scene"
                    ? "Сцена"
                    : "Сохранить театр"}
            </strong>
            <button type="button" onClick={() => setSheet(null)}>
              Закрыть
            </button>
          </header>
          {sheet === "view" ? (
            <div className="theater-mobile-sheet__grid">
              <MobileActionButton
                active={vm.showFloorPlan}
                onClick={() => vm.setShowFloorPlan(!vm.showFloorPlan)}
              >
                2D план
              </MobileActionButton>
              <MobileActionButton
                active={vm.showSeats}
                onClick={() => vm.setShowSeats(!vm.showSeats)}
              >
                Кресла
              </MobileActionButton>
              <MobileActionButton
                active={vm.showGrid}
                onClick={() => vm.setShowGrid(!vm.showGrid)}
              >
                Сетка
              </MobileActionButton>
              <MobileActionButton
                active={!vm.wallsHidden}
                onClick={() => vm.setWallsHidden(!vm.wallsHidden)}
              >
                Стены
              </MobileActionButton>
              <MobileActionButton
                active={vm.spectaclePreviewMode}
                onClick={() => vm.setSpectaclePreviewMode(!vm.spectaclePreviewMode)}
              >
                Превью
              </MobileActionButton>
              <MobileActionButton
                active={vm.showControls}
                onClick={() => vm.setShowControls(!vm.showControls)}
              >
                Панели
              </MobileActionButton>
            </div>
          ) : null}
          {sheet === "objects" ? (
            <div className="theater-mobile-sheet__grid">
              <MobileActionButton
                active={vm.activeTab === "spotlights"}
                onClick={() => {
                  vm.setActiveTab("spotlights");
                  vm.setEditMode("spotlights");
                }}
              >
                Софиты · {vm.displaySpotlights.length}
              </MobileActionButton>
              <MobileActionButton
                active={vm.activeTab === "models"}
                onClick={() => {
                  vm.setActiveTab("models");
                  vm.setEditMode("models");
                }}
              >
                Модели · {vm.models.length}
              </MobileActionButton>
              <MobileActionButton
                active={vm.activeTab === "decor"}
                onClick={() => {
                  vm.setActiveTab("decor");
                  vm.setEditMode("decor");
                }}
              >
                Декор
              </MobileActionButton>
              <MobileActionButton
                active={vm.showSpotlights}
                onClick={() => vm.setShowSpotlights(!vm.showSpotlights)}
              >
                Свет в 3D
              </MobileActionButton>
            </div>
          ) : null}
          {sheet === "scene" ? (
            <>
              <div className="theater-mobile-sheet__grid">
                <MobileActionButton
                  active={vm.activeTab === "layout"}
                  onClick={() => vm.setActiveTab("layout")}
                >
                  План зала
                </MobileActionButton>
                <MobileActionButton
                  active={vm.lightConsoleExpanded}
                  onClick={() => vm.setLightConsoleExpanded((open) => !open)}
                >
                  Пульт света
                </MobileActionButton>
                <MobileActionButton
                  active={vm.dutyLightEnabled}
                  onClick={() => vm.setDutyLightEnabled(!vm.dutyLightEnabled)}
                >
                  Дежурка
                </MobileActionButton>
                <MobileActionButton
                  active={vm.smokeMachineEnabled}
                  onClick={() => {
                    if (!vm.smokeMachineEnabled) {
                      if (vm.spectaclePreviewMode) {
                        vm.setSpectaclePreviewMode(false);
                      }
                      vm.setSmokeMachineEnabled(true);
                      vm.setSmokePanelOpen(true);
                      return;
                    }
                    vm.setSmokePanelOpen(!vm.smokePanelOpen);
                  }}
                >
                  Дым
                </MobileActionButton>
                <MobileActionButton
                  active={vm.snapToGrid}
                  onClick={() => vm.setSnapToGrid(!vm.snapToGrid)}
                >
                  Привязка
                </MobileActionButton>
                <MobileActionButton
                  active={!isPanelsSwapped}
                  onClick={() => onTogglePanels?.()}
                  disabled={!onTogglePanels}
                >
                  Настройки
                </MobileActionButton>
              </div>
              {vm.activeTab === "layout" ? (
                <div className="theater-mobile-layout-settings">
                  <TheaterControlsLayoutTab vm={vm} />
                </div>
              ) : null}
            </>
          ) : null}
          {sheet === "save" ? (
            <div className="theater-mobile-sheet__stack">
              <p>
                Основные правки уже попадают в текущую сцену. Здесь можно сделать отдельный снимок
                3D-театра для телефона или экспорта.
              </p>
              <MobileActionButton onClick={saveLocalSnapshot}>Сохранить на устройстве</MobileActionButton>
              <MobileActionButton onClick={() => void copySnapshotJson()}>Копировать JSON</MobileActionButton>
              <MobileActionButton onClick={downloadSnapshotJson}>Экспорт JSON</MobileActionButton>
            </div>
          ) : null}
        </section>
      ) : null}
      <nav className="theater-mobile-actions__bar">
        <MobileActionButton active={sheet === "view"} onClick={() => openSheet("view")}>
          Вид
        </MobileActionButton>
        <MobileActionButton active={sheet === "objects"} onClick={() => openSheet("objects")}>
          Объекты
        </MobileActionButton>
        <MobileActionButton active={sheet === "scene"} onClick={() => openSheet("scene")}>
          Сцена
        </MobileActionButton>
        <MobileActionButton active={sheet === "save"} onClick={() => openSheet("save")}>
          Сохранить
        </MobileActionButton>
      </nav>
    </div>
  );
}

type MobileActionButtonProps = {
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
  onClick: () => void;
};

function MobileActionButton({
  active,
  disabled,
  children,
  onClick,
}: MobileActionButtonProps) {
  return (
    <button
      type="button"
      className={[
        "theater-mobile-action-btn",
        active ? "theater-mobile-action-btn--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
