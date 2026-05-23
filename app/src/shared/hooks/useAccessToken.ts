import { useAppSelector } from "../store/hooks";

/** Access token from Redux with localStorage fallback (matches API interceptor). */
export function useAccessToken(): string | null {
  const fromStore = useAppSelector((s) => s.auth?.accessToken ?? null);
  if (fromStore) return fromStore;
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken");
}
