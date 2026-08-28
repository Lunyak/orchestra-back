import type { CalendarSectionState } from "@shared/components/calendar/CalendarSection";
import type { MonthCalendarEvent } from "@shared/components/calendar/MonthCalendar";
import dayjs from "dayjs";
import type { TeamProfile } from "../../../sync/api/profile";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import {
  findDirectorSessionBusyConflict,
  findDirectorSessionParticipant,
  formatTimeHHMM,
  getSessionStartLocalMinutes,
  isDirectorSessionPublished,
  looksLikeEmail,
  normalizeEmail,
  profileHasSpecifiedAvailabilityForDate,
  toDateKey,
} from "./session-page-utils";
import { getEmailsPlannedForDirectorSlot } from "./session-slot-planned";
import {
  buildSessionSlotInsights,
  computeSlotGatherStatus,
} from "./session-slot-insights";
import type {
  DaySessionPreview,
  ProjectDataCache,
  SessionsSideCalledStatusTone,
  SlotGatherStatus,
  SlotInsight,
} from "./session-page-types";
import type { SessionsSideCalledRow } from "./director-sessions-page-types";

export function sessionUsesProject(
  session: DirectorRehearsalSession,
  projectSlug: string,
) {
  if (session.projectSlugs?.includes(projectSlug)) return true;
  return session.slots.some((slot) => slot.ref?.projectSlug === projectSlug);
}

export function createInitialCalendarState(): CalendarSectionState {
  const today = toDateKey(new Date());
  const d = new Date(`${today}T12:00:00`);
  const monthStart = new Date(d.getFullYear(), d.getMonth(), 1);
  const monthEnd = new Date(
    d.getFullYear(),
    d.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  return {
    currentMonth: d,
    selectedDate: today,
    viewMode: "month",
    monthStartDate: monthStart,
    monthEndDate: monthEnd,
    fromIso: monthStart.toISOString(),
    toIso: monthEnd.toISOString(),
  };
}

export function attachKnownPublishedAt(
  list: DirectorRehearsalSession[],
  publishedAtBySessionId: Map<string, string>,
): DirectorRehearsalSession[] {
  return list.map((s) => {
    const id = String(s?.id ?? "").trim();
    if (!id) return s;
    if (String(s.publishedAt ?? "").trim()) return s;
    const prev = publishedAtBySessionId.get(id);
    return prev && String(prev).trim() ? { ...s, publishedAt: prev } : s;
  });
}

export function rememberPublishedAt(
  sessions: DirectorRehearsalSession[],
  publishedAtBySessionId: Map<string, string>,
) {
  for (const s of sessions ?? []) {
    const id = String(s?.id ?? "").trim();
    const p = String(s.publishedAt ?? "").trim();
    if (id && p) publishedAtBySessionId.set(id, String(s.publishedAt));
  }
}

export function groupSessionsByDate(
  sessions: DirectorRehearsalSession[],
): Map<string, DirectorRehearsalSession[]> {
  const grouped = new Map<string, DirectorRehearsalSession[]>();
  for (const session of sessions) {
    const d = new Date(session.startsAt);
    if (!Number.isFinite(d.getTime())) continue;
    const key = toDateKey(d);
    const arr = grouped.get(key);
    if (arr) arr.push(session);
    else grouped.set(key, [session]);
  }
  for (const list of grouped.values()) {
    list.sort(
      (a, b) =>
        new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  }
  return grouped;
}

export function buildDotsByDate(
  sessionsByDate: Map<string, DirectorRehearsalSession[]>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [date, list] of sessionsByDate.entries()) {
    out[date] = list.length;
  }
  return out;
}

export function buildEventsByDate(
  sessionsByDate: Map<string, DirectorRehearsalSession[]>,
): Record<string, MonthCalendarEvent[]> {
  const out: Record<string, MonthCalendarEvent[]> = {};
  for (const [date, list] of sessionsByDate.entries()) {
    out[date] = list.map((s) => ({
      id: s.id,
      time: formatTimeHHMM(getSessionStartLocalMinutes(s.startsAt)),
      title: String(s.title ?? "Сессия").trim() || "Сессия",
      published: isDirectorSessionPublished(s),
    }));
  }
  return out;
}

export function resolveCreateSessionTime(params: {
  dateKey: string;
  preferredTime: string;
  sessions: DirectorRehearsalSession[];
  projectSlugs?: string[];
  durationMin?: number;
}): { time: string } | { error: string } {
  const {
    dateKey: dk,
    preferredTime,
    sessions,
    projectSlugs,
    durationMin = 30,
  } = params;
  const preferred = String(preferredTime ?? "").trim() || "20:00";
  const preferredMatch = preferred.match(/^(\d{1,2}):(\d{2})$/);
  const preferredMin = preferredMatch
    ? Number(preferredMatch[1]) * 60 + Number(preferredMatch[2])
    : 20 * 60;

  const buildProbe = (startMin: number): DirectorRehearsalSession => ({
    id: "__create-probe__",
    title: "",
    startsAt: new Date(`${dk}T${formatTimeHHMM(startMin)}:00`).toISOString(),
    projectSlugs,
    slots: [{ id: "probe", offsetMin: 0, durationMin }],
    updatedAt: new Date().toISOString(),
  });

  if (!findDirectorSessionBusyConflict(buildProbe(preferredMin), sessions)) {
    return { time: preferred };
  }

  for (let step = 1; step < 48; step += 1) {
    const candidateMin = (preferredMin + step * 30) % (24 * 60);
    if (!findDirectorSessionBusyConflict(buildProbe(candidateMin), sessions)) {
      return { time: formatTimeHHMM(candidateMin) };
    }
  }

  return {
    error:
      "Нет свободного интервала на этот день — все слоты пересекаются с другими сессиями",
  };
}

export function formatProfileShortName(
  profile: TeamProfile | undefined,
  fallback: string,
) {
  const firstName = String(profile?.firstName ?? "").trim();
  const lastName = String(profile?.lastName ?? "").trim();
  if (firstName && lastName) return `${firstName} ${lastName[0]}.`;
  if (firstName) return firstName;

  const displayName = String(profile?.displayName ?? "").trim();
  const [firstPart, secondPart] = displayName.split(/\s+/).filter(Boolean);
  if (firstPart && secondPart) return `${firstPart} ${secondPart[0]}.`;
  return displayName || fallback;
}

export function collectSessionPickedActorEmails(
  session: DirectorRehearsalSession | null,
  dataCache: ProjectDataCache,
): Set<string> {
  if (!session) return new Set<string>();
  const set = new Set<string>();
  for (const sl of session.slots ?? []) {
    const ref = sl.ref;
    if (!ref?.projectSlug || ref.sceneId == null) continue;
    const data = dataCache[ref.projectSlug];
    if (!data) continue;
    for (const e of getEmailsPlannedForDirectorSlot(
      ref.projectSlug,
      ref.sceneId,
      data,
      (sl as DirectorSessionSlot).roleRehearsalPicks,
    )) {
      const n = normalizeEmail(String(e ?? ""));
      if (n) set.add(n);
    }
  }
  return set;
}

export function buildActorsSummary(slotInsights: SlotInsight[]) {
  const map = new Map<string, { actor: string; slots: number }>();
  for (const s of slotInsights) {
    for (const a of s.actors) {
      const key = String(a ?? "").trim();
      if (!key) continue;
      map.set(key, { actor: key, slots: (map.get(key)?.slots ?? 0) + 1 });
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.slots - a.slots || a.actor.localeCompare(b.actor, "ru"),
  );
}

export function collectActorEmails(
  actorsSummary: Array<{ actor: string; slots: number }>,
  plannedEmails: string[] | undefined,
): string[] {
  const set = new Set<string>();
  for (const x of actorsSummary) {
    const raw = String(x.actor ?? "").trim();
    if (!looksLikeEmail(raw)) continue;
    const n = normalizeEmail(raw);
    if (n) set.add(n);
  }
  for (const p of plannedEmails ?? []) {
    const raw = String(p ?? "").trim();
    if (!looksLikeEmail(raw)) continue;
    const n = normalizeEmail(raw);
    if (n) set.add(n);
  }
  return Array.from(set);
}

export function collectDayPreviewActorEmails(
  sessionsForSelectedDay: DirectorRehearsalSession[],
  dataCache: ProjectDataCache,
): string[] {
  const set = new Set<string>();
  for (const session of sessionsForSelectedDay) {
    for (const insight of buildSessionSlotInsights(session, dataCache)) {
      for (const actor of insight.actors) {
        const normalized = normalizeEmail(String(actor ?? ""));
        if (normalized) set.add(normalized);
      }
    }
  }
  return Array.from(set);
}

export function buildSlotGatherStatusBySlotId(
  session: DirectorRehearsalSession | null,
  slotInsights: SlotInsight[],
  slotById: Map<string, DirectorSessionSlot>,
): Map<string, SlotGatherStatus> {
  const out = new Map<string, SlotGatherStatus>();
  if (!session) return out;
  for (const insight of slotInsights) {
    const slot = slotById.get(insight.slotId);
    out.set(insight.slotId, computeSlotGatherStatus(session, insight, slot));
  }
  return out;
}

export function buildDaySessionPreviewsById(
  sessionsForSelectedDay: DirectorRehearsalSession[],
  dataCache: ProjectDataCache,
  projectLabelBySlug: ReadonlyMap<string, string>,
): Map<string, DaySessionPreview> {
  const out = new Map<string, DaySessionPreview>();
  for (const session of sessionsForSelectedDay) {
    const insights = buildSessionSlotInsights(
      session,
      dataCache,
      projectLabelBySlug,
    );
    const slotsById = new Map(
      (session.slots ?? []).map((slot) => [slot.id, slot]),
    );
    const slots = insights.map((insight) => {
      const slot = slotsById.get(insight.slotId);
      const gatherStatus = computeSlotGatherStatus(session, insight, slot);
      return {
        slotId: insight.slotId,
        time: insight.time,
        projectLabel: insight.projectLabel,
        sceneLabel: insight.sceneLabel,
        gatherStatus,
        durationMin: slot?.durationMin ?? 0,
      };
    });
    const slotsWithMaterial = slots.filter((slot) => slot.gatherStatus !== "none");
    const slotsOkCount = slotsWithMaterial.filter(
      (slot) => slot.gatherStatus === "ok",
    ).length;
    const commentRaw = String(session.comment ?? "").trim();
    out.set(session.id, {
      sessionId: session.id,
      slots,
      slotsOkCount,
      slotsWithMaterialCount: slotsWithMaterial.length,
      commentPreview:
        commentRaw.length > 72 ? `${commentRaw.slice(0, 72)}…` : commentRaw,
    });
  }
  return out;
}

export function buildSessionsSideCalledRowsBySlotId(params: {
  activeSession: DirectorRehearsalSession | null;
  slotInsights: SlotInsight[];
  profilesByEmail: Map<string, TeamProfile>;
  sessionDateKey: string | null;
}): Map<string, SessionsSideCalledRow[]> {
  const { activeSession, slotInsights, profilesByEmail, sessionDateKey } =
    params;
  const out = new Map<string, SessionsSideCalledRow[]>();
  if (!activeSession) return out;

  const rowForEmail = (raw: string): SessionsSideCalledRow => {
    const emailNorm = normalizeEmail(String(raw ?? ""));
    const prof = emailNorm ? profilesByEmail.get(emailNorm) : undefined;
    const displayName = String(prof?.displayName ?? "").trim();
    const fallbackName = displayName || String(raw ?? "").trim() || emailNorm;
    const name = formatProfileShortName(prof, fallbackName);
    const avatarUrl = String(prof?.avatarUrl ?? "").trim() || null;
    let statusLabel = "";
    let statusTone: SessionsSideCalledStatusTone = "muted";

    const published = isDirectorSessionPublished(activeSession);
    const participants = activeSession.participants ?? [];
    const hasCallTable = published && participants.length > 0;

    if (!sessionDateKey) {
      statusLabel = "Сначала укажи дату сессии";
      statusTone = "warn";
    } else if (!hasCallTable) {
      statusLabel = "Ждём публикации";
      statusTone = "warn";
    } else {
      const part = findDirectorSessionParticipant(activeSession, emailNorm);
      if (part?.status === "present") {
        statusLabel = "Подтвердил явку";
        statusTone = "confirmed";
      } else if (part?.status === "absent") {
        statusLabel = "Отметил «не приду»";
        statusTone = "bad";
      } else if (part?.status === "late") {
        statusLabel = "Опоздает";
        statusTone = "warn";
      } else {
        statusLabel = "Вызов не подтверждён";
        statusTone = "warn";
      }
    }

    return {
      key: emailNorm || String(raw),
      email: String(raw ?? "").trim(),
      name,
      avatarUrl,
      avatarLabel: name,
      statusLabel,
      statusTone,
    };
  };

  for (const insight of slotInsights) {
    const emails = insight.actors ?? [];
    if (emails.length === 0) {
      out.set(insight.slotId, []);
      continue;
    }
    out.set(
      insight.slotId,
      emails.map((raw) => rowForEmail(raw)),
    );
  }

  return out;
}

export function collectMissingAvailabilityEmails(params: {
  activeSession: DirectorRehearsalSession | null;
  sessionDateKey: string | null;
  sessionPickedActorEmails: Set<string>;
  profilesByEmail: Map<string, TeamProfile>;
  selfEmailNorm: string | null;
}): string[] {
  const {
    activeSession,
    sessionDateKey,
    sessionPickedActorEmails,
    profilesByEmail,
    selfEmailNorm,
  } = params;
  if (!activeSession || !sessionDateKey) return [];
  const source = new Set<string>();
  for (const email of activeSession.plannedEmails ?? []) {
    const normalized = normalizeEmail(String(email ?? ""));
    if (normalized) source.add(normalized);
  }
  sessionPickedActorEmails.forEach((email) => source.add(email));
  return Array.from(source).filter((email) => {
    if (selfEmailNorm && email === selfEmailNorm) return false;
    const profile = profilesByEmail.get(email);
    return !profileHasSpecifiedAvailabilityForDate(profile, sessionDateKey);
  });
}

export function formatCalendarSelectedDateLabel(selectedDate: string) {
  return dayjs(selectedDate).format("D MMMM YYYY");
}

export function sessionDateKeyFromStartsAt(
  startsAt: string | undefined | null,
): string | null {
  if (!startsAt) return null;
  const d = new Date(startsAt);
  return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
}

export function extractPersistErrorMessage(e: unknown): string {
  const err = e as {
    data?: { message?: string };
    response?: { data?: { message?: string } };
    message?: string;
  };
  return (
    err?.data?.message ||
    err?.response?.data?.message ||
    err?.message ||
    "Не удалось сохранить сессию"
  );
}

export function extractMutationErrorMessage(
  e: unknown,
  fallback: string,
): string {
  const err = e as {
    response?: { data?: { message?: string } };
    message?: string;
  };
  return err?.response?.data?.message || err?.message || fallback;
}
