import { siteAsset } from "./siteAssets";

export type SiteCastItem = {
  role: string;
  actor: string;
};

export type SiteReview = {
  text: string;
  author?: string;
};

export type SiteEvent = {
  /** Human-readable identifier used in URLs: /события/:slug */
  slug: string;
  soon: boolean;
  name: string;
  subtitle?: string;
  old?: string;
  anonse?: string;
  date?: string;
  /** Card/preview image for Events page */
  cardImage: string;
  /** Optional background image for Event page */
  eventPageBg?: string;
  /** Disable frosted glass overlay on Event page */
  disableGlass?: boolean;
  type?: string;
  colorBackground?: number;
  photos?: string[];
  cast?: SiteCastItem[];
  /** TicketCloud продажи билетов (опционально) */
  ticketsCloudEventId?: string;
  ticketsCloudToken?: string;
  /** Отзывы (опционально) */
  reviews?: SiteReview[];
  /** Отзывы-картинки (опционально) */
  reviewImages?: string[];
  /** Амбиент (дождь): аудио и название кнопки (опционально) */
  rainAudioUrl?: string;
  rainButtonLabel?: string;
};

type SiteEventsContent = {
  version?: number;
  updatedAt?: string;
  events: SiteEvent[];
};

const EVENTS_URL = siteAsset("/content/events.json");
const CACHE_KEY = "site:events-json:v2";

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

/** Same data as last successful `fetchSiteEvents` (sessionStorage). Safe for first paint — avoids stale hardcoded fallbacks. */
export function readSiteEventsCache(): SiteEvent[] | null {
  if (typeof window === "undefined") return null;
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = safeJsonParse<SiteEventsContent>(cached);
    if (!parsed || !isValidContent(parsed)) return null;
    const events = parsed.events ?? [];
    return events.length ? (events as SiteEvent[]) : null;
  } catch {
    return null;
  }
}

function normalizeEvent(raw: any): SiteEvent | null {
  if (!raw || typeof raw !== "object") return null;

  const slugRaw = typeof raw.slug === "string" ? raw.slug : typeof raw.id === "string" ? raw.id : "";
  const slug = slugRaw.trim();
  const name = typeof raw.name === "string" ? raw.name : "";
  const cardImageRaw =
    typeof raw.cardImage === "string"
      ? raw.cardImage
      : typeof raw.img === "string"
        ? raw.img
        : "";
  const cardImage = cardImageRaw.trim();

  if (!slug || !name.trim() || !cardImage) return null;

  const soon = Boolean(raw.soon);
  const subtitle = typeof raw.subtitle === "string" ? raw.subtitle : undefined;
  const old = typeof raw.old === "string" ? raw.old : undefined;
  const anonse = typeof raw.anonse === "string" ? raw.anonse : undefined;
  const date = typeof raw.date === "string" ? raw.date : undefined;
  const type = typeof raw.type === "string" ? raw.type : undefined;
  const colorBackground =
    typeof raw.colorBackground === "number" ? raw.colorBackground : undefined;
  const photos = Array.isArray(raw.photos) ? raw.photos.filter((x: any) => typeof x === "string") : undefined;
  const cast = Array.isArray(raw.cast)
    ? raw.cast
        .map((x: any) =>
          x && typeof x === "object" && typeof x.role === "string" && typeof x.actor === "string"
            ? { role: x.role, actor: x.actor }
            : null
        )
        .filter(Boolean)
    : undefined;
  const eventPageBg =
    typeof raw.eventPageBg === "string"
      ? raw.eventPageBg
      : typeof raw.bgImage === "string"
        ? raw.bgImage
        : undefined;
  const disableGlass = raw.disableGlass === true ? true : undefined;

  const ticketsCloudEventId =
    typeof raw.ticketsCloudEventId === "string" ? raw.ticketsCloudEventId.trim() : undefined;
  const ticketsCloudToken =
    typeof raw.ticketsCloudToken === "string" ? raw.ticketsCloudToken.trim() : undefined;

  const reviewsRaw = Array.isArray(raw.reviews) ? raw.reviews : null;
  const reviews = reviewsRaw
    ? (reviewsRaw
        .map((x: any) => {
          if (typeof x === "string") {
            const text = x.trim();
            return text ? ({ text } satisfies SiteReview) : null;
          }
          if (x && typeof x === "object") {
            const text = typeof x.text === "string" ? x.text.trim() : "";
            if (!text) return null;
            const author = typeof x.author === "string" ? x.author.trim() : "";
            return (author ? { text, author } : { text }) satisfies SiteReview;
          }
          return null;
        })
        .filter(Boolean) as SiteReview[])
    : undefined;

  const reviewImages =
    Array.isArray(raw.reviewImages)
      ? (raw.reviewImages
          .map((x: any) => (typeof x === "string" ? x.trim() : ""))
          .filter(Boolean) as string[])
      : undefined;

  const rainAudioUrl =
    typeof raw.rainAudioUrl === "string" ? raw.rainAudioUrl.trim() : undefined;
  const rainButtonLabel =
    typeof raw.rainButtonLabel === "string" ? raw.rainButtonLabel.trim() : undefined;

  return {
    slug,
    soon,
    name: name.trim(),
    subtitle,
    old,
    anonse,
    date,
    cardImage,
    ...(disableGlass ? { disableGlass: true } : null),
    type,
    colorBackground,
    photos,
    cast,
    eventPageBg,
    ...(ticketsCloudEventId ? { ticketsCloudEventId } : null),
    ...(ticketsCloudToken ? { ticketsCloudToken } : null),
    ...(reviews && reviews.length ? { reviews } : null),
    ...(reviewImages && reviewImages.length ? { reviewImages } : null),
    ...(rainAudioUrl ? { rainAudioUrl } : null),
    ...(rainButtonLabel ? { rainButtonLabel } : null),
  };
}

export async function fetchSiteEvents(opts?: {
  timeoutMs?: number;
  cache?: boolean;
}): Promise<SiteEvent[] | null> {
  const timeoutMs = Math.max(1000, Math.min(20000, Math.trunc(opts?.timeoutMs ?? 5000)));
  const cache = opts?.cache !== false;

  const cachedEvents = (() => {
    if (!cache) return null;
    const cached = sessionStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    const parsed = safeJsonParse<SiteEventsContent>(cached);
    return parsed && isValidContent(parsed) ? parsed.events : null;
  })();

  const ac = new AbortController();
  const t = window.setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(EVENTS_URL, {
      cache: "no-store",
      signal: ac.signal,
    });
    if (!res.ok) return cachedEvents;
    const text = await res.text();
    const parsed = safeJsonParse<SiteEventsContent>(text);
    if (!parsed || !isValidContent(parsed)) return cachedEvents;
    const normalized = (parsed.events ?? []).map(normalizeEvent).filter(Boolean) as SiteEvent[];
    const cachedValue: SiteEventsContent = {
      version: parsed.version,
      updatedAt: parsed.updatedAt,
      events: normalized,
    };
    if (cache) sessionStorage.setItem(CACHE_KEY, JSON.stringify(cachedValue));
    return normalized;
  } catch {
    return cachedEvents;
  } finally {
    window.clearTimeout(t);
  }
}

