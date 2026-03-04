import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { getDirectorSessions, type DirectorSession } from "../../../sync/api";
import dayjs from "dayjs";

export type CalendarSectionState = {
  currentMonthIso: string;
  selectedDate: string;
  monthStartIso: string;
  monthEndIso: string;
  fromIso: string;
  toIso: string;
};

export type ProfileAvailabilityState = {
  calendarState: CalendarSectionState;
  byRangeKey: Record<string, DirectorSession[] | undefined>;
  loading: boolean;
  error: string | null;
  activeRangeKey: string;
};

function defaultCalendarState(): CalendarSectionState {
  const now = new Date();
  const monthStartDate = dayjs(now).startOf("month").toDate();
  const monthEndDate = dayjs(now).endOf("month").toDate();
  return {
    currentMonthIso: now.toISOString(),
    selectedDate: dayjs(now).format("YYYY-MM-DD"),
    monthStartIso: monthStartDate.toISOString(),
    monthEndIso: monthEndDate.toISOString(),
    fromIso: monthStartDate.toISOString(),
    toIso: monthEndDate.toISOString(),
  };
}

function rangeKey(fromIso: string, toIso: string) {
  return [String(fromIso ?? ""), String(toIso ?? "")].join("|");
}

const initialState: ProfileAvailabilityState = {
  calendarState: defaultCalendarState(),
  byRangeKey: {},
  loading: false,
  error: null,
  activeRangeKey: "",
};

export const loadSessionsForRangeThunk = createAsyncThunk<
  { rangeKey: string; sessions: DirectorSession[] },
  { accessToken: string; fromIso: string; toIso: string },
  { state: RootState; rejectValue: string }
>(
  "profileAvailability/loadSessionsForRange",
  async ({ accessToken, fromIso, toIso }, { rejectWithValue }) => {
    try {
      const res = await getDirectorSessions(accessToken);
      const fromMs = new Date(fromIso).getTime();
      const toMs = new Date(toIso).getTime();
      const sessions = (res.sessions ?? [])
        .filter(Boolean)
        .filter((s: any) => {
          const t = new Date(String(s?.startsAt ?? "")).getTime();
          if (!Number.isFinite(t)) return false;
          if (Number.isFinite(fromMs) && t < fromMs) return false;
          if (Number.isFinite(toMs) && t > toMs) return false;
          return true;
        }) as DirectorSession[];
      return { rangeKey: rangeKey(fromIso, toIso), sessions };
    } catch {
      return rejectWithValue("Не удалось загрузить события сессий");
    }
  },
  {
    condition: ({ fromIso, toIso }, { getState }) => {
      const s = (getState() as any).profileAvailability as ProfileAvailabilityState | undefined;
      if (!s) return true;
      if (s.loading) return false;
      const key = rangeKey(fromIso, toIso);
      if (s.byRangeKey[key]) return false;
      return true;
    },
  },
);

export const profileAvailabilitySlice = createSlice({
  name: "profileAvailability",
  initialState,
  reducers: {
    setProfileCalendarState(state, action: PayloadAction<{ value: any }>) {
      const v = action.payload.value ?? {};
      const currentMonth = v?.currentMonth instanceof Date ? v.currentMonth : new Date(v?.currentMonthIso ?? Date.now());
      const monthStartDate = v?.monthStartDate instanceof Date ? v.monthStartDate : new Date(v?.monthStartIso ?? Date.now());
      const monthEndDate = v?.monthEndDate instanceof Date ? v.monthEndDate : new Date(v?.monthEndIso ?? Date.now());
      const selectedDate = String(v?.selectedDate ?? "").trim();
      const fromIso = String(v?.fromIso ?? monthStartDate.toISOString()).trim();
      const toIso = String(v?.toIso ?? monthEndDate.toISOString()).trim();
      state.calendarState = {
        currentMonthIso: currentMonth.toISOString(),
        selectedDate: /^\d{4}-\d{2}-\d{2}$/.test(selectedDate) ? selectedDate : dayjs(currentMonth).format("YYYY-MM-DD"),
        monthStartIso: monthStartDate.toISOString(),
        monthEndIso: monthEndDate.toISOString(),
        fromIso,
        toIso,
      };
    },
    setActiveRangeKey(state, action: PayloadAction<{ value: string }>) {
      state.activeRangeKey = String(action.payload.value ?? "");
    },
    clearAvailabilityError(state) {
      state.error = null;
    },
  },
  extraReducers: (b) => {
    b.addCase(loadSessionsForRangeThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    b.addCase(loadSessionsForRangeThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.error = null;
      state.byRangeKey[action.payload.rangeKey] = action.payload.sessions;
      state.activeRangeKey = action.payload.rangeKey;
    });
    b.addCase(loadSessionsForRangeThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload ?? "Не удалось загрузить события сессий";
    });
  },
});

export const profileAvailabilityActions = profileAvailabilitySlice.actions;
export const profileAvailabilityReducer = profileAvailabilitySlice.reducer;

export function selectProfileCalendarState(state: RootState): CalendarSectionState {
  return (state as any).profileAvailability?.calendarState ?? defaultCalendarState();
}

export function selectAvailabilitySessionsForActiveRange(state: RootState): DirectorSession[] {
  const s = (state as any).profileAvailability as ProfileAvailabilityState | undefined;
  if (!s) return [];
  const list = s.byRangeKey?.[s.activeRangeKey];
  return Array.isArray(list) ? list : [];
}

export function selectAvailabilityFlags(state: RootState) {
  const s = (state as any).profileAvailability as ProfileAvailabilityState | undefined;
  return {
    loading: Boolean(s?.loading),
    error: s?.error ?? null,
  };
}

