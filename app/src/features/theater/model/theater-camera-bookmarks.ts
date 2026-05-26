import type { TheaterCameraState } from "./theater-camera-storage";

export type TheaterCameraBookmark = {
  id: string;
  label: string;
  state: TheaterCameraState;
};

function storageKey(projectName: string) {
  return `orchestra-theater-camera-bookmarks:${projectName || "default"}`;
}

export function readTheaterCameraBookmarks(projectName: string): TheaterCameraBookmark[] {
  try {
    const raw = localStorage.getItem(storageKey(projectName));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is TheaterCameraBookmark =>
        typeof item?.id === "string" &&
        typeof item?.label === "string" &&
        Array.isArray(item?.state?.position) &&
        Array.isArray(item?.state?.target),
    );
  } catch {
    return [];
  }
}

export function writeTheaterCameraBookmarks(
  projectName: string,
  bookmarks: TheaterCameraBookmark[],
) {
  try {
    localStorage.setItem(storageKey(projectName), JSON.stringify(bookmarks));
  } catch {
    // ignore
  }
}

export function addTheaterCameraBookmark(
  projectName: string,
  label: string,
  state: TheaterCameraState,
): TheaterCameraBookmark[] {
  const next: TheaterCameraBookmark = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: label.trim() || `Вид ${readTheaterCameraBookmarks(projectName).length + 1}`,
    state,
  };
  const bookmarks = [...readTheaterCameraBookmarks(projectName), next];
  writeTheaterCameraBookmarks(projectName, bookmarks);
  return bookmarks;
}

export function removeTheaterCameraBookmark(
  projectName: string,
  id: string,
): TheaterCameraBookmark[] {
  const bookmarks = readTheaterCameraBookmarks(projectName).filter((item) => item.id !== id);
  writeTheaterCameraBookmarks(projectName, bookmarks);
  return bookmarks;
}

export const THEATER_CAMERA_CAPTURE_EVENT = "orchestra:theater-camera-capture";

export function applyTheaterCameraBookmark(bookmark: TheaterCameraBookmark) {
  window.dispatchEvent(
    new CustomEvent("orchestra:theater-camera-apply-bookmark", { detail: bookmark }),
  );
}

export function requestTheaterCameraCapture(): Promise<TheaterCameraState | null> {
  return new Promise((resolve) => {
    const timeout = window.setTimeout(() => resolve(null), 500);
    const handler = (event: Event) => {
      window.clearTimeout(timeout);
      window.removeEventListener(THEATER_CAMERA_CAPTURE_EVENT, handler);
      resolve((event as CustomEvent<TheaterCameraState>).detail ?? null);
    };
    window.addEventListener(THEATER_CAMERA_CAPTURE_EVENT, handler, { once: true });
    window.dispatchEvent(new CustomEvent("orchestra:theater-camera-capture-request"));
  });
}
