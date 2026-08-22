import { readImageFileAsDataUrl } from "../../project/model/project-poster-storage";

const THEATER_POSTER_KEY_PREFIX = "theaterPoster:";
export const THEATER_POSTER_CHANGE_EVENT = "orchestra-theater-poster-change";

function posterStorageKey(theaterId: string) {
  return `${THEATER_POSTER_KEY_PREFIX}${theaterId}`;
}

function notifyTheaterPosterChange(theaterId: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(THEATER_POSTER_CHANGE_EVENT, {
      detail: { theaterId },
    }),
  );
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
  if (typeof window === "undefined") return;
  const key = posterStorageKey(theaterId);
  try {
    localStorage.setItem(key, dataUrl);
    if (localStorage.getItem(key) !== dataUrl) {
      throw new Error("Не удалось сохранить афишу");
    }
    notifyTheaterPosterChange(theaterId);
  } catch (error) {
    if (error instanceof Error && error.message === "Не удалось сохранить афишу") {
      throw error;
    }
    throw new Error(
      "Не хватило места для афиши. Выберите файл поменьше или освободите память браузера.",
    );
  }
}

export function removeTheaterPoster(theaterId: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(posterStorageKey(theaterId));
    notifyTheaterPosterChange(theaterId);
  } catch {
    // ignore
  }
}

export { readImageFileAsDataUrl };
