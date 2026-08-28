import type { MonthCalendarEvent } from "@shared/components/calendar/MonthCalendar";
import dayjs from "dayjs";
import {
  projectSessionPath,
  theaterRehearsalSessionPath,
} from "../../../app/router/paths";
import type { TheaterRehearsal } from "../../../sync/api/workspaces";
import {
  directorSessionBusySpanMin,
  formatTimeHHMM,
  getSessionStartLocalMinutes,
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
} from "../../director-sessions";

export const REHEARSAL_HISTORY_DAYS = 30;
export const REHEARSAL_FUTURE_DAYS = 180;
export const DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
export const DEFAULT_REHEARSAL_TIME = "20:00";
export const CREATE_TIME_STEP_MIN = 5;
export const CREATE_TIME_MIN = 8 * 60;
export const CREATE_TIME_MAX = 23 * 60 + 30;
/** Длительность новой репетиции (первый слот). */
export const DEFAULT_CREATE_DURATION_MIN = 30;
/** Если нет duration/слотов — минимальный блок занятости. */
export const FALLBACK_BUSY_DURATION_MIN = 30;

export type BusyRange = {
  startMin: number;
  endMin: number;
};

export type RehearsalSlotPreview = {
  id: string;
  time: string;
  label: string;
  isProgRun?: boolean;
};

export function rehearsalRange() {
  const now = Date.now();
  return {
    from: new Date(
      now - REHEARSAL_HISTORY_DAYS * DAY_IN_MILLISECONDS,
    ).toISOString(),
    to: new Date(
      now + REHEARSAL_FUTURE_DAYS * DAY_IN_MILLISECONDS,
    ).toISOString(),
  };
}

export function dateKey(value: string) {
  const date = dayjs(value);
  return date.isValid() ? date.format("YYYY-MM-DD") : "";
}

export function parseTimeToMinutes(time: string): number | null {
  const match = String(time ?? "")
    .trim()
    .match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
}

export function formatMinutesToTime(totalMin: number): string {
  const normalized =
    ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(normalized / 60)).padStart(2, "0");
  const minutes = String(normalized % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDurationLabel(durationMin: number): string {
  const total = Math.max(1, Math.floor(durationMin));
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours > 0 && minutes > 0) return `${hours} ч ${minutes} мин`;
  if (hours > 0) return `${hours} ч`;
  return `${minutes} мин`;
}

export function sessionSpanMin(session: DirectorRehearsalSession): number {
  return directorSessionBusySpanMin(session);
}

export function rehearsalSpanMin(
  rehearsal: TheaterRehearsal,
  bundleSessions: DirectorRehearsalSession[],
): number {
  if (rehearsal.source === "director-session") {
    const session = bundleSessions.find((item) => item.id === rehearsal.id);
    if (session) return sessionSpanMin(session);
  }
  const fromApi = Math.floor(Number(rehearsal.durationMin) || 0);
  if (fromApi > 0) return fromApi;
  return FALLBACK_BUSY_DURATION_MIN;
}

export function rangesOverlap(
  startA: number,
  endA: number,
  startB: number,
  endB: number,
): boolean {
  return startA < endB && startB < endA;
}

export function collectBusyRanges(
  dayRehearsals: TheaterRehearsal[],
  bundleSessions: DirectorRehearsalSession[],
  theaterId: string,
  selectedDate: string,
  excludeSessionId?: string | null,
): BusyRange[] {
  const ranges: BusyRange[] = [];
  const seenSessionIds = new Set<string>();
  const excludedId = String(excludeSessionId ?? "").trim();

  for (const rehearsal of dayRehearsals) {
    if (excludedId && rehearsal.id === excludedId) continue;
    const startMin = getSessionStartLocalMinutes(rehearsal.startsAt);
    if (!Number.isFinite(startMin)) continue;
    const span = rehearsalSpanMin(rehearsal, bundleSessions);
    ranges.push({ startMin, endMin: startMin + span });
    if (rehearsal.source === "director-session") {
      seenSessionIds.add(rehearsal.id);
    }
  }

  for (const session of bundleSessions) {
    if (excludedId && session.id === excludedId) continue;
    if (String(session.theaterId ?? "").trim() !== theaterId) continue;
    if (dateKey(session.startsAt) !== selectedDate) continue;
    if (seenSessionIds.has(session.id)) continue;
    const startMin = getSessionStartLocalMinutes(session.startsAt);
    if (!Number.isFinite(startMin)) continue;
    const span = sessionSpanMin(session);
    ranges.push({ startMin, endMin: startMin + span });
  }

  return ranges;
}

export function isStartBlockedByRanges(
  startMin: number,
  durationMin: number,
  ranges: BusyRange[],
): boolean {
  const endMin = startMin + Math.max(1, durationMin);
  return ranges.some((range) =>
    rangesOverlap(startMin, endMin, range.startMin, range.endMin),
  );
}

export function nextFreeRehearsalTime(
  ranges: BusyRange[],
  preferred = DEFAULT_REHEARSAL_TIME,
  durationMin = DEFAULT_CREATE_DURATION_MIN,
): string {
  const preferredMin = parseTimeToMinutes(preferred) ?? CREATE_TIME_MIN;
  const duration = Math.max(1, durationMin);
  for (
    let minute = preferredMin;
    minute <= CREATE_TIME_MAX;
    minute += CREATE_TIME_STEP_MIN
  ) {
    if (!isStartBlockedByRanges(minute, duration, ranges)) {
      return formatMinutesToTime(minute);
    }
  }
  for (
    let minute = CREATE_TIME_MIN;
    minute < preferredMin;
    minute += CREATE_TIME_STEP_MIN
  ) {
    if (!isStartBlockedByRanges(minute, duration, ranges)) {
      return formatMinutesToTime(minute);
    }
  }
  return preferred;
}

export function rehearsalDetailsPath(
  theaterId: string,
  rehearsal: TheaterRehearsal,
) {
  if (rehearsal.source === "director-session") {
    return theaterRehearsalSessionPath(theaterId, rehearsal.id);
  }
  return projectSessionPath(rehearsal.project.slug);
}

export function rehearsalProjectsLabel(rehearsal: TheaterRehearsal) {
  const projects = rehearsal.projects.length
    ? rehearsal.projects
    : [rehearsal.project];
  return projects
    .map((project) => project.name)
    .filter(Boolean)
    .join(" · ");
}

function slotPreviewLabel(slot: DirectorSessionSlot): string {
  if (slot.isProgRun) return "ПРОГОН";
  const customTitle = String(slot.title ?? "").trim();
  if (customTitle) return customTitle;
  const projectSlug = String(slot.ref?.projectSlug ?? "").trim();
  const sceneId = Number(slot.ref?.sceneId);
  if (projectSlug && Number.isFinite(sceneId) && sceneId > 0) {
    return `${projectSlug} · сцена #${sceneId}`;
  }
  if (projectSlug) return projectSlug;
  return "Слот без названия";
}

export function rehearsalSlotPreviews(
  rehearsal: TheaterRehearsal,
  bundleSessions: DirectorRehearsalSession[],
): RehearsalSlotPreview[] {
  if (rehearsal.source !== "director-session") return [];
  const session = bundleSessions.find((item) => item.id === rehearsal.id);
  if (!session) return [];
  const baseMin = getSessionStartLocalMinutes(session.startsAt);
  return [...(session.slots ?? [])]
    .sort(
      (a, b) =>
        Math.floor(Number(a.offsetMin) || 0) -
        Math.floor(Number(b.offsetMin) || 0),
    )
    .map((slot) => {
      const offset = Math.max(0, Math.floor(Number(slot.offsetMin) || 0));
      return {
        id: slot.id,
        time: formatTimeHHMM(baseMin + offset),
        label: slotPreviewLabel(slot),
        isProgRun: Boolean(slot.isProgRun),
      };
    });
}

export function groupRehearsalsByDate(rehearsals: TheaterRehearsal[]) {
  const grouped = new Map<string, TheaterRehearsal[]>();
  for (const rehearsal of rehearsals) {
    const key = dateKey(rehearsal.startsAt);
    if (!key) continue;
    const list = grouped.get(key);
    if (list) list.push(rehearsal);
    else grouped.set(key, [rehearsal]);
  }
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }
  return grouped;
}

export function dotsFromRehearsalsByDate(
  rehearsalsByDate: Map<string, TheaterRehearsal[]>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [date, list] of rehearsalsByDate.entries()) {
    out[date] = list.length;
  }
  return out;
}

export function eventsFromRehearsalsByDate(
  rehearsalsByDate: Map<string, TheaterRehearsal[]>,
): Record<string, MonthCalendarEvent[]> {
  const out: Record<string, MonthCalendarEvent[]> = {};
  for (const [date, list] of rehearsalsByDate.entries()) {
    out[date] = list.map((rehearsal) => {
      const startMin = getSessionStartLocalMinutes(rehearsal.startsAt);
      return {
        id: `${rehearsal.source}:${rehearsal.id}`,
        time: formatTimeHHMM(startMin),
        title: rehearsal.title,
        published: Boolean(rehearsal.publishedAt),
      };
    });
  }
  return out;
}
