import axios from "axios";

// В React/Vite используем import.meta.env вместо process.env
const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

export interface AuthResponse {
  accessToken: string;
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
