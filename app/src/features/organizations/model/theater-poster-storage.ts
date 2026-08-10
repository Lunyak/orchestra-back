import { readImageFileAsDataUrl } from "../../project/model/project-poster-storage";

const THEATER_POSTER_KEY_PREFIX = "theaterPoster:";

function posterStorageKey(theaterId: string) {
  return `${THEATER_POSTER_KEY_PREFIX}${theaterId}`;
}

export function readTheaterPoster(theaterId: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(posterStorageKey(theaterId));
  } catch {
    return null;
  }
}

export function storeTheaterPoster(theaterId: string, dataUrl: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(posterStorageKey(theaterId), dataUrl);
  } catch {
    // ignore quota / private mode
  }
}

export function removeTheaterPoster(theaterId: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(posterStorageKey(theaterId));
  } catch {
    // ignore
  }
}

export { readImageFileAsDataUrl };
