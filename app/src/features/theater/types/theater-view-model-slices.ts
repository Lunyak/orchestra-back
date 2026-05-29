import type { Dispatch, SetStateAction } from "react";
import type {
  ScriptStep,
  TheaterLayout,
  TheaterModel,
  TheaterSpotlight,
} from "../../../shared/types/script";
import type { DecorCatalogKey } from "../model/theater-decor-catalog";
import type { TheaterViewPrefs } from "../model/theater-view-prefs-storage";

/** View / display preferences (localStorage per project). */
export type TheaterPrefsSlice = TheaterViewPrefs & {
  setShowGrid: (value: boolean) => void;
  setShowStageGrid: (value: boolean) => void;
  setSnapToGrid: (value: boolean) => void;
  setGridStep: (value: number) => void;
  setShowSeats: (value: boolean) => void;
  setWallsOpaque: (value: boolean) => void;
  setWallsHidden: (value: boolean) => void;
  setWallsHideFromCamera: (value: boolean) => void;
  setShowFloorPlan: (value: boolean) => void;
  setFloorPlanExpanded: Dispatch<SetStateAction<boolean>>;
  setSpectaclePreviewMode: (value: boolean) => void;
  setAlignGuidesEnabled: (value: boolean) => void;
  setActiveTab: (tab: TheaterViewPrefs["activeTab"]) => void;
  setOutlineDrawMode: (value: boolean) => void;
  setSpotlightAimMode: (mode: TheaterViewPrefs["spotlightAimMode"]) => void;
  setDutyLightEnabled: (value: boolean) => void;
  setSceneBackgroundColor: (value: string) => void;
  setShowSpotlightGuideLines: (value: boolean) => void;
  setLightConsoleExpanded: Dispatch<SetStateAction<boolean>>;
  showSpotlights: boolean;
  setShowSpotlights: (value: boolean) => void;
  showOnlyActiveSpotlight: boolean;
  setShowOnlyActiveSpotlight: (value: boolean) => void;
};

export type TheaterHistorySlice = {
  undoTheater: () => void;
  redoTheater: () => void;
  canUndoTheater: boolean;
  canRedoTheater: boolean;
  beginTheaterHistoryTransaction: () => void;
  endTheaterHistoryTransaction: () => void;
};

export type TheaterDocumentSlice = {
  projectName: string;
  currentPage: number;
  currentStep: ScriptStep | undefined;
  stepCount: number;
  layout: TheaterLayout;
  updateLayout: (patch: Partial<TheaterLayout>) => void;
  previewLayout: (patch: Partial<TheaterLayout>) => void;
  updateCurrentStep: (patch: Partial<ScriptStep>) => void;
};

export type TheaterSelectionSlice = {
  activeTab: TheaterViewPrefs["activeTab"];
  editMode: "spotlights" | "models" | "decor";
  dragMode: "target" | "source";
  isDragging: boolean;
  activeSpotlightId: number | undefined;
  activeModelId: number | undefined;
  multiSelectedSpotlightIds: number[];
  multiSelectedModelIds: number[];
};

export type TheaterSpotlightsSlice = {
  spotlights: TheaterSpotlight[];
  displaySpotlights: TheaterSpotlight[];
  visibleSpotlights: TheaterSpotlight[];
  spotlightsConfigured: boolean;
  activeSpotlight: TheaterSpotlight | undefined;
  spotlightAimMode: TheaterViewPrefs["spotlightAimMode"];
  stageGrid: { cols: number; rows: number };
};

export type TheaterModelsSlice = {
  models: TheaterModel[];
  visibleModels: TheaterModel[];
  activeModel: TheaterModel | undefined;
  activeModelId: number | undefined;
};

export type TheaterDecorSlice = {
  decorPlaceMode: boolean;
  decorCatalogKey: DecorCatalogKey;
};

/** Nested domains for gradual migration off flat `vm`. */
export type TheaterSceneSlices = {
  prefs: TheaterPrefsSlice;
  history: TheaterHistorySlice;
  document: TheaterDocumentSlice;
  selection: TheaterSelectionSlice;
  spotlights: TheaterSpotlightsSlice;
  models: TheaterModelsSlice;
  decor: TheaterDecorSlice;
};
