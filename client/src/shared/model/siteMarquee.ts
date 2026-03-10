import { siteAsset } from "./siteAssets";

export type SiteMarqueeContent = {
  version?: number;
  updatedAt?: string;
  /** lines (will be repeated) */
  items: string[];
  /** seconds */
  duration?: number;
  /** Optional home page ambient audio toggle */
  homeAudioUrl?: string;
  homeAudioLabel?: string;
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

  const cachedValue = (() => {
    if (!cache) return null;
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = safeJsonParse<SiteMarqueeContent>(cached);
    return parsed && Array.isArray(parsed.items) ? parsed : null;
  })();

  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(URL, { cache: "no-store", signal: ac.signal });
    if (!res.ok) return cachedValue;
    const text = await res.text();
    const parsed = safeJsonParse<any>(text);
    if (!parsed || !Array.isArray(parsed.items)) return cachedValue;

    const items = (parsed.items as any[])
      .filter((x) => typeof x === "string")
      .map((s) => s.trim())
      .filter(Boolean);
    const duration =
      typeof parsed.duration === "number" && Number.isFinite(parsed.duration) ? parsed.duration : undefined;
    const homeAudioUrl = typeof parsed.homeAudioUrl === "string" ? parsed.homeAudioUrl.trim() : "";
    const homeAudioLabel = typeof parsed.homeAudioLabel === "string" ? parsed.homeAudioLabel.trim() : "";

    const normalized: SiteMarqueeContent = {
      version: typeof parsed.version === "number" ? parsed.version : undefined,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : undefined,
      items,
      ...(typeof duration === "number" ? { duration } : null),
      ...(homeAudioUrl ? { homeAudioUrl } : null),
      ...(homeAudioLabel ? { homeAudioLabel } : null),
    };

    if (cache) sessionStorage.setItem(CACHE_KEY, JSON.stringify(normalized));
    return normalized;
  } catch {
    return cachedValue;
  } finally {
    window.clearTimeout(t);
  }
}

