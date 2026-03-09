import { siteAsset } from "./siteAssets";

export type SiteMarqueeContent = {
  version?: number;
  updatedAt?: string;
  /** lines (will be repeated) */
  items: string[];
  /** seconds */
  duration?: number;
};

const URL = siteAsset("/content/marquee.json");
const CACHE_KEY = "site:marquee-json:v1";

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function fetchSiteMarquee(opts?: {
  timeoutMs?: number;
  cache?: boolean;
}): Promise<SiteMarqueeContent | null> {
  const timeoutMs = Math.max(1000, Math.min(20000, Math.trunc(opts?.timeoutMs ?? 4000)));
  const cache = opts?.cache !== false;

  if (cache) {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = safeJsonParse<SiteMarqueeContent>(cached);
      if (parsed && Array.isArray(parsed.items)) return parsed;
    }
  }

  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(URL, { cache: "no-store", signal: ac.signal });
    if (!res.ok) return null;
    const text = await res.text();
    const parsed = safeJsonParse<SiteMarqueeContent>(text);
    if (!parsed || !Array.isArray(parsed.items)) return null;
    if (cache) sessionStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
    return parsed;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

