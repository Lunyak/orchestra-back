import type { TheaterLayout, TheaterModel, TheaterSpotlight } from "../../../../shared/types/script";
import type { TheaterViewPrefs } from "../../model/theater-view-prefs-storage";

export type TheaterFloorPlanProps = {
  layout: TheaterLayout;
  models: TheaterModel[];
  spotlights: TheaterSpotlight[];
  showSeats: boolean;
  showSpotlights: boolean;
  showSpotlightGuideLines: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
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
  | { kind: "outline-vertex"; index: number };

export const COMPACT_SIZE = { width: 196, height: 156 };
export const EXPANDED_SIZE = { width: 420, height: 340 };
