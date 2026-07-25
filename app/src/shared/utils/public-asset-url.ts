/**
 * Собирает URL для файлов из public/ с учётом Vite BASE_URL (/orkestr/ и т.д.).
 * Для theater/* при заданном VITE_THEATER_ASSETS_BASE_URL — MinIO/S3
 * (обычно `{S3_PUBLIC_URL}/{S3_BUCKET}`).
 */
export function resolvePublicAssetUrl(pathname: string): string {
  const path = String(pathname ?? "").replace(/^\/+/, "");
  const isTheaterAsset = path === "theater" || path.startsWith("theater/");
  const theaterAssetsBase = String(
    (import.meta as ImportMeta).env?.VITE_THEATER_ASSETS_BASE_URL ?? "",
  )
    .trim()
    .replace(/\/+$/, "");

  if (isTheaterAsset && theaterAssetsBase) {
    return `${theaterAssetsBase}/${path}`;
  }

  const rawBase = String((import.meta as ImportMeta).env?.BASE_URL ?? "/").trim() || "/";
  const baseWithSlash = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;

  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      const absoluteBase = new URL(baseWithSlash, window.location.origin);
      return new URL(path, absoluteBase).href;
    } catch {
      // fallback below
    }
  }

  if (/^https?:\/\//i.test(baseWithSlash)) {
    try {
      return new URL(path, baseWithSlash).href;
    } catch {
      // fallback below
    }
  }

  return `${baseWithSlash}${path}`.replace(/([^:]\/)\/+/g, "$1");
}
