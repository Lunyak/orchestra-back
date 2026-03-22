const KEY = "orchestra:spectacle.pageLock";

export function getSpectaclePageLockEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setSpectaclePageLockEnabled(value: boolean): void {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(KEY, "1");
  else localStorage.removeItem(KEY);
  window.dispatchEvent(new Event("orchestra-spectacle-lock-changed"));
}
