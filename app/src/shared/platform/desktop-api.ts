export type DesktopApi = Record<string, any>;

export function getDesktopApi(): DesktopApi | null {
  if (typeof window === "undefined") return null;
  const candidate = (window as any).api;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as DesktopApi;
}

export function requireDesktopApi(feature?: string): DesktopApi {
  const api = getDesktopApi();
  if (api) return api;
  const suffix = feature ? `: ${feature}` : "";
  throw new Error(`Desktop API is unavailable${suffix}`);
}
