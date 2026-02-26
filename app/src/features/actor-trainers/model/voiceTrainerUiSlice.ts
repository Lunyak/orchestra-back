import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type VoiceTrainerCheckMode = "full" | "sentences";
export type PartnerVoiceSource =
  | { kind: "auto" }
  | { kind: "tts" }
  | { kind: "performer"; performerId: string };

export type VoiceTrainerUiState = {
  uiKey: string;
  autoFlow: boolean;
  checkMode: VoiceTrainerCheckMode;
  ttsVoiceName: string;
  recordTakes: boolean;
  partnerVoiceByRoleKey: Record<string, PartnerVoiceSource | undefined>;
};

export type VoiceTrainerUiSliceState = {
  byKey: Record<string, VoiceTrainerUiState | undefined>;
};

const initialState: VoiceTrainerUiSliceState = {
  byKey: {},
};

function storageKey(uiKey: string) {
  return `actorTrainer:voiceUi:${uiKey}`;
}

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persist(ui: VoiceTrainerUiState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(ui.uiKey), JSON.stringify(ui));
  } catch {
    // ignore
  }
}

function defaultUi(uiKey: string): VoiceTrainerUiState {
  // Backward-compat: reuse older global settings as a starting point.
  const legacyVoiceName =
    typeof window !== "undefined" ? localStorage.getItem("voiceDialogue:ttsVoiceName") : null;
  const legacyCheckMode =
    typeof window !== "undefined" ? localStorage.getItem("voiceDialogue:checkMode") : null;
  const legacyAutoFlow =
    typeof window !== "undefined" ? localStorage.getItem("voiceDialogue:autoFlow") : null;
  return {
    uiKey,
    autoFlow: legacyAutoFlow == null ? true : legacyAutoFlow === "true",
    checkMode: legacyCheckMode === "sentences" ? "sentences" : "full",
    ttsVoiceName: legacyVoiceName || "auto",
    recordTakes: true,
    partnerVoiceByRoleKey: {},
  };
}

export const voiceTrainerUiSlice = createSlice({
  name: "voiceTrainerUi",
  initialState,
  reducers: {
    initVoiceTrainerUi(state, action: PayloadAction<{ uiKey: string }>) {
      const uiKey = String(action.payload.uiKey ?? "").trim();
      if (!uiKey) return;
      if (state.byKey[uiKey]) return;
      const raw =
        typeof window !== "undefined" ? localStorage.getItem(storageKey(uiKey)) : null;
      const parsed = safeParse(raw);
      const base = defaultUi(uiKey);
      const parsedObj = parsed && typeof parsed === "object" ? (parsed as any) : null;
      const checkMode: VoiceTrainerCheckMode =
        parsedObj?.checkMode === "sentences" ? "sentences" : "full";
      const partnerVoiceByRoleKey: Record<string, PartnerVoiceSource | undefined> = {};
      const rawPartner = parsedObj?.partnerVoiceByRoleKey;
      if (rawPartner && typeof rawPartner === "object") {
        for (const [rk, v] of Object.entries(rawPartner as Record<string, any>)) {
          const roleKey = String(rk ?? "").trim();
          if (!roleKey) continue;
          const kind = String((v as any)?.kind ?? "");
          if (kind === "tts") partnerVoiceByRoleKey[roleKey] = { kind: "tts" };
          else if (kind === "auto") partnerVoiceByRoleKey[roleKey] = { kind: "auto" };
          else if (kind === "performer") {
            const pid = String((v as any)?.performerId ?? "").trim();
            if (pid) partnerVoiceByRoleKey[roleKey] = { kind: "performer", performerId: pid };
          }
        }
      }

      const next: VoiceTrainerUiState = {
        ...base,
        uiKey,
        autoFlow: typeof parsedObj?.autoFlow === "boolean" ? parsedObj.autoFlow : base.autoFlow,
        checkMode,
        ttsVoiceName:
          typeof parsedObj?.ttsVoiceName === "string" && parsedObj.ttsVoiceName.trim()
            ? parsedObj.ttsVoiceName
            : base.ttsVoiceName,
        recordTakes:
          typeof parsedObj?.recordTakes === "boolean" ? parsedObj.recordTakes : base.recordTakes,
        partnerVoiceByRoleKey,
      };
      state.byKey[uiKey] = next;
      persist(next);
    },
    setVoiceAutoFlow(state, action: PayloadAction<{ uiKey: string; value: boolean }>) {
      const { uiKey, value } = action.payload;
      const entry = state.byKey[uiKey] ?? defaultUi(uiKey);
      const next = { ...entry, autoFlow: Boolean(value) };
      state.byKey[uiKey] = next;
      persist(next);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("voiceDialogue:autoFlow", String(next.autoFlow));
        } catch {}
      }
    },
    setVoiceCheckMode(
      state,
      action: PayloadAction<{ uiKey: string; value: VoiceTrainerCheckMode }>,
    ) {
      const { uiKey, value } = action.payload;
      const entry = state.byKey[uiKey] ?? defaultUi(uiKey);
      const next: VoiceTrainerUiState = {
        ...entry,
        checkMode: (value === "sentences" ? "sentences" : "full") as VoiceTrainerCheckMode,
      };
      state.byKey[uiKey] = next;
      persist(next);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("voiceDialogue:checkMode", next.checkMode);
        } catch {}
      }
    },
    setVoiceTtsVoiceName(state, action: PayloadAction<{ uiKey: string; value: string }>) {
      const { uiKey, value } = action.payload;
      const entry = state.byKey[uiKey] ?? defaultUi(uiKey);
      const next = { ...entry, ttsVoiceName: String(value ?? "auto") || "auto" };
      state.byKey[uiKey] = next;
      persist(next);
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("voiceDialogue:ttsVoiceName", next.ttsVoiceName);
        } catch {}
      }
    },
    setVoiceRecordTakes(state, action: PayloadAction<{ uiKey: string; value: boolean }>) {
      const { uiKey, value } = action.payload;
      const entry = state.byKey[uiKey] ?? defaultUi(uiKey);
      const next = { ...entry, recordTakes: Boolean(value) };
      state.byKey[uiKey] = next;
      persist(next);
    },
    setPartnerVoiceSourceForRole(
      state,
      action: PayloadAction<{ uiKey: string; roleKey: string; source: PartnerVoiceSource }>,
    ) {
      const { uiKey, roleKey, source } = action.payload;
      const entry = state.byKey[uiKey] ?? defaultUi(uiKey);
      const next = {
        ...entry,
        partnerVoiceByRoleKey: {
          ...(entry.partnerVoiceByRoleKey ?? {}),
          [String(roleKey ?? "").trim()]: source,
        },
      };
      state.byKey[uiKey] = next;
      persist(next);
    },
  },
});

export const voiceTrainerUiActions = voiceTrainerUiSlice.actions;
export const voiceTrainerUiReducer = voiceTrainerUiSlice.reducer;

export function selectVoiceTrainerUi(state: RootState, uiKey: string): VoiceTrainerUiState {
  const key = String(uiKey ?? "").trim();
  return state.voiceTrainerUi?.byKey?.[key] ?? defaultUi(key);
}

