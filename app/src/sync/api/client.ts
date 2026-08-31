import axios, {
  type AxiosError,
  type AxiosRequestConfig,
  type AxiosResponse,
  isAxiosError,
} from "axios";
import { refreshToken } from "../auth";

export const AUTH_TOKEN_SYNC_EVENT = "orchestra-auth-token-sync";

export function notifyAccessTokenStorageChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_TOKEN_SYNC_EVENT));
}

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL ?? "http://localhost:3000";

export const api = axios.create({
  baseURL: API_BASE,
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("accessToken");
    if (!token) return config;

    const headersAny = config.headers as any;
    const existingAuth =
      typeof headersAny?.get === "function"
        ? headersAny.get("Authorization") ?? headersAny.get("authorization")
        : headersAny?.Authorization ?? headersAny?.authorization;

    if (!existingAuth) {
      config.headers = config.headers ?? {};
      (config.headers as any).Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

let globalLogoutHandler: (() => void) | null = null;

export function setupApiInterceptors(logout: () => void) {
  globalLogoutHandler = logout;
}

function invalidateClientSession() {
  localStorage.removeItem("accessToken");
  localStorage.removeItem("refreshToken");
  localStorage.removeItem("lastSyncAt");
  notifyAccessTokenStorageChanged();
  if (typeof window === "undefined") return;
  if (globalLogoutHandler) {
    globalLogoutHandler();
  } else {
    window.location.reload();
  }
}

let isRefreshing = false;
let refreshQueue: Array<(token: string | null) => void> = [];

function subscribeTokenRefresh(cb: (token: string | null) => void) {
  refreshQueue.push(cb);
}

function notifyTokenRefreshed(token: string | null) {
  refreshQueue.forEach((cb) => cb(token));
  refreshQueue = [];
}

function shouldInvalidateSessionOnRefreshError(error: unknown): boolean {
  if (!isAxiosError(error)) {
    return false;
  }
  if (
    error.code === "ERR_NETWORK" ||
    error.code === "ECONNABORTED" ||
    error.code === "ERR_CANCELED"
  ) {
    return false;
  }
  if (!error.response) {
    return false;
  }
  const status = error.response.status;
  if (status >= 500 && status < 600) {
    return false;
  }
  if (status === 408 || status === 429) {
    return false;
  }
  return status === 400 || status === 401 || status === 403;
}

api.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalConfig = error.config as
      | (AxiosRequestConfig & { _retry?: boolean })
      | undefined;

    if (!originalConfig || status !== 401 || originalConfig._retry) {
      return Promise.reject(error);
    }

    originalConfig._retry = true;

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        subscribeTokenRefresh((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }
          originalConfig.headers = originalConfig.headers ?? {};
          (originalConfig.headers as any).Authorization = `Bearer ${newToken}`;
          resolve(api(originalConfig));
        });
      });
    }

    isRefreshing = true;

    try {
      const oldRefresh = localStorage.getItem("refreshToken");
      if (!oldRefresh) {
        notifyTokenRefreshed(null);
        invalidateClientSession();
        return Promise.reject(error);
      }

      const tokens = await refreshToken(oldRefresh);
      localStorage.setItem("accessToken", tokens.accessToken);
      localStorage.setItem("refreshToken", tokens.refreshToken);
      notifyAccessTokenStorageChanged();
      notifyTokenRefreshed(tokens.accessToken);

      originalConfig.headers = originalConfig.headers ?? {};
      (originalConfig.headers as any).Authorization =
        `Bearer ${tokens.accessToken}`;
      return api(originalConfig);
    } catch (e) {
      notifyTokenRefreshed(null);
      const invalidate = shouldInvalidateSessionOnRefreshError(e);
      if (invalidate) {
        invalidateClientSession();
      } else if (typeof console !== "undefined" && console.warn) {
        console.warn(
          "[api] Refresh token request failed (session kept); will retry on next request",
          e,
        );
      }
      return Promise.reject(e);
    } finally {
      isRefreshing = false;
    }
  },
);

export function getApiBaseUrl(): string {
  return API_BASE;
}
