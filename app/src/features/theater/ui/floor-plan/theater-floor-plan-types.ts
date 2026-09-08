import type { TheaterLayout, TheaterModel, TheaterSpotlight } from "../../../../shared/types/script";
import type { TheaterViewPrefs } from "../../model/theater-view-prefs-storage";

export type TheaterFloorPlanProps = {
  layout: TheaterLayout;
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
  showSeats: boolean;
  showSpotlights: boolean;
  showSpotlightGuideLines: boolean;
  maxSide: number;
  onChangeMaxSide: (value: number) => void;
  activeTab: TheaterViewPrefs["activeTab"];
  editMode: "spotlights" | "models" | "decor";
  decorPlaceMode: boolean;
  modelTransformMode: "translate" | "rotate" | "scale";
  activeModelId?: number;
  selectedModelIds?: number[];
  activeSpotlightId?: number;
  selectedSpotlightIds?: number[];
  activeDoorId?: number;
  activeRecessId?: number;
  activeOpeningId?: number;
  hoveredModelId: number | null;
  snapToGrid: boolean;
  gridStep: number;
  onSelectModel: (id: number, additive?: boolean) => void;
  onModelContextMenu: (id: number, clientX: number, clientY: number) => void;
  onSelectSpotlight: (
    id: number,
    additive?: boolean,
    clientX?: number,
    clientY?: number,
  ) => void;
  onSelectDoor?: (id: number) => void;
  onSelectRecess?: (id: number) => void;
  onSelectOpening?: (id: number) => void;
  onPlaceDecor: (position: [number, number, number]) => void;
  onPreviewModel: (id: number, position: [number, number, number]) => void;
  onCommitModel: (id: number, position: [number, number, number]) => void;
  onMoveSpotlight: (
    id: number,
    patch: Partial<Pick<TheaterSpotlight, "position" | "target">>,
  ) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onPreviewLayout?: (patch: Partial<TheaterLayout>) => void;
  onCommitLayout?: (patch: Partial<TheaterLayout>) => void;
  onLayoutInteractStart?: () => void;
  onLayoutInteractEnd?: () => void;
  outlineDrawMode?: boolean;
  activeOutlineVertexIndex?: number | null;
  onSelectOutlineVertex?: (index: number | null) => void;
  spotlightAimMode?: "point" | "cell";
  showStageGrid?: boolean;
  highlightGridCell?: { col: number; row: number } | null;
  onPickGridCell?: (col: number, row: number) => void;
};

export type DragState =
  | { kind: "model"; id: number }
  | { kind: "spotlight-source" | "spotlight-target"; id: number }
  | { kind: "door-move"; doorId: number }
  | { kind: "door-width-start"; doorId: number }
  | { kind: "door-width-end"; doorId: number }
  | { kind: "recess-move"; recessId: number }
  | { kind: "recess-width-start"; recessId: number }
  | { kind: "recess-width-end"; recessId: number }
  | { kind: "opening-move"; openingId: number }
  | { kind: "opening-width-start"; openingId: number }
  | { kind: "opening-width-end"; openingId: number }
  | { kind: "outline-vertex"; index: number };

export const FLOOR_PLAN_DEFAULT_MAX_SIDE = 196;
export const FLOOR_PLAN_MIN_MAX_SIDE = 140;
export const FLOOR_PLAN_LIMIT_MAX_SIDE = 720;
export const FLOOR_PLAN_NAV_MIN_SIDE = 220;

export function clampFloorPlanMaxSide(value: number): number {
  if (!Number.isFinite(value)) return FLOOR_PLAN_DEFAULT_MAX_SIDE;
  return Math.min(
    FLOOR_PLAN_LIMIT_MAX_SIDE,
    Math.max(FLOOR_PLAN_MIN_MAX_SIDE, Math.round(value)),
  );
}

/** Размер SVG-плана по пропорциям зала внутри квадратной max-коробки. */
export function fitFloorPlanSize(
  hallWidth: number,
  hallDepth: number,
  maxSide: number,
): { width: number; height: number } {
  const side = clampFloorPlanMaxSide(maxSide);
  const safeW = Math.max(hallWidth, 0.01);
  const safeD = Math.max(hallDepth, 0.01);
  const aspect = safeW / safeD;
  if (aspect >= 1) {
    const width = side;
    const height = Math.max(1, Math.round(width / aspect));
    return { width, height };
  }
  const height = side;
  const width = Math.max(1, Math.round(height * aspect));
  return { width, height };
}
