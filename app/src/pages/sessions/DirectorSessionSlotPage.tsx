import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import {
  loadDirectorSessions,
  saveDirectorSessions,
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
} from "../../features/director-sessions/directorSessionsSync";
import { useProject } from "../../features/project";
import { RehearsalsCard } from "../../features/rehearsals-card/RehearsalsCard";
import type { SceneRolesDataV1 } from "../../features/scene";
import type { ScriptStep } from "../../shared/types/script";
import { markdownToPlainText } from "../../shared/utils/textPreview";
import { syncPull } from "../../sync/api/entity-sync";
import type { SyncPullResponse } from "../../sync/api/types/sync";
import { getProfilesBatch, type TeamProfile } from "../../sync/api/profile";
import { getProjectMembers, getProjectRoles } from "../../sync/api/projects";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import { SlotRoleRehearsalPicker } from "./SlotRoleRehearsalPicker";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getNormalizedRoleKeysForSlotStep,
  type DirectorSlotPlannedData,
} from "./sessionSlotPlanned";
import { TroupeSchedulePreview } from "./TroupeSchedulePreview";

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

function extractRolesBrackets(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const role = (m[1] ?? "").trim();
    if (role) out.push(role);
  }
  return Array.from(new Set(out));
}

function extractSpeakerRolesFromLines(text?: string): string[] {
  if (!text) return [];
  const out: string[] = [];
  const lines = text.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith("==") || line.startsWith("(")) continue;
    const m1 = line.match(/^([A-ZА-ЯЁ][A-ZА-ЯЁ0-9 _.\-]{1,40})\s*[:—-]\s+\S/);
    if (m1?.[1]) {
      const role = m1[1].replace(/\s+/g, " ").trim();
      if (role.length >= 2 && role.length <= 40) out.push(role);
      continue;
    }
    const m2 = line.match(/^([A-ZА-ЯЁ]{2,40})([.,!?:])\s+/);
    if (m2?.[1]) out.push(m2[1].trim());
  }
  return Array.from(new Set(out));
}

function extractRolesSmart(text?: string): string[] {
  const a = extractRolesBrackets(text);
  const b = extractSpeakerRolesFromLines(text);
  return Array.from(
    new Set(
      [...a, ...b]
        .map((x) => String(x ?? "").trim())
        .filter((x) => x.length > 0),
    ),
  );
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
  const sceneRoles = ((scene as any)?.sceneRoles ?? null) as SceneRolesDataV1 | null;
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

export function DirectorSessionSlotPage() {
  const { accessToken } = useAuth();
  const { projects } = useProject();
  const navigate = useNavigate();

  const { sessionId, slotId } = useParams();
  const sid = String(sessionId ?? "").trim();
  const slId = String(slotId ?? "").trim();

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

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );

  const projectFilterStorageKey = useMemo(
    () => `directorSessions:slot:${sid}:${slId}:project`,
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
    if (!accessToken || !sid || !slId) return;
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
        const sl = (s.slots ?? []).find((x) => x.id === slId) ?? null;
        if (!sl) {
          setSession(s);
          setSlot(null);
          setError("Слот не найден");
          return;
        }
        setSession(s);
        setSlot(sl);
        setError(null);
      })
      .catch((e: any) => {
        if (cancelled) return;
        setError(e?.message ?? "Не удалось загрузить слот");
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
    if (!sessionDateKey) return set;
    if (!slotWindow) return set;
    const roleEmails = roleEmailsByKey ?? {};
    for (const p of teamProfiles ?? []) {
      const email = normalizeEmail((p as any)?.email);
      if (!email) continue;
      if (!looksLikeEmail(email)) continue;
      const cal = (p as any)?.availabilityCalendar as
        | Record<string, string>
        | undefined;
      const st =
        cal?.[sessionDateKey] === "present"
          ? "present"
          : cal?.[sessionDateKey] === "absent"
            ? "absent"
            : "unknown";
      if (st !== "present") continue;
      const ranges = getRangesForDateMinutes(p, sessionDateKey);
      if (ranges.length > 0) {
        if (!isSlotInsideRanges(slotWindow.startMin, slotWindow.endMin, ranges))
          continue;
      }
      for (const [rk, emails] of Object.entries(roleEmails)) {
        if (!rk) continue;
        if (!Array.isArray(emails) || emails.length === 0) continue;
        if (!emails.includes(email)) continue;
        set.add(rk);
      }
    }
    return set;
  }, [roleEmailsByKey, sessionDateKey, slotWindow, teamProfiles]);

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
    for (const s of list) {
      const text = String((s as any).playMarkdown ?? (s as any).markdown ?? "");
      const roles = extractRolesSmart(text);
      const missing: string[] = [];
      for (const r of roles) {
        const norm = normalizeRoleKey(r);
        if (norm && !freeSet.has(norm)) missing.push(r);
      }
      out.push({ step: s, ok: missing.length === 0, missing, roles });
    }
    return out;
  }, [freeRolesNormSet, steps]);

  const stepsForList = useMemo(() => {
    if (!onlySelectable) return selectableSteps;
    return selectableSteps.filter((x) => x.ok);
  }, [onlySelectable, selectableSteps]);

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
    const step =
      slotPlannedInput.steps.find((s) => s.id === stepId) ?? null;
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
    return <div style={{ padding: 12 }}>Нужно войти, чтобы открыть слот.</div>;
  if (!sid || !slId)
    return <div style={{ padding: 12 }}>Некорректный URL слота.</div>;

  return (
    <div
      style={{ padding: "12px 12px 40px", maxWidth: 1100, margin: "0 auto" }}
    >
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Link
          to={`/sessions?sessionId=${encodeURIComponent(sid)}`}
          style={{ textDecoration: "none", color: "inherit", opacity: 0.85 }}
        >
          ← К сессии
        </Link>
        <div style={{ fontWeight: 800, fontSize: 16 }}>Слот</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{headerTimeLabel}</div>
        <div style={{ fontSize: 12, opacity: 0.75 }}>{slotTimeLabel}</div>
      </div>

      {loading ? (
        <div style={{ marginTop: 10, opacity: 0.75 }}>Загрузка…</div>
      ) : null}
      {error ? (
        <div className="settings-invite-error" style={{ marginTop: 10 }}>
          {error}
        </div>
      ) : null}

      {session && slot && !loading && !error && (
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "1fr 1.2fr",
            alignItems: "start",
          }}
        >
          <RehearsalsCard fluid title="Текущий выбор">
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.85 }}>
              {slot.ref ? (
                <>
                  <div>
                    Проект: <b>{slot.ref.projectSlug}</b>
                  </div>
                  <div>
                    Шаг: <b>#{slot.ref.stepId}</b>
                  </div>
                </>
              ) : (
                <div>Материал не выбран.</div>
              )}
            </div>

            {selectedStep && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 900 }}>Превью</div>
                <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                  {selectedStep.title ? selectedStep.title : "—"}
                </div>
                <pre
                  style={{
                    marginTop: 8,
                    whiteSpace: "pre-wrap",
                    maxHeight: 260,
                    overflow: "auto",
                    padding: 10,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.20)",
                    fontSize: 12,
                    lineHeight: 1.35,
                  }}
                >
                  {(() => {
                    const text = String(
                      (selectedStep as any).playMarkdown ??
                        (selectedStep as any).markdown ??
                        "",
                    );
                    const plain = markdownToPlainText(text);
                    return (
                      plain.slice(0, 1600) +
                      (plain.length > 1600 ? "\n\n… (обрезано)" : "")
                    );
                  })()}
                </pre>
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
              placeholder="Например: темп, ключевой акцент, кого проверить…"
              rows={4}
            />

            <div
              style={{
                marginTop: 12,
                display: "flex",
                gap: 10,
                flexWrap: "wrap",
              }}
            >
              <button
                type="button"
                onClick={() =>
                  void updateSlot({
                    ref: undefined,
                    roleRehearsalPicks: undefined,
                  })
                }
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                Снять материал
              </button>
              <button
                type="button"
                onClick={() =>
                  navigate(`/sessions?sessionId=${encodeURIComponent(sid)}`)
                }
                style={{
                  height: 34,
                  padding: "0 12px",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                  color: "inherit",
                  cursor: "pointer",
                  fontWeight: 800,
                  fontSize: 12,
                }}
              >
                Готово
              </button>
            </div>
          </RehearsalsCard>

          <RehearsalsCard fluid title="Выбор сцены/шага">
            <div
              style={{
                marginTop: 10,
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

            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 12,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <label
                style={{
                  display: "inline-flex",
                  gap: 8,
                  alignItems: "center",
                  userSelect: "none",
                }}
              >
                <input
                  type="checkbox"
                  checked={onlySelectable}
                  onChange={(e) => setOnlySelectable(e.target.checked)}
                />
                <span style={{ fontSize: 12, opacity: 0.85 }}>
                  по доступности актёров
                </span>
              </label>
              {(membersLoading || rolesLoading) && (
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  подгружаю роли/участников…
                </span>
              )}
              {sessionDateKey && slotWindow ? (
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  окно слота: <b>{sessionDateKey}</b> ·{" "}
                  {formatTimeHHMM(slotWindow.startMin)}–
                  {formatTimeHHMM(slotWindow.endMin)}
                </span>
              ) : (
                <span style={{ fontSize: 12, opacity: 0.75 }}>
                  нет даты/времени для расчёта доступности
                </span>
              )}
            </div>

            {stepsLoading ? (
              <div style={{ marginTop: 10, opacity: 0.75, fontSize: 12 }}>
                Загружаю шаги…
              </div>
            ) : null}
            {stepsError ? (
              <div className="settings-invite-error" style={{ marginTop: 10 }}>
                {stepsError}
              </div>
            ) : null}
            {availabilityError ? (
              <div className="settings-invite-error" style={{ marginTop: 10 }}>
                {availabilityError}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 10,
                display: "grid",
                gap: 8,
                maxHeight: 620,
                overflow: "auto",
                paddingRight: 4,
              }}
            >
              {stepsForList.slice(0, 250).map((x) => {
                const s = x.step;
                const isSelected = Boolean(
                  slot.ref &&
                  slot.ref.projectSlug === projectFilter &&
                  slot.ref.stepId === s.id,
                );
                const ok = x.ok;
                return (
                  <button
                    key={`${projectFilter}:${s.id}`}
                    type="button"
                    onClick={() =>
                      void updateSlot({
                        ref: { projectSlug: projectFilter, stepId: s.id },
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
                    style={{
                      textAlign: "left",
                      borderRadius: 12,
                      border: isSelected
                        ? "1px solid rgba(96,165,250,0.55)"
                        : ok
                          ? "1px solid rgba(46,160,67,0.28)"
                          : "1px solid rgba(248,81,73,0.22)",
                      background: isSelected
                        ? "rgba(96,165,250,0.10)"
                        : ok
                          ? "rgba(46,160,67,0.08)"
                          : "rgba(248,81,73,0.06)",
                      padding: "10px 10px",
                      cursor: "pointer",
                      color: "inherit",
                      display: "grid",
                      gap: 4,
                    }}
                    title="Назначить в этот слот"
                  >
                    <div style={{ fontWeight: 900, fontSize: 12 }}>
                      #{s.id} {s.title}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.72 }}>
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
                    {!ok && x.missing.length > 0 && (
                      <div style={{ fontSize: 12, opacity: 0.85 }}>
                        не хватает: <b>{x.missing.slice(0, 6).join(", ")}</b>
                        {x.missing.length > 6
                          ? ` +${x.missing.length - 6}`
                          : ""}
                      </div>
                    )}
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
      )}
    </div>
  );
}
