import type { DirectorSessionParticipant } from "../../../sync/api/director-sessions";
import type { TeamProfile } from "../../../sync/api/profile";
import { getEmailsPlannedForDirectorSlot } from "./session-slot-planned";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import type { ScriptStep } from "../../../shared/types/script";
import type { SceneRolesDataV1 } from "../../scene";
import type { SyncPullResponse } from "../../../sync/api/types/sync";
import type {
  AvailabilityTimeRange,
  DirectorSessionProjectDataCache,
  ProjectDataCache,
  SessionsSideCalledStatusTone,
  SlotActorAvailability,
  SlotGatherStatus,
} from "./session-page-types";

export const SESSION_ROW_LONG_PRESS_MS = 520;
export const SESSION_ROW_LONG_PRESS_MOVE_PX = 12;

export function parseTimeHHMM(src: string): number | null {
  const s = String(src ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

export function formatTimeHHMM(totalMin: number): string {
  const m = ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function getSessionStartLocalMinutes(startsAtIso: string): number {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

export function formatSlotTime(startsAtIso: string, offsetMin: number): string {
  const base = getSessionStartLocalMinutes(startsAtIso);
  return formatTimeHHMM(base + Math.max(0, Math.floor(offsetMin)));
}

export function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

export function normalizeEmail(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

/** Email из JWT accessToken (для учёта собственной явки режиссёра). */
export function parseEmailFromAccessToken(token: string | null): string | null {
  if (!token) return null;
  try {
    const seg = token.split(".")[1];
    if (!seg) return null;
    let b64 = seg.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    const json = JSON.parse(atob(b64)) as { email?: string; sub?: string };
    const raw =
      typeof json.email === "string" && json.email.trim()
        ? json.email
        : typeof json.sub === "string" && json.sub.includes("@")
          ? json.sub
          : "";
    const n = normalizeEmail(raw);
    return n && looksLikeEmail(n) ? n : null;
  } catch {
    return null;
  }
}

export function isDirectorSessionPublished(session: DirectorRehearsalSession): boolean {
  return Boolean(String(session.publishedAt ?? "").trim());
}

export function findDirectorSessionParticipant(
  session: DirectorRehearsalSession,
  emailNorm: string,
): DirectorSessionParticipant | undefined {
  const list = (session.participants ?? []) as DirectorSessionParticipant[];
  return list.find((p) => normalizeEmail(String(p.email ?? "")) === emailNorm);
}

export function actorCalendarPresentStrictForDraft(
  emailNorm: string,
  sessionDateKey: string,
  profilesByEmail: Map<string, TeamProfile>,
  selfEmailNorm: string | null,
): boolean {
  if (selfEmailNorm && emailNorm === selfEmailNorm) return true;
  const p = profilesByEmail.get(emailNorm);
  if (!p) return false;
  if (!profileHasSpecifiedAvailabilityForDate(p, sessionDateKey)) return false;
  const cal = (p as TeamProfile & { availabilityCalendar?: Record<string, string> })
    ?.availabilityCalendar?.[sessionDateKey];
  return cal === "present";
}

export function getRangesForDateMinutes(
  prof: TeamProfile | null | undefined,
  dateKey: string | null,
): Array<{ fromMin: number; toMin: number }> {
  if (!prof || !dateKey) return [];
  const raw = (prof as TeamProfile & { availabilityTimeRanges?: Record<string, AvailabilityTimeRange[]> })
    ?.availabilityTimeRanges;
  const list = raw?.[dateKey];
  if (!Array.isArray(list) || list.length === 0) return [];
  const out: Array<{ fromMin: number; toMin: number }> = [];
  for (const it of list.slice(0, 20)) {
    const fromMin = parseTimeHHMM(String(it?.from ?? ""));
    const toMin = parseTimeHHMM(String(it?.to ?? ""));
    if (fromMin == null || toMin == null) continue;
    if (fromMin >= toMin) continue;
    out.push({ fromMin, toMin });
  }
  out.sort((a, b) => a.fromMin - b.fromMin || a.toMin - b.toMin);
  return out;
}

export function isSlotInsideRanges(
  slotStartMin: number,
  slotEndMin: number,
  ranges: Array<{ fromMin: number; toMin: number }>,
): boolean {
  if (ranges.length === 0) return false;
  const a = Math.max(0, Math.floor(slotStartMin));
  const b = Math.max(0, Math.floor(slotEndMin));
  for (const r of ranges) {
    if (a >= r.fromMin && b <= r.toMin) return true;
  }
  return false;
}

export function classifyActorSlotAvailability(
  prof: TeamProfile | undefined,
  sessionDateKey: string,
  startMin: number,
  endMin: number,
): SlotActorAvailability {
  if (!prof) return "unknown";
  const cal = (prof as TeamProfile & { availabilityCalendar?: Record<string, string> })
    ?.availabilityCalendar;
  const st =
    cal?.[sessionDateKey] === "present"
      ? "present"
      : cal?.[sessionDateKey] === "absent"
        ? "absent"
        : "unknown";
  if (st === "absent") return "busy";
  const ranges = getRangesForDateMinutes(prof, sessionDateKey);
  if (ranges.length > 0) {
    return isSlotInsideRanges(startMin, endMin, ranges) ? "free" : "busy";
  }
  if (st === "present") return "free";
  return "unknown";
}

export function profileHasSpecifiedAvailabilityForDate(
  prof: TeamProfile | null | undefined,
  dateKey: string | null,
): boolean {
  if (!prof || !dateKey) return false;
  const cal = (prof as TeamProfile & { availabilityCalendar?: Record<string, string> })
    ?.availabilityCalendar;
  const dayMark = cal?.[dateKey];
  if (dayMark === "present" || dayMark === "absent") return true;
  return getRangesForDateMinutes(prof, dateKey).length > 0;
}

export function sessionStartsDateKey(session: DirectorRehearsalSession): string | null {
  const d = new Date(session.startsAt);
  return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
}

export function normalizeRoleKey(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function computePlannedEmailsForSession(
  session: DirectorRehearsalSession,
  dataCache: ProjectDataCache,
): { emails: string[]; complete: boolean } {
  const out = new Set<string>();
  let complete = true;
  const slots = session?.slots ?? [];
  for (const sl of slots) {
    const ref = (sl as DirectorSessionSlot).ref;
    const slug = String(ref?.projectSlug ?? "").trim();
    const stepId = typeof ref?.stepId === "number" ? ref.stepId : null;
    if (!slug || stepId == null) continue;
    const data = dataCache[slug];
    if (!data) {
      complete = false;
      continue;
    }
    const slotEmails = getEmailsPlannedForDirectorSlot(
      slug,
      stepId,
      data,
      sl.roleRehearsalPicks,
    );
    for (const norm of slotEmails) {
      out.add(norm);
      if (out.size >= 500) break;
    }
    if (out.size >= 500) break;
  }
  return { emails: Array.from(out), complete };
}

export function getLocalDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { date: "", time: "" };
  const date = toDateKey(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date, time: `${hh}:${mm}` };
}

export function directorSlotRefKey(projectSlug: string, stepId: number): string {
  return `${String(projectSlug ?? "").trim()}:${Math.floor(Number(stepId) || 0)}`;
}

export function projectDisplayLabel(
  projectSlug: string,
  projectLabelBySlug?: ReadonlyMap<string, string> | null,
): string {
  const slug = String(projectSlug ?? "").trim();
  if (!slug) return "";
  const label = String(projectLabelBySlug?.get(slug) ?? "").trim();
  return label || slug;
}

export function isReadyStep(step: ScriptStep): boolean {
  const st = String((step as { kanbanStatus?: string })?.kanbanStatus ?? "")
    .trim()
    .toLowerCase();
  return st === "ready" || st === "готова";
}

export function roleMapsFromProjectRoles(
  roles: Array<{ key?: string; title?: string; emails?: string[] }> | null | undefined,
): {
  roleEmailsByKey: Record<string, string[]>;
  roleTitleByKey: Record<string, string>;
} {
  const roleEmailsByKey: Record<string, string[]> = {};
  const roleTitleByKey: Record<string, string> = {};
  (roles ?? []).forEach((r) => {
    const key = normalizeRoleKey(String(r?.key ?? r?.title ?? ""));
    if (!key) return;
    const emails = Array.isArray(r?.emails)
      ? r.emails.map((e) => normalizeEmail(String(e))).filter(Boolean)
      : [];
    roleEmailsByKey[key] = Array.from(new Set(emails));
    roleTitleByKey[key] = String(r?.title ?? r?.key ?? key).trim() || key;
  });
  return { roleEmailsByKey, roleTitleByKey };
}

export function memberEmailsFromProjectMembers(
  res:
    | {
        owner?: { email?: string } | null;
        members?: Array<{ user?: { email?: string } }>;
      }
    | null
    | undefined,
): string[] {
  const emails = [
    res?.owner?.email ? normalizeEmail(res.owner.email) : null,
    ...(res?.members ?? []).map((m) => normalizeEmail(m.user?.email ?? "")),
  ].filter(Boolean) as string[];
  return Array.from(new Set(emails));
}

export function parseStepsFromPull(
  pull: SyncPullResponse,
  projectSlug: string,
): DirectorSessionProjectDataCache[string] {
  const proj = (pull.projects ?? []).find((p) => p.slug === projectSlug);
  const scene = proj
    ? (pull.scenes ?? []).find((s) => String(s?.id ?? "") === `${proj.id}:script`)
    : null;
  const sceneId = String(scene?.id ?? "") || null;
  const sceneRoles = ((scene as { sceneRoles?: SceneRolesDataV1 } | null)?.sceneRoles ??
    null) as SceneRolesDataV1 | null;
  const steps = (Array.isArray(pull.steps) ? pull.steps : [])
    .filter((st) => (sceneId ? String(st?.sceneId ?? "") === sceneId : true))
    .sort((a, b) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
    .map((st) => ({
      id: Number(st?.sourceId ?? 0),
      title: String(st?.title ?? ""),
      markdown: String(st?.markdown ?? ""),
      playMarkdown: st?.playMarkdown ?? undefined,
      explicationMarkdown: st?.explicationMarkdown ?? undefined,
      durationMin: st?.durationMin ?? undefined,
      kanbanStatus: st?.kanbanStatus ?? undefined,
      kanbanOrder: st?.kanbanOrder ?? undefined,
    }))
    .filter((x) => Number.isFinite(x.id) && x.id > 0) as ScriptStep[];
  return { steps, sceneId, sceneRoles };
}

export function calledStatusToGatherMark(
  tone: SessionsSideCalledStatusTone,
): SlotGatherStatus {
  if (tone === "confirmed" || tone === "ok") return "ok";
  if (tone === "warn") return "warn";
  if (tone === "bad") return "bad";
  return "none";
}
