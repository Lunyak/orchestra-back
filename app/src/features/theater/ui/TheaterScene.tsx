import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import cn from "classnames";
import { useAppEditorMenubarActionsRender } from "@shared/components/app-editor-menubar";
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
import { useTheaterScene } from "../model/use-theater-scene";
import type { TheaterSceneProps } from "../model/theater-scene-types";
import { useStageGridHighlight } from "../playbook-stage/use-stage-grid-highlight";
import {
  DEFAULT_THEATER_CAMERA,
  readTheaterCamera,
} from "../model/theater-camera-storage";
import { splitModelsForFurnitureInstancing } from "../model/theater-furniture-instancing";
import type { ModelPlacementPreset } from "../model/theater-model-placement";
import {
  shiftTheaterModels,
  shiftTheaterSpotlights,
  type HallExpandResult,
} from "../model/theater-hall-expand";
import { buildLightPlotFromSpotlights } from "../model/theater-light-channel-link";
import {
  buildTheaterModelSizePatch,
  getTheaterModelSizeAxisLabels,
  type TheaterModelWorldSize,
} from "../model/theater-model-world-size";
import { writeSceneTheaterModels } from "../model/theater-scene-models";
import type { TheaterModel, TheaterSpotlight } from "../../../shared/types/script";
import { TheaterControls } from "./TheaterControls";
import { isTheaterDecorModel } from "../model/theater-decor-catalog";
import { isLightTrussModel } from "../model/theater-truss-mounts";
import { resolveSmokePosition } from "../model/theater-smoke-settings";
import { useMobileTheaterLayout } from "../model/theater-mobile-layout";
import { TheaterSceneLayout } from "./TheaterSceneLayout";
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
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) onImmersiveModeChange(false);
    };

    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (document.fullscreenElement) {
        void document.exitFullscreen?.().catch(() => undefined);
      }
    };
  }, [immersiveMode, onImmersiveModeChange]);

  const isModelEditMode = vm.editMode === "models" || vm.editMode === "decor";
  const showEditorHelpers = embeddedLightRehearsal
    ? vm.activeTab === "spotlights"
    : !vm.spectaclePreviewMode;
  const mobileTheaterLayout = useMobileTheaterLayout();
  const controlsInSidebar = Boolean(controlsInPanel);
  const showEditorChrome =
    controlsInSidebar && vm.showControls && !mobileTheaterLayout;
  const showTheaterToolsBar = !embeddedLightRehearsal && !mobileTheaterLayout;

  const sceneSettingsActive = !isPanelsSwapped;
  const panelsToggleLabel = isPanelsSwapped
    ? "Музыка и сцены"
    : "Настройки сцены";
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
    [
      onTogglePanels,
      embeddedLightRehearsal,
      sceneSettingsActive,
      panelsToggleLabel,
      panelsToggleTitle,
    ],
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
        splitModelsForFurnitureInstancing(
          vm.visibleModels,
          excludeFromFurnitureInstancing,
        ),
      [vm.visibleModels, excludeFromFurnitureInstancing],
    );

  const activeSpotlight = useMemo(
    () =>
      vm.displaySpotlights.find((item) => item.id === vm.activeSpotlightId),
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
    isModelEditMode && vm.activeModelId != null && vm.activeModel != null;

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
      const nextSpotlights = shiftTheaterSpotlights(
        start.spotlights,
        result.objectShift,
      );
      vm.updateCurrentScene({
        ...writeSceneTheaterModels(
          shiftTheaterModels(start.models, result.objectShift),
        ),
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
      vm.setLightRigFocused(false);
      vm.selectTheaterSpotlight(id, additive);
      vm.setEditMode("spotlights");
    },
    [
      vm.selectTheaterSpotlight,
      vm.setAudienceSeatsFocused,
      vm.setEditMode,
      vm.setLayoutOutlineFocused,
      vm.setLightRigFocused,
      vm.setStageGridFocused,
    ],
  );

  const selectModel = useCallback(
    (id: number, additive = false) => {
      vm.setLayoutOutlineFocused(false);
      vm.setAudienceSeatsFocused(false);
      vm.setStageGridFocused(false);
      vm.setLightRigFocused(false);
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
      vm.setLightRigFocused,
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
            typeof activeSpotlight.intensity === "number" &&
            Number.isFinite(activeSpotlight.intensity)
              ? activeSpotlight.intensity
              : undefined;
          const restoredIntensity = activeSpotlight.isRgb
            ? THEATER_SPOTLIGHT_RGB_DEFAULT_UI_INTENSITY
            : THEATER_SPOTLIGHT_DEFAULT_UI_INTENSITY;
          const nextSpotlightPatch =
            nextEnabled &&
            (currentIntensity == null || currentIntensity <= 0)
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
            setPlaybookData((prev) => ({
              ...(prev ?? {}),
              lightFaders: nextFaders,
            }));
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
        onClearGridBinding: () =>
          vm.clearSpotlightGridBinding(activeSpotlight.id),
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
      sizeAxisLabels: getTheaterModelSizeAxisLabels(activeModel.builtin),
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
      onRotateQuarter: (direction: "cw" | "ccw") =>
        vm.rotateActiveModel(direction),
      placementGrid: isDecorEditMode ? vm.stageGrid : undefined,
      onPlace: isDecorEditMode
        ? (preset: ModelPlacementPreset) => vm.placeActiveModel(preset)
        : undefined,
      onResetTransform: () => {
        const resetY = isLightTrussModel(activeModel)
          ? activeModel.position[1]
          : 0;
        vm.updateModel(modelId, {
          position: [0, resetY, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
        });
        vm.setPendingSnapModelId(modelId);
      },
      onClone: () => vm.cloneModel(modelId),
      onCopyToPreviousScene: () =>
        vm.copyModelsToAdjacentScene("previous", [modelId]),
      onCopyToNextScene: () =>
        vm.copyModelsToAdjacentScene("next", [modelId]),
      canCopyToPreviousScene: vm.currentPage > 0,
      canCopyToNextScene: vm.currentPage < vm.sceneCount - 1,
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
    <TheaterSceneLayout
      vm={vm}
      immersiveMode={immersiveMode}
      onImmersiveModeChange={onImmersiveModeChange}
      sidebarRender={sidebarRender}
      mobileTheaterLayout={mobileTheaterLayout}
      showEditorChrome={showEditorChrome}
      showTheaterToolsBar={showTheaterToolsBar}
      controlsInSidebar={controlsInSidebar}
      embedLight={embedLight}
      showHallQuickStart={showHallQuickStart}
      onHallQuickStartFinish={finishHallQuickStart}
      onTogglePanels={onTogglePanels}
      isPanelsSwapped={isPanelsSwapped}
      showSpotlightFocusPanel={showSpotlightFocusPanel}
      spotlightFocusPanelProps={spotlightFocusPanelProps}
      showModelFocusPanel={showModelFocusPanel}
      modelFocusPanelProps={modelFocusPanelProps}
      showSmokeFocusPanel={showSmokeFocusPanel}
      showSmokePanelTab={showSmokePanelTab}
      smokePosition={smokePosition}
      highlightGridCell={highlightGridCell}
      initialCamera={initialCamera}
      showEditorHelpers={showEditorHelpers}
      instancedFurnitureModels={instancedFurnitureModels}
      individualModels={individualModels}
      isModelEditMode={isModelEditMode}
      onSelectModel={selectModel}
      onFocusModel={focusModel}
      onSelectSpotlight={selectSpotlight}
      onFocusSpotlight={focusSpotlight}
      onLayoutSizePreview={(result) =>
        applyHallExpandResult(result, "preview")
      }
      onLayoutSizeCommit={(result) => applyHallExpandResult(result, "commit")}
      onLayoutSizeDragStart={handleHallExpandDragStart}
      onLayoutSizeDragEnd={handleHallExpandDragEnd}
    />
  );
};
