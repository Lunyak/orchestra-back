import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { ensureDirectorSessionsProject } from "../../../features/director-sessions/directorSessionsSync";
import {
  getDirectorSessionInvitations,
  getDirectorSessions,
  type DirectorSession,
} from "../../../sync/api/director-sessions";
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

/** Ключ кэша сессий в занятости (суффикс при смене схемы — сброс старых данных без приглашений). */
export function profileAvailabilityCacheKey(fromIso: string, toIso: string) {
  return [String(fromIso ?? "").trim(), String(toIso ?? "").trim(), "v4inv"].join("|");
}

const initialState: ProfileAvailabilityState = {
  calendarState: defaultCalendarState(),
  byRangeKey: {},
  loading: false,
  error: null,
};

export const loadSessionsForRangeThunk = createAsyncThunk<
  { rangeKey: string; sessions: DirectorSession[] },
  { accessToken: string; fromIso: string; toIso: string },
  { state: RootState; rejectValue: string }
>(
  "profileAvailability/loadSessionsForRange",
  async ({ accessToken, fromIso, toIso }, { rejectWithValue }) => {
    try {
      await ensureDirectorSessionsProject(accessToken);
      const ownRes = await getDirectorSessions(accessToken);
      let invited: any[] = [];
      try {
        const invRes = await getDirectorSessionInvitations(accessToken, fromIso, toIso);
        invited = invRes.sessions ?? [];
      } catch (e) {
        console.warn(
          "[profileAvailability] director-sessions/invitations failed (свои сессии всё равно загружены):",
          e,
        );
      }
      const byId = new Map<string, DirectorSession>();
      for (const s of ownRes.sessions ?? []) {
        const id = String((s as any)?.id ?? "").trim();
        if (id) byId.set(id, s as DirectorSession);
      }
      for (const s of invited) {
        const id = String((s as any)?.id ?? "").trim();
        if (id && !byId.has(id)) byId.set(id, s as DirectorSession);
      }
      const merged = Array.from(byId.values());
      const fromMs = new Date(fromIso).getTime();
      const toMs = new Date(toIso).getTime();
      const sessions = merged
        .filter(Boolean)
        .filter((s: any) => {
          const t = new Date(String(s?.startsAt ?? "")).getTime();
          if (!Number.isFinite(t)) return false;
          if (Number.isFinite(fromMs) && t < fromMs) return false;
          if (Number.isFinite(toMs) && t > toMs) return false;
          return true;
        }) as DirectorSession[];
      return { rangeKey: profileAvailabilityCacheKey(fromIso, toIso), sessions };
    } catch {
      return rejectWithValue("Не удалось загрузить события сессий");
    }
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
  const { fromIso, toIso } = s.calendarState ?? defaultCalendarState();
  const key = profileAvailabilityCacheKey(fromIso, toIso);
  const list = s.byRangeKey?.[key];
  return Array.isArray(list) ? list : [];
}

export function selectAvailabilityFlags(state: RootState) {
  const s = (state as any).profileAvailability as ProfileAvailabilityState | undefined;
  return {
    loading: Boolean(s?.loading),
    error: s?.error ?? null,
  };
}

