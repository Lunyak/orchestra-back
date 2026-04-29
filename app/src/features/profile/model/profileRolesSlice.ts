import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import type { RootState } from "../../../shared/store/store";
import { getProjectRoles, type ProjectRoleInfo } from "../../../sync/api/projects";

export type ProfileRolesState = {
  roles: ProjectRoleInfo[];
  loading: boolean;
  error: string | null;
  loadedProjectName: string | null;
};

const initialState: ProfileRolesState = {
  roles: [],
  loading: false,
  error: null,
  loadedProjectName: null,
};

export const fetchProjectRolesThunk = createAsyncThunk<
  { projectName: string; roles: ProjectRoleInfo[] },
  { accessToken: string; projectName: string },
  { state: RootState; rejectValue: string }
>(
  "profileRoles/fetchProjectRoles",
  async ({ accessToken, projectName }, { rejectWithValue }) => {
    try {
      const res = await getProjectRoles(accessToken, projectName);
      const roles = Array.isArray(res?.roles) ? res.roles : [];
      return { projectName, roles };
    } catch (e: any) {
      return rejectWithValue(String(e?.message ?? "Не удалось загрузить роли"));
    }
  },
  {
    condition: ({ projectName }, { getState }) => {
      const s = (getState() as any).profileRoles as ProfileRolesState | undefined;
      if (!s) return true;
      if (s.loading) return false;
      if (s.loadedProjectName === projectName && s.roles.length > 0) return false;
      return true;
    },
  },
);

export const profileRolesSlice = createSlice({
  name: "profileRoles",
  initialState,
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchProjectRolesThunk.pending, (state) => {
      state.loading = true;
      state.error = null;
    });
    b.addCase(fetchProjectRolesThunk.fulfilled, (state, action) => {
      state.loading = false;
      state.error = null;
      state.roles = action.payload.roles ?? [];
      state.loadedProjectName = action.payload.projectName;
    });
    b.addCase(fetchProjectRolesThunk.rejected, (state, action) => {
      state.loading = false;
      state.error = action.payload ?? "Не удалось загрузить роли";
      state.roles = [];
      state.loadedProjectName = null;
    });
  },
});

export const profileRolesReducer = profileRolesSlice.reducer;

export function selectProjectRoles(state: RootState): ProjectRoleInfo[] {
  const list = (state as any).profileRoles?.roles;
  return Array.isArray(list) ? list : [];
}

export function selectProfileRolesFlags(state: RootState) {
  const s = (state as any).profileRoles as ProfileRolesState | undefined;
  return {
    loading: Boolean(s?.loading),
    error: s?.error ?? null,
  };
}

