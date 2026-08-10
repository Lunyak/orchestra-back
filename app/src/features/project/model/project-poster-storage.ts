const PROJECT_POSTER_KEY_PREFIX = "projectPoster:";

function posterStorageKey(projectSlug: string) {
  return `${PROJECT_POSTER_KEY_PREFIX}${projectSlug}`;
}

export function readProjectPoster(projectSlug: string): string | null {
  try {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(posterStorageKey(projectSlug));
  } catch {
    return null;
  }
}

export function storeProjectPoster(projectSlug: string, dataUrl: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.setItem(posterStorageKey(projectSlug), dataUrl);
  } catch {
    // ignore quota / private mode
  }
}

export function removeProjectPoster(projectSlug: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(posterStorageKey(projectSlug));
  } catch {
    // ignore
  }
}

const MAX_POSTER_BYTES = 1_500_000;

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Выберите изображение"));
      return;
    }
    if (file.size > MAX_POSTER_BYTES) {
      reject(new Error("Файл слишком большой (макс. ~1.5 МБ)"));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        resolve(result);
        return;
      }
      reject(new Error("Не удалось прочитать файл"));
    };
    reader.onerror = () => reject(new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}
