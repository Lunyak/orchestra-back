import type { AvailabilityStatus, AvailabilityTimeRange } from "./availability-calendar";
import { getAvailabilityDayVisual } from "./availability-calendar";
import type { DirectorSession } from "../../../sync/api/director-sessions";

export type OccupancyContextKind = "theater" | "project" | "studio";

export type OccupancyContextCard = {
  id: string;
  kind: OccupancyContextKind;
  title: string;
  href: string;
  sessionCount: number;
  studioImageUrl?: string | null;
};

export type MonthAvailabilityPulse = {
  free: number;
  busy: number;
  partial: number;
  unknown: number;
  marked: number;
  total: number;
  fillRatio: number;
};

export const OCCUPANCY_KIND_LABEL: Record<OccupancyContextKind, string> = {
  theater: "Театр",
  project: "Проект",
  studio: "Студия",
};

export function matchesOccupancyContextQuery(
  context: OccupancyContextCard,
  query: string,
): boolean {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return true;
  return context.title.toLocaleLowerCase("ru").includes(needle);
}

export function listMonthIsoDates(monthIso: string): string[] {
  const seed = monthIso.trim();
  const start = seed ? new Date(`${seed.slice(0, 7)}-01T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime())) return [];
  const year = start.getFullYear();
  const month = start.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const dates: string[] = [];
  for (let day = 1; day <= lastDay; day += 1) {
    const mm = String(month + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    dates.push(`${year}-${mm}-${dd}`);
  }
  return dates;
}

export function countMonthAvailabilityPulse(
  calendar: Record<string, AvailabilityStatus> | null | undefined,
  ranges: Record<string, AvailabilityTimeRange[]> | null | undefined,
  monthIso: string,
): MonthAvailabilityPulse {
  const dates = listMonthIsoDates(monthIso);
  let free = 0;
  let busy = 0;
  let partial = 0;
  let unknown = 0;

  for (const dateIso of dates) {
    const visual = getAvailabilityDayVisual(calendar, ranges, dateIso).cls;
    if (visual === "free") free += 1;
    else if (visual === "busy") busy += 1;
    else if (visual === "partial") partial += 1;
    else unknown += 1;
  }

  const total = dates.length;
  const marked = free + busy + partial;
  return {
    free,
    busy,
    partial,
    unknown,
    marked,
    total,
    fillRatio: total > 0 ? marked / total : 0,
  };
}

export function sessionProjectSlug(session: DirectorSession): string | null {
  for (const slot of session.slots ?? []) {
    const slug = String(slot.ref?.projectSlug ?? "").trim();
    if (slug) return slug;
  }
  return null;
}

export function countSessionsForContext(
  sessions: DirectorSession[],
  kind: OccupancyContextKind,
  contextId: string,
): number {
  const id = contextId.trim();
  if (!id) return 0;
  return sessions.filter((session) => {
    if (kind === "theater") {
      return String(session.theaterId ?? "").trim() === id;
    }
    if (kind === "project") {
      return sessionProjectSlug(session) === id;
    }
    return false;
  }).length;
}

export function dayStatusLabel(
  calendar: Record<string, AvailabilityStatus> | null | undefined,
  ranges: Record<string, AvailabilityTimeRange[]> | null | undefined,
  dateIso: string,
): string {
  return getAvailabilityDayVisual(calendar, ranges, dateIso).tooltip;
}
