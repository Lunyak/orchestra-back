function isAbsoluteUrlLike(value: string): boolean {
  const v = (value ?? "").trim();
  return v.startsWith("http://") || v.startsWith("https://");
}

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function stripLeadingSlash(value: string): string {
  return value.replace(/^\/+/, "");
}

function normalizePublicPath(value: string): string {
  const v = (value ?? "").trim();
  if (!v) return v;
  if (isAbsoluteUrlLike(v)) return v;
  return v.startsWith("/") ? v : `/${v}`;
}

/**
 * Hardcoded base URL for site media (posters/photos/actors).
 *
 * This is intentionally NOT configurable via env right now (per request) to
 * avoid extra deployment variables. When we finish migration and want flexibility,
 * we can switch it back to env.
 */
// Use same-origin proxy to avoid Mixed Content when site is served over HTTPS.
// Caddy proxies /minio/* -> minio:9000.
const SITE_ASSETS_BASE_URL = '/minio/orchestra-media/site';

/**
 * Convert a site media reference into a URL.
 *
 * - If input is already absolute (http/https), returns it unchanged.
 * - Otherwise, ensures it starts with "/" and prefixes with SITE_ASSETS_BASE_URL.
 *
 * Example:
 *  - SITE_ASSETS_BASE_URL="http://213.226.126.196:9000/orchestra-media/site"
 *  - siteAsset("/photos/vassa/0.jpg") -> "http://213.226.126.196:9000/orchestra-media/site/photos/vassa/0.jpg"
 */
export function siteAsset(pathOrUrl: string): string {
  const normalized = normalizePublicPath(pathOrUrl);
  if (!normalized) return normalized;
  if (isAbsoluteUrlLike(normalized)) return normalized;
  return `${stripTrailingSlash(SITE_ASSETS_BASE_URL)}/${stripLeadingSlash(normalized)}`;
}

export function isAbsoluteUrl(value: string): boolean {
  return isAbsoluteUrlLike(value);
}

