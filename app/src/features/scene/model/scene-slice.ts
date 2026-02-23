import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ScriptStep, TheaterLayout } from "../../../shared/types/script";

export const DEFAULT_THEATER_LAYOUT: TheaterLayout = {
  hallWidth: 9,
  hallDepth: 6,
  wallHeight: 6,
  audienceStartZ: 3,
  seatRows: 4,
  seatsPerRow: 7,
  seatSpacing: 1.1,
  rowSpacing: 0.8,
  rowRise: 0.25,
  aisleWidth: 1.2,
  aisleCenterX: 0,
  doorWidth: 1.2,
  doorHeight: 2.2,
  doorZ: -6,
};

export interface SceneData {
  name?: string;
  steps?: ScriptStep[];
  playlist?: any[];
  sounds?: any[];
  theaterLayout?: TheaterLayout;
  /** Глобальное распределение: роль -> актёры (email/имя). Истина для назначений. */
  roleAssignments?: Record<string, string[]>;
}

export interface SceneState {
  sceneData: SceneData | null;
  steps: ScriptStep[];
  theaterLayout: TheaterLayout;
  currentPage: number;
  isSceneReady: boolean;
  hasLocalEdits: boolean;
}

const initialState: SceneState = {
  sceneData: null,
  steps: [],
  theaterLayout: DEFAULT_THEATER_LAYOUT,
  currentPage: 0,
  isSceneReady: false,
  hasLocalEdits: false,
};

export const sceneSlice = createSlice({
  name: "scene",
  initialState,
  reducers: {
    resetForProject(state) {
      state.sceneData = null;
      state.steps = [];
      state.theaterLayout = DEFAULT_THEATER_LAYOUT;
      state.currentPage = 0;
      state.isSceneReady = false;
      state.hasLocalEdits = false;
    },
    hydrateScene(
      state,
      action: PayloadAction<{
        sceneData: SceneData | null;
        steps: ScriptStep[];
        theaterLayout: TheaterLayout;
        currentPage?: number;
        isSceneReady: boolean;
      }>,
    ) {
      state.sceneData = action.payload.sceneData;
      state.steps = action.payload.steps;
      state.theaterLayout = action.payload.theaterLayout;
      state.currentPage = action.payload.currentPage ?? 0;
      state.isSceneReady = action.payload.isSceneReady;
      state.hasLocalEdits = false;
    },
    setSceneData(state, action: PayloadAction<SceneData | null>) {
      state.sceneData = action.payload;
      state.hasLocalEdits = true;
    },
    setRoleAssignments(state, action: PayloadAction<Record<string, string[]>>) {
      state.sceneData = { ...(state.sceneData ?? {}), roleAssignments: action.payload };
      state.hasLocalEdits = true;
    },
    setSteps(state, action: PayloadAction<ScriptStep[]>) {
      state.steps = action.payload;
      state.hasLocalEdits = true;
    },
    setTheaterLayout(state, action: PayloadAction<TheaterLayout>) {
      state.theaterLayout = action.payload;
      state.hasLocalEdits = true;
    },
    setCurrentPage(state, action: PayloadAction<number>) {
      state.currentPage = action.payload;
    },
    addStep(state) {
      state.hasLocalEdits = true;
      const nextId = state.steps.reduce((acc, step) => Math.max(acc, step.id), 0) + 1;
      const insertIndex = Math.min(state.currentPage + 1, state.steps.length);
      const sourceStep = state.steps[state.currentPage];
      const nextRequisites = sourceStep?.requisites
        ? sourceStep.requisites.map((item) => ({ ...item, checked: false }))
        : [];
      const nextItem: ScriptStep = {
        id: nextId,
        title: `Шаг ${nextId}`,
        markdown: "",
        requisites: nextRequisites,
      };
      state.steps.splice(insertIndex, 0, nextItem);
      state.currentPage = insertIndex;
    },
    deleteStep(state, action: PayloadAction<number>) {
      state.hasLocalEdits = true;
      const id = action.payload;
      const next = state.steps.filter((s) => s.id !== id);
      if (next.length === 0) {
        state.currentPage = 0;
        state.steps = [{ id: 1, title: "Новый шаг", markdown: "" }];
        return;
      }
      state.steps = next;
      state.currentPage = Math.min(state.currentPage, next.length - 1);
    },
    reorderSteps(state, action: PayloadAction<{ fromIndex: number; toIndex: number }>) {
      const { fromIndex, toIndex } = action.payload;
      if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
      if (fromIndex >= state.steps.length || toIndex >= state.steps.length) return;
      state.hasLocalEdits = true;
      const [moved] = state.steps.splice(fromIndex, 1);
      state.steps.splice(toIndex, 0, moved);
      const prev = state.currentPage;
      if (prev === fromIndex) state.currentPage = toIndex;
      else if (fromIndex < toIndex && prev > fromIndex && prev <= toIndex) state.currentPage = prev - 1;
      else if (fromIndex > toIndex && prev < fromIndex && prev >= toIndex) state.currentPage = prev + 1;
    },
    markSaved(state) {
      state.hasLocalEdits = false;
    },
  },
});

export const sceneActions = sceneSlice.actions;
export const sceneReducer = sceneSlice.reducer;

