import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type LightPlotMode = "rehearsal" | "prog-run";

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

  /** Режим редактирования сценария (persist в localStorage). */
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
  /** Режим страницы /light-plot: пошаговая репетиция или прогон. */
  lightPlotMode: LightPlotMode;
};

const SPECTACLE_RUN_TEXT_HIDDEN_KEY = "orchestra-spectacle-run-text-hidden";
const LIGHT_PLOT_MODE_KEY = "orchestra-light-plot-mode";

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
    localStorage.setItem("isEditing", String(state.isEditing));
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
    lightPlotMode: "rehearsal",
  };
}

function storedLightPlotMode(defaultValue: LightPlotMode): LightPlotMode {
  if (typeof window === "undefined") return defaultValue;
  try {
    const stored = localStorage.getItem(LIGHT_PLOT_MODE_KEY);
    return stored === "prog-run" ? "prog-run" : defaultValue;
  } catch {
    return defaultValue;
  }
}

function persistLightPlotMode(mode: LightPlotMode) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LIGHT_PLOT_MODE_KEY, mode);
  } catch {
    // ignore
  }
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
    isEditing: storedBool("isEditing", base.isEditing),
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
    lightPlotMode: storedLightPlotMode(base.lightPlotMode),
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
      state.isEditing = storedBool("isEditing", base.isEditing);
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
        state.lightPlotMode = storedLightPlotMode(base.lightPlotMode);
      }
      // Эфемерные поля — сброс при init; theater-панели восстанавливаются в useSpectaclePage.
      state.mobilePlaylistOpen = false;
      state.mobileStepsOpen = false;
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
      persistBooleans(state);
    },
    toggleEditing(state) {
      state.isEditing = !state.isEditing;
      persistBooleans(state);
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

    setLightPlotMode(state, action: PayloadAction<{ mode: LightPlotMode }>) {
      const mode = action.payload.mode === "prog-run" ? "prog-run" : "rehearsal";
      state.lightPlotMode = mode;
      persistLightPlotMode(mode);
    },
  },
});

export const scriptUiActions = scriptUiSlice.actions;
export const selectScriptUi = (s: RootState) => s.scriptUi;
