import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { listRehearsals, type Rehearsal } from "../../../sync/api";
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
  byRangeKey: Record<string, Rehearsal[] | undefined>;
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

function rangeKey(projectName: string, fromIso: string, toIso: string) {
  return [String(projectName ?? ""), String(fromIso ?? ""), String(toIso ?? "")].join("|");
}

const initialState: ProfileAvailabilityState = {
  calendarState: defaultCalendarState(),
  byRangeKey: {},
  loading: false,
  error: null,
  activeRangeKey: "",
};

export const loadRehearsalsForRangeThunk = createAsyncThunk<
  { rangeKey: string; rehearsals: Rehearsal[] },
  { accessToken: string; projectName: string; fromIso: string; toIso: string },
  { state: RootState; rejectValue: string }
>(
  "profileAvailability/loadRehearsalsForRange",
  async ({ accessToken, projectName, fromIso, toIso }, { rejectWithValue }) => {
    try {
      const res = await listRehearsals(accessToken, projectName, fromIso, toIso);
      return { rangeKey: rangeKey(projectName, fromIso, toIso), rehearsals: res.rehearsals ?? [] };
    } catch {
      return rejectWithValue("Не удалось загрузить события репетиций");
    }
  },
  {
    condition: ({ projectName, fromIso, toIso }, { getState }) => {
      const s = (getState() as any).profileAvailability as ProfileAvailabilityState | undefined;
      if (!s) return true;
      if (s.loading) return false;
      const key = rangeKey(projectName, fromIso, toIso);
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
    b.addCase(loadRehearsalsForRangeThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    b.addCase(loadRehearsalsForRangeThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.error = null;
      state.byRangeKey[action.payload.rangeKey] = action.payload.rehearsals;
      state.activeRangeKey = action.payload.rangeKey;
    });
    b.addCase(loadRehearsalsForRangeThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload ?? "Не удалось загрузить события репетиций";
    });
  },
});

export const profileAvailabilityActions = profileAvailabilitySlice.actions;
export const profileAvailabilityReducer = profileAvailabilitySlice.reducer;

export function selectProfileCalendarState(state: RootState): CalendarSectionState {
  return (state as any).profileAvailability?.calendarState ?? defaultCalendarState();
}

export function selectAvailabilityRehearsalsForActiveRange(state: RootState): Rehearsal[] {
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

