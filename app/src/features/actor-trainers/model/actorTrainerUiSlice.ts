import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type ActorTrainerMode = "dialogue" | "write" | "voice";

export type ActorTrainerUiState = {
  uiKey: string;
  trainerMode: ActorTrainerMode;
};

export type ActorTrainerUiSliceState = {
  byKey: Record<string, ActorTrainerUiState | undefined>;
};

const initialState: ActorTrainerUiSliceState = {
  byKey: {},
};

function storageKey(uiKey: string) {
  return `actorTrainer:pageUi:${uiKey}`;
}

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function normalizeTrainerMode(v: unknown): ActorTrainerMode {
  if (v === "cards") return "write";
  if (v === "dialogue" || v === "write" || v === "voice") return v;
  return "dialogue";
}

function defaultUi(uiKey: string): ActorTrainerUiState {
  return {
    uiKey,
    trainerMode: "dialogue",
  };
}

function persist(ui: ActorTrainerUiState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(ui.uiKey), JSON.stringify(ui));
  } catch {
    // ignore
  }
}

export const actorTrainerUiSlice = createSlice({
  name: "actorTrainerUi",
  initialState,
  reducers: {
    initActorTrainerUi(state, action: PayloadAction<{ uiKey: string }>) {
      const uiKey = String(action.payload.uiKey ?? "").trim();
      if (!uiKey) return;
      if (state.byKey[uiKey]) return;

      const raw = typeof window !== "undefined" ? localStorage.getItem(storageKey(uiKey)) : null;
      const parsed = safeParse(raw);
      const parsedObj = parsed && typeof parsed === "object" ? (parsed as any) : null;

      const base = defaultUi(uiKey);
      const next: ActorTrainerUiState = {
        ...base,
        uiKey,
        trainerMode: normalizeTrainerMode(parsedObj?.trainerMode ?? base.trainerMode),
      };

      state.byKey[uiKey] = next;
      persist(next);
    },
    setTrainerMode(state, action: PayloadAction<{ uiKey: string; value: ActorTrainerMode }>) {
      const uiKey = String(action.payload.uiKey ?? "").trim();
      if (!uiKey) return;
      const value = normalizeTrainerMode(action.payload.value);

      const entry = state.byKey[uiKey] ?? defaultUi(uiKey);
      const next: ActorTrainerUiState = { ...entry, uiKey, trainerMode: value };
      state.byKey[uiKey] = next;
      persist(next);
    },
  },
});

export const actorTrainerUiActions = actorTrainerUiSlice.actions;
export const actorTrainerUiReducer = actorTrainerUiSlice.reducer;

export function selectActorTrainerUi(state: RootState, uiKey: string): ActorTrainerUiState {
  const key = String(uiKey ?? "").trim();
  return state.actorTrainerUi?.byKey?.[key] ?? defaultUi(key);
}

export function selectActorTrainerMode(state: RootState, uiKey: string): ActorTrainerMode {
  return selectActorTrainerUi(state, uiKey).trainerMode;
}

