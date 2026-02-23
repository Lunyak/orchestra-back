import { createAsyncThunk, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { login, register } from "../../../sync/auth";

export type AfterLoginCallback = (token: string) => Promise<void>;

export interface AuthState {
  accessToken: string | null;
}

const initialState: AuthState = {
  accessToken:
    typeof window !== "undefined" ? localStorage.getItem("accessToken") : null,
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
});

export const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAccessTokenState(state, action: PayloadAction<string | null>) {
      state.accessToken = action.payload ?? null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(authLogin.fulfilled, (state, action) => {
      state.accessToken = action.payload;
    });
    builder.addCase(authSignUp.fulfilled, (state, action) => {
      state.accessToken = action.payload;
    });
    builder.addCase(authLogout.fulfilled, (state) => {
      state.accessToken = null;
    });
  },
});

export const authActions = authSlice.actions;
export const authReducer = authSlice.reducer;

