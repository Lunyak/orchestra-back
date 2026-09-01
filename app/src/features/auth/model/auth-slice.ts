import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { login, register } from "../../../sync/auth";
import {
  readDesktopOfflineMode,
  writeDesktopOfflineMode,
} from "./desktop-offline";

export type AfterLoginCallback = (token: string) => Promise<void>;

export interface AuthState {
  accessToken: string | null;
  offlineMode: boolean;
}

const initialState: AuthState = {
  accessToken:
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
  offlineMode: typeof window !== "undefined" ? readDesktopOfflineMode() : false,
};

export const authLogin = createAsyncThunk<
  string,
  { email: string; password: string; onAfterLogin?: AfterLoginCallback }
>("auth/login", async ({ email, password, onAfterLogin }) => {
  const res = await login(email, password);
  localStorage.setItem("accessToken", res.accessToken);
  localStorage.setItem("refreshToken", res.refreshToken);
  await onAfterLogin?.(res.accessToken);
  return res.accessToken;
});

export const authSignUp = createAsyncThunk<
  string,
  { email: string; password: string; onAfterLogin?: AfterLoginCallback }
>("auth/signUp", async ({ email, password, onAfterLogin }) => {
  const res = await register(email, password);
  localStorage.setItem("accessToken", res.accessToken);
  localStorage.setItem("refreshToken", res.refreshToken);
  await onAfterLogin?.(res.accessToken);
  return res.accessToken;
});

export const authLogout = createAsyncThunk<void, void>("auth/logout", async () => {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  writeDesktopOfflineMode(false);
});

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAccessTokenState(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload ?? null;
      if (action.payload) {
        state.offlineMode = false;
        writeDesktopOfflineMode(false);
      }
    },
    enterDesktopOffline(state) {
      writeDesktopOfflineMode(true);
      state.offlineMode = true;
    },
    leaveDesktopOffline(state) {
      writeDesktopOfflineMode(false);
      state.offlineMode = false;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(authLogin.fulfilled, (state, action) => {
      state.accessToken = action.payload;
      state.offlineMode = false;
      writeDesktopOfflineMode(false);
    });
    builder.addCase(authSignUp.fulfilled, (state, action) => {
      state.accessToken = action.payload;
      state.offlineMode = false;
      writeDesktopOfflineMode(false);
    });
    builder.addCase(authLogout.fulfilled, (state) => {
      state.accessToken = null;
      state.offlineMode = false;
    });
  },
});

export const authActions = authSlice.actions;
export const authReducer = authSlice.reducer;

