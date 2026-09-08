import { useRef, useState, type ReactNode } from "react";
import cn from "classnames";
import type { TheaterAudienceLayout, TheaterModel, TheaterSurfaceMaterial } from "../../../shared/types/script";
import { getDesktopApi } from "../../../shared/platform/desktop-api";
import { desktopAddProjectImage } from "../../../shared/platform/desktop-methods";
import {
  canAddTheaterLayoutDoors,
  type TheaterAudienceContextHit,
  type TheaterFloorContextHit,
  type TheaterObjectContextHit,
  type TheaterOpeningContextHit,
  type TheaterRecessContextHit,
  type TheaterWallContextHit,
} from "../model/theater-object-context";
import {
  createLayoutAisle,
  layoutPatchFromAisles,
  patchLayoutAisle,
} from "../model/theater-aisles";
import { getAudienceStartZBounds } from "../model/theater-metrics";
import {
  findLayoutDoor,
  patchLayoutDoor,
  resolveLayoutDoors,
  THEATER_DOOR_STYLE_LABELS,
} from "../model/theater-doors";
import {
  DECOR_TEXTURE_MODES,
  DECOR_TEXTURE_PRESETS,
  getDecorTexturePresetId,
  toDecorTextureFileRef,
  toDecorTexturePresetRef,
  type DecorTexturePresetId,
} from "../model/theater-decor-textures";
import {
  isTheaterWallRecessWall,
  patchLayoutWallRecess,
} from "../model/theater-wall-recesses";
import {
  patchLayoutWallOpening,
} from "../model/theater-wall-openings";
import {
  getTheaterSurfaceMaterialConfig,
  normalizeTheaterSurfaceMaterial,
  surfaceMaterialKeyForWall,
  type TheaterSurfaceMaterialKey,
} from "../model/theater-surface-materials";
import { STAGE_WALL_SIDE_LABELS } from "../model/theater-stage-geometry";
import {
  TheaterObjectContextMenu,
  type TheaterObjectContextMenuItem,
} from "./TheaterObjectContextMenu";
import { buildAudienceContextMenuItems } from "./theater-audience-context-items";
import {
  buildOpeningContextMenuItems,
  isOpeningWallPick,
} from "./theater-opening-context-items";
import { buildRecessContextMenuItems } from "./theater-recess-context-items";
import {
  buildStageContextMenuItems,
  patchForStageContextPick,
  patchForStageContextRange,
} from "./theater-stage-context-items";
import type { TheaterCameraState } from "../model/theater-camera-storage";
import {
  focusCameraForModel,
  requestTheaterCameraFocus,
} from "../model/theater-camera-focus";
import type { HallExpandResult } from "../model/theater-hall-expand";
import { translateLightTrusses } from "../model/theater-light-rig";
import { isLightTrussModel } from "../model/theater-truss-mounts";
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
import { TheaterCameraNavPad } from "./TheaterCameraNavPad";

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
  const [objectContextMenu, setObjectContextMenu] =
    useState<TheaterObjectContextHit | null>(null);
  const wallTextureInputRef = useRef<HTMLInputElement | null>(null);
  const lightRigDragOriginRef = useRef<TheaterModel[] | null>(null);
  const pendingTextureSurfaceRef = useRef<TheaterSurfaceMaterialKey | null>(null);
  const wallColorTxRef = useRef(false);
  const canAddWallDoors = canAddTheaterLayoutDoors(vm.layout);
  const wallContextMenu =
    objectContextMenu?.kind === "wall" ? objectContextMenu : null;
  const canAddWallRecess =
    canAddWallDoors &&
    wallContextMenu != null &&
    isTheaterWallRecessWall(wallContextMenu.wall);
  const floorContextMenu =
    objectContextMenu?.kind === "floor" ? objectContextMenu : null;
  const doorContextMenu =
    objectContextMenu?.kind === "door" ? objectContextMenu : null;
  const recessContextMenu =
    objectContextMenu?.kind === "recess" ? objectContextMenu : null;
  const openingContextMenu =
    objectContextMenu?.kind === "opening" ? objectContextMenu : null;
  const audienceContextMenu =
    objectContextMenu?.kind === "audience" ? objectContextMenu : null;
  const contextDoor = doorContextMenu
    ? findLayoutDoor(vm.layout, doorContextMenu.doorId)
    : undefined;
  const surfaceMaterialKey = wallContextMenu
    ? surfaceMaterialKeyForWall(wallContextMenu.wall)
    : floorContextMenu
      ? "stageFloorMaterial"
      : null;
  const surfaceMaterial = surfaceMaterialKey
    ? normalizeTheaterSurfaceMaterial(
        surfaceMaterialKey,
        vm.layout[surfaceMaterialKey],
      )
    : null;
  const wallTextureMode = surfaceMaterial?.textureMode ?? "repeat";
  const wallColorValue =
    surfaceMaterial?.color ??
    (surfaceMaterialKey
      ? getTheaterSurfaceMaterialConfig(surfaceMaterialKey).defaultColor
      : "#111827");
  const wallLookItems: TheaterObjectContextMenuItem[] = [
    {
      id: "texture",
      label: "Текстура",
      children: [
        ...DECOR_TEXTURE_PRESETS.map((preset) => ({
          id: `texture-preset:${preset.id}`,
          label: preset.label,
          active: getDecorTexturePresetId(surfaceMaterial?.texture) === preset.id,
        })),
        { id: "texture-upload", label: "Загрузить…" },
        {
          id: "texture-clear",
          label: "Убрать текстуру",
          disabled: !surfaceMaterial?.texture,
        },
        {
          id: "wall-color",
          label: "Цвет",
          colorValue: wallColorValue,
        },
      ],
    },
    {
      id: "texture-mode",
      label: "Позиционирование",
      disabled: !surfaceMaterial?.texture,
      children: DECOR_TEXTURE_MODES.map((mode) => ({
        id: `texture-mode:${mode.id}`,
        label: mode.label,
        active: wallTextureMode === mode.id,
      })),
    },
  ];
  const doorStyle = contextDoor?.style === "metal" ? "metal" : "wood";
  const canRemoveDoor = resolveLayoutDoors(vm.layout).length > 1;
  const surfaceLookItem: TheaterObjectContextMenuItem = {
    id: "texture-look",
    label: "Оформление",
    children: wallLookItems,
  };
  const objectContextItems: TheaterObjectContextMenuItem[] = wallContextMenu
    ? [
        {
          id: "add-door",
          label: "Добавить дверь",
          disabled: !canAddWallDoors,
        },
        {
          id: "add-recess",
          label: "Добавить нишу",
          disabled: !canAddWallRecess,
        },
        {
          id: "add-opening",
          label: "Добавить проём",
          disabled: !canAddWallDoors,
        },
        surfaceLookItem,
      ]
    : floorContextMenu
      ? [...buildStageContextMenuItems(vm.layout), surfaceLookItem]
      : doorContextMenu
        ? [
            {
              id: "door-style",
              label: "Текстура",
              children: [
                {
                  id: "door-style:wood",
                  label: THEATER_DOOR_STYLE_LABELS.wood,
                  active: doorStyle === "wood",
                },
                {
                  id: "door-style:metal",
                  label: THEATER_DOOR_STYLE_LABELS.metal,
                  active: doorStyle === "metal",
                },
              ],
            },
            {
              id: "door-delete",
              label: "Удалить",
              danger: true,
              disabled: !canRemoveDoor,
            },
          ]
        : recessContextMenu
          ? buildRecessContextMenuItems(vm.layout, recessContextMenu.recessId)
        : openingContextMenu
          ? buildOpeningContextMenuItems(vm.layout, openingContextMenu.openingId)
        : audienceContextMenu
          ? buildAudienceContextMenuItems(vm.layout)
          : [];
  const objectContextTitle = wallContextMenu
    ? STAGE_WALL_SIDE_LABELS[wallContextMenu.wall]
    : floorContextMenu
      ? "Сцена"
      : doorContextMenu
        ? "Дверь"
        : recessContextMenu
          ? "Ниша"
        : openingContextMenu
          ? "Проём"
        : audienceContextMenu
          ? "Кресла"
          : undefined;

  const closeObjectContextMenu = () => {
    if (wallColorTxRef.current) {
      vm.endTheaterHistoryTransaction();
      wallColorTxRef.current = false;
    }
    setObjectContextMenu(null);
  };

  const handleWallColorChange = (_id: string, color: string) => {
    if (!surfaceMaterialKey) return;
    if (!wallColorTxRef.current) {
      vm.beginTheaterHistoryTransaction();
      wallColorTxRef.current = true;
    }
    applySurfaceMaterial(surfaceMaterialKey, { color });
  };

  const handleWallColorCommit = () => {
    if (!wallColorTxRef.current) return;
    vm.endTheaterHistoryTransaction();
    wallColorTxRef.current = false;
  };

  const applySurfaceMaterial = (
    key: TheaterSurfaceMaterialKey,
    patch: Partial<TheaterSurfaceMaterial>,
  ) => {
    const current = normalizeTheaterSurfaceMaterial(key, vm.layout[key]);
    vm.updateLayout({
      [key]: { ...current, ...patch },
    });
  };

  const handleWallContextMenu = (hit: TheaterWallContextHit) => {
    if (!showEditorHelpers) return;
    setObjectContextMenu(hit);
  };

  const handleFloorContextMenu = (hit: TheaterFloorContextHit) => {
    if (!showEditorHelpers) return;
    setObjectContextMenu(hit);
  };

  const handleDoorContextMenu = (hit: TheaterObjectContextHit) => {
    if (!showEditorHelpers) return;
    if (hit.kind !== "door") return;
    vm.setActiveDoorId(hit.doorId);
    setObjectContextMenu(hit);
  };

  const handleRecessContextMenu = (hit: TheaterRecessContextHit) => {
    if (!showEditorHelpers) return;
    vm.setActiveRecessId(hit.recessId);
    setObjectContextMenu(hit);
  };

  const handleOpeningContextMenu = (hit: TheaterOpeningContextHit) => {
    if (!showEditorHelpers) return;
    vm.setActiveOpeningId(hit.openingId);
    setObjectContextMenu(hit);
  };

  const handleAudienceContextMenu = (hit: TheaterAudienceContextHit) => {
    if (!showEditorHelpers) return;
    vm.focusAudienceSeats();
    setObjectContextMenu(hit);
  };

  const handleAudienceRangeStart = () => {
    if (wallColorTxRef.current) return;
    vm.beginTheaterHistoryTransaction();
    wallColorTxRef.current = true;
  };

  const handleAudienceRangeCommit = () => {
    if (!wallColorTxRef.current) return;
    vm.endTheaterHistoryTransaction();
    wallColorTxRef.current = false;
  };

  const handleRecessRangeChange = (id: string, value: number) => {
    if (!recessContextMenu) return;
    handleAudienceRangeStart();
    if (id === "recess-pos") {
      vm.updateLayout({
        wallRecesses: patchLayoutWallRecess(vm.layout, recessContextMenu.recessId, {
          pos: value,
        }),
      });
      return;
    }
    if (id === "recess-width") {
      vm.updateLayout({
        wallRecesses: patchLayoutWallRecess(vm.layout, recessContextMenu.recessId, {
          width: value,
        }),
      });
      return;
    }
    if (id === "recess-depth") {
      vm.updateLayout({
        wallRecesses: patchLayoutWallRecess(vm.layout, recessContextMenu.recessId, {
          depth: value,
        }),
      });
    }
  };

  const handleOpeningRangeChange = (id: string, value: number) => {
    if (!openingContextMenu) return;
    handleAudienceRangeStart();
    if (id === "opening-pos") {
      vm.updateLayout({
        wallOpenings: patchLayoutWallOpening(vm.layout, openingContextMenu.openingId, {
          pos: value,
        }),
      });
      return;
    }
    if (id === "opening-width") {
      vm.updateLayout({
        wallOpenings: patchLayoutWallOpening(vm.layout, openingContextMenu.openingId, {
          width: value,
        }),
      });
      return;
    }
    if (id === "opening-height") {
      vm.updateLayout({
        wallOpenings: patchLayoutWallOpening(vm.layout, openingContextMenu.openingId, {
          height: value,
        }),
      });
      return;
    }
    if (id === "opening-sill") {
      vm.updateLayout({
        wallOpenings: patchLayoutWallOpening(vm.layout, openingContextMenu.openingId, {
          sill: value,
        }),
      });
    }
  };

  const handleStageRangeChange = (id: string, value: number) => {
    handleAudienceRangeStart();
    const patch = patchForStageContextRange(vm.layout, id, value);
    if (!patch) return;
    vm.updateLayout(patch);
  };

  const handleAudienceRangeChange = (id: string, value: number) => {
    handleAudienceRangeStart();
    if (id === "audience-z") {
      vm.updateLayout({ audienceStartZ: value });
      return;
    }
    if (id === "audience-row-spacing") {
      vm.updateLayout({ rowSpacing: value });
      return;
    }
    if (id === "audience-rows") {
      vm.updateLayout({ seatRows: Math.round(value) });
      return;
    }
    if (id === "audience-seats-per-row") {
      vm.updateLayout({ seatsPerRow: Math.round(value) });
      return;
    }
    if (id === "audience-row-rise") {
      vm.updateLayout({ rowRise: value });
      return;
    }
    if (id.startsWith("aisle-width:")) {
      const aisleId = Number(id.slice("aisle-width:".length));
      if (!Number.isFinite(aisleId)) return;
      vm.updateLayout(
        layoutPatchFromAisles(patchLayoutAisle(vm.layout, aisleId, { width: value }), vm.layout),
      );
      return;
    }
    if (id.startsWith("aisle-center:")) {
      const aisleId = Number(id.slice("aisle-center:".length));
      if (!Number.isFinite(aisleId)) return;
      vm.updateLayout(
        layoutPatchFromAisles(
          patchLayoutAisle(vm.layout, aisleId, { centerX: value }),
          vm.layout,
        ),
      );
    }
  };

  const handleObjectContextPick = (id: string) => {
    if (objectContextMenu?.kind === "floor") {
      const patch = patchForStageContextPick(vm.layout, id);
      if (patch) {
        vm.updateLayout(patch);
        return;
      }
    }
    if (objectContextMenu?.kind === "audience") {
      if (id === "add-aisle") {
        vm.updateLayout(
          layoutPatchFromAisles(
            createLayoutAisle(vm.layout, objectContextMenu.x),
            vm.layout,
          ),
        );
        return;
      }
      if (id === "audience-place-stage") {
        vm.updateLayout({ audienceStartZ: getAudienceStartZBounds(vm.layout).min });
        return;
      }
      if (id.startsWith("audience-layout:")) {
        const nextLayout = id.slice("audience-layout:".length) as TheaterAudienceLayout;
        if (nextLayout !== "rows" && nextLayout !== "arc" && nextLayout !== "surround") {
          return;
        }
        vm.updateLayout({ audienceLayout: nextLayout });
      }
      return;
    }
    if (objectContextMenu?.kind === "door") {
      if (id === "door-delete") {
        if (!canRemoveDoor) return;
        vm.removeActiveDoor(objectContextMenu.doorId);
        return;
      }
      if (id === "door-style:wood" || id === "door-style:metal") {
        const style = id === "door-style:metal" ? "metal" : "wood";
        vm.setActiveDoorId(objectContextMenu.doorId);
        vm.updateLayout({
          doors: patchLayoutDoor(vm.layout, objectContextMenu.doorId, { style }),
        });
      }
      return;
    }
    if (objectContextMenu?.kind === "recess") {
      if (id === "recess-delete") {
        vm.removeActiveWallRecess(objectContextMenu.recessId);
        return;
      }
      if (id === "recess-filled") {
        const current = vm.layoutRecesses.find(
          (item) => item.id === objectContextMenu.recessId,
        );
        vm.updateLayout({
          wallRecesses: patchLayoutWallRecess(vm.layout, objectContextMenu.recessId, {
            filled: !current?.filled,
          }),
        });
        return;
      }
      if (id.startsWith("recess-wall:")) {
        const wall = id.slice("recess-wall:".length);
        if (!isTheaterWallRecessWall(wall)) return;
        vm.updateLayout({
          wallRecesses: patchLayoutWallRecess(vm.layout, objectContextMenu.recessId, {
            wall,
          }),
        });
      }
      return;
    }
    if (objectContextMenu?.kind === "opening") {
      if (id === "opening-delete") {
        vm.removeActiveWallOpening(objectContextMenu.openingId);
        return;
      }
      const wall = isOpeningWallPick(id);
      if (wall) {
        vm.updateLayout({
          wallOpenings: patchLayoutWallOpening(vm.layout, objectContextMenu.openingId, {
            wall,
          }),
        });
      }
      return;
    }
    if (id === "add-door") {
      if (!wallContextMenu || !canAddWallDoors) return;
      vm.setActiveTab("layout");
      vm.addDoor(wallContextMenu.wall, wallContextMenu.pos);
      return;
    }
    if (id === "add-recess") {
      if (!wallContextMenu || !canAddWallDoors) return;
      if (!isTheaterWallRecessWall(wallContextMenu.wall)) return;
      vm.setActiveTab("layout");
      vm.addWallRecess(wallContextMenu.wall, wallContextMenu.pos);
      return;
    }
    if (id === "add-opening") {
      if (!wallContextMenu || !canAddWallDoors) return;
      vm.setActiveTab("layout");
      vm.addWallOpening(wallContextMenu.wall, wallContextMenu.pos);
      return;
    }
    if (!surfaceMaterialKey) return;
    if (id === "texture-upload") {
      pendingTextureSurfaceRef.current = surfaceMaterialKey;
      queueMicrotask(() => wallTextureInputRef.current?.click());
      return;
    }
    if (id === "texture-clear") {
      applySurfaceMaterial(surfaceMaterialKey, { texture: undefined });
      return;
    }
    if (id.startsWith("texture-mode:")) {
      if (!surfaceMaterial?.texture) return;
      const mode = DECOR_TEXTURE_MODES.find(
        (item) => item.id === id.slice("texture-mode:".length),
      )?.id;
      if (!mode) return;
      applySurfaceMaterial(surfaceMaterialKey, { textureMode: mode });
      return;
    }
    if (!id.startsWith("texture-preset:")) return;
    const presetId = id.slice("texture-preset:".length) as DecorTexturePresetId;
    applySurfaceMaterial(surfaceMaterialKey, {
      texture: toDecorTexturePresetRef(presetId),
      textureMode: surfaceMaterial?.textureMode ?? "cover",
    });
  };

  const handleWallTextureUpload = async (file: File | undefined) => {
    const key = pendingTextureSurfaceRef.current;
    pendingTextureSurfaceRef.current = null;
    if (!key || !file || !file.type.startsWith("image/")) return;
    const api = getDesktopApi();
    let textureRef: string;
    if (api?.addProjectImage) {
      const buffer = await file.arrayBuffer();
      const result = await desktopAddProjectImage(
        api,
        vm.projectName,
        new Uint8Array(buffer),
        file.type,
        file.name,
      );
      if (!result?.ok || !result.file) {
        if (!result?.canceled) {
          console.error("Failed to add theater wall texture:", result?.error);
        }
        return;
      }
      textureRef = toDecorTextureFileRef(result.file);
    } else {
      textureRef = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    }
    applySurfaceMaterial(key, {
      texture: textureRef,
      textureMode: "once",
      textureRepeat: 1,
    });
  };

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
              activeOpeningId={vm.activeOpeningId}
              hoveredModelId={vm.hoveredModelId}
              snapToGrid={vm.snapToGrid}
              gridStep={vm.gridStep}
              onSelectModel={(id, additive) => onSelectModel(id, additive)}
              onModelContextMenu={(id) => onFocusModel(id)}
              onSelectSpotlight={(id, additive) => onSelectSpotlight(id, additive)}
              onSelectDoor={vm.setActiveDoorId}
              onSelectRecess={vm.setActiveRecessId}
              onSelectOpening={vm.setActiveOpeningId}
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
          {!embedLight && showEditorHelpers ? <TheaterCameraNavPad /> : null}
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
              activeOpeningId={vm.activeOpeningId}
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
                  if (!isLightTrussModel(active)) {
                    vm.setPendingSnapModelId(active.id);
                  }
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
                if (!isLightTrussModel(active)) {
                  vm.setPendingSnapModelId(active.id);
                }
              }}
              onModelFloorMoveDragStart={vm.beginTheaterHistoryTransaction}
              onModelFloorMoveDragEnd={vm.endTheaterHistoryTransaction}
              onLightRigMovePreview={(deltaX, deltaZ) => {
                const origin = lightRigDragOriginRef.current;
                if (!origin) return;
                vm.updateModels(translateLightTrusses(origin, deltaX, deltaZ));
              }}
              onLightRigMoveCommit={(deltaX, deltaZ) => {
                const origin = lightRigDragOriginRef.current;
                lightRigDragOriginRef.current = null;
                if (!origin) return;
                vm.updateModels(translateLightTrusses(origin, deltaX, deltaZ));
              }}
              onLightRigMoveDragStart={() => {
                lightRigDragOriginRef.current = vm.models;
                vm.beginTheaterHistoryTransaction();
              }}
              onLightRigMoveDragEnd={vm.endTheaterHistoryTransaction}
              lightRigFocused={vm.lightRigFocused}
              onSelectLightRig={vm.focusLightRig}
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
              onWallContextMenu={
                showEditorHelpers ? handleWallContextMenu : undefined
              }
              onFloorContextMenu={
                showEditorHelpers ? handleFloorContextMenu : undefined
              }
              onSelectDoor={(doorId) => {
                closeObjectContextMenu();
                vm.setActiveDoorId(doorId);
                vm.setActiveTab("layout");
              }}
              onDoorMovePreview={(doors) => vm.previewLayout({ doors })}
              onDoorMoveCommit={(doors) => vm.updateLayout({ doors })}
              onDoorDragStart={vm.beginTheaterHistoryTransaction}
              onDoorDragEnd={vm.endTheaterHistoryTransaction}
              onDoorContextMenu={
                showEditorHelpers ? handleDoorContextMenu : undefined
              }
              onRecessContextMenu={
                showEditorHelpers ? handleRecessContextMenu : undefined
              }
              onSelectRecess={(recessId) => {
                closeObjectContextMenu();
                vm.setActiveRecessId(recessId);
                vm.setActiveTab("layout");
              }}
              onRecessMovePreview={
                showEditorHelpers
                  ? (wallRecesses) => vm.previewLayout({ wallRecesses })
                  : undefined
              }
              onRecessMoveCommit={
                showEditorHelpers
                  ? (wallRecesses) => vm.updateLayout({ wallRecesses })
                  : undefined
              }
              onRecessDragStart={
                showEditorHelpers ? vm.beginTheaterHistoryTransaction : undefined
              }
              onRecessDragEnd={
                showEditorHelpers ? vm.endTheaterHistoryTransaction : undefined
              }
              onSelectOpening={(openingId) => {
                closeObjectContextMenu();
                vm.setActiveOpeningId(openingId);
                vm.setActiveTab("layout");
              }}
              onOpeningMovePreview={
                showEditorHelpers
                  ? (wallOpenings) => vm.previewLayout({ wallOpenings })
                  : undefined
              }
              onOpeningMoveCommit={
                showEditorHelpers
                  ? (wallOpenings) => vm.updateLayout({ wallOpenings })
                  : undefined
              }
              onOpeningDragStart={
                showEditorHelpers ? vm.beginTheaterHistoryTransaction : undefined
              }
              onOpeningDragEnd={
                showEditorHelpers ? vm.endTheaterHistoryTransaction : undefined
              }
              onOpeningContextMenu={
                showEditorHelpers ? handleOpeningContextMenu : undefined
              }
              onAudienceContextMenu={
                showEditorHelpers && vm.showSeats && !vm.isDragging && !vm.decorPlaceMode
                  ? handleAudienceContextMenu
                  : undefined
              }
            />
          </TheaterCanvasShell>
          <TheaterObjectContextMenu
            open={objectContextMenu != null}
            x={objectContextMenu?.clientX ?? 0}
            y={objectContextMenu?.clientY ?? 0}
            title={objectContextTitle}
            items={objectContextItems}
            onPick={handleObjectContextPick}
            onColorChange={handleWallColorChange}
            onColorCommit={handleWallColorCommit}
            onRangeChange={
              audienceContextMenu
                ? handleAudienceRangeChange
                : floorContextMenu
                  ? handleStageRangeChange
                  : recessContextMenu
                    ? handleRecessRangeChange
                    : openingContextMenu
                      ? handleOpeningRangeChange
                      : undefined
            }
            onRangeStart={
              audienceContextMenu || floorContextMenu || recessContextMenu || openingContextMenu
                ? handleAudienceRangeStart
                : undefined
            }
            onRangeCommit={
              audienceContextMenu || floorContextMenu || recessContextMenu || openingContextMenu
                ? handleAudienceRangeCommit
                : undefined
            }
            onClose={closeObjectContextMenu}
          />
          <input
            ref={wallTextureInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              void handleWallTextureUpload(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          {!embedLight ? <TheaterViewportKadrStrip vm={vm} /> : null}
        </div>
      </div>
    </div>
  );

  if (embedLight) return sceneTree;
  return <TheaterSchemeTabs>{sceneTree}</TheaterSchemeTabs>;
}
