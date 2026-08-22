import { readImageFileAsDataUrl } from "../../project/model/project-poster-storage";

const STUDIO_POSTER_KEY_PREFIX = "studioPoster:";

function posterStorageKey(studioId: string) {
  return `${STUDIO_POSTER_KEY_PREFIX}${studioId}`;
}

export function readStudioPoster(studioId: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(posterStorageKey(studioId));
  } catch {
    return null;
  }
}

export function storeStudioPoster(studioId: string, dataUrl: string) {
  if (typeof window === "undefined") return;
  const key = posterStorageKey(studioId);
  try {
    localStorage.setItem(key, dataUrl);
    if (localStorage.getItem(key) !== dataUrl) {
      throw new Error("Не удалось сохранить афишу");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Не удалось сохранить афишу") {
      throw error;
    }
    throw new Error(
      "Не хватило места для афиши. Выберите файл поменьше или освободите память браузера.",
    );
  }
}

export function removeStudioPoster(studioId: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(posterStorageKey(studioId));
  } catch {
    // ignore
  }
}

export { readImageFileAsDataUrl };
