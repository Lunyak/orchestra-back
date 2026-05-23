import type { PlatformApi } from "./platform-api";

export type DesktopApi = PlatformApi;

export function getDesktopApi(): DesktopApi | null {
  if (typeof window === "undefined") return null;
  const candidate = window.api;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate;
}

export function requireDesktopApi(feature?: string): DesktopApi {
  const api = getDesktopApi();
  if (api) return api;
  const suffix = feature ? `: ${feature}` : "";
  throw new Error(`Desktop API is unavailable${suffix}`);
}
