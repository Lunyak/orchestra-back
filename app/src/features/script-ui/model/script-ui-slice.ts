import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type ScriptUiState = {
  showRequisites: boolean;
  showPlaylistSidebar: boolean;
  showHeaderSounds: boolean;
  isStepsCollapsed: boolean;
  /** Панель "Роли в сцене" (StepRolesPanel) */
  showStepRoles: boolean;
  /** Панель инструментов редактора сценария (музыка/свет) */
  showScriptEditorTools: boolean;

  /**
   * Мобильные оверлеи панелей (НЕ persist'им).
   * Нужны, чтобы на мобилке "контрольные кнопки" открывали панели,
   * не ломая сохранённые desktop-настройки.
   */
  mobilePlaylistOpen: boolean;
  mobileStepsOpen: boolean;

  /** Режим редактирования (не persist'им) */
  isEditing: boolean;
  /** Перестановка панелей в театре (persist per-project в theater-view-prefs). */
  swapTheaterPanels: boolean;
  /** Правая панель настроек 3D-театра (persist per-project в theater-view-prefs). */
  showTheaterControls: boolean;
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
    localStorage.setItem("showScriptEditorTools", String(state.showScriptEditorTools));
  } catch {
    // ignore
  }
}

function defaultState(): ScriptUiState {
  return {
    showRequisites: false,
    showPlaylistSidebar: true,
    showHeaderSounds: true,
    isStepsCollapsed: false,
    showStepRoles: false,
    showScriptEditorTools: false,
    mobilePlaylistOpen: false,
    mobileStepsOpen: false,
    isEditing: false,
    swapTheaterPanels: false,
    showTheaterControls: true,
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
    showScriptEditorTools: storedBool("showScriptEditorTools", base.showScriptEditorTools),
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
      state.showScriptEditorTools = storedBool("showScriptEditorTools", base.showScriptEditorTools);
      // Эфемерные поля — сброс при init; theater-панели восстанавливаются в useSpectaclePage.
      state.mobilePlaylistOpen = false;
      state.mobileStepsOpen = false;
      state.isEditing = false;
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

    setShowScriptEditorTools(state, action: PayloadAction<{ value: boolean }>) {
      state.showScriptEditorTools = Boolean(action.payload.value);
      persistBooleans(state);
    },
    toggleScriptEditorTools(state) {
      state.showScriptEditorTools = !state.showScriptEditorTools;
      persistBooleans(state);
    },

    setMobilePlaylistOpen(state, action: PayloadAction<{ value: boolean }>) {
      state.mobilePlaylistOpen = Boolean(action.payload.value);
    },
    toggleMobilePlaylist(state) {
      state.mobilePlaylistOpen = !state.mobilePlaylistOpen;
    },

    setMobileStepsOpen(state, action: PayloadAction<{ value: boolean }>) {
      state.mobileStepsOpen = Boolean(action.payload.value);
    },
    toggleMobileSteps(state) {
      state.mobileStepsOpen = !state.mobileStepsOpen;
    },

    closeMobilePanels(state) {
      state.mobilePlaylistOpen = false;
      state.mobileStepsOpen = false;
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
      if (state.swapTheaterPanels) {
        state.showTheaterControls = true;
      } else {
        state.showPlaylistSidebar = true;
      }
    },
    setShowTheaterControls(state, action: PayloadAction<{ value: boolean }>) {
      state.showTheaterControls = Boolean(action.payload.value);
    },
    toggleTheaterControls(state) {
      state.showTheaterControls = !state.showTheaterControls;
    },
  },
});

export const scriptUiActions = scriptUiSlice.actions;
export const selectScriptUi = (s: RootState) => s.scriptUi;
