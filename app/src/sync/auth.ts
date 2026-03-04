import axios from "axios";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ForgotPasswordResponse {
  ok: true;
  token?: string;
}

export async function login(email: string, password: string) {
  const { data } = await axios.post<AuthResponse>(`${API_BASE}/auth/login`, {
    email,
    password,
  });
  return data;
}

export async function register(email: string, password: string) {
  const { data } = await axios.post<AuthResponse>(`${API_BASE}/auth/register`, {
    email,
    password,
  });
  return data;
}

export async function refreshToken(oldRefreshToken: string) {
  const { data } = await axios.post<AuthResponse>(`${API_BASE}/auth/refresh`, {
    refreshToken: oldRefreshToken,
  });
  return data;
}

export async function forgotPassword(email: string) {
  const { data } = await axios.post<ForgotPasswordResponse>(
    `${API_BASE}/auth/forgot-password`,
    { email },
  );
  return data;
}

export async function resetPassword(token: string, newPassword: string) {
  const { data } = await axios.post<{ ok: true }>(`${API_BASE}/auth/reset-password`, {
    token,
    newPassword,
  });
  return data;
}
