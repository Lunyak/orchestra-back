import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useAppEditorViewMenuRender } from "@shared/components/app-editor-menubar";
import { useScene } from "../../scene";
import { patchSceneFaderFromSpotlightIntensity } from "../model/sync-spotlight-fader-level";
import { useTheaterScene, type TheaterSceneViewModel } from "../model/use-theater-scene";
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
import { TheaterEditorViewMenu } from "./menubar/TheaterEditorViewMenu";
import { TheaterBtn } from "./theater-controls-ui";
import { TheaterFloorPlan } from "./TheaterFloorPlan";
import { TheaterModelFocusPanel } from "./TheaterModelFocusPanel";
import { TheaterSpotlightFocusPanel } from "./TheaterSpotlightFocusPanel";
import { TheaterLightConsolePanel } from "./TheaterLightConsolePanel";
import { TheaterCanvasShell } from "./canvas/TheaterCanvasShell";
import { TheaterCanvasContent } from "./canvas/TheaterCanvasContent";
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
}: TheaterSceneProps) => {
  const vm = useTheaterScene({
    projectName,
    theaterLayout,
    onTheaterLayoutChange,
  });
  const { sceneData, setSceneData } = useScene();

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

  const isModelEditMode = vm.editMode === "models" || vm.editMode === "decor";
  const showEditorHelpers = embeddedLightRehearsal
    ? vm.activeTab === "spotlights"
    : !vm.spectaclePreviewMode;
  const mobileTheaterLayout = useMobileTheaterLayout();
  const controlsInSidebar = Boolean(controlsInPanel);
  const showEditorChrome = controlsInSidebar && vm.showControls && !mobileTheaterLayout;

  useAppEditorViewMenuRender(
    "theater-view-menu",
    10,
    () => (embeddedLightRehearsal ? null : <TheaterEditorViewMenu vm={vm} />),
  );

  const toolbarRender = showEditorChrome ? (
    <TheaterControls vm={vm} controlsInPanel panel="toolbar" />
  ) : null;

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
        onIntensityChange: (intensity: number) => {
          vm.updateSpotlight(activeSpotlight.id, { intensity });
          const nextFaders = patchSceneFaderFromSpotlightIntensity(
            sceneData?.lightFaders ?? null,
            activeSpotlight,
            intensity,
          );
          if (nextFaders) {
            setSceneData((prev) => ({ ...(prev ?? {}), lightFaders: nextFaders }));
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

  const embedLight = embeddedLightRehearsal;

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
      <div
        className={[
          "theater-scene-main",
          showEditorChrome ? "theater-scene-main--with-rail" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {toolbarRender}
        <div className="theater-scene-body">
      {onTogglePanels && !embedLight && (
        <div className="theater-panels-toggle">
          <TheaterBtn
            active={!isPanelsSwapped}
            onClick={onTogglePanels}
            title={
              isPanelsSwapped
                ? "Плейлист слева и шаги справа, сцена на весь экран"
                : "Слева — вкладки (включая «Обзор»), справа — содержимое"
            }
          >
            {isPanelsSwapped ? "Музыка и шаги" : "Настройки сцены"}
          </TheaterBtn>
        </div>
      )}
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
      {vm.showFloorPlan && !embedLight ? (
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
      {!embedLight ? (
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
      ) : null}
      {!embedLight ? (
        <TheaterLightConsolePanel
          projectName={vm.projectName}
          spotlights={vm.displaySpotlights}
          updateSpotlights={vm.updateSpotlights}
          collapsed={!vm.lightConsoleExpanded}
        />
      ) : null}
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
    step: vm.currentStep
      ? {
          id: vm.currentStep.id,
          title: vm.currentStep.title,
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
      floorPlanExpanded: vm.floorPlanExpanded,
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
  const title = vm.currentStep?.title?.trim() || vm.projectName;
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
    return vm.currentStep?.title || "Театр";
  }, [vm.activeModel, vm.activeSpotlight, vm.currentStep?.title]);

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
        <section className="theater-mobile-sheet" aria-label="Быстрые действия">
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
          ) : null}
          {sheet === "save" ? (
            <div className="theater-mobile-sheet__stack">
              <p>
                Основные правки уже попадают в текущий шаг. Здесь можно сделать отдельный снимок
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
