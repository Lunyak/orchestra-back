import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type ScriptUiState = {
  showPlaylistSidebar: boolean;
  showHeaderSounds: boolean;
  isStepsCollapsed: boolean;

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
    localStorage.setItem("showPlaylistSidebar", String(state.showPlaylistSidebar));
    localStorage.setItem("showHeaderSounds", String(state.showHeaderSounds));
    localStorage.setItem("isStepsCollapsed", String(state.isStepsCollapsed));
  } catch {
    // ignore
  }
}

function defaultState(): ScriptUiState {
  return {
    showPlaylistSidebar: true,
    showHeaderSounds: true,
    isStepsCollapsed: false,
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
    showPlaylistSidebar: storedBool("showPlaylistSidebar", base.showPlaylistSidebar),
    showHeaderSounds: storedBool("showHeaderSounds", base.showHeaderSounds),
    isStepsCollapsed: storedBool("isStepsCollapsed", base.isStepsCollapsed),
  };
}

export const scriptUiSlice = createSlice({
  name: "scriptUi",
  initialState: initialStateFromStorage(),
  reducers: {
    initScriptUi(state) {
      const base = defaultState();
      state.showPlaylistSidebar = storedBool("showPlaylistSidebar", base.showPlaylistSidebar);
      state.showHeaderSounds = storedBool("showHeaderSounds", base.showHeaderSounds);
      state.isStepsCollapsed = storedBool("isStepsCollapsed", base.isStepsCollapsed);
      // Эфемерные поля — сброс при init; theater-панели восстанавливаются в useSpectaclePage.
      state.mobilePlaylistOpen = false;
      state.mobileStepsOpen = false;
      state.isEditing = false;
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
