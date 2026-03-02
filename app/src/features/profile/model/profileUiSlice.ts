import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type ProfileTabId = "profile" | "availability" | "trainers" | "roleWork";

export type ProfileUiState = {
  activeTab: ProfileTabId;
};

const initialState: ProfileUiState = {
  activeTab: "profile",
};

function storageKey() {
  return "profilePage:activeTab";
}

function isTabId(v: unknown): v is ProfileTabId {
  return v === "profile" || v === "availability" || v === "trainers" || v === "roleWork";
}

function persist(activeTab: ProfileTabId) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), activeTab);
  } catch {
    // ignore
  }
}

export const profileUiSlice = createSlice({
  name: "profileUi",
  initialState,
  reducers: {
    initProfileUi(state) {
      if (typeof window === "undefined") return;
      try {
        const raw = localStorage.getItem(storageKey());
        if (isTabId(raw)) state.activeTab = raw;
      } catch {
        // ignore
      }
    },
    setActiveProfileTab(state, action: PayloadAction<{ value: ProfileTabId }>) {
      const next = isTabId(action.payload.value) ? action.payload.value : "profile";
      state.activeTab = next;
      persist(next);
    },
  },
});

export const profileUiActions = profileUiSlice.actions;
export const profileUiReducer = profileUiSlice.reducer;

export function selectActiveProfileTab(state: RootState): ProfileTabId {
  return (state as any).profileUi?.activeTab ?? "profile";
}

