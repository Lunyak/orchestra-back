import dayjs from "dayjs";
import "dayjs/locale/ru";

export function isoDate(d: Date): string {
  return dayjs(d).format("YYYY-MM-DD");
}

export type IsoDayRange = { from: string; to: string };

export function orderIsoDayRange(a: string, b: string): IsoDayRange {
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

export function isIsoInDayRange(
  dayIso: string,
  range: IsoDayRange | null,
): boolean {
  if (!range) return false;
  return dayIso >= range.from && dayIso <= range.to;
}

export function countDaysInIsoRange(range: IsoDayRange): number {
  return dayjs(range.to).diff(dayjs(range.from), "day") + 1;
}

export function formatIsoDayRangeLabel(range: IsoDayRange): string {
  const start = dayjs(range.from).locale("ru");
  const end = dayjs(range.to).locale("ru");
  if (range.from === range.to) return start.format("D MMMM");
  if (start.year() === end.year() && start.month() === end.month()) {
    return `${start.format("D")}–${end.format("D MMMM")}`;
  }
  if (start.year() === end.year()) {
    return `${start.format("D MMMM")} – ${end.format("D MMMM")}`;
  }
  return `${start.format("D MMMM YYYY")} – ${end.format("D MMMM YYYY")}`;
}

export function ruDayCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} день`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return `${count} дня`;
  }
  return `${count} дней`;
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

export type TroupePeopleView = "list" | "tiles";

const TROUPE_PEOPLE_VIEW_KEY = "orchestra.troupe.peopleView";
const TROUPE_NARROW_MQ = "(max-width: 720px)";

export function readTroupePeopleView(): TroupePeopleView {
  if (typeof window === "undefined") return "tiles";
  return window.localStorage.getItem(TROUPE_PEOPLE_VIEW_KEY) === "list"
    ? "list"
    : "tiles";
}

export function writeTroupePeopleView(view: TroupePeopleView) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TROUPE_PEOPLE_VIEW_KEY, view);
}

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
