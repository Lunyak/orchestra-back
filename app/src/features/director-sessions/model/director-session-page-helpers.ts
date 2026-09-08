import type { ScriptScene } from "../../../shared/types/script";
import type { TeamProfile } from "../../../sync/api/profile";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import {
  classifyActorSlotAvailability,
  directorSlotRefKey,
  formatDurationMinLabel,
  formatSlotTime,
  getSessionStartLocalMinutes,
  looksLikeEmail,
  normalizeEmail,
  toDateKey,
} from "./session-page-utils";
import type { DirectorSessionProjectDataCache } from "./session-page-types";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getEmailsPlannedForDirectorSlot,
  getNormalizedRoleKeysForAllScenes,
  getNormalizedRoleKeysForSlotScene,
  getRolePlannedEmailsForDirectorSlot,
  SLOT_PROG_RUN_TITLE,
  type DirectorSlotPlannedData,
} from "./session-slot-planned";

export function pickQueryErrorMessage(
  error: unknown,
  fallback: string,
): string {
  const msg = (error as { message?: string } | undefined)?.message;
  return msg ? msg : fallback;
}

export function sessionDateKeyFromStartsAt(
  startsAt: string | null | undefined,
): string | null {
  if (!startsAt) return null;
  const d = new Date(startsAt);
  return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
}

export function slotWindowFromSession(
  session: DirectorRehearsalSession | null,
  slot: DirectorSessionSlot | null,
): { startMin: number; endMin: number } | null {
  if (!session || !slot) return null;
  const base = getSessionStartLocalMinutes(session.startsAt);
  const startMin = base + Math.max(0, Math.floor(slot.offsetMin || 0));
  const endMin = startMin + Math.max(1, Math.floor(slot.durationMin || 1));
  return { startMin, endMin };
}

export function projectSlugsFromSession(
  session: DirectorRehearsalSession | null | undefined,
): string[] {
  const s = new Set<string>();
  for (const sl of session?.slots ?? []) {
    const u = String(sl.ref?.projectSlug ?? "").trim();
    if (u) s.add(u);
  }
  return Array.from(s).sort();
}

export function mergeProfilesByEmail(
  ...lists: Array<TeamProfile[] | undefined>
): Map<string, TeamProfile> {
  const m = new Map<string, TeamProfile>();
  for (const list of lists) {
    for (const p of list ?? []) {
      const e = normalizeEmail(p.email);
      if (e) m.set(e, p);
    }
  }
  return m;
}

export function collectSlotPlannerEmails(
  session: DirectorRehearsalSession | null,
  dataCache: DirectorSessionProjectDataCache,
  roleEmailsByProjectSlug: Record<string, Record<string, string[]>>,
): string[] {
  if (!session) return [];
  const set = new Set<string>();
  for (const sl of session.slots ?? []) {
    const ref = sl.ref;
    if (!ref?.projectSlug || ref.sceneId == null) continue;
    const slug = String(ref.projectSlug).trim();
    const cached = dataCache[slug];
    const rem = roleEmailsByProjectSlug[slug];
    if (!cached?.scenes?.length || !rem) continue;
    const plannedData: DirectorSlotPlannedData = {
      scenes: cached.scenes,
      sceneRoles: cached.sceneRoles ?? null,
      roleEmailsByKey: rem,
    };
    const byRole = getRolePlannedEmailsForDirectorSlot(
      slug,
      ref.sceneId,
      plannedData,
      null,
    );
    for (const { emails } of byRole) {
      for (const e of emails) {
        const n = normalizeEmail(String(e ?? ""));
        if (n && looksLikeEmail(n)) set.add(n);
      }
    }
  }
  return Array.from(set);
}

export function buildSlotRehearsalToneClassById(args: {
  session: DirectorRehearsalSession | null;
  sessionDateKey: string | null;
  dataCache: DirectorSessionProjectDataCache;
  roleEmailsByProjectSlug: Record<string, Record<string, string[]>>;
  profilesForSlotTones: Map<string, TeamProfile>;
}): Map<string, string> {
  const {
    session,
    sessionDateKey,
    dataCache,
    roleEmailsByProjectSlug,
    profilesForSlotTones,
  } = args;
  const out = new Map<string, string>();
  if (!session || !sessionDateKey) return out;
  const base = getSessionStartLocalMinutes(session.startsAt);

  for (const sl of session.slots ?? []) {
    const ref = sl.ref;
    if (!ref?.projectSlug || ref.sceneId == null) continue;
    const slug = String(ref.projectSlug).trim();
    const cached = dataCache[slug];
    const rem = roleEmailsByProjectSlug[slug];
    if (!cached?.scenes?.length || !rem) continue;

    const plannedData: DirectorSlotPlannedData = {
      scenes: cached.scenes,
      sceneRoles: cached.sceneRoles ?? null,
      roleEmailsByKey: rem,
    };

    const byRole = getRolePlannedEmailsForDirectorSlot(
      slug,
      ref.sceneId,
      plannedData,
      null,
    );
    if (byRole.length === 0) continue;

    const startMin = base + Math.max(0, Math.floor(sl.offsetMin || 0));
    const endMin = startMin + Math.max(1, Math.floor(sl.durationMin || 1));

    let allRolesOk = true;
    for (const { emails } of byRole) {
      if (emails.length === 0) {
        allRolesOk = false;
        break;
      }
      const roleOk = emails.some((normEmail) => {
        const prof = profilesForSlotTones.get(
          normalizeEmail(String(normEmail ?? "")),
        );
        return (
          classifyActorSlotAvailability(
            prof,
            sessionDateKey,
            startMin,
            endMin,
          ) === "free"
        );
      });
      if (!roleOk) {
        allRolesOk = false;
        break;
      }
    }

    out.set(
      sl.id,
      allRolesOk ? "session-slot--rehearsal-ok" : "session-slot--rehearsal-bad",
    );
  }
  return out;
}

export function buildEmailsBySlotId(
  session: DirectorRehearsalSession | null,
  dataCache: DirectorSessionProjectDataCache,
  roleEmailsByProjectSlug: Record<string, Record<string, string[]>>,
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  if (!session) return out;
  for (const sl of session.slots ?? []) {
    const ref = sl.ref;
    if (!ref?.projectSlug || ref.sceneId == null) continue;
    const slug = String(ref.projectSlug).trim();
    const cached = dataCache[slug];
    const rem = roleEmailsByProjectSlug[slug];
    if (!cached?.scenes?.length || !rem) continue;
    const plannedData: DirectorSlotPlannedData = {
      scenes: cached.scenes,
      sceneRoles: cached.sceneRoles ?? null,
      roleEmailsByKey: rem,
    };
    if (sl.isProgRun) {
      const picks = sl.roleRehearsalPicks ?? [];
      if (picks.length > 0) {
        const emails = new Set<string>();
        for (const pick of picks) {
          if (!pick.checked) continue;
          const email = normalizeEmail(String(pick.email ?? ""));
          if (email && looksLikeEmail(email)) emails.add(email);
        }
        out[sl.id] = Array.from(emails);
        continue;
      }
      const roleKeys = getNormalizedRoleKeysForAllScenes(
        cached.scenes,
        cached.sceneRoles ?? null,
      );
      const emails = new Set<string>();
      for (const key of roleKeys) {
        for (const raw of rem[key] ?? []) {
          const email = normalizeEmail(String(raw ?? ""));
          if (email && looksLikeEmail(email)) emails.add(email);
        }
      }
      out[sl.id] = Array.from(emails);
      continue;
    }
    out[sl.id] = getEmailsPlannedForDirectorSlot(
      slug,
      ref.sceneId,
      plannedData,
      sl.roleRehearsalPicks ?? null,
    );
  }
  return out;
}

export function buildFreeRolesNormSet(args: {
  roleEmailsByKey: Record<string, string[]>;
  sessionDateKey: string | null;
  slotWindow: { startMin: number; endMin: number } | null;
  profilesForSlotTones: Map<string, TeamProfile>;
}): Set<string> {
  const { roleEmailsByKey, sessionDateKey, slotWindow, profilesForSlotTones } =
    args;
  const set = new Set<string>();
  if (!sessionDateKey || !slotWindow) return set;
  for (const [rk, emails] of Object.entries(roleEmailsByKey ?? {})) {
    if (!rk || !Array.isArray(emails) || emails.length === 0) continue;
    const ok = emails.some((raw) => {
      const email = normalizeEmail(String(raw ?? ""));
      if (!email || !looksLikeEmail(email)) return false;
      const p = profilesForSlotTones.get(email);
      return (
        classifyActorSlotAvailability(
          p,
          sessionDateKey,
          slotWindow.startMin,
          slotWindow.endMin,
        ) === "free"
      );
    });
    if (ok) set.add(rk);
  }
  return set;
}

export type SelectableSceneRow = {
  scene: ScriptScene;
  ok: boolean;
  missing: string[];
  roles: string[];
};

export function buildSelectableScenes(args: {
  projectFilter: string;
  isCustomSlug: boolean;
  projectScenes: ScriptScene[];
  freeRolesNormSet: Set<string>;
  dataCache: DirectorSessionProjectDataCache;
  roleTitleByKey: Record<string, string>;
}): SelectableSceneRow[] {
  const {
    projectFilter,
    isCustomSlug,
    projectScenes,
    freeRolesNormSet,
    dataCache,
    roleTitleByKey,
  } = args;
  const out: SelectableSceneRow[] = [];
  if (!projectFilter || isCustomSlug) return out;
  const pack = dataCache[projectFilter] ?? null;
  const sceneRoles = pack?.sceneRoles ?? null;

  for (const s of projectScenes) {
    const roleKeysNorm = getNormalizedRoleKeysForSlotScene(
      s,
      sceneRoles,
      s.id,
    );
    const roles = roleKeysNorm.map((rk) => roleTitleByKey[rk] ?? rk);
    const missing: string[] = [];
    for (const normKey of roleKeysNorm) {
      if (normKey && !freeRolesNormSet.has(normKey)) {
        missing.push(roleTitleByKey[normKey] ?? normKey);
      }
    }
    out.push({ scene: s, ok: missing.length === 0, missing, roles });
  }
  return out;
}

export function buildSlotsBySceneRefInSession(
  session: DirectorRehearsalSession | null | undefined,
): Map<string, DirectorSessionSlot[]> {
  const map = new Map<string, DirectorSessionSlot[]>();
  if (!session?.slots?.length) return map;
  for (const sl of session.slots) {
    const r = sl.ref;
    if (!r?.projectSlug) continue;
    const sceneId = Math.floor(Number(r.sceneId) || 0);
    if (!Number.isFinite(sceneId) || sceneId <= 0) continue;
    const k = directorSlotRefKey(r.projectSlug, sceneId);
    const arr = map.get(k) ?? [];
    arr.push(sl);
    map.set(k, arr);
  }
  return map;
}

export function resolveSelectedSceneLabel(args: {
  slot: DirectorSessionSlot | null;
  selectedScene: ScriptScene | null;
}): string {
  const { slot, selectedScene } = args;
  if (slot?.isProgRun) return SLOT_PROG_RUN_TITLE;
  if (selectedScene) {
    const title = String(selectedScene.title ?? "").trim();
    return title ? title : `Сцена #${selectedScene.id}`;
  }
  return String(slot?.title ?? "").trim();
}

export function resolveSelectedSceneProjectLabel(args: {
  slot: DirectorSessionSlot | null;
  projectLabelBySlug: Map<string, string>;
}): string {
  const { slot, projectLabelBySlug } = args;
  const slug = String(slot?.ref?.projectSlug ?? "").trim();
  if (slug) return projectLabelBySlug.get(slug) ?? slug;
  if (String(slot?.title ?? "").trim()) return "Без проекта";
  return "";
}

export function buildSlotDisplayById(args: {
  session: DirectorRehearsalSession | null | undefined;
  dataCache: DirectorSessionProjectDataCache;
  projectLabelBySlug: Map<string, string>;
}): Map<string, { projectLabel: string; materialLabel: string; isProgRun?: boolean }> {
  const { session, dataCache, projectLabelBySlug } = args;
  const map = new Map<
    string,
    { projectLabel: string; materialLabel: string; isProgRun?: boolean }
  >();
  for (const sl of session?.slots ?? []) {
    if (sl.isProgRun) {
      const slug = String(sl.ref?.projectSlug ?? "").trim();
      map.set(sl.id, {
        projectLabel: SLOT_PROG_RUN_TITLE,
        materialLabel: slug
          ? (projectLabelBySlug.get(slug) ?? slug)
          : "Проект",
        isProgRun: true,
      });
      continue;
    }
    const ref = sl.ref;
    const customTitle = String(sl.title ?? "").trim();
    if (!ref?.projectSlug || ref.sceneId == null) {
      map.set(sl.id, {
        projectLabel: customTitle || "Слот без названия",
        materialLabel: "Без проекта",
      });
      continue;
    }
    const slug = String(ref.projectSlug).trim();
    const scene = dataCache[slug]?.scenes?.find((s) => s.id === ref.sceneId);
    const projectLabel = projectLabelBySlug.get(slug) ?? slug;
    const sceneLabel =
      String(scene?.title ?? "").trim() ||
      customTitle ||
      `Сцена #${ref.sceneId}`;
    map.set(sl.id, {
      projectLabel: sceneLabel,
      materialLabel: projectLabel,
    });
  }
  return map;
}

export function buildSlotChartEmailSet(args: {
  slot: DirectorSessionSlot | null;
  slotPlannedInput: DirectorSlotPlannedData | null;
  selectedParticipantEmailsList: string[];
}): Set<string> | undefined {
  const { slot, slotPlannedInput, selectedParticipantEmailsList } = args;
  if (slot?.ref && slotPlannedInput) {
    const slug = String(slot.ref.projectSlug ?? "").trim();
    if (slot.isProgRun) {
      const picks = slot.roleRehearsalPicks ?? [];
      if (picks.length > 0) {
        const emails = new Set<string>();
        for (const pick of picks) {
          if (!pick.checked) continue;
          const email = normalizeEmail(String(pick.email ?? ""));
          if (email && looksLikeEmail(email)) emails.add(email);
        }
        return emails;
      }
      const roleKeys = getNormalizedRoleKeysForAllScenes(
        slotPlannedInput.scenes,
        slotPlannedInput.sceneRoles,
      );
      const emails = new Set<string>();
      for (const key of roleKeys) {
        for (const raw of slotPlannedInput.roleEmailsByKey[key] ?? []) {
          const email = normalizeEmail(String(raw ?? ""));
          if (email && looksLikeEmail(email)) emails.add(email);
        }
      }
      return emails;
    }
    const list = getAllAssigneeEmailsForDirectorSlotChart(
      slug,
      slot.ref.sceneId,
      slotPlannedInput,
    );
    return new Set(list);
  }
  if (!slot?.ref) {
    if (selectedParticipantEmailsList.length > 0) {
      return new Set(selectedParticipantEmailsList);
    }
    return undefined;
  }
  return undefined;
}

export function filterProjectScenesForPicker(
  dataCache: DirectorSessionProjectDataCache,
  projectFilter: string,
  isCustomSlug: boolean,
): ScriptScene[] {
  if (!projectFilter || isCustomSlug) return [];
  return dataCache[projectFilter]?.scenes ?? [];
}

export function formatSlotTimeLabel(
  session: DirectorRehearsalSession | null,
  slot: DirectorSessionSlot | null,
): string {
  if (!session || !slot) return "";
  return `${formatSlotTime(session.startsAt, slot.offsetMin)} · ${formatDurationMinLabel(slot.durationMin)}`;
}
