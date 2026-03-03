import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type ScriptUiState = {
  showRequisites: boolean;
  showPlaylistSidebar: boolean;
  showHeaderSounds: boolean;
  isStepsCollapsed: boolean;
  /** Панель "Роли в сцене" (StepRolesPanel) */
  showStepRoles: boolean;

  /** Режим редактирования (не persist'им) */
  isEditing: boolean;
  /** Перестановка панелей в театре (не persist'им, как и раньше) */
  swapTheaterPanels: boolean;
};

function storedBool(key: string, defaultValue: boolean): boolean {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? stored === "true" : defaultValue;
  } catch {
    return defaultValue;
  }
}

function persistBooleans(state: ScriptUiState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("showRequisites", String(state.showRequisites));
    localStorage.setItem("showPlaylistSidebar", String(state.showPlaylistSidebar));
    localStorage.setItem("showHeaderSounds", String(state.showHeaderSounds));
    localStorage.setItem("isStepsCollapsed", String(state.isStepsCollapsed));
    localStorage.setItem("showStepRoles", String(state.showStepRoles));
  } catch {
    // ignore
  }
}

function defaultState(): ScriptUiState {
  return {
    showRequisites: true,
    showPlaylistSidebar: true,
    showHeaderSounds: true,
    isStepsCollapsed: false,
    showStepRoles: true,
    isEditing: false,
    swapTheaterPanels: true,
  };
}

function initialStateFromStorage(): ScriptUiState {
  const base = defaultState();
  return {
    ...base,
    showRequisites: storedBool("showRequisites", base.showRequisites),
    showPlaylistSidebar: storedBool("showPlaylistSidebar", base.showPlaylistSidebar),
    showHeaderSounds: storedBool("showHeaderSounds", base.showHeaderSounds),
    isStepsCollapsed: storedBool("isStepsCollapsed", base.isStepsCollapsed),
    showStepRoles: storedBool("showStepRoles", base.showStepRoles),
  };
}

export const scriptUiSlice = createSlice({
  name: "scriptUi",
  initialState: initialStateFromStorage(),
  reducers: {
    initScriptUi(state) {
      const base = defaultState();
      state.showRequisites = storedBool("showRequisites", base.showRequisites);
      state.showPlaylistSidebar = storedBool("showPlaylistSidebar", base.showPlaylistSidebar);
      state.showHeaderSounds = storedBool("showHeaderSounds", base.showHeaderSounds);
      state.isStepsCollapsed = storedBool("isStepsCollapsed", base.isStepsCollapsed);
      state.showStepRoles = storedBool("showStepRoles", base.showStepRoles);
      // Non-persisted fields should be reset on init (matches previous behavior)
      state.isEditing = false;
      state.swapTheaterPanels = true;
      persistBooleans(state);
    },

    setShowRequisites(state, action: PayloadAction<{ value: boolean }>) {
      state.showRequisites = Boolean(action.payload.value);
      persistBooleans(state);
    },
    toggleRequisites(state) {
      state.showRequisites = !state.showRequisites;
      persistBooleans(state);
    },

    setShowPlaylistSidebar(state, action: PayloadAction<{ value: boolean }>) {
      state.showPlaylistSidebar = Boolean(action.payload.value);
      persistBooleans(state);
    },
    togglePlaylist(state) {
      state.showPlaylistSidebar = !state.showPlaylistSidebar;
      persistBooleans(state);
    },

    setShowHeaderSounds(state, action: PayloadAction<{ value: boolean }>) {
      state.showHeaderSounds = Boolean(action.payload.value);
      persistBooleans(state);
    },
    toggleHeaderSounds(state) {
      state.showHeaderSounds = !state.showHeaderSounds;
      persistBooleans(state);
    },

    setIsStepsCollapsed(state, action: PayloadAction<{ value: boolean }>) {
      state.isStepsCollapsed = Boolean(action.payload.value);
      persistBooleans(state);
    },
    toggleStepsCollapsed(state) {
      state.isStepsCollapsed = !state.isStepsCollapsed;
      persistBooleans(state);
    },

    setShowStepRoles(state, action: PayloadAction<{ value: boolean }>) {
      state.showStepRoles = Boolean(action.payload.value);
      persistBooleans(state);
    },
    toggleStepRoles(state) {
      state.showStepRoles = !state.showStepRoles;
      persistBooleans(state);
    },

    setIsEditing(state, action: PayloadAction<{ value: boolean }>) {
      state.isEditing = Boolean(action.payload.value);
    },
    toggleEditing(state) {
      state.isEditing = !state.isEditing;
    },

    setSwapTheaterPanels(state, action: PayloadAction<{ value: boolean }>) {
      state.swapTheaterPanels = Boolean(action.payload.value);
    },
    togglePanels(state) {
      state.swapTheaterPanels = !state.swapTheaterPanels;
    },
  },
});

export const scriptUiActions = scriptUiSlice.actions;
export const selectScriptUi = (s: RootState) => s.scriptUi;
