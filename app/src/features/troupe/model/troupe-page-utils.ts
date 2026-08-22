import dayjs from "dayjs";
import "dayjs/locale/ru";

export function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

export function monthKey(d: Date): string {
  return dayjs(d).format("YYYY-MM");
}

export function monthLabel(d: Date): string {
  return dayjs(d).locale("ru").format("MMMM YYYY");
}

export function currentMonthStart(): Date {
  return dayjs().startOf("month").toDate();
}

export function dateFromMonthKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  if (!Number.isFinite(y) || mo < 0 || mo > 11) return null;
  return new Date(y, mo, 1);
}

export function memberLabel(m: {
  email: string;
  profile: {
    displayName?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    avatarUrl?: string | null;
    avatarSmallUrl?: string | null;
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
