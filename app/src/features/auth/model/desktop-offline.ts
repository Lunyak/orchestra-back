const DESKTOP_OFFLINE_KEY = "orchestra:desktop-offline";

export function isDesktopRuntime() {
  return import.meta.env.MODE === "desktop";
}

export function readDesktopOfflineMode() {
  if (!isDesktopRuntime()) return false;
  try {
    return localStorage.getItem(DESKTOP_OFFLINE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeDesktopOfflineMode(on: boolean) {
  try {
    if (on) localStorage.setItem(DESKTOP_OFFLINE_KEY, "1");
    else localStorage.removeItem(DESKTOP_OFFLINE_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}
