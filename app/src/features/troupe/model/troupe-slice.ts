import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import {
  addTroupeMember,
  getMyTroupe,
  inviteToProject,
  removeTroupeMember,
  type TroupeMemberItem,
  type TroupeSummary,
} from "../../../sync/api";

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
  error: string | null;
  adding: boolean;
  addError: string | null;
  removingIds: Record<string, boolean | undefined>;
  invitingIds: Record<string, boolean | undefined>;
  inviteErrorByMemberId: Record<string, string | undefined>;
};

const initialState: TroupeState = {
  troupe: null,
  members: [],
  loading: false,
  error: null,
  adding: false,
  addError: null,
  removingIds: {},
  invitingIds: {},
  inviteErrorByMemberId: {},
};

export const fetchMyTroupe = createAsyncThunk<
  { troupe: TroupeSummary; members: TroupeMemberItem[] },
  void
>("troupe/fetchMyTroupe", async (_args, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) throw new Error("Нет токена авторизации");
  return await getMyTroupe(token);
});

export const troupeAddMember = createAsyncThunk<TroupeMemberItem, { email: string }>(
  "troupe/addMember",
  async ({ email }, api) => {
    const token = getAccessToken(api.getState as () => RootState);
    if (!token) throw new Error("Нет токена авторизации");
    return await addTroupeMember(token, email);
  },
);

export const troupeRemoveMember = createAsyncThunk<string, { memberId: string }>(
  "troupe/removeMember",
  async ({ memberId }, api) => {
    const token = getAccessToken(api.getState as () => RootState);
    if (!token) throw new Error("Нет токена авторизации");
    await removeTroupeMember(token, memberId);
    return memberId;
  },
);

export const troupeInviteMemberToProject = createAsyncThunk<
  { memberId: string; projectSlug: string },
  { memberId: string; email: string; projectSlug: string; role?: "editor" | "viewer" }
>("troupe/inviteMemberToProject", async ({ memberId, email, projectSlug, role }, api) => {
  const token = getAccessToken(api.getState as () => RootState);
  if (!token) throw new Error("Нет токена авторизации");
  await inviteToProject(token, projectSlug, email, role ?? "viewer");
  return { memberId, projectSlug };
});

export const troupeSlice = createSlice({
  name: "troupe",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder.addCase(fetchMyTroupe.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    builder.addCase(fetchMyTroupe.fulfilled, (state, action) => {
      state.loading = false;
      state.error = null;
      state.troupe = action.payload.troupe;
      state.members = action.payload.members ?? [];
    });
    builder.addCase(fetchMyTroupe.rejected, (state, action) => {
      state.loading = false;
      state.error = String(action.error?.message ?? "Не удалось загрузить труппу");
    });

    builder.addCase(troupeAddMember.pending, (state) => {
      state.adding = true;
      state.addError = null;
    });
    builder.addCase(troupeAddMember.fulfilled, (state, action) => {
      state.adding = false;
      state.addError = null;
      const member = action.payload;
      state.members = [member, ...state.members.filter((m) => m.id !== member.id)];
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
      const id = action.payload;
      delete state.removingIds[id];
      state.members = state.members.filter((m) => m.id !== id);
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

