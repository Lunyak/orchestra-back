import { siteAsset } from "./siteAssets";

export type SiteCastItem = {
  role: string;
  actor: string;
};

export type SiteEvent = {
  id: string;
  soon: boolean;
  name: string;
  subtitle?: string;
  old?: string;
  anonse?: string;
  date?: string;
  img: string;
  type?: string;
  colorBackground?: number;
  photos?: string[];
  cast?: SiteCastItem[];
};

type SiteEventsContent = {
  version?: number;
  updatedAt?: string;
  events: SiteEvent[];
};

const EVENTS_URL = siteAsset("/content/events.json");
const CACHE_KEY = "site:events-json:v1";

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function isValidContent(x: any): x is SiteEventsContent {
  return x && typeof x === "object" && Array.isArray(x.events);
}

export async function fetchSiteEvents(opts?: {
  timeoutMs?: number;
  cache?: boolean;
}): Promise<SiteEvent[] | null> {
  const timeoutMs = Math.max(1000, Math.min(20000, Math.trunc(opts?.timeoutMs ?? 5000)));
  const cache = opts?.cache !== false;

  if (cache) {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = safeJsonParse<SiteEventsContent>(cached);
      if (parsed && isValidContent(parsed)) return parsed.events;
    }
  }

  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) return null;
    const text = await res.text();
    const parsed = safeJsonParse<SiteEventsContent>(text);
    if (!parsed || !isValidContent(parsed)) return null;
    if (cache) sessionStorage.setItem(CACHE_KEY, JSON.stringify(parsed));
    return parsed.events;
  } catch {
    return null;
  } finally {
    window.clearTimeout(t);
  }
}

