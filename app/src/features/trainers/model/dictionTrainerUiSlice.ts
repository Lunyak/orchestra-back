import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";

export type DictionExercise = {
  id: string;
  title: string;
  text: string;
  level: 1 | 2 | 3;
};

export type DictionAttempt = {
  id: string;
  exerciseId: string;
  finishedAtIso: string;
  durationMs: number;
  note?: string;
};

export type DictionTrainerUiState = {
  selectedLevel: 1 | 2 | 3 | "all";
  selectedExerciseId: string;
  showText: boolean;
  attempts: DictionAttempt[];
};

const EXERCISES: DictionExercise[] = [
  {
    id: "shla-sasha",
    title: "Шла Саша",
    text: "Шла Саша по шоссе и сосала сушку.",
    level: 1,
  },
  {
    id: "korabliki",
    title: "Корабли лавировали",
    text: "Корабли лавировали, лавировали, да не вылавировали.",
    level: 2,
  },
  {
    id: "dvore-drov",
    title: "Дрова во дворе",
    text: "На дворе трава, на траве дрова. Не руби дрова на траве двора.",
    level: 2,
  },
  {
    id: "ot-topota",
    title: "От топота",
    text: "От топота копыт пыль по полю летит.",
    level: 1,
  },
  {
    id: "ks-ksts",
    title: "КС/КСТС",
    text: "Съешь ещё этих мягких французских булок, да выпей чаю.",
    level: 3,
  },
  {
    id: "s-sh",
    title: "С/Ш",
    text: "Шестнадцать шли мышей и шесть нашли грошей.",
    level: 3,
  },
];

function storageKey() {
  return "trainers:diction:ui";
}

function safeParse(raw: string | null): any {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persist(state: DictionTrainerUiState) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(), JSON.stringify(state));
  } catch {
    // ignore
  }
}

function defaultState(): DictionTrainerUiState {
  return {
    selectedLevel: "all",
    selectedExerciseId: EXERCISES[0]?.id ?? "",
    showText: true,
    attempts: [],
  };
}

function normalizeAttempt(raw: any): DictionAttempt | null {
  const exerciseId = String(raw?.exerciseId ?? "").trim();
  const finishedAtIso = String(raw?.finishedAtIso ?? "").trim();
  const durationMs = Number(raw?.durationMs ?? 0);
  const id = String(raw?.id ?? "").trim();
  if (!id || !exerciseId || !finishedAtIso) return null;
  if (!Number.isFinite(durationMs) || durationMs < 0) return null;
  const note = typeof raw?.note === "string" ? raw.note : undefined;
  return { id, exerciseId, finishedAtIso, durationMs, note };
}

export const dictionTrainerUiSlice = createSlice({
  name: "dictionTrainerUi",
  initialState: defaultState(),
  reducers: {
    initDictionTrainerUi(state) {
      if (typeof window === "undefined") return;
      const parsed = safeParse(localStorage.getItem(storageKey()));
      const base = defaultState();
      const next: DictionTrainerUiState = {
        ...base,
        selectedLevel:
          parsed?.selectedLevel === 1 || parsed?.selectedLevel === 2 || parsed?.selectedLevel === 3
            ? parsed.selectedLevel
            : parsed?.selectedLevel === "all"
              ? "all"
              : base.selectedLevel,
        selectedExerciseId:
          typeof parsed?.selectedExerciseId === "string" && parsed.selectedExerciseId.trim()
            ? parsed.selectedExerciseId
            : base.selectedExerciseId,
        showText: typeof parsed?.showText === "boolean" ? parsed.showText : base.showText,
        attempts: Array.isArray(parsed?.attempts)
          ? parsed.attempts.map(normalizeAttempt).filter(Boolean).slice(-50)
          : base.attempts,
      };
      state.selectedLevel = next.selectedLevel;
      state.selectedExerciseId = next.selectedExerciseId;
      state.showText = next.showText;
      state.attempts = next.attempts;
      persist(next);
    },
    setDictionSelectedLevel(state, action: PayloadAction<{ value: 1 | 2 | 3 | "all" }>) {
      const v = action.payload.value;
      state.selectedLevel = v === 1 || v === 2 || v === 3 || v === "all" ? v : "all";
      persist(state);
    },
    setDictionSelectedExercise(state, action: PayloadAction<{ value: string }>) {
      const id = String(action.payload.value ?? "").trim();
      if (!id) return;
      state.selectedExerciseId = id;
      persist(state);
    },
    setDictionShowText(state, action: PayloadAction<{ value: boolean }>) {
      state.showText = Boolean(action.payload.value);
      persist(state);
    },
    addDictionAttempt(state, action: PayloadAction<{ attempt: DictionAttempt }>) {
      state.attempts = [...(state.attempts ?? []), action.payload.attempt].slice(-50);
      persist(state);
    },
    clearDictionAttempts(state) {
      state.attempts = [];
      persist(state);
    },
  },
});

export const dictionTrainerUiActions = dictionTrainerUiSlice.actions;
export const dictionTrainerUiReducer = dictionTrainerUiSlice.reducer;

export function selectDictionExercises(): DictionExercise[] {
  return EXERCISES;
}

export function selectDictionTrainerUi(state: RootState): DictionTrainerUiState {
  return (state as any).dictionTrainerUi ?? defaultState();
}

