import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import cn from "classnames";
import { useAppEditorMenubarActionsRender } from "@shared/components/app-editor-menubar";
import { usePlaybook } from "../../playbook";
import {
  patchSceneFaderFromSpotlightIntensity,
  patchSceneFaderLevel,
} from "../model/sync-spotlight-fader-level";
import {
  bindSpotlightOnFaderBoard,
  detachSpotlightFromFaderBoard,
  readSpotlightChannel,
  readSpotlightFaderId,
} from "../model/theater-light-fader-bindings";
import {
  buildCompleteLightFaders,
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
import {
  modelGroupMemberIds,
  selectionHasModelGroup,
} from "../model/theater-model-groups";
import { isLightTrussModel } from "../model/theater-truss-mounts";
import { resolveSmokePosition } from "../model/theater-smoke-settings";
import { useMobileTheaterLayout } from "../model/theater-mobile-layout";
import { TheaterSceneLayout } from "./TheaterSceneLayout";
import type { TheaterObjectContextMenuItem } from "./TheaterObjectContextMenu";
import {
  buildSpotlightContextMenuItems,
  spotlightPresetColor,
} from "./theater-spotlight-context-items";
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
      vm.setModelDragArmed(false);
      vm.setEditMode(isDecor ? "decor" : "models");
      const groupIds = modelGroupMemberIds(vm.models, id);
      vm.selectTheaterModel(id, additive);
      if (groupIds.length > 1) {
        vm.setMultiSelectedModelIds((prev) => {
          if (!additive) return groupIds;
          const selected = new Set(prev);
          const groupSelected = groupIds.every((memberId) => selected.has(memberId));
          if (groupSelected) {
            groupIds.forEach((memberId) => selected.delete(memberId));
            return selected.size > 0 ? [...selected] : [id];
          }
          groupIds.forEach((memberId) => selected.add(memberId));
          return [...selected];
        });
      }
    },
    [
      vm.exitDecorPlaceMode,
      vm.models,
      vm.selectTheaterModel,
      vm.setAudienceSeatsFocused,
      vm.setEditMode,
      vm.setLayoutOutlineFocused,
      vm.setLightRigFocused,
      vm.setModelDragArmed,
      vm.setMultiSelectedModelIds,
      vm.setSpectaclePreviewMode,
      vm.setStageGridFocused,
      vm.spectaclePreviewMode,
    ],
  );

  const [spotlightContext, setSpotlightContext] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const [modelContext, setModelContext] = useState<{
    id: number;
    x: number;
    y: number;
  } | null>(null);

  const openModelContext = useCallback(
    (id: number, clientX: number, clientY: number) => {
      if (!vm.multiSelectedModelIds.includes(id)) {
        selectModel(id, false);
      }
      setSpotlightContext(null);
      setModelContext({ id, x: clientX, y: clientY });
    },
    [selectModel, vm.multiSelectedModelIds],
  );

  const closeModelContext = useCallback(() => {
    setModelContext(null);
  }, []);

  const focusSpotlight = useCallback(
    (spotlightId: number, clientX: number, clientY: number) => {
      selectSpotlight(spotlightId, false);
      setModelContext(null);
      setSpotlightContext({ id: spotlightId, x: clientX, y: clientY });
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
        onPickDragMode: (mode: "target" | "source") =>
          vm.setDragMode(vm.dragMode === mode ? null : mode),
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

  const menuSpotlight =
    spotlightContext == null
      ? null
      : (vm.displaySpotlights.find((item) => item.id === spotlightContext.id) ??
        null);
  const spotlightContextMatches =
    menuSpotlight != null &&
    spotlightFocusPanelProps != null &&
    menuSpotlight.id === spotlightFocusPanelProps.spotlight.id;
  const lightChannelCount = Array.isArray(playbookData?.lightChannels)
    ? playbookData.lightChannels.length
    : 0;
  const faderCount =
    playbookData?.lightFaders?.v === 1 ? playbookData.lightFaders.faders.length : 0;
  const spotlightContextMenu =
    spotlightContextMatches && spotlightContext && menuSpotlight
      ? {
          x: spotlightContext.x,
          y: spotlightContext.y,
          title: menuSpotlight.isRgb
            ? `RGB · ${menuSpotlight.label}`
            : menuSpotlight.label,
          items: buildSpotlightContextMenuItems({
            spotlight: menuSpotlight,
            dragMode: vm.dragMode,
            aimMode: vm.spotlightAimMode,
            gridCol: highlightGridCell?.col ?? menuSpotlight.gridCol,
            gridRow: highlightGridCell?.row ?? menuSpotlight.gridRow,
            trusses: vm.models.filter((model) => model.builtin === "lightTruss6m"),
            spotlights: vm.spotlights,
            channelCount: lightChannelCount,
            faderCount,
          }),
        }
      : null;

  const closeSpotlightContext = useCallback(() => {
    setSpotlightContext(null);
  }, []);

  const modelContextTarget =
    modelContext == null
      ? null
      : (vm.models.find((item) => item.id === modelContext.id) ?? null);
  const modelContextSelection = modelContextTarget
    ? vm.multiSelectedModelIds.includes(modelContextTarget.id)
      ? vm.multiSelectedModelIds
      : [modelContextTarget.id]
    : [];
  const modelContextItems: TheaterObjectContextMenuItem[] = [];
  if (modelContextSelection.length >= 2) {
    const groupIds = modelContextSelection.map(
      (id) => vm.models.find((item) => item.id === id)?.groupId,
    );
    const alreadyOneGroup =
      groupIds[0] != null && groupIds.every((groupId) => groupId === groupIds[0]);
    if (!alreadyOneGroup) {
      modelContextItems.push({ id: "group:join", label: "Объединить" });
    }
  }
  if (modelContextTarget && selectionHasModelGroup(vm.models, [modelContextTarget.id])) {
    modelContextItems.push({ id: "group:split", label: "Разбить" });
  }
  const modelContextMenu =
    modelContext && modelContextTarget && modelContextItems.length > 0
      ? {
          x: modelContext.x,
          y: modelContext.y,
          title: modelContextTarget.name,
          items: modelContextItems,
        }
      : null;

  const handleModelContextPick = useCallback(
    (actionId: string) => {
      if (actionId === "group:join") vm.groupSelectedModels();
      if (actionId === "group:split") vm.ungroupSelectedModels();
    },
    [vm],
  );

  const bindMenuSpotlightFader = useCallback(
    (faderId: number, spotlightId: number, channel: number) => {
      setPlaybookData((prev) => {
        const current = prev?.lightFaders?.v === 1 ? prev.lightFaders.faders : [];
        const nextFaderRows = bindSpotlightOnFaderBoard(
          current,
          faderId,
          spotlightId,
          channel,
        );
        const nextFaders = buildCompleteLightFaders({
          v: 1,
          count: nextFaderRows.length,
          faders: nextFaderRows,
        });
        const channelCount = Math.max(
          channel,
          Array.isArray(prev?.lightChannels) ? prev.lightChannels.length : channel,
        );
        const programs = resolveLightPrograms(
          prev?.lightPrograms,
          resolveLightProgramMinCount(channelCount, prev?.lightPrograms, channel),
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
      window.setTimeout(() => {
        void saveScenesForLightPlot({ force: true });
      }, 0);
    },
    [saveScenesForLightPlot, setPlaybookData],
  );

  const handleSpotlightContextPick = useCallback(
    (actionId: string) => {
      const panel = spotlightFocusPanelProps;
      const spotlight = menuSpotlight;
      if (!panel || !spotlight || spotlight.id !== panel.spotlight.id) return;
      if (actionId === "state:power") {
        panel.onToggleEnabled();
        return;
      }
      if (actionId === "state:visibility") {
        panel.onToggleHidden();
        return;
      }
      if (actionId === "aim:point") {
        panel.onPickAimMode("point");
        return;
      }
      if (actionId === "aim:cell") {
        panel.onPickAimMode("cell");
        return;
      }
      if (actionId === "aim:clear-cell") {
        panel.onClearGridBinding?.();
        return;
      }
      if (actionId === "aim:stage") {
        vm.aimSelectedSpotlightsAtStage();
        return;
      }
      if (actionId === "drag:source") {
        panel.onPickDragMode("source");
        return;
      }
      if (actionId === "drag:target") {
        panel.onPickDragMode("target");
        return;
      }
      if (actionId === "mount:detach") {
        panel.onDetachFromTruss();
        return;
      }
      if (actionId.startsWith("mount:")) {
        const rest = actionId.slice("mount:".length);
        const separator = rest.indexOf(":");
        if (separator <= 0) return;
        const mountModelId = Number(rest.slice(0, separator));
        const mountPointId = rest.slice(separator + 1);
        if (!Number.isFinite(mountModelId) || !mountPointId) return;
        panel.onAttachToTruss(mountModelId, mountPointId);
        return;
      }
      if (actionId.startsWith("light:preset:")) {
        const color = spotlightPresetColor(actionId.slice("light:preset:".length));
        if (color) panel.onColorChange(color);
        return;
      }
      if (actionId.startsWith("channel:")) {
        const channel = Math.max(1, Number(actionId.slice("channel:".length)) || 1);
        vm.updateSpotlight(spotlight.id, { channel });
        const faderId = readSpotlightFaderId(spotlight);
        if (faderId != null) bindMenuSpotlightFader(faderId, spotlight.id, channel);
        return;
      }
      if (actionId === "fader:none") {
        vm.updateSpotlight(spotlight.id, { faderId: undefined });
        setPlaybookData((prev) => ({
          ...(prev ?? {}),
          lightFaders: {
            v: 1,
            faders: detachSpotlightFromFaderBoard(
              prev?.lightFaders?.v === 1 ? prev.lightFaders.faders : [],
              spotlight.id,
            ),
          },
        }));
        window.setTimeout(() => {
          void saveScenesForLightPlot({ force: true });
        }, 0);
        return;
      }
      if (actionId.startsWith("fader:")) {
        const faderId = Math.max(1, Number(actionId.slice("fader:".length)) || 1);
        const channel = spotlight.channel ?? spotlight.id;
        vm.updateSpotlight(spotlight.id, { faderId });
        bindMenuSpotlightFader(faderId, spotlight.id, channel);
        return;
      }
      if (actionId === "model:low-detail") {
        vm.updateSpotlight(spotlight.id, {
          modelLowDetail: spotlight.modelLowDetail !== true,
        });
        return;
      }
      if (actionId === "object:clone") {
        panel.onClone?.();
        return;
      }
      if (actionId === "object:delete") {
        panel.onDelete?.();
      }
    },
    [
      bindMenuSpotlightFader,
      menuSpotlight,
      saveScenesForLightPlot,
      setPlaybookData,
      spotlightFocusPanelProps,
      vm,
    ],
  );

  const handleSpotlightContextColorChange = useCallback(
    (_id: string, color: string) => {
      spotlightFocusPanelProps?.onColorChange(color);
    },
    [spotlightFocusPanelProps],
  );

  const handleSpotlightContextRangeChange = useCallback(
    (id: string, value: number) => {
      if (id === "light:angle") spotlightFocusPanelProps?.onAngleChange(value);
      if (id === "light:intensity") spotlightFocusPanelProps?.onIntensityChange(value);
    },
    [spotlightFocusPanelProps],
  );

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
      transformArmed: vm.modelDragArmed,
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
        if (vm.modelDragArmed && vm.modelTransformMode === mode) {
          vm.setModelDragArmed(false);
          return;
        }
        vm.exitDecorPlaceMode();
        vm.setEditMode(isDecorEditMode ? "decor" : "models");
        vm.setModelTransformMode(mode);
        vm.setModelDragArmed(true);
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
      onModelContextMenu={openModelContext}
      onSelectSpotlight={selectSpotlight}
      onFocusSpotlight={focusSpotlight}
      spotlightContextMenu={spotlightContextMenu}
      onSpotlightContextPick={handleSpotlightContextPick}
      onSpotlightContextColorChange={handleSpotlightContextColorChange}
      onSpotlightContextRangeChange={handleSpotlightContextRangeChange}
      onSpotlightContextRangeStart={vm.beginTheaterHistoryTransaction}
      onSpotlightContextRangeCommit={vm.endTheaterHistoryTransaction}
      onCloseSpotlightContext={closeSpotlightContext}
      modelContextMenu={modelContextMenu}
      onModelContextPick={handleModelContextPick}
      onCloseModelContext={closeModelContext}
      onLayoutSizePreview={(result) =>
        applyHallExpandResult(result, "preview")
      }
      onLayoutSizeCommit={(result) => applyHallExpandResult(result, "commit")}
      onLayoutSizeDragStart={handleHallExpandDragStart}
      onLayoutSizeDragEnd={handleHallExpandDragEnd}
    />
  );
};
