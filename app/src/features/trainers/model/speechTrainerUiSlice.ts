import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type SpeechMode = "breathing" | "reading";

export type ReadingPresetId = "base" | "stage" | "news";

export type SpeechTrainerUiState = {
  mode: SpeechMode;
  showText: boolean;
  presetId: ReadingPresetId;
  showPauses: boolean;
  showStresses: boolean;
  metronomeOn: boolean;
  metronomeBpm: number;
};

function storageKey() {
  return "trainers:speech:ui";
}

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persist(state: SpeechTrainerUiState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function defaultState(): SpeechTrainerUiState {
  return {
    mode: "breathing",
    showText: true,
    presetId: "base",
    showPauses: true,
    showStresses: false,
    metronomeOn: false,
    metronomeBpm: 72,
  };
}

function isMode(v: unknown): v is SpeechMode {
  return v === "breathing" || v === "reading";
}

function isPreset(v: unknown): v is ReadingPresetId {
  return v === "base" || v === "stage" || v === "news";
}

export const speechTrainerUiSlice = createSlice({
  name: "speechTrainerUi",
  initialState: defaultState(),
  reducers: {
    initSpeechTrainerUi(state) {
      if (typeof window === "undefined") return;
      const parsed = safeParse(localStorage.getItem(storageKey()));
      const base = defaultState();
      const bpmRaw = Number(parsed?.metronomeBpm ?? base.metronomeBpm);
      const bpm = Number.isFinite(bpmRaw) ? Math.max(30, Math.min(220, Math.round(bpmRaw))) : base.metronomeBpm;
      const next: SpeechTrainerUiState = {
        ...base,
        mode: isMode(parsed?.mode) ? parsed.mode : base.mode,
        showText: typeof parsed?.showText === "boolean" ? parsed.showText : base.showText,
        presetId: isPreset(parsed?.presetId) ? parsed.presetId : base.presetId,
        showPauses: typeof parsed?.showPauses === "boolean" ? parsed.showPauses : base.showPauses,
        showStresses: typeof parsed?.showStresses === "boolean" ? parsed.showStresses : base.showStresses,
        metronomeOn: typeof parsed?.metronomeOn === "boolean" ? parsed.metronomeOn : base.metronomeOn,
        metronomeBpm: bpm,
      };
      state.mode = next.mode;
      state.showText = next.showText;
      state.presetId = next.presetId;
      state.showPauses = next.showPauses;
      state.showStresses = next.showStresses;
      state.metronomeOn = next.metronomeOn;
      state.metronomeBpm = next.metronomeBpm;
      persist(next);
    },
    setSpeechMode(state, action: PayloadAction<{ value: SpeechMode }>) {
      state.mode = isMode(action.payload.value) ? action.payload.value : "breathing";
      persist(state);
    },
    setSpeechShowText(state, action: PayloadAction<{ value: boolean }>) {
      state.showText = Boolean(action.payload.value);
      persist(state);
    },
    setSpeechPresetId(state, action: PayloadAction<{ value: ReadingPresetId }>) {
      state.presetId = isPreset(action.payload.value) ? action.payload.value : "base";
      persist(state);
    },
    setSpeechShowPauses(state, action: PayloadAction<{ value: boolean }>) {
      state.showPauses = Boolean(action.payload.value);
      persist(state);
    },
    setSpeechShowStresses(state, action: PayloadAction<{ value: boolean }>) {
      state.showStresses = Boolean(action.payload.value);
      persist(state);
    },
    setSpeechMetronomeOn(state, action: PayloadAction<{ value: boolean }>) {
      state.metronomeOn = Boolean(action.payload.value);
      persist(state);
    },
    setSpeechMetronomeBpm(state, action: PayloadAction<{ value: number }>) {
      const v = Number(action.payload.value ?? 72);
      state.metronomeBpm = Number.isFinite(v) ? Math.max(30, Math.min(220, Math.round(v))) : 72;
      persist(state);
    },
  },
});

export const speechTrainerUiActions = speechTrainerUiSlice.actions;
export const speechTrainerUiReducer = speechTrainerUiSlice.reducer;

export function selectSpeechTrainerUi(state: RootState): SpeechTrainerUiState {
  return (state as any).speechTrainerUi ?? defaultState();
}

