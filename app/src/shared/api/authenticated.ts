import { store } from "../store/store";

export function getAccessToken(): string | null {
  const fromStore = store.getState().auth?.accessToken ?? null;
  if (fromStore) return fromStore;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}

/**
 * Runs an API call with the current access token.
 * Prefer this over threading `accessToken` through every call site when the axios interceptor already attaches auth.
 */
export async function callWithAuth<T>(fn: (token: string) => Promise<T>): Promise<T> {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Нет токена авторизации");
  }
  return fn(token);
}
