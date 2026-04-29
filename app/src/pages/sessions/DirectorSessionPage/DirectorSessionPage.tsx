import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import { LabeledCheckbox } from "@shared/core/labeled-checkbox/LabeledCheckbox";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../features/auth";
import {
  loadDirectorSessions,
  saveDirectorSessions,
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
} from "../../../features/director-sessions/directorSessionsSync";
import { useProject } from "../../../features/project";
import { RehearsalsCard } from "../../../features/rehearsals-card/RehearsalsCard";
import type { SceneRolesDataV1 } from "../../../features/scene";
import type { ScriptStep } from "../../../shared/types/script";
import { markdownToPlainText } from "../../../shared/utils/textPreview";
import {
  getProfilesBatch,
  getProjectMembers,
  getProjectRoles,
  syncPull,
  type SyncPullResponse,
  type TeamProfile,
} from "../../../sync/api";
import { DirectorSessionSlotsPanel } from "../DirectorSessionSlotsPanel";
import { SlotRoleRehearsalPicker } from "../SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "../TroupeSchedulePreview";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getNormalizedRoleKeysForSlotStep,
  getRolePlannedEmailsForDirectorSlot,
  type DirectorSlotPlannedData,
} from "../sessionSlotPlanned";
import "../style.css";
import "./style.css";

dayjs.locale("ru");

type ProjectDataCache = Record<
  string,
  {
    steps: ScriptStep[];
    sceneId: string | null;
    sceneRoles: SceneRolesDataV1 | null;
  }
>;

type AvailabilityTimeRange = { from: string; to: string };

function getSessionStartLocalMinutes(startsAtIso: string): number {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
}

function formatTimeHHMM(totalMin: number): string {
  const m = ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatSlotTime(startsAtIso: string, offsetMin: number): string {
  const base = getSessionStartLocalMinutes(startsAtIso);
  return formatTimeHHMM(base + Math.max(0, Math.floor(offsetMin)));
}

function directorSlotRefKey(projectSlug: string, stepId: number): string {
  return `${String(projectSlug ?? "").trim()}:${Math.floor(Number(stepId) || 0)}`;
}

function toDateKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseTimeHHMM(src: string): number | null {
  const s = String(src ?? "").trim();
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

function normalizeEmail(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase();
}

function getRangesForDateMinutes(
  prof: TeamProfile | null | undefined,
  dateKey: string | null,
): Array<{ fromMin: number; toMin: number }> {
  if (!prof || !dateKey) return [];
  const raw = (prof as any)?.availabilityTimeRanges as
    | Record<string, AvailabilityTimeRange[]>
    | null
    | undefined;
  const list = raw?.[dateKey];
  if (!Array.isArray(list) || list.length === 0) return [];
  const out: Array<{ fromMin: number; toMin: number }> = [];
  for (const it of list.slice(0, 20)) {
    const fromMin = parseTimeHHMM(String((it as any)?.from ?? ""));
    const toMin = parseTimeHHMM(String((it as any)?.to ?? ""));
    if (fromMin == null || toMin == null) continue;
    if (fromMin >= toMin) continue;
    out.push({ fromMin, toMin });
  }
  out.sort((a, b) => a.fromMin - b.fromMin || a.toMin - b.toMin);
  return out;
}

function isSlotInsideRanges(
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

type SlotActorAvailability = "free" | "busy" | "unknown";

/** Свободен на время слота по графику; «не отмечено» и без интервалов = не свободен. */
function classifyActorSlotAvailability(
  prof: TeamProfile | undefined,
  dateKey: string,
  startMin: number,
  endMin: number,
): SlotActorAvailability {
  if (!prof) return "unknown";
  const cal = (prof as any)?.availabilityCalendar as
    | Record<string, string>
    | undefined;
  const st =
    cal?.[dateKey] === "present"
      ? "present"
      : cal?.[dateKey] === "absent"
        ? "absent"
        : "unknown";
  if (st === "absent") return "busy";
  const ranges = getRangesForDateMinutes(prof, dateKey);
  if (ranges.length > 0) {
    return isSlotInsideRanges(startMin, endMin, ranges) ? "free" : "busy";
  }
  if (st === "present") return "free";
  return "unknown";
}

function normalizeRoleKey(v: string): string {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[_\-.]+/g, " ")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isReadyStep(step: ScriptStep): boolean {
  const st = String((step as any)?.kanbanStatus ?? "")
    .trim()
    .toLowerCase();
  return st === "ready" || st === "готова";
}

function parseStepsFromPull(
  pull: SyncPullResponse,
  projectSlug: string,
): {
  steps: ScriptStep[];
  sceneId: string | null;
  sceneRoles: SceneRolesDataV1 | null;
} {
  const proj = (pull.projects ?? []).find((p: any) => p.slug === projectSlug);
  const scene = proj
    ? (pull.scenes ?? []).find(
        (s: any) => String(s?.id ?? "") === `${proj.id}:script`,
      )
    : null;
  const sceneId = String(scene?.id ?? "") || null;
  const sceneRoles = ((scene as any)?.sceneRoles ??
    null) as SceneRolesDataV1 | null;
  const steps = (Array.isArray((pull as any)?.steps) ? (pull as any).steps : [])
    .filter((st: any) =>
      sceneId ? String(st?.sceneId ?? "") === sceneId : true,
    )
    .sort((a: any, b: any) => Number(a?.order ?? 0) - Number(b?.order ?? 0))
    .map((st: any) => ({
      id: Number(st?.sourceId ?? 0),
      title: String(st?.title ?? ""),
      markdown: String(st?.markdown ?? ""),
      playMarkdown: st?.playMarkdown ?? undefined,
      explicationMarkdown: st?.explicationMarkdown ?? undefined,
      durationMin: st?.durationMin ?? undefined,
      kanbanStatus: st?.kanbanStatus ?? undefined,
      kanbanOrder: st?.kanbanOrder ?? undefined,
    }))
    .filter((x: any) => Number.isFinite(x.id) && x.id > 0);
  return { steps, sceneId, sceneRoles };
}

export function DirectorSessionPage() {
  const { accessToken } = useAuth();
  const { projects } = useProject();
  const navigate = useNavigate();

  const { sessionId, slotId } = useParams();
  const sid = String(sessionId ?? "").trim();
  const slId =
    slotId != null && String(slotId).trim() !== "" ? String(slotId).trim() : "";

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const [session, setSession] = useState<DirectorRehearsalSession | null>(null);
  const [slot, setSlot] = useState<DirectorSessionSlot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [dataCache, setDataCache] = useState<ProjectDataCache>({});
  const [stepsLoading, setStepsLoading] = useState(false);
  const [stepsError, setStepsError] = useState<string | null>(null);

  const [membersLoading, setMembersLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState<string | null>(
    null,
  );
  const [projectMemberEmails, setProjectMemberEmails] = useState<string[]>([]);
  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);
  const [roleEmailsByKey, setRoleEmailsByKey] = useState<
    Record<string, string[]>
  >({});
  const [roleTitleByKey, setRoleTitleByKey] = useState<Record<string, string>>(
    {},
  );
  /** Роли по slug проекта — для расчёта тонов всех слотов (разные проекты в одной сессии). */
  const [roleEmailsByProjectSlug, setRoleEmailsByProjectSlug] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [plannerProfiles, setPlannerProfiles] = useState<TeamProfile[]>([]);

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );

  const projectFilterStorageKey = useMemo(
    () => `directorSessions:session:${sid}:${slId || "all"}:project`,
    [sid, slId],
  );
  const [projectFilter, setProjectFilter] = useState<string>(() => {
    try {
      return (
        (typeof window !== "undefined"
          ? localStorage.getItem(projectFilterStorageKey)
          : null) ||
        (typeof window !== "undefined"
          ? localStorage.getItem("selectedProject")
          : null) ||
        ""
      );
    } catch (_) {
      return "";
    }
  });
  const [query, setQuery] = useState("");
  const [onlySelectable, setOnlySelectable] = useState(false);

  const rolesSlug = useMemo(() => {
    const fromSlot = (slot?.ref?.projectSlug ?? "").trim();
    return fromSlot || projectFilter;
  }, [slot?.ref?.projectSlug, projectFilter]);

  useEffect(() => {
    if (!accessToken || !sid) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDirectorSessions(accessToken)
      .then((res) => {
        if (cancelled) return;
        const list = res.sessions ?? [];
        setSessions(list);
        const s = list.find((x) => x.id === sid) ?? null;
        if (!s) {
          setSession(null);
          setSlot(null);
          setError("Сессия не найдена");
          return;
        }
        setSession(s);
        if (!slId) {
          setSlot(null);
          setError(null);
          return;
        }
        const sl = (s.slots ?? []).find((x) => x.id === slId) ?? null;
        setSlot(sl);
        if (!sl) {
          const n = (s.slots ?? []).length;
          setError(
            n === 0
              ? "Слотов пока нет — добавь первый в блоке «Слоты» слева."
              : null,
          );
        } else {
          setError(null);
        }
      })
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? "Не удалось загрузить сессию");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, sid, slId]);

  useEffect(() => {
    if (!visibleProjects.length) return;
    setProjectFilter((prev) => {
      const chosen = prev && visibleProjects.includes(prev) ? prev : "";
      return chosen || visibleProjects[0] || "";
    });
  }, [visibleProjects]);

  useEffect(() => {
    try {
      if (projectFilter)
        localStorage.setItem(projectFilterStorageKey, projectFilter);
    } catch (_) {}
  }, [projectFilter, projectFilterStorageKey]);

  const sessionDateKey = useMemo(() => {
    if (!session?.startsAt) return null;
    const d = new Date(session.startsAt);
    return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
  }, [session?.startsAt]);

  const slotWindow = useMemo(() => {
    if (!session || !slot) return null;
    const base = getSessionStartLocalMinutes(session.startsAt);
    const startMin = base + Math.max(0, Math.floor(slot.offsetMin || 0));
    const endMin = startMin + Math.max(1, Math.floor(slot.durationMin || 1));
    return { startMin, endMin };
  }, [session, slot]);

  const persistSessions = async (next: DirectorRehearsalSession[]) => {
    if (!accessToken) return;
    setSessions(next);
    await saveDirectorSessions(accessToken, { sessions: next });
    const s = next.find((x) => x.id === sid) ?? null;
    setSession(s);
    if (!s) {
      setSlot(null);
      return;
    }
    if (slId) {
      setSlot((s.slots ?? []).find((x) => x.id === slId) ?? null);
    } else {
      setSlot(null);
    }
  };

  const updateSlotById = useCallback(
    async (targetSlotId: string, patch: Partial<DirectorSessionSlot>) => {
      if (!session) return;
      const nextSessions = (sessions ?? []).map((s) => {
        if (s.id !== session.id) return s;
        return {
          ...s,
          slots: (s.slots ?? []).map((sl) =>
            sl.id === targetSlotId ? { ...sl, ...patch } : sl,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      await persistSessions(nextSessions);
      const nextSession = nextSessions.find((x) => x.id === session.id) ?? null;
      setSession(nextSession);
      setSlot((prev) => {
        if (!prev || prev.id !== targetSlotId) return prev;
        return (
          nextSession?.slots?.find((x) => x.id === targetSlotId) ?? null
        );
      });
    },
    [session, sessions, persistSessions],
  );

  const updateSlot = useCallback(
    async (patch: Partial<DirectorSessionSlot>) => {
      if (!slot) return;
      await updateSlotById(slot.id, patch);
    },
    [slot, updateSlotById],
  );

  const persistSlotNotes = useCallback(
    (targetSlotId: string, notes: string) => {
      void updateSlotById(targetSlotId, { notes });
    },
    [updateSlotById],
  );

  const {
    draft: slotNotesDraft,
    onChange: onSlotNotesChange,
    onBlur: onSlotNotesBlur,
  } = useDebouncedSyncedText(slot?.id, slot?.notes, persistSlotNotes);

  const loadProjectData = async (slug: string) => {
    if (!accessToken) return;
    if (!slug) return;
    if (dataCache[slug]) return;
    setStepsLoading(true);
    setStepsError(null);
    try {
      const pull = await syncPull(accessToken, null, slug, { steps: true });
      const parsed = parseStepsFromPull(pull, slug);
      setDataCache((p) => ({ ...p, [slug]: parsed }));
    } catch (e: any) {
      setStepsError(
        e?.response?.data?.message ?? e?.message ?? "Не удалось загрузить шаги",
      );
      setDataCache((p) => ({
        ...p,
        [slug]: { steps: [], sceneId: null, sceneRoles: null },
      }));
    } finally {
      setStepsLoading(false);
    }
  };

  const projectSlugsInSession = useMemo(() => {
    const s = new Set<string>();
    for (const sl of session?.slots ?? []) {
      const u = String(sl.ref?.projectSlug ?? "").trim();
      if (u) s.add(u);
    }
    return Array.from(s).sort();
  }, [session?.id, session?.slots]);

  const projectDataLoadedSig = useMemo(
    () =>
      projectSlugsInSession.filter((slug) => dataCache[slug] != null).join("|"),
    [dataCache, projectSlugsInSession],
  );

  useEffect(() => {
    if (!accessToken || projectSlugsInSession.length === 0) return;
    for (const slug of projectSlugsInSession) {
      if (dataCache[slug] != null) continue;
      void loadProjectData(slug);
    }
  }, [accessToken, projectSlugsInSession.join("|"), projectDataLoadedSig]);

  useEffect(() => {
    if (!accessToken || projectSlugsInSession.length === 0) {
      setRoleEmailsByProjectSlug({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        projectSlugsInSession.map(async (slug) => {
          try {
            const rolesRes = await getProjectRoles(accessToken, slug);
            const emailsByKey: Record<string, string[]> = {};
            (rolesRes?.roles ?? []).forEach((r: any) => {
              const key = normalizeRoleKey(String(r?.key ?? r?.title ?? ""));
              if (!key) return;
              const emails = Array.isArray(r?.emails)
                ? r.emails.map((e: any) => normalizeEmail(e)).filter(Boolean)
                : [];
              emailsByKey[key] = Array.from(new Set(emails));
            });
            return [slug, emailsByKey] as const;
          } catch {
            return [slug, {}] as const;
          }
        }),
      );
      if (!cancelled)
        setRoleEmailsByProjectSlug(Object.fromEntries(entries) as Record<
          string,
          Record<string, string[]>
        >);
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, projectSlugsInSession.join("|")]);

  const slotPlannerEmails = useMemo(() => {
    if (!session) return [];
    const set = new Set<string>();
    for (const sl of session.slots ?? []) {
      const ref = sl.ref;
      if (!ref?.projectSlug || ref.stepId == null) continue;
      const slug = String(ref.projectSlug).trim();
      const cached = dataCache[slug];
      const rem = roleEmailsByProjectSlug[slug];
      if (!cached?.steps?.length || !rem) continue;
      const plannedData: DirectorSlotPlannedData = {
        steps: cached.steps,
        sceneRoles: cached.sceneRoles ?? null,
        roleEmailsByKey: rem,
      };
      const byRole = getRolePlannedEmailsForDirectorSlot(
        slug,
        ref.stepId,
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
  }, [session, session?.slots, dataCache, roleEmailsByProjectSlug]);

  useEffect(() => {
    if (!accessToken) {
      setPlannerProfiles([]);
      return;
    }
    if (slotPlannerEmails.length === 0) {
      setPlannerProfiles([]);
      return;
    }
    let cancelled = false;
    getProfilesBatch(accessToken, slotPlannerEmails)
      .then((list) => {
        if (!cancelled) setPlannerProfiles(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlannerProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, slotPlannerEmails.join("|")]);

  const profilesForSlotTones = useMemo(() => {
    const m = new Map<string, TeamProfile>();
    for (const p of teamProfiles ?? []) {
      const e = normalizeEmail((p as any)?.email);
      if (e) m.set(e, p);
    }
    for (const p of plannerProfiles ?? []) {
      const e = normalizeEmail((p as any)?.email);
      if (e) m.set(e, p);
    }
    return m;
  }, [teamProfiles, plannerProfiles]);

  /** Цвет слота по графику полного состава ролей (чекбоксы репетиции не учитываются). */
  const slotRehearsalToneClassById = useMemo(() => {
    const out = new Map<string, string>();
    if (!session || !sessionDateKey) return out;
    const base = getSessionStartLocalMinutes(session.startsAt);

    for (const sl of session.slots ?? []) {
      const ref = sl.ref;
      if (!ref?.projectSlug || ref.stepId == null) continue;
      const slug = String(ref.projectSlug).trim();
      const cached = dataCache[slug];
      const rem = roleEmailsByProjectSlug[slug];
      if (!cached?.steps?.length || !rem) continue;

      const plannedData: DirectorSlotPlannedData = {
        steps: cached.steps,
        sceneRoles: cached.sceneRoles ?? null,
        roleEmailsByKey: rem,
      };

      const byRole = getRolePlannedEmailsForDirectorSlot(
        slug,
        ref.stepId,
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
  }, [
    session?.id,
    session?.startsAt,
    session?.slots,
    sessionDateKey,
    dataCache,
    roleEmailsByProjectSlug,
    profilesForSlotTones,
  ]);

  useEffect(() => {
    if (!projectFilter) return;
    void loadProjectData(projectFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  useEffect(() => {
    if (!rolesSlug || rolesSlug === projectFilter) return;
    void loadProjectData(rolesSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesSlug, projectFilter]);

  useEffect(() => {
    if (!accessToken || !rolesSlug) {
      setProjectMemberEmails([]);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    setAvailabilityError(null);
    getProjectMembers(accessToken, rolesSlug)
      .then((res) => {
        if (cancelled) return;
        const emails = [
          res.owner?.email ? normalizeEmail(res.owner.email) : null,
          ...(res.members ?? []).map((m) => normalizeEmail(m.user?.email)),
        ].filter(Boolean) as string[];
        setProjectMemberEmails(Array.from(new Set(emails)));
      })
      .catch((e: any) => {
        if (cancelled) return;
        setProjectMemberEmails([]);
        setAvailabilityError(
          e?.response?.data?.message ??
            e?.message ??
            "Не удалось загрузить участников проекта",
        );
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, rolesSlug]);

  useEffect(() => {
    if (!accessToken || !rolesSlug) {
      setRoleEmailsByKey({});
      setRoleTitleByKey({});
      return;
    }
    let cancelled = false;
    setRolesLoading(true);
    setAvailabilityError(null);
    getProjectRoles(accessToken, rolesSlug)
      .then((rolesRes) => {
        if (cancelled) return;
        const emailsByKey: Record<string, string[]> = {};
        const titleByKey: Record<string, string> = {};
        (rolesRes?.roles ?? []).forEach((r: any) => {
          const key = normalizeRoleKey(String(r?.key ?? r?.title ?? ""));
          if (!key) return;
          const emails = Array.isArray(r?.emails)
            ? r.emails.map((e: any) => normalizeEmail(e)).filter(Boolean)
            : [];
          emailsByKey[key] = Array.from(new Set(emails));
          titleByKey[key] = String(r?.title ?? r?.key ?? key).trim() || key;
        });
        setRoleEmailsByKey(emailsByKey);
        setRoleTitleByKey(titleByKey);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setRoleEmailsByKey({});
        setRoleTitleByKey({});
        setAvailabilityError(
          e?.response?.data?.message ??
            e?.message ??
            "Не удалось загрузить роли проекта",
        );
      })
      .finally(() => {
        if (!cancelled) setRolesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, rolesSlug]);

  useEffect(() => {
    if (!accessToken) return;
    if (projectMemberEmails.length === 0) {
      setTeamProfiles([]);
      return;
    }
    let cancelled = false;
    setAvailabilityError(null);
    getProfilesBatch(accessToken, projectMemberEmails)
      .then((list) => {
        if (!cancelled) setTeamProfiles(list ?? []);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setTeamProfiles([]);
        setAvailabilityError(
          e?.response?.data?.message ??
            e?.message ??
            "Не удалось загрузить профили участников",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, projectMemberEmails.join("|")]);

  const freeRolesNormSet = useMemo(() => {
    const set = new Set<string>();
    if (!sessionDateKey || !slotWindow) return set;
    const roleEmails = roleEmailsByKey ?? {};
    const profMap = profilesForSlotTones;
    for (const [rk, emails] of Object.entries(roleEmails)) {
      if (!rk || !Array.isArray(emails) || emails.length === 0) continue;
      const ok = emails.some((raw) => {
        const email = normalizeEmail(String(raw ?? ""));
        if (!email || !looksLikeEmail(email)) return false;
        const p = profMap.get(email);
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
  }, [roleEmailsByKey, sessionDateKey, slotWindow, profilesForSlotTones]);

  const headerTimeLabel = useMemo(() => {
    if (!session?.startsAt) return "";
    return dayjs(session.startsAt).format("D MMMM YYYY, HH:mm");
  }, [session?.startsAt]);

  const slotTimeLabel = useMemo(() => {
    if (!session || !slot) return "";
    return `${formatSlotTime(session.startsAt, slot.offsetMin)} · ${slot.durationMin} мин`;
  }, [session, slot]);

  const steps = useMemo(() => {
    const src = projectFilter ? (dataCache[projectFilter]?.steps ?? []) : [];
    const base = src.filter((s) => !isReadyStep(s));
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((s) => {
      const inTitle = String(s.title ?? "")
        .toLowerCase()
        .includes(q);
      const inText = markdownToPlainText(
        String((s as any).playMarkdown ?? (s as any).markdown ?? ""),
      )
        .toLowerCase()
        .includes(q);
      return inTitle || inText;
    });
  }, [dataCache, projectFilter, query]);

  const selectableSteps = useMemo(() => {
    const out: Array<{
      step: ScriptStep;
      ok: boolean;
      missing: string[];
      roles: string[];
    }> = [];
    const list = steps;
    const freeSet = freeRolesNormSet;
    const pack = projectFilter ? dataCache[projectFilter] : null;
    const sceneRoles = pack?.sceneRoles ?? null;

    for (const s of list) {
      const roleKeysNorm = getNormalizedRoleKeysForSlotStep(
        s,
        sceneRoles,
        s.id,
      );
      const roles = roleKeysNorm.map(
        (rk) => roleTitleByKey[rk] ?? rk,
      );
      const missing: string[] = [];
      for (const normKey of roleKeysNorm) {
        if (normKey && !freeSet.has(normKey)) {
          missing.push(roleTitleByKey[normKey] ?? normKey);
        }
      }
      out.push({ step: s, ok: missing.length === 0, missing, roles });
    }
    return out;
  }, [freeRolesNormSet, steps, dataCache, projectFilter, roleTitleByKey]);

  const stepsForList = useMemo(() => {
    if (!onlySelectable) return selectableSteps;
    return selectableSteps.filter((x) => x.ok);
  }, [onlySelectable, selectableSteps]);

  /** Шаги (project + stepId), которые уже привязаны к какому-либо слоту этой сессии */
  const slotsByStepRefInSession = useMemo(() => {
    const map = new Map<string, DirectorSessionSlot[]>();
    if (!session?.slots?.length) return map;
    for (const sl of session.slots) {
      const r = sl.ref;
      if (!r?.projectSlug) continue;
      const stepId = Math.floor(Number(r.stepId) || 0);
      if (!Number.isFinite(stepId) || stepId <= 0) continue;
      const k = directorSlotRefKey(r.projectSlug, stepId);
      const arr = map.get(k) ?? [];
      arr.push(sl);
      map.set(k, arr);
    }
    return map;
  }, [session?.id, session?.slots]);

  const selectedStep = useMemo(() => {
    if (!slot?.ref) return null;
    const slug = slot.ref.projectSlug;
    const id = slot.ref.stepId;
    const data = dataCache[slug];
    return data?.steps?.find((s) => s.id === id) ?? null;
  }, [dataCache, slot?.ref]);

  const slotPlannedInput = useMemo((): DirectorSlotPlannedData | null => {
    if (!slot?.ref) return null;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const cached = dataCache[slug];
    return {
      steps: cached?.steps ?? [],
      sceneRoles: cached?.sceneRoles ?? null,
      roleEmailsByKey,
    };
  }, [slot?.ref, dataCache, roleEmailsByKey]);

  const slotRoleKeysForPicker = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return [];
    const stepId = slot.ref.stepId;
    const step = slotPlannedInput.steps.find((s) => s.id === stepId) ?? null;
    return getNormalizedRoleKeysForSlotStep(
      step,
      slotPlannedInput.sceneRoles,
      stepId,
    );
  }, [slot?.ref, slotPlannedInput]);

  const slotChartEmailSet = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return undefined;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const list = getAllAssigneeEmailsForDirectorSlotChart(
      slug,
      slot.ref.stepId,
      slotPlannedInput,
    );
    return new Set(list);
  }, [slot?.ref, slotPlannedInput]);

  if (!accessToken)
    return (
      <div style={{ padding: 12 }}>
        Нужно войти, чтобы открыть страницу сессии.
      </div>
    );
  if (!sid) return <div style={{ padding: 12 }}>Некорректный адрес.</div>;

  return (
    <div className="director-session-page">
      <div className="director-session-page__head">
        <Link
          to={`/sessions?sessionId=${encodeURIComponent(sid)}`}
          className="director-session-page__back"
        >
          ← К списку сессий
        </Link>
      </div>

      {loading ? (
        <div style={{ marginTop: 10, opacity: 0.75 }}>Загрузка…</div>
      ) : null}
      {error ? (
        <div className="settings-invite-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {session ? (
        <>
          <div className="director-session-page__title">{session.title}</div>
        </>
      ) : (
        <div className="director-session-page__title">Сессия</div>
      )}
      {session && !loading && (
        <div className="director-session-page__grid">
          <DirectorSessionSlotsPanel
            session={session}
            sessions={sessions}
            slotToneClassById={slotRehearsalToneClassById}
            selectedSlotId={slId || null}
            onSelectSlot={(id) =>
              navigate(
                `/sessions/${encodeURIComponent(sid)}/slots/${encodeURIComponent(id)}`,
              )
            }
            onRequestCloseSlot={() =>
              navigate(`/sessions/${encodeURIComponent(sid)}`)
            }
            onNoSlotsLeft={() =>
              navigate(`/sessions/${encodeURIComponent(sid)}`, {
                replace: true,
              })
            }
            persistSessions={persistSessions}
            slotSettings={
              slot ? (
                <div className="director-session-page__detail-grid">
                  <RehearsalsCard
                    fluid
                    title=""
                    className="director-session-page__preview"
                  >
                    {selectedStep && (
                      <div className="session__step-item">
                        <PreviewSlot selectedStep={selectedStep} />

                        <TroupeSchedulePreview
                          sessionDateKey={sessionDateKey}
                          profiles={teamProfiles}
                          membersLoading={membersLoading}
                          participantEmailSet={slotChartEmailSet}
                        />
                        <SlotRoleRehearsalPicker
                          roleKeys={slotRoleKeysForPicker}
                          roleTitleByKey={roleTitleByKey}
                          roleEmailsByKey={roleEmailsByKey}
                          picks={slot.roleRehearsalPicks}
                          profiles={teamProfiles}
                          onPicksChange={(next) =>
                            void updateSlot({ roleRehearsalPicks: next })
                          }
                        />
                      </div>
                    )}

                    <FormTextarea
                      rootClassName="form-textarea--section"
                      label="Заметки к слоту"
                      value={slotNotesDraft}
                      onChange={(e) => onSlotNotesChange(e.target.value)}
                      onBlur={onSlotNotesBlur}
                      placeholder="Например: темп, акценты, на что обратить внимание…"
                      rows={4}
                    />

                    <div
                      style={{
                        marginTop: 12,
                        display: "flex",
                        gap: 10,
                        flexWrap: "wrap",
                      }}
                    ></div>
                  </RehearsalsCard>

                  <RehearsalsCard fluid title="">
                    <div style={{ marginTop: 10 }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 10,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        <select
                          className="native-select"
                          value={projectFilter}
                          onChange={(e) => setProjectFilter(e.target.value)}
                        >
                          {visibleProjects.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                        <input
                          className="native-text-input"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="поиск по названию/тексту"
                          style={{ flex: 1, minWidth: 240 }}
                        />
                      </div>
                    </div>
                    <div className="session__steps-checkbox">
                      <LabeledCheckbox
                        checked={onlySelectable}
                        onChange={(e) => setOnlySelectable(e)}
                      >
                        <span className="">по доступности актёров</span>
                      </LabeledCheckbox>
                    </div>

                    {stepsLoading ? (
                      <div className="session__steps-list">Загружаю шаги…</div>
                    ) : null}
                    {stepsError ? (
                      <div
                        className="settings-invite-error"
                        style={{ marginTop: 10 }}
                      >
                        {stepsError}
                      </div>
                    ) : null}
                    {availabilityError ? (
                      <div
                        className="settings-invite-error"
                        style={{ marginTop: 10 }}
                      >
                        {availabilityError}
                      </div>
                    ) : null}

                    <div className="session__steps-list">
                      {stepsForList.slice(0, 250).map((stepData) => {
                        const s = stepData.step;
                        const isSelected = Boolean(
                          slot.ref &&
                          slot.ref.projectSlug === projectFilter &&
                          slot.ref.stepId === s.id,
                        );
                        const ok = stepData.ok;
                        const refKey = directorSlotRefKey(projectFilter, s.id);
                        const slotsWithSameRef =
                          slotsByStepRefInSession.get(refKey) ?? [];
                        const otherSlotsWithRef = slotsWithSameRef.filter(
                          (sl) => sl.id !== slot.id,
                        );
                        const bookedInOtherSlots = otherSlotsWithRef.length > 0;
                        const otherSlotsTimesLabel =
                          bookedInOtherSlots && session
                            ? (() => {
                                const sorted = [...otherSlotsWithRef].sort(
                                  (a, b) => a.offsetMin - b.offsetMin,
                                );
                                if (sorted.length === 1) {
                                  return formatSlotTime(
                                    session.startsAt,
                                    sorted[0].offsetMin,
                                  );
                                }
                                if (sorted.length === 2) {
                                  return `${formatSlotTime(session.startsAt, sorted[0].offsetMin)} · ${formatSlotTime(session.startsAt, sorted[1].offsetMin)}`;
                                }
                                return `${formatSlotTime(session.startsAt, sorted[0].offsetMin)} +${sorted.length - 1}`;
                              })()
                            : "";
                        const assignTitle =
                          bookedInOtherSlots && session
                            ? `Назначить в этот слот. Уже в сессии: ${[
                                ...otherSlotsWithRef,
                              ]
                                .sort((a, b) => a.offsetMin - b.offsetMin)
                                .map((sl) =>
                                  formatSlotTime(
                                    session.startsAt,
                                    sl.offsetMin,
                                  ),
                                )
                                .join(", ")}`
                            : "Назначить в этот слот";
                        return (
                          <button
                            className={cn("session__step-item", {
                              "session__step-item--selected": isSelected,
                              "session__step-item--ok": !isSelected && ok,
                              "session__step-item--bad": !isSelected && !ok,
                              "session__step-item--booked":
                                bookedInOtherSlots && !isSelected,
                            })}
                            key={`${projectFilter}:${s.id}`}
                            type="button"
                            onClick={() =>
                              void updateSlot({
                                ref: {
                                  projectSlug: projectFilter,
                                  stepId: s.id,
                                },
                                durationMin:
                                  s.durationMin == null
                                    ? slot.durationMin
                                    : Math.max(
                                        1,
                                        Math.floor(Number(s.durationMin) || 1),
                                      ),
                                roleRehearsalPicks: undefined,
                              })
                            }
                            title={assignTitle}
                          >
                            <div
                              className="session__step-item__title"
                              style={{ fontWeight: 900, fontSize: 12 }}
                            >
                              <span className="session__step-item__title-text">
                                #{s.id} {s.title || "\u00a0"}
                              </span>
                              {bookedInOtherSlots ? (
                                <span
                                  className="session__step-item__badge session__step-item__badge--in-session"
                                  aria-hidden
                                >
                                  в сессии
                                  {otherSlotsTimesLabel ? (
                                    <span className="session__step-item__badge-detail">
                                      {" "}
                                      · {otherSlotsTimesLabel}
                                    </span>
                                  ) : null}
                                </span>
                              ) : null}
                            </div>
                            <div
                              className="session__step-item__status"
                              style={{ fontSize: 12, opacity: 0.72 }}
                            >
                              {isReadyStep(s) ? "Готова" : "В работе"}
                              {s.durationMin != null
                                ? ` · длит.: ${Math.max(1, Math.floor(Number(s.durationMin) || 1))} мин`
                                : ""}
                              {" · "}
                              {ok ? (
                                <span
                                  style={{
                                    color: "rgba(126, 231, 135, 0.95)",
                                    fontWeight: 800,
                                  }}
                                >
                                  можно взять
                                </span>
                              ) : (
                                <span
                                  style={{
                                    color: "rgba(248, 81, 73, 0.95)",
                                    fontWeight: 800,
                                  }}
                                >
                                  не собирается
                                </span>
                              )}
                            </div>
                            <div
                              className={cn(
                                "session__step-item__missing",
                                !(!ok && stepData.missing.length > 0) &&
                                  "session__step-item__missing--empty",
                              )}
                            >
                              {!ok && stepData.missing.length > 0 ? (
                                <>
                                  не хватает:{" "}
                                  <b>
                                    {stepData.missing.slice(0, 6).join(", ")}
                                  </b>
                                  {stepData.missing.length > 6
                                    ? ` +${stepData.missing.length - 6}`
                                    : ""}
                                </>
                              ) : (
                                "\u00a0"
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {stepsForList.length === 0 && !stepsLoading && (
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          Нет шагов (или сцена не найдена).
                        </div>
                      )}
                    </div>
                  </RehearsalsCard>
                </div>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

const PreviewSlot = ({ selectedStep }: { selectedStep: any }) => {
  return (
    <pre className="director-session-page__preview-pre">
      {(() => {
        const text = String(
          (selectedStep as any).playMarkdown ??
            (selectedStep as any).markdown ??
            "",
        );
        const plain = markdownToPlainText(text);
        return (
          plain.slice(0, 1600) + (plain.length > 1600 ? "\n\n… (обрезано)" : "")
        );
      })()}
    </pre>
  );
};
