import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { inviteToProject } from "../../../sync/api/projects";
import {
  addTroupeMember,
  getMyTroupe,
  patchMyTroupeTitle,
  removeTroupeMember,
  type TroupeMemberItem,
  type TroupeSummary,
} from "../../../sync/api/troupe";

function getAccessToken(getState: () => RootState): string | null {
  const fromState = getState().auth?.accessToken ?? null;
  if (fromState) return fromState;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

export type TroupeState = {
  troupe: TroupeSummary | null;
  members: TroupeMemberItem[];
  loading: boolean;
  scheduleRefreshing: boolean;
  scheduleMonthKey: string | null;
  scheduleProjectSlug: string | null;
  error: string | null;
  adding: boolean;
  addError: string | null;
  removingIds: Record<string, boolean | undefined>;
  invitingIds: Record<string, boolean | undefined>;
  inviteErrorByMemberId: Record<string, string | undefined>;
  patchingTitle: boolean;
  patchTitleError: string | null;
};

const initialState: TroupeState = {
  troupe: null,
  members: [],
  loading: false,
  scheduleRefreshing: false,
  scheduleMonthKey: null,
  scheduleProjectSlug: null,
  error: null,
  adding: false,
  addError: null,
  removingIds: {},
  invitingIds: {},
  inviteErrorByMemberId: {},
  patchingTitle: false,
  patchTitleError: null,
};

export const fetchMyTroupe = createAsyncThunk<
  { troupe: TroupeSummary | null; members: TroupeMemberItem[] },
  { month?: string; project: string }
>("troupe/fetchMyTroupe", async (arg, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) throw new Error("Нет токена авторизации");
  const month = arg.month ? arg.month : undefined;
  return await getMyTroupe(token, { month, project: arg.project });
});

export const troupeAddMember = createAsyncThunk<
  { troupe: TroupeSummary | null; members: TroupeMemberItem[] },
  { email: string }
>("troupe/addMember", async ({ email }, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) throw new Error("Нет токена авторизации");
  const { scheduleMonthKey, scheduleProjectSlug } = (api.getState as () => RootState)().troupe;
  if (!scheduleProjectSlug) throw new Error("Не выбран проект для обновления расписания");
  await addTroupeMember(token, email, { project: scheduleProjectSlug });
  return await getMyTroupe(token, {
    month: scheduleMonthKey ?? undefined,
    project: scheduleProjectSlug,
  });
});

export const troupeRemoveMember = createAsyncThunk<
  { troupe: TroupeSummary | null; members: TroupeMemberItem[] },
  { memberId: string }
>("troupe/removeMember", async ({ memberId }, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) throw new Error("Нет токена авторизации");
  const { scheduleMonthKey, scheduleProjectSlug } = (api.getState as () => RootState)().troupe;
  if (!scheduleProjectSlug) throw new Error("Не выбран проект для обновления расписания");
  await removeTroupeMember(token, memberId, { project: scheduleProjectSlug });
  return await getMyTroupe(token, {
    month: scheduleMonthKey ?? undefined,
    project: scheduleProjectSlug,
  });
});

export const troupeInviteMemberToProject = createAsyncThunk<
  { memberId: string; projectSlug: string },
  { memberId: string; email: string; projectSlug: string; role?: "editor" | "viewer" }
>("troupe/inviteMemberToProject", async ({ memberId, email, projectSlug, role }, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) throw new Error("Нет токена авторизации");
  await inviteToProject(token, projectSlug, email, role ?? "viewer");
  return { memberId, projectSlug };
});

export const troupePatchTitle = createAsyncThunk<TroupeSummary, { title: string }>(
  "troupe/patchTitle",
  async ({ title }, api) => {
    const token = getAccessToken(api.getState as () => RootState);
    if (!token) throw new Error("Нет токена авторизации");
    return await patchMyTroupeTitle(token, title);
  },
);

export const troupeSlice = createSlice({
  name: "troupe",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(troupePatchTitle.pending, (state) => {
      state.patchingTitle = true;
      state.patchTitleError = null;
    });
    builder.addCase(troupePatchTitle.fulfilled, (state, action) => {
      state.patchingTitle = false;
      state.patchTitleError = null;
      if (state.troupe && state.troupe.id === action.payload.id) {
        state.troupe = { ...state.troupe, ...action.payload };
      } else {
        state.troupe = action.payload;
      }
    });
    builder.addCase(troupePatchTitle.rejected, (state, action) => {
      state.patchingTitle = false;
      state.patchTitleError = String(action.error?.message ?? "Не удалось сохранить название");
    });

    builder.addCase(fetchMyTroupe.pending, (state, action) => {
      const arg = action.meta.arg;
      const month = arg.month ? arg.month : undefined;
      const partial = Boolean(month) && state.troupe != null;
      if (partial) {
        state.scheduleRefreshing = true;
      } else {
        state.loading = true;
      }
      state.error = null;
    });
    builder.addCase(fetchMyTroupe.fulfilled, (state, action) => {
      state.loading = false;
      state.scheduleRefreshing = false;
      state.error = null;
      state.troupe = action.payload.troupe;
      state.members = action.payload.members ?? [];
      const arg = action.meta.arg;
      if (arg.month) state.scheduleMonthKey = arg.month;
      state.scheduleProjectSlug = arg.project;
    });
    builder.addCase(fetchMyTroupe.rejected, (state, action) => {
      state.loading = false;
      state.scheduleRefreshing = false;
      state.error = String(action.error?.message ?? "Не удалось загрузить труппу");
    });

    builder.addCase(troupeAddMember.pending, (state) => {
      state.adding = true;
      state.addError = null;
    });
    builder.addCase(troupeAddMember.fulfilled, (state, action) => {
      state.adding = false;
      state.addError = null;
      state.troupe = action.payload.troupe;
      state.members = action.payload.members ?? [];
    });
    builder.addCase(troupeAddMember.rejected, (state, action: any) => {
      state.adding = false;
      state.addError = String(action?.error?.message ?? "Не удалось добавить участника");
    });

    builder.addCase(troupeRemoveMember.pending, (state, action) => {
      const id = action.meta.arg.memberId;
      state.removingIds[id] = true;
    });
    builder.addCase(troupeRemoveMember.fulfilled, (state, action) => {
      const id = action.meta.arg.memberId;
      delete state.removingIds[id];
      state.troupe = action.payload.troupe;
      state.members = action.payload.members ?? [];
    });
    builder.addCase(troupeRemoveMember.rejected, (state, action) => {
      const id = action.meta.arg.memberId;
      delete state.removingIds[id];
      state.error = String(action.error?.message ?? "Не удалось удалить участника");
    });

    builder.addCase(troupeInviteMemberToProject.pending, (state, action) => {
      const id = action.meta.arg.memberId;
      state.invitingIds[id] = true;
      delete state.inviteErrorByMemberId[id];
    });
    builder.addCase(troupeInviteMemberToProject.fulfilled, (state, action) => {
      const id = action.payload.memberId;
      delete state.invitingIds[id];
      delete state.inviteErrorByMemberId[id];
    });
    builder.addCase(troupeInviteMemberToProject.rejected, (state, action) => {
      const id = action.meta.arg.memberId;
      delete state.invitingIds[id];
      state.inviteErrorByMemberId[id] = String(
        action.error?.message ?? "Не удалось добавить в проект",
      );
    });
  },
});

export const troupeReducer = troupeSlice.reducer;

