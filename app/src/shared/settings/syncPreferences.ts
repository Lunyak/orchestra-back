const PAUSE_REMOTE_KEY = "orchestra:sync.pauseRemoteSceneUpdates";
const CONFIRM_BEFORE_PULL_KEY = "orchestra:sync.confirmBeforeRemoteSceneUpdates";

export function getPauseRemoteSceneUpdates(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(PAUSE_REMOTE_KEY) === "1";
}

export function setPauseRemoteSceneUpdates(value: boolean): void {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(PAUSE_REMOTE_KEY, "1");
  else localStorage.removeItem(PAUSE_REMOTE_KEY);
}

export function getConfirmBeforeRemoteScenePull(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(CONFIRM_BEFORE_PULL_KEY) === "1";
}

export function setConfirmBeforeRemoteScenePull(value: boolean): void {
  if (typeof window === "undefined") return;
  if (value) localStorage.setItem(CONFIRM_BEFORE_PULL_KEY, "1");
  else localStorage.removeItem(CONFIRM_BEFORE_PULL_KEY);
}
