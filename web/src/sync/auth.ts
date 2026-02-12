import axios from "axios";

// В React/Vite используем import.meta.env вместо process.env
// Совпадать с web/src/sync/api.ts: при открытии с того же хоста (порт 80) используем /api
function getApiBase(): string {
  const raw =
    (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";
  if (typeof window === "undefined") return raw;
  if (raw === "/api" || (raw.startsWith("/") && !raw.startsWith("//")))
    return raw;
  try {
    const envUrl = new URL(raw);
    // В проде фронт обычно на 80/443, бэк может быть на :3000 того же хоста.
    // В этом случае всегда идем через /api-прокси, чтобы не упираться в CORS/порты.
    const currentPort =
      window.location.port ||
      (window.location.protocol === "https:" ? "443" : "80");
    const sameHost = envUrl.hostname === window.location.hostname;
    const isDefaultWebPort = currentPort === "80" || currentPort === "443";
    const samePort = envUrl.port === currentPort;
    if (
      sameHost &&
      (isDefaultWebPort || (samePort && currentPort !== "3000"))
    ) {
      return "/api";
    }
  } catch {
    // ignore
  }
  return raw;
}
const API_BASE = getApiBase();

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
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
