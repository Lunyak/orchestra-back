/**
 * Собирает URL для файлов из public/ с учётом Vite BASE_URL (/orkestr/ и т.д.).
 * Не использует `new URL(path, BASE_URL)` напрямую — пустой или относительный base ломает конструктор.
 */
export function resolvePublicAssetUrl(pathname: string): string {
  const path = String(pathname ?? "").replace(/^\/+/, "");
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
