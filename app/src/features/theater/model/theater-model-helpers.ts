export const MODEL_TRANSFORM_HISTORY_GRACE_MS = 400;

export const THEATER_MODEL_FILE_ACCEPT =
  ".glb,.gltf,model/gltf-binary,model/gltf+json";

export function readTheaterAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem("accessToken");
  } catch {
    return null;
  }
}

export function modelDisplayNameFromFileName(fileName: string): string {
  const base = fileName.replace(/^.*[/\\]/, "").trim();
  return base.replace(/\.[^.]+$/, "") || base || "Модель";
}
