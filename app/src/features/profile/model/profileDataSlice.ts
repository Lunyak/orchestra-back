import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import {
  deleteMyProfile,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  type MyProfile,
} from "../../../sync/api/profile";

type AvailabilityStatus = "present" | "absent";
type AvailabilityTimeRange = { from: string; to: string };

export type ProfileDataState = {
  profile: MyProfile | null;
  form: Partial<MyProfile>;
  loadingProfile: boolean;
  saving: boolean;
  avatarUploading: boolean;
  deletingProfile: boolean;
  error: string | null;
  ok: string | null;
  loadedOnce: boolean;
};

const initialState: ProfileDataState = {
  profile: null,
  form: {},
  loadingProfile: false,
  saving: false,
  avatarUploading: false,
  deletingProfile: false,
  error: null,
  ok: null,
  loadedOnce: false,
};

function toMinutesHHMM(v: string): number | null {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23) return null;
  if (mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesToHHMM(min: number): string {
  const m = Math.max(0, Math.min(24 * 60, Math.floor(min)));
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function normalizePatchFromForm(form: Partial<MyProfile>): Partial<MyProfile> {
  const t = (v: unknown) => String(v ?? "").trim();

  const inputCalendar = (form as any)?.availabilityCalendar as
    | Record<string, AvailabilityStatus>
    | undefined;
  const cleanCalendar: Record<string, AvailabilityStatus> = {};
  if (inputCalendar && typeof inputCalendar === "object") {
    for (const [date, status] of Object.entries(inputCalendar)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (status === "present" || status === "absent") {
        cleanCalendar[date] = status;
      }
    }
  }

  const inputRanges = (form as any).availabilityTimeRanges as
    | Record<string, AvailabilityTimeRange[]>
    | undefined;
  const cleanRanges: Record<string, AvailabilityTimeRange[]> = {};
  if (inputRanges && typeof inputRanges === "object") {
    for (const [date, list] of Object.entries(inputRanges)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      if (!Array.isArray(list)) continue;
      const ranges: Array<{ a: number; b: number }> = [];
      for (const it of list.slice(0, 20)) {
        const from = toMinutesHHMM(String((it as any)?.from ?? ""));
        const to = toMinutesHHMM(String((it as any)?.to ?? ""));
        if (from == null || to == null) continue;
        if (from >= to) continue;
        ranges.push({ a: from, b: to });
      }
      if (ranges.length === 0) continue;
      ranges.sort((x, y) => x.a - y.a || x.b - y.b);
      const merged: Array<{ a: number; b: number }> = [];
      for (const r of ranges) {
        const last = merged[merged.length - 1];
        if (!last || r.a > last.b) merged.push({ ...r });
        else last.b = Math.max(last.b, r.b);
      }
      cleanRanges[date] = merged.map((r) => ({
        from: minutesToHHMM(r.a),
        to: minutesToHHMM(r.b),
      }));
    }
  }

  return {
    displayName: t((form as any).displayName),
    firstName: t((form as any).firstName),
    lastName: t((form as any).lastName),
    telegramUsername: t((form as any).telegramUsername),
    telegramId: t((form as any).telegramId),
    avatarUrl: t((form as any).avatarUrl),
    availabilityCalendar: cleanCalendar as any,
    availabilityTimeRanges: cleanRanges as any,
  } as Partial<MyProfile>;
}

export const fetchMyProfileThunk = createAsyncThunk<MyProfile, { accessToken: string }, { state: RootState }>(
  "profileData/fetchMyProfile",
  async ({ accessToken }) => {
    return await getMyProfile(accessToken);
  },
  {
    condition: ({ accessToken }, { getState }) => {
      if (!accessToken) return false;
      const s = (getState() as any).profileData as ProfileDataState | undefined;
      if (!s) return true;
      if (s.loadingProfile) return false;
      if (s.profile) return false;
      return true;
    },
  },
);

export const saveMyProfileThunk = createAsyncThunk<MyProfile, { accessToken: string }, { state: RootState }>(
  "profileData/saveMyProfile",
  async ({ accessToken }, { getState, rejectWithValue }) => {
    const state = getState() as any;
    const s = state.profileData as ProfileDataState | undefined;
    const form = s?.form ?? {};
    try {
      const patch = normalizePatchFromForm(form);
      return await updateMyProfile(accessToken, patch);
    } catch (e: any) {
      return rejectWithValue(e?.response?.data?.message ?? "Не удалось сохранить профиль");
    }
  },
  {
    condition: ({ accessToken }, { getState }) => {
      if (!accessToken) return false;
      const s = (getState() as any).profileData as ProfileDataState | undefined;
      if (!s) return true;
      if (s.saving) return false;
      return true;
    },
  },
);

export const uploadAvatarThunk = createAsyncThunk<
  MyProfile,
  { accessToken: string; file: File },
  { rejectValue: string }
>("profileData/uploadAvatar", async ({ accessToken, file }, { rejectWithValue }) => {
  try {
    return await uploadMyAvatar(accessToken, file);
  } catch (e: any) {
    return rejectWithValue(e?.response?.data?.message ?? "Не удалось загрузить аватар");
  }
});

export const deleteProfileDataThunk = createAsyncThunk<
  MyProfile,
  { accessToken: string },
  { rejectValue: string }
>("profileData/deleteProfileData", async ({ accessToken }, { rejectWithValue }) => {
  try {
    await deleteMyProfile(accessToken);
    return await getMyProfile(accessToken);
  } catch (e: any) {
    return rejectWithValue(e?.response?.data?.message ?? "Не удалось удалить профиль");
  }
});

export const profileDataSlice = createSlice({
  name: "profileData",
  initialState,
  reducers: {
    clearProfileMessages(state) {
      state.error = null;
      state.ok = null;
    },
    setProfileFormField(
      state,
      action: PayloadAction<{ key: keyof MyProfile; value: unknown }>,
    ) {
      const key = action.payload.key;
      (state.form as any)[key] = action.payload.value as any;
    },
    initProfileFormFromProfile(state) {
      const p = state.profile;
      state.form = {
        displayName: p?.displayName ?? "",
        firstName: p?.firstName ?? "",
        lastName: p?.lastName ?? "",
        telegramUsername: p?.telegramUsername ?? "",
        telegramId: p?.telegramId ?? "",
        avatarUrl: p?.avatarUrl ?? "",
        availabilityCalendar: (p as any)?.availabilityCalendar ?? {},
        availabilityTimeRanges: (p as any)?.availabilityTimeRanges ?? {},
      } as any;
    },
    toggleAvailabilityDayStatus(state, action: PayloadAction<{ date: string }>) {
      const date = String(action.payload.date ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const availabilityCalendar =
        (((state.form as any).availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>) ?? {};
      const availabilityTimeRanges =
        (((state.form as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>) ?? {};

      const current = availabilityCalendar[date];
      const next: AvailabilityStatus | undefined =
        current === "present" ? "absent" : current === "absent" ? undefined : "present";

      const nextCal = { ...availabilityCalendar };
      const nextRanges = { ...availabilityTimeRanges };
      if (next) nextCal[date] = next;
      else delete nextCal[date];
      if (next !== "present") delete nextRanges[date];

      (state.form as any).availabilityCalendar = nextCal;
      (state.form as any).availabilityTimeRanges = nextRanges;
    },
    setAvailabilityDayStatus(
      state,
      action: PayloadAction<{ date: string; status: AvailabilityStatus | null }>,
    ) {
      const date = String(action.payload.date ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const status = action.payload.status;

      const availabilityCalendar =
        (((state.form as any).availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>) ?? {};
      const availabilityTimeRanges =
        (((state.form as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>) ?? {};

      const nextCal = { ...availabilityCalendar };
      const nextRanges = { ...availabilityTimeRanges };

      if (status === "present" || status === "absent") nextCal[date] = status;
      else delete nextCal[date];

      // Ranges only make sense when day is explicitly "present"
      if (status !== "present") delete nextRanges[date];

      (state.form as any).availabilityCalendar = nextCal;
      (state.form as any).availabilityTimeRanges = nextRanges;
    },
    setTimeRangesForDate(
      state,
      action: PayloadAction<{ date: string; ranges: AvailabilityTimeRange[] }>,
    ) {
      const date = String(action.payload.date ?? "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
      const ranges = Array.isArray(action.payload.ranges) ? action.payload.ranges : [];
      const availabilityTimeRanges =
        (((state.form as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>) ?? {};
      const availabilityCalendar =
        (((state.form as any).availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>) ?? {};

      const nextRanges = { ...availabilityTimeRanges };
      if (ranges.length > 0) nextRanges[date] = ranges;
      else delete nextRanges[date];

      const nextCalendar = { ...availabilityCalendar };
      nextCalendar[date] = "present";

      (state.form as any).availabilityTimeRanges = nextRanges;
      (state.form as any).availabilityCalendar = nextCalendar;
    },
  },
  extraReducers: (b) => {
    b.addCase(fetchMyProfileThunk.pending, (state) => {
      state.loadingProfile = true;
      state.error = null;
      state.ok = null;
    });
    b.addCase(fetchMyProfileThunk.fulfilled, (state, action) => {
      state.loadingProfile = false;
      state.profile = action.payload ?? null;
      state.loadedOnce = true;
      state.error = null;
      state.ok = null;
      // Keep form in sync if it was empty (first load)
      state.form = {
        displayName: action.payload?.displayName ?? "",
        firstName: action.payload?.firstName ?? "",
        lastName: action.payload?.lastName ?? "",
        telegramUsername: action.payload?.telegramUsername ?? "",
        telegramId: action.payload?.telegramId ?? "",
        avatarUrl: action.payload?.avatarUrl ?? "",
        availabilityCalendar: (action.payload as any)?.availabilityCalendar ?? {},
        availabilityTimeRanges: (action.payload as any)?.availabilityTimeRanges ?? {},
      } as any;
    });
    b.addCase(fetchMyProfileThunk.rejected, (state) => {
      state.loadingProfile = false;
      state.profile = null;
      state.loadedOnce = true;
    });

    b.addCase(saveMyProfileThunk.pending, (state) => {
      state.saving = true;
      state.error = null;
      state.ok = null;
    });
    b.addCase(saveMyProfileThunk.fulfilled, (state, action) => {
      state.saving = false;
      state.profile = action.payload ?? null;
      state.error = null;
      state.ok = "Сохранено";
      state.form = {
        displayName: action.payload?.displayName ?? "",
        firstName: action.payload?.firstName ?? "",
        lastName: action.payload?.lastName ?? "",
        telegramUsername: action.payload?.telegramUsername ?? "",
        telegramId: action.payload?.telegramId ?? "",
        avatarUrl: action.payload?.avatarUrl ?? "",
        availabilityCalendar: (action.payload as any)?.availabilityCalendar ?? {},
        availabilityTimeRanges: (action.payload as any)?.availabilityTimeRanges ?? {},
      } as any;
    });
    b.addCase(saveMyProfileThunk.rejected, (state, action) => {
      state.saving = false;
      state.error = (action.payload as any) ?? "Не удалось сохранить профиль";
    });

    b.addCase(uploadAvatarThunk.pending, (state) => {
      state.avatarUploading = true;
      state.error = null;
      state.ok = null;
    });
    b.addCase(uploadAvatarThunk.fulfilled, (state, action) => {
      state.avatarUploading = false;
      state.profile = action.payload ?? null;
      (state.form as any).avatarUrl = action.payload?.avatarUrl ?? "";
      state.ok = "Аватар загружен";
    });
    b.addCase(uploadAvatarThunk.rejected, (state, action) => {
      state.avatarUploading = false;
      state.error = action.payload ?? "Не удалось загрузить аватар";
    });

    b.addCase(deleteProfileDataThunk.pending, (state) => {
      state.deletingProfile = true;
      state.error = null;
      state.ok = null;
    });
    b.addCase(deleteProfileDataThunk.fulfilled, (state, action) => {
      state.deletingProfile = false;
      state.profile = action.payload ?? null;
      state.ok = "Данные профиля удалены";
      state.form = {
        displayName: action.payload?.displayName ?? "",
        firstName: action.payload?.firstName ?? "",
        lastName: action.payload?.lastName ?? "",
        telegramUsername: action.payload?.telegramUsername ?? "",
        telegramId: action.payload?.telegramId ?? "",
        avatarUrl: action.payload?.avatarUrl ?? "",
        availabilityCalendar: (action.payload as any)?.availabilityCalendar ?? {},
        availabilityTimeRanges: (action.payload as any)?.availabilityTimeRanges ?? {},
      } as any;
    });
    b.addCase(deleteProfileDataThunk.rejected, (state, action) => {
      state.deletingProfile = false;
      state.error = action.payload ?? "Не удалось удалить профиль";
    });
  },
});

export const profileDataActions = profileDataSlice.actions;
export const profileDataReducer = profileDataSlice.reducer;

function selectProfileDataState(state: RootState): ProfileDataState | undefined {
  return (state as any).profileData as ProfileDataState | undefined;
}

const EMPTY_PROFILE_FORM: Partial<MyProfile> = {};

export const selectMyProfile = createSelector([selectProfileDataState], (s): MyProfile | null => s?.profile ?? null);

export const selectProfileForm = createSelector(
  [selectProfileDataState],
  (s): Partial<MyProfile> => s?.form ?? EMPTY_PROFILE_FORM,
);

export const selectProfileDataFlags = createSelector(
  [selectProfileDataState],
  (s): {
    loadingProfile: boolean;
    saving: boolean;
    avatarUploading: boolean;
    deletingProfile: boolean;
    error: string | null;
    ok: string | null;
  } => ({
    loadingProfile: Boolean(s?.loadingProfile),
    saving: Boolean(s?.saving),
    avatarUploading: Boolean(s?.avatarUploading),
    deletingProfile: Boolean(s?.deletingProfile),
    error: s?.error ?? null,
    ok: s?.ok ?? null,
  }),
);

