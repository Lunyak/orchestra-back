const PROJECT_POSTER_KEY_PREFIX = "projectPoster:";
const MAX_INPUT_BYTES = 8_000_000;
const MAX_EDGE_PX = 900;
const JPEG_QUALITY = 0.82;

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
  if (typeof window === "undefined") return;
  const key = posterStorageKey(projectSlug);
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

export function removeProjectPoster(projectSlug: string) {
  try {
    if (typeof window === "undefined") return;
    localStorage.removeItem(posterStorageKey(projectSlug));
  } catch {
    // ignore
  }
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
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

function compressDataUrl(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const longestEdge = Math.max(image.width, image.height);
      const scale = Math.min(1, MAX_EDGE_PX / Math.max(1, longestEdge));
      const width = Math.max(1, Math.round(image.width * scale));
      const height = Math.max(1, Math.round(image.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(dataUrl);
        return;
      }
      context.drawImage(image, 0, 0, width, height);
      try {
        resolve(canvas.toDataURL("image/jpeg", JPEG_QUALITY));
      } catch {
        resolve(dataUrl);
      }
    };
    image.onerror = () =>
      reject(new Error("Не удалось обработать изображение"));
    image.src = dataUrl;
  });
}

export async function readImageFileAsDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Выберите изображение");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("Файл слишком большой (макс. ~8 МБ)");
  }
  const rawDataUrl = await readFileAsDataUrl(file);
  return compressDataUrl(rawDataUrl);
}
