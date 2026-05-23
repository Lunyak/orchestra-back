import dayjs from "dayjs";

export function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

export function monthKey(d: Date): string {
  return dayjs(d).format("YYYY-MM");
}

export function dateFromMonthKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (!Number.isFinite(y) || mo < 0 || mo > 11) return null;
  return new Date(y, mo, 1);
}

export function readStoredTroupeMonth(): Date {
  if (typeof window === "undefined") return new Date();
  try {
    const saved = localStorage.getItem("troupe-month");
    if (!saved) return new Date();
    const t = saved.trim();
    const fromKey = dateFromMonthKey(t);
    if (fromKey) return fromKey;
    if (t.includes("T") || t.length > 7) {
      return new Date();
    }
    const legacy = new Date(t);
    return !isNaN(legacy.getTime())
      ? dayjs(legacy).startOf("month").toDate()
      : new Date();
  } catch {
    return new Date();
  }
}

export function memberLabel(m: {
  email: string;
  profile: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
  } | null;
}): string {
  const p = m.profile;
  const display = String(p?.displayName ?? "").trim();
  if (display) return display;
  const full =
    `${String(p?.firstName ?? "").trim()} ${String(p?.lastName ?? "").trim()}`.trim();
  if (full) return full;
  return m.email;
}

const TROUPE_NARROW_MQ = "(max-width: 720px)";

export function subscribeTroupeNarrowLayout(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia(TROUPE_NARROW_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

export function getTroupeNarrowLayoutSnapshot(): boolean {
  return typeof window !== "undefined"
    ? window.matchMedia(TROUPE_NARROW_MQ).matches
    : false;
}
