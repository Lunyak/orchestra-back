import { createAsyncThunk, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import type { MyProfile } from "../../../sync/api/profile";
import { profileApi } from "../api/profile-api";

function rtkErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data?: { message?: string } }).data;
    if (data?.message) return String(data.message);
  }
  return fallback;
}

function unwrapProfileResult<T>(result: { data?: T; error?: unknown }): T {
  if (result.error) {
    throw result.error;
  }
  return result.data as T;
}

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

function isValidIsoDate(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

const MAX_AVAILABILITY_RANGE_DAYS = 366;

function listIsoDatesInRange(fromIso: string, toIso: string): string[] {
  const from = String(fromIso ?? "").trim();
  const to = String(toIso ?? "").trim();
  if (!isValidIsoDate(from) || !isValidIsoDate(to)) return [];
  if (from > to) return [];

  const out: string[] = [];
  const cur = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  if (!Number.isFinite(cur.getTime()) || !Number.isFinite(end.getTime())) return [];

  while (cur <= end && out.length < MAX_AVAILABILITY_RANGE_DAYS) {
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, "0");
    const dd = String(cur.getDate()).padStart(2, "0");
    out.push(`${yyyy}-${mm}-${dd}`);
    cur.setDate(cur.getDate() + 1);
  }

  return out;
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
    avatarSmallUrl: t((form as any).avatarSmallUrl),
    phone: t((form as any).phone),
    availabilityCalendar: cleanCalendar as any,
    availabilityTimeRanges: cleanRanges as any,
  } as Partial<MyProfile>;
}

export const fetchMyProfileThunk = createAsyncThunk<MyProfile, { accessToken: string }, { state: RootState }>(
  "profileData/fetchMyProfile",
  async (_args, { dispatch }) => {
    const result = await dispatch(
      profileApi.endpoints.myProfile.initiate(undefined, { forceRefetch: true }),
    );
    return unwrapProfileResult(result);
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
  async (_args, { dispatch, getState, rejectWithValue }) => {
    const state = getState() as any;
    const s = state.profileData as ProfileDataState | undefined;
    const form = s?.form ?? {};
    try {
      const patch = normalizePatchFromForm(form);
      const result = await dispatch(profileApi.endpoints.updateMyProfile.initiate(patch));
      if (result.error) {
        return rejectWithValue(rtkErrorMessage(result.error, "Не удалось сохранить профиль"));
      }
      return result.data as MyProfile;
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
  { accessToken: string; file: File; variant?: "full" | "small" },
  { rejectValue: string }
>("profileData/uploadAvatar", async ({ file, variant = "full" }, { dispatch, rejectWithValue }) => {
  try {
    const result = await dispatch(
      profileApi.endpoints.uploadMyAvatar.initiate({ file, variant }),
    );
    if (result.error) {
      return rejectWithValue(rtkErrorMessage(result.error, "Не удалось загрузить аватар"));
    }
    return result.data as MyProfile;
  } catch (e: any) {
    return rejectWithValue(e?.response?.data?.message ?? "Не удалось загрузить аватар");
  }
});

export const deleteProfileDataThunk = createAsyncThunk<
  MyProfile,
  { accessToken: string },
  { rejectValue: string }
>("profileData/deleteProfileData", async (_args, { dispatch, rejectWithValue }) => {
  try {
    const deleteResult = await dispatch(profileApi.endpoints.deleteMyProfile.initiate());
    if (deleteResult.error) {
      return rejectWithValue(rtkErrorMessage(deleteResult.error, "Не удалось удалить профиль"));
    }
    const refreshResult = await dispatch(
      profileApi.endpoints.myProfile.initiate(undefined, { forceRefetch: true }),
    );
    return unwrapProfileResult(refreshResult);
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
        avatarSmallUrl: p?.avatarSmallUrl ?? "",
        phone: p?.phone ?? "",
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
    setAvailabilityRangeStatus(
      state,
      action: PayloadAction<{ fromDate: string; toDate: string; status: AvailabilityStatus | null }>,
    ) {
      const dates = listIsoDatesInRange(action.payload.fromDate, action.payload.toDate);
      if (dates.length === 0) return;

      const status = action.payload.status;
      const availabilityCalendar =
        (((state.form as any).availabilityCalendar ?? {}) as Record<string, AvailabilityStatus>) ?? {};
      const availabilityTimeRanges =
        (((state.form as any).availabilityTimeRanges ?? {}) as Record<string, AvailabilityTimeRange[]>) ?? {};

      const nextCal = { ...availabilityCalendar };
      const nextRanges = { ...availabilityTimeRanges };

      for (const date of dates) {
        if (status === "present" || status === "absent") {
          nextCal[date] = status;
          if (status !== "present") delete nextRanges[date];
        } else {
          delete nextCal[date];
          delete nextRanges[date];
        }
      }

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
        avatarSmallUrl: action.payload?.avatarSmallUrl ?? "",
        phone: action.payload?.phone ?? "",
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
        avatarSmallUrl: action.payload?.avatarSmallUrl ?? "",
        phone: action.payload?.phone ?? "",
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
      (state.form as any).avatarSmallUrl = action.payload?.avatarSmallUrl ?? "";
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
        avatarSmallUrl: action.payload?.avatarSmallUrl ?? "",
        phone: action.payload?.phone ?? "",
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

