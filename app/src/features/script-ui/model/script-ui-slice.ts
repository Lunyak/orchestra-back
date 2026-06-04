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
  /** Редактирование плейлиста: fade, loop, порядок, подготовка (не persist'им) */
  playlistEditMode: boolean;
  /** Кроссфейд между треками плейлиста (list + player instance) */
  playlistCrossfadeEnabled: boolean;
  /** Перестановка панелей в театре (persist per-project в theater-view-prefs). */
  swapTheaterPanels: boolean;
  /** Правая панель настроек 3D-театра (persist per-project в theater-view-prefs). */
  showTheaterControls: boolean;
  /** Скрыть текст шага на странице «Репетиция» (/light-plot). */
  spectacleRunTextHidden: boolean;
};

const SPECTACLE_RUN_TEXT_HIDDEN_KEY = "orchestra-spectacle-run-text-hidden";

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
    localStorage.setItem(
      "playlistCrossfadeEnabled",
      String(state.playlistCrossfadeEnabled),
    );
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
    playlistEditMode: false,
    playlistCrossfadeEnabled: false,
    swapTheaterPanels: false,
    showTheaterControls: true,
    spectacleRunTextHidden: false,
  };
}

function persistSpectacleRunTextHidden(hidden: boolean) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SPECTACLE_RUN_TEXT_HIDDEN_KEY, hidden ? "1" : "0");
  } catch {
    // ignore
  }
}

function initialStateFromStorage(): ScriptUiState {
  const base = defaultState();
  return {
    ...base,
    showPlaylistSidebar: storedBool("showPlaylistSidebar", base.showPlaylistSidebar),
    showHeaderSounds: storedBool("showHeaderSounds", base.showHeaderSounds),
    isStepsCollapsed: storedBool("isStepsCollapsed", base.isStepsCollapsed),
    playlistCrossfadeEnabled: storedBool(
      "playlistCrossfadeEnabled",
      base.playlistCrossfadeEnabled,
    ),
    spectacleRunTextHidden: (() => {
      if (typeof window === "undefined") return base.spectacleRunTextHidden;
      try {
        return localStorage.getItem(SPECTACLE_RUN_TEXT_HIDDEN_KEY) === "1";
      } catch {
        return base.spectacleRunTextHidden;
      }
    })(),
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
      state.playlistCrossfadeEnabled = storedBool(
        "playlistCrossfadeEnabled",
        base.playlistCrossfadeEnabled,
      );
      if (typeof window !== "undefined") {
        try {
          state.spectacleRunTextHidden =
            localStorage.getItem(SPECTACLE_RUN_TEXT_HIDDEN_KEY) === "1";
        } catch {
          state.spectacleRunTextHidden = base.spectacleRunTextHidden;
        }
      }
      // Эфемерные поля — сброс при init; theater-панели восстанавливаются в useSpectaclePage.
      state.mobilePlaylistOpen = false;
      state.mobileStepsOpen = false;
      state.isEditing = false;
      state.playlistEditMode = false;
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

    setPlaylistEditMode(state, action: PayloadAction<{ value: boolean }>) {
      state.playlistEditMode = Boolean(action.payload.value);
    },
    togglePlaylistEditMode(state) {
      state.playlistEditMode = !state.playlistEditMode;
    },

    setPlaylistCrossfadeEnabled(state, action: PayloadAction<{ value: boolean }>) {
      state.playlistCrossfadeEnabled = Boolean(action.payload.value);
      persistBooleans(state);
    },
    togglePlaylistCrossfade(state) {
      state.playlistCrossfadeEnabled = !state.playlistCrossfadeEnabled;
      persistBooleans(state);
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

    setSpectacleRunTextHidden(state, action: PayloadAction<{ value: boolean }>) {
      state.spectacleRunTextHidden = Boolean(action.payload.value);
      persistSpectacleRunTextHidden(state.spectacleRunTextHidden);
    },
    toggleSpectacleRunTextHidden(state) {
      state.spectacleRunTextHidden = !state.spectacleRunTextHidden;
      persistSpectacleRunTextHidden(state.spectacleRunTextHidden);
    },
  },
});

export const scriptUiActions = scriptUiSlice.actions;
export const selectScriptUi = (s: RootState) => s.scriptUi;
