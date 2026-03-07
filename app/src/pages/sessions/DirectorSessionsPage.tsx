import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth";
import {
  loadDirectorSessions,
  saveDirectorSessions,
  type DirectorRehearsalSession,
  type DirectorSessionSlot,
} from "../../features/director-sessions/directorSessionsSync";
import { useProject } from "../../features/project";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import type { ScriptStep } from "../../shared/types/script";
import { createId } from "../../shared/utils/createId";
import { markdownToPlainText } from "../../shared/utils/textPreview";
import {
  getProfilesBatch,
  getProjectMembers,
  getProjectRoles,
  publishDirectorSession,
  syncPull,
  type TeamProfile,
} from "../../sync/api";
import "../rehearsals/style.css";
import "./style.css";
import { ListItem } from "@shared/components/list-item/ListItem";

type ProjectDataCache = Record<
  string,
  {
    steps: ScriptStep[];
    roleEmailsByKey: Record<string, string[]>;
    roleTitleByKey: Record<string, string>;
  }
>;

type AvailabilityTimeRange = { from: string; to: string };

const DND_MIME_SLOT_ID = "application/x-orchestra-director-session-slot";
const DND_MIME_STEP_REF = "application/x-orchestra-director-session-step-ref";

type DragStepRefPayload = {
  kind: "stepRef";
  projectSlug: string;
  stepId: number;
  durationMin?: number;
};

function parseDragStepRef(dt: DataTransfer): DragStepRefPayload | null {
  const raw = dt.getData(DND_MIME_STEP_REF);
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Partial<DragStepRefPayload> | null;
    if (!v || v.kind !== "stepRef") return null;
    const projectSlug = String(v.projectSlug ?? "").trim();
    const stepId = Number(v.stepId);
    const durationMin =
      v.durationMin == null ? undefined : Math.max(1, Math.floor(Number(v.durationMin)));
    if (!projectSlug) return null;
    if (!Number.isFinite(stepId) || stepId <= 0) return null;
    return { kind: "stepRef", projectSlug, stepId, durationMin };
  } catch (_) {
    return null;
  }
}

function parseDragSlotId(dt: DataTransfer): string | null {
  const id = String(dt.getData(DND_MIME_SLOT_ID) || dt.getData("text/plain") || "").trim();
  return id || null;
}

function guessDurationMin(payload: DragStepRefPayload): number {
  const d = Number(payload.durationMin);
  if (Number.isFinite(d) && d > 0) return Math.max(1, Math.floor(d));
  return 30;
}

function isReadyStep(step: ScriptStep): boolean {
  const st = String((step as any)?.kanbanStatus ?? "")
    .trim()
    .toLowerCase();
  return st === "ready" || st === "готова";
}

function safeDateFromDateKey(dateKey: string): Date | null {
  const s = String(dateKey ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  // Use noon to avoid timezone edge cases around midnight.
  const d = new Date(`${s}T12:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function formatTimeFromOffset(offsetMin: number): string {
  const m = Math.max(0, Math.floor(offsetMin));
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function packSlotsSequentialInOrder(slots: DirectorSessionSlot[]): DirectorSessionSlot[] {
  const list = [...(slots ?? [])];
  let offset = 0;
  return list.map((s) => {
    const dur = Math.max(1, Math.floor(Number(s.durationMin) || 1));
    const item = { ...s, offsetMin: offset, durationMin: dur };
    offset += dur;
    return item;
  });
}

function packSlotsSequentialByOffset(slots: DirectorSessionSlot[]): DirectorSessionSlot[] {
  const sorted = [...(slots ?? [])].sort((a, b) => a.offsetMin - b.offsetMin);
  return packSlotsSequentialInOrder(sorted);
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

function formatTimeHHMM(totalMin: number): string {
  const m = ((Math.floor(totalMin) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(m / 60)).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function getSessionStartLocalMinutes(startsAtIso: string): number {
  const d = new Date(startsAtIso);
  if (!Number.isFinite(d.getTime())) return 0;
  return d.getHours() * 60 + d.getMinutes();
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

function looksLikeEmail(v: string): boolean {
  return /.+@.+\..+/.test(v);
}

function normalizeEmail(v: string): string {
  return String(v ?? "").trim().toLowerCase();
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
      [...a, ...b].map((x) => String(x ?? "").trim()).filter((x) => x.length > 0),
    ),
  );
}

function computePlannedEmailsForSession(
  session: DirectorRehearsalSession,
  dataCache: ProjectDataCache,
): { emails: string[]; complete: boolean } {
  const out = new Set<string>();
  let complete = true;
  const slots = session?.slots ?? [];
  for (const sl of slots) {
    const ref = (sl as any)?.ref as { projectSlug?: string; stepId?: number } | undefined;
    const slug = String(ref?.projectSlug ?? "").trim();
    const stepId = typeof ref?.stepId === "number" ? ref.stepId : null;
    if (!slug || stepId == null) continue;
    const data = dataCache[slug];
    if (!data) {
      complete = false;
      continue;
    }
    const step = (data.steps ?? []).find((x) => x.id === stepId) ?? null;
    const text = String((step as any)?.playMarkdown ?? (step as any)?.markdown ?? "");
    const roles = extractRolesSmart(text);
    for (const r of roles) {
      const key = normalizeRoleKey(r);
      if (!key) continue;
      const emails = (data.roleEmailsByKey ?? {})[key] ?? [];
      for (const e of emails) {
        const norm = normalizeEmail(String(e ?? ""));
        if (!norm) continue;
        if (!looksLikeEmail(norm)) continue;
        out.add(norm);
        if (out.size >= 500) break;
      }
      if (out.size >= 500) break;
    }
    if (out.size >= 500) break;
  }
  return { emails: Array.from(out), complete };
}

function getLocalDateTimeParts(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return { date: "", time: "" };
  const date = toDateKey(d);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return { date, time: `${hh}:${mm}` };
}

export function DirectorSessionsPage() {
  const { accessToken } = useAuth();
  const { projects } = useProject();
  const location = useLocation();
  const navigate = useNavigate();

  const sessionIdFromUrl = useMemo(() => {
    const sp = new URLSearchParams(location.search);
    const v = String(sp.get("sessionId") ?? "").trim();
    return v || null;
  }, [location.search]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
  const [timelineDragOver, setTimelineDragOver] = useState(false);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId) ?? null,
    [activeSessionId, sessions],
  );

  // minimal UX: selected slot
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);
  useEffect(() => {
    if (!activeSession) {
      setActiveSlotId(null);
      return;
    }
    setActiveSlotId((prev) => prev ?? activeSession.slots?.[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId]);

  const sessionDateKey = useMemo(() => {
    if (!activeSession?.startsAt) return null;
    const d = new Date(activeSession.startsAt);
    return Number.isFinite(d.getTime()) ? toDateKey(d) : null;
  }, [activeSession?.startsAt]);

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadDirectorSessions(accessToken)
      .then((res) => {
        if (cancelled) return;
        setSessions(res.sessions ?? []);
        const ids = new Set((res.sessions ?? []).map((s: any) => String(s?.id ?? "")).filter(Boolean));
        setActiveSessionId((prev) => {
          if (sessionIdFromUrl && ids.has(sessionIdFromUrl)) return sessionIdFromUrl;
          return prev ?? res.sessions?.[0]?.id ?? null;
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message || "Не удалось загрузить сессии");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, sessionIdFromUrl]);

  // Keep URL in sync for shareable link
  useEffect(() => {
    if (location.pathname !== "/sessions") return;
    const current = sessionIdFromUrl;
    const next = activeSessionId || null;
    if (current === next) return;
    const search = next ? `?sessionId=${encodeURIComponent(next)}` : "";
    navigate({ pathname: "/sessions", search }, { replace: true });
  }, [activeSessionId, location.pathname, navigate, sessionIdFromUrl]);

  const persist = async (next: DirectorRehearsalSession[]) => {
    if (!accessToken) return;
    setSessions(next);
    try {
      await saveDirectorSessions(accessToken, { sessions: next });
    } catch (e) {
      console.error("saveDirectorSessions failed:", e);
    }
  };

  const moveSessionBefore = async (dragId: string, beforeId: string) => {
    if (dragId === beforeId) return;
    const fromIndex = (sessions ?? []).findIndex((s) => s.id === dragId);
    const toIndex = (sessions ?? []).findIndex((s) => s.id === beforeId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...sessions];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    await persist(next);
  };

  const moveSessionDelta = async (id: string, delta: -1 | 1) => {
    const idx = (sessions ?? []).findIndex((s) => s.id === id);
    if (idx === -1) return;
    const nextIndex = idx + delta;
    if (nextIndex < 0 || nextIndex >= (sessions ?? []).length) return;
    const next = [...sessions];
    const tmp = next[idx];
    next[idx] = next[nextIndex];
    next[nextIndex] = tmp;
    await persist(next);
  };

  const deleteSession = async (sessionId: string) => {
    const s = (sessions ?? []).find((x) => x.id === sessionId) ?? null;
    const ok =
      typeof window !== "undefined"
        ? window.confirm(`Удалить сессию “${s?.title ?? "Без названия"}”?`)
        : true;
    if (!ok) return;
    const idx = (sessions ?? []).findIndex((x) => x.id === sessionId);
    const next = (sessions ?? []).filter((x) => x.id !== sessionId);
    const nextActive =
      activeSessionId === sessionId
        ? next[Math.min(idx, Math.max(0, next.length - 1))]?.id ?? next[0]?.id ?? null
        : activeSessionId;
    setActiveSessionId(nextActive);
    await persist(next);
  };

  const publishActiveSession = async () => {
    if (!accessToken || !activeSession) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await publishDirectorSession(accessToken, activeSession.id, {
        comment: activeSession.comment ?? "",
      });
    } catch (e: any) {
      setPublishError(
        e?.response?.data?.message ||
        e?.message ||
        "Не удалось опубликовать сессию",
      );
    } finally {
      setPublishing(false);
    }
  };

  const createSession = async () => {
    const now = new Date();
    const nowIso = now.toISOString();
    const next: DirectorRehearsalSession = {
      id: createId(),
      title: `Сессия ${now.toLocaleDateString()}`,
      startsAt: nowIso,
      slots: [
        { id: createId(), offsetMin: 0, durationMin: 30 },
      ],
      updatedAt: nowIso,
    };
    const merged = [next, ...sessions];
    setActiveSessionId(next.id);
    await persist(merged);
  };

  const updateActiveSession = async (patch: Partial<DirectorRehearsalSession>) => {
    if (!activeSession) return;
    const nowIso = new Date().toISOString();
    const nextActive: DirectorRehearsalSession = { ...activeSession, ...patch, updatedAt: nowIso };
    const computed = computePlannedEmailsForSession(nextActive, dataCache);
    const nextWithPlanned: DirectorRehearsalSession =
      computed.complete || computed.emails.length > 0
        ? { ...nextActive, plannedEmails: computed.emails }
        : nextActive;

    const nextSessions = sessions.map((s) => (s.id === activeSession.id ? nextWithPlanned : s));
    await persist(nextSessions);
  };

  const updateSlot = async (
    slotId: string,
    patch: Partial<DirectorSessionSlot>,
    options?: { shiftFollowing?: boolean; deltaMin?: number }
  ) => {
    if (!activeSession) return;
    const shiftFollowing = Boolean(options?.shiftFollowing);
    const deltaMin = options?.deltaMin ?? 0;
    const baseSlots = [...(activeSession.slots ?? [])];
    const current = baseSlots.find((s) => s.id === slotId) ?? null;
    if (!current) return;
    const currentOffset = current.offsetMin;
    const nextSlots = baseSlots.map((s) => {
      if (s.id === slotId) return { ...s, ...patch };
      if (shiftFollowing && deltaMin !== 0 && s.offsetMin > currentOffset) {
        return { ...s, offsetMin: Math.max(0, Math.floor(s.offsetMin + deltaMin)) };
      }
      return s;
    });
    await updateActiveSession({ slots: nextSlots });
  };

  const addSlot = async () => {
    if (!activeSession) return;
    const last = [...(activeSession.slots ?? [])].sort((a, b) => a.offsetMin - b.offsetMin).slice(-1)[0];
    const nextOffset = last ? last.offsetMin + Math.max(1, last.durationMin) : 0;
    const slot: DirectorSessionSlot = {
      id: createId(),
      offsetMin: nextOffset,
      durationMin: 30,
    };
    await updateActiveSession({ slots: [...(activeSession.slots ?? []), slot] });
  };

  const removeSlot = async (slotId: string) => {
    if (!activeSession) return;
    await updateActiveSession({ slots: (activeSession.slots ?? []).filter((x) => x.id !== slotId) });
  };

  const packTimeline = async () => {
    if (!activeSession) return;
    await updateActiveSession({
      slots: packSlotsSequentialByOffset(activeSession.slots ?? []),
    });
  };

  const insertSlotAfter = async (afterSlotId: string) => {
    if (!activeSession) return;
    const slots = [...(activeSession.slots ?? [])];
    const after = slots.find((s) => s.id === afterSlotId);
    if (!after) return;
    const insertOffset = Math.max(0, Math.floor(after.offsetMin + Math.max(1, after.durationMin || 1)));
    const durationMin = 30;
    const nextSlot: DirectorSessionSlot = {
      id: createId(),
      offsetMin: insertOffset,
      durationMin,
    };
    const shifted = slots.map((s) => {
      if (!autoShiftFollowing) return s;
      // Сдвигаем то, что начинается не раньше вставки (чтобы не налезало)
      if (s.offsetMin >= insertOffset) return { ...s, offsetMin: s.offsetMin + durationMin };
      return s;
    });
    const nextSlots = [...shifted, nextSlot];
    await updateActiveSession({ slots: nextSlots });
    setActiveSlotId(nextSlot.id);
  };

  // ---- Material picker (from "kanban" data via syncPull) ----
  const projectFilterStorageKey = "directorSessions:materialsProject";
  const [projectFilter, setProjectFilter] = useState<string>(() => {
    try {
      return (
        (typeof window !== "undefined" ? localStorage.getItem(projectFilterStorageKey) : null) ||
        (typeof window !== "undefined" ? localStorage.getItem("selectedProject") : null) ||
        ""
      );
    } catch (_) {
      return "";
    }
  });
  const [query, setQuery] = useState("");
  const [dataCache, setDataCache] = useState<ProjectDataCache>({});
  const [stepsLoading, setStepsLoading] = useState(false);

  const visibleProjects = useMemo(
    () => (Array.isArray(projects) ? projects : []).filter(Boolean).sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );

  const loadProjectData = async (slug: string) => {
    if (!accessToken) return;
    if (!slug || dataCache[slug]) return;
    setStepsLoading(true);
    try {
      const pull = await syncPull(accessToken, null, slug, { steps: true });
      const rolesRes = await getProjectRoles(accessToken, slug).catch(() => null);
      const roleEmailsByKey: Record<string, string[]> = {};
      const roleTitleByKey: Record<string, string> = {};
      (rolesRes?.roles ?? []).forEach((r: any) => {
        const key = normalizeRoleKey(String(r?.key ?? r?.title ?? ""));
        if (!key) return;
        const emails = Array.isArray(r?.emails)
          ? r.emails.map((e: any) => normalizeEmail(e)).filter(Boolean)
          : [];
        roleEmailsByKey[key] = Array.from(new Set(emails));
        roleTitleByKey[key] = String(r?.title ?? r?.key ?? key).trim() || key;
      });
      // у вас обычно одна сцена на проект (script); берём первую по projectId
      const proj = (pull.projects ?? []).find((p: any) => p.slug === slug);
      const scene =
        proj ? (pull.scenes ?? []).find((s: any) => String(s?.id ?? "") === `${proj.id}:script`) : null;
      const sceneId = String(scene?.id ?? "");
      const steps = (Array.isArray((pull as any)?.steps) ? (pull as any).steps : [])
        .filter((st: any) => String(st?.sceneId ?? "") === sceneId)
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
      setDataCache((p) => ({ ...p, [slug]: { steps, roleEmailsByKey, roleTitleByKey } }));
    } catch (e) {
      console.error("loadProjectData failed:", slug, e);
      setDataCache((p) => ({ ...p, [slug]: { steps: [], roleEmailsByKey: {}, roleTitleByKey: {} } }));
    } finally {
      setStepsLoading(false);
    }
  };

  useEffect(() => {
    const first =
      (projectFilter && visibleProjects.includes(projectFilter) ? projectFilter : "") ||
      visibleProjects[0] ||
      "";
    if (first && first !== projectFilter) setProjectFilter(first);
  }, [projectFilter, visibleProjects]);

  useEffect(() => {
    if (!projectFilter) return;
    try {
      localStorage.setItem(projectFilterStorageKey, projectFilter);
    } catch (_) { }
  }, [projectFilter]);

  useEffect(() => {
    if (!projectFilter) return;
    void loadProjectData(projectFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  const filteredSteps = useMemo(() => {
    const src = projectFilter ? (dataCache[projectFilter]?.steps ?? []) : [];
    const base = src.filter((s) => !isReadyStep(s));
    const q = query.trim().toLowerCase();
    if (!q) return base;
    return base.filter((s) => {
      const inTitle = String(s.title ?? "").toLowerCase().includes(q);
      const inText = markdownToPlainText(String(s.playMarkdown ?? s.markdown ?? ""))
        .toLowerCase()
        .includes(q);
      return inTitle || inText;
    });
  }, [projectFilter, query, dataCache]);

  // ----- Free actors & selectable scenes (based on availability + project role assignments) -----
  const [membersLoading, setMembersLoading] = useState(false);
  const [projectMemberEmails, setProjectMemberEmails] = useState<string[]>([]);
  useEffect(() => {
    if (!accessToken || !projectFilter) {
      setProjectMemberEmails([]);
      return;
    }
    let cancelled = false;
    setMembersLoading(true);
    getProjectMembers(accessToken, projectFilter)
      .then((res) => {
        if (cancelled) return;
        const emails = [
          res.owner?.email ? normalizeEmail(res.owner.email) : null,
          ...(res.members ?? []).map((m) => normalizeEmail(m.user?.email)),
        ].filter(Boolean) as string[];
        setProjectMemberEmails(Array.from(new Set(emails)));
      })
      .catch(() => {
        if (!cancelled) setProjectMemberEmails([]);
      })
      .finally(() => {
        if (!cancelled) setMembersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, projectFilter]);

  const [teamProfiles, setTeamProfiles] = useState<TeamProfile[]>([]);
  useEffect(() => {
    if (!accessToken) return;
    if (projectMemberEmails.length === 0) {
      setTeamProfiles([]);
      return;
    }
    let cancelled = false;
    getProfilesBatch(accessToken, projectMemberEmails)
      .then((list) => {
        if (!cancelled) setTeamProfiles(list ?? []);
      })
      .catch(() => {
        if (!cancelled) setTeamProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, projectMemberEmails.join("|")]);

  const freeActorsForDate = useMemo(() => {
    if (!sessionDateKey) return [];
    const data = projectFilter ? dataCache[projectFilter] : null;
    const roleEmailsByKey = data?.roleEmailsByKey ?? {};
    const roleTitleByKey = data?.roleTitleByKey ?? {};
    return (teamProfiles ?? [])
      .map((p) => {
        const email = normalizeEmail(p.email);
        const cal = (p as any)?.availabilityCalendar as Record<string, string> | undefined;
        const st = cal?.[sessionDateKey] === "present" ? "present" : cal?.[sessionDateKey] === "absent" ? "absent" : "unknown";
        const ranges = getRangesForDateMinutes(p, sessionDateKey);
        const rolesNorm: string[] = [];
        const rolesDisplay: string[] = [];
        if (email) {
          for (const [rk, emails] of Object.entries(roleEmailsByKey)) {
            if (!rk) continue;
            if (!Array.isArray(emails) || emails.length === 0) continue;
            if (!emails.includes(email)) continue;
            rolesNorm.push(rk);
            rolesDisplay.push(roleTitleByKey[rk] ?? rk);
          }
        }
        rolesDisplay.sort((a, b) => a.localeCompare(b, "ru"));
        return {
          email,
          displayName: String((p as any)?.displayName ?? "").trim() || null,
          avatarUrl: String((p as any)?.avatarUrl ?? "").trim() || null,
          status: st as "present" | "absent" | "unknown",
          rolesNorm,
          rolesDisplay,
          ranges,
        };
      })
      .filter((x) => x.email);
  }, [dataCache, projectFilter, sessionDateKey, teamProfiles]);

  const troupeScheduleMonth = useMemo(() => {
    if (sessionDateKey) return safeDateFromDateKey(sessionDateKey) ?? new Date();
    return new Date();
  }, [sessionDateKey]);

  const troupeScheduleMonthKey = useMemo(() => {
    const y = troupeScheduleMonth.getFullYear();
    const m = String(troupeScheduleMonth.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [troupeScheduleMonth]);

  const troupeScheduleDays = useMemo(() => {
    const y = troupeScheduleMonth.getFullYear();
    const m = troupeScheduleMonth.getMonth();
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const out: Date[] = [];
    for (let day = 1; day <= daysInMonth; day += 1) {
      out.push(new Date(y, m, day, 12, 0, 0));
    }
    return out;
  }, [troupeScheduleMonth]);

  const troupeScheduleGridTemplateColumns = useMemo(() => {
    return `140px repeat(${troupeScheduleDays.length}, 28px)`;
  }, [troupeScheduleDays.length]);

  const troupeScheduleActors = useMemo(() => {
    const list = (teamProfiles ?? [])
      .map((p) => {
        const email = normalizeEmail(p.email);
        if (!email) return null;
        return {
          email,
          displayName: String((p as any)?.displayName ?? "").trim() || null,
          avatarUrl: String((p as any)?.avatarUrl ?? "").trim() || null,
          availabilityCalendar: ((p as any)?.availabilityCalendar ?? null) as
            | Record<string, "present" | "absent">
            | null,
          availabilityTimeRanges: ((p as any)?.availabilityTimeRanges ?? null) as
            | Record<string, AvailabilityTimeRange[]>
            | null,
        };
      })
      .filter(Boolean) as Array<{
        email: string;
        displayName: string | null;
        avatarUrl: string | null;
        availabilityCalendar: Record<string, "present" | "absent"> | null;
        availabilityTimeRanges: Record<string, AvailabilityTimeRange[]> | null;
      }>;
    list.sort((a, b) =>
      String(a.displayName ?? a.email).localeCompare(String(b.displayName ?? b.email), "ru"),
    );
    return list;
  }, [teamProfiles]);

  const activeSlotWindow = useMemo(() => {
    if (!activeSession || !activeSlotId) return null;
    const sl = (activeSession.slots ?? []).find((s) => s.id === activeSlotId) ?? null;
    if (!sl) return null;
    const base = getSessionStartLocalMinutes(activeSession.startsAt);
    const startMin = base + Math.max(0, Math.floor(sl.offsetMin || 0));
    const endMin = startMin + Math.max(1, Math.floor(sl.durationMin || 1));
    return { startMin, endMin };
  }, [activeSessionId, activeSession?.startsAt, activeSession?.slots, activeSlotId]);

  const freeRolesNormSet = useMemo(() => {
    const set = new Set<string>();
    for (const a of freeActorsForDate) {
      if (a.status !== "present") continue;
      if (activeSlotWindow && a.ranges?.length) {
        if (!isSlotInsideRanges(activeSlotWindow.startMin, activeSlotWindow.endMin, a.ranges)) continue;
      }
      for (const r of a.rolesNorm) set.add(r);
    }
    return set;
  }, [activeSlotWindow, freeActorsForDate]);

  const [onlySelectable, setOnlySelectable] = useState(false);
  const selectableSteps = useMemo(() => {
    const steps = (projectFilter ? (dataCache[projectFilter]?.steps ?? []) : []).filter(
      (s) => !isReadyStep(s),
    );
    const out: Array<{ step: ScriptStep; ok: boolean; missing: string[]; roles: string[] }> = [];
    for (const s of steps) {
      const text = String(s.playMarkdown ?? s.markdown ?? "");
      const roles = extractRolesSmart(text);
      const missing: string[] = [];
      for (const r of roles) {
        const norm = normalizeRoleKey(r);
        if (norm && !freeRolesNormSet.has(norm)) missing.push(r);
      }
      out.push({ step: s, ok: missing.length === 0, missing, roles });
    }
    return out;
  }, [dataCache, freeRolesNormSet, projectFilter]);

  const filteredStepsForList = useMemo(() => {
    const base = filteredSteps;
    if (!onlySelectable) return base;
    const okIds = new Set(selectableSteps.filter((x) => x.ok).map((x) => x.step.id));
    return base.filter((s) => okIds.has(s.id));
  }, [filteredSteps, onlySelectable, selectableSteps]);

  const attachToSlot = async (slotId: string, ref: { projectSlug: string; stepId: number }) => {
    if (!activeSession) return;
    const nextSlots = (activeSession.slots ?? []).map((sl) =>
      sl.id === slotId ? { ...sl, ref } : sl
    );
    await updateActiveSession({ slots: nextSlots });
  };

  const attachStepToSlotByDrop = async (slotId: string, payload: DragStepRefPayload) => {
    if (!activeSession) return;
    const slots = [...(activeSession.slots ?? [])];
    const current = slots.find((s) => s.id === slotId) ?? null;
    if (!current) return;
    const nextDur = guessDurationMin(payload);
    const prevDur = Math.max(1, Math.floor(Number(current.durationMin) || 1));
    const delta = nextDur - prevDur;
    await updateSlot(
      slotId,
      {
        ref: { projectSlug: payload.projectSlug, stepId: payload.stepId },
        durationMin: nextDur,
      },
      { shiftFollowing: autoShiftFollowing, deltaMin: delta },
    );
    setActiveSlotId(slotId);
    setSlotDraft((p) => ({
      ...p,
      [slotId]: {
        ...(p[slotId] ?? {
          time: activeSession ? formatSlotTime(activeSession.startsAt, current.offsetMin) : "",
          duration: "",
        }),
        duration: String(nextDur),
      },
    }));
  };

  const addSlotFromDroppedStep = async (payload: DragStepRefPayload) => {
    if (!activeSession) return;
    const sorted = [...(activeSession.slots ?? [])].sort((a, b) => a.offsetMin - b.offsetMin);
    const last = sorted.slice(-1)[0] ?? null;
    const offsetMin = last ? last.offsetMin + Math.max(1, Math.floor(Number(last.durationMin) || 1)) : 0;
    const durationMin = guessDurationMin(payload);
    const slot: DirectorSessionSlot = {
      id: createId(),
      offsetMin,
      durationMin,
      ref: { projectSlug: payload.projectSlug, stepId: payload.stepId },
    };
    await updateActiveSession({ slots: [...(activeSession.slots ?? []), slot] });
    setActiveSlotId(slot.id);
  };

  // Materials popover (step preview + assign)
  const [materialPreview, setMaterialPreview] = useState<{
    projectSlug: string;
    step: ScriptStep;
  } | null>(null);

  // Drag & drop ordering for slots (re-packs timeline sequentially)
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const moveSlotBefore = async (dragId: string, beforeId: string) => {
    if (!activeSession) return;
    if (dragId === beforeId) return;
    const sorted = [...(activeSession.slots ?? [])].sort((a, b) => a.offsetMin - b.offsetMin);
    const fromIndex = sorted.findIndex((s) => s.id === dragId);
    const toIndex = sorted.findIndex((s) => s.id === beforeId);
    if (fromIndex === -1 || toIndex === -1) return;
    const next = [...sorted];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    // Важно: после d&d сохраняем порядок, а не пересортировываем по старым offsetMin.
    await updateActiveSession({ slots: packSlotsSequentialInOrder(next) });
  };

  // Подгружаем данные проектов, которые уже используются в слотах (чтобы показывать названия/аналитику)
  useEffect(() => {
    if (!activeSession) return;
    const slugs = Array.from(
      new Set(
        (activeSession.slots ?? [])
          .map((s) => s.ref?.projectSlug)
          .filter(Boolean) as string[],
      ),
    );
    slugs.forEach((slug) => {
      if (!dataCache[slug]) void loadProjectData(slug);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSessionId, activeSession?.slots?.length]);

  const slotById = useMemo(() => {
    const map = new Map<string, DirectorSessionSlot>();
    (activeSession?.slots ?? []).forEach((s) => map.set(s.id, s));
    return map;
  }, [activeSession?.slots]);

  const activeSlot = activeSlotId ? slotById.get(activeSlotId) ?? null : null;
  const [autoShiftFollowing, setAutoShiftFollowing] = useState(true);

  const slotInsights = useMemo(() => {
    if (!activeSession) return [];
    return [...(activeSession.slots ?? [])]
      .sort((a, b) => a.offsetMin - b.offsetMin)
      .map((sl) => {
        const ref = sl.ref;
        if (!ref) {
          return {
            slotId: sl.id,
            time: formatSlotTime(activeSession.startsAt, sl.offsetMin),
            title: "Материал не выбран",
            ready: false,
            missingRoles: [] as string[],
            actors: [] as string[],
          };
        }
        const data = dataCache[ref.projectSlug];
        const step = data?.steps?.find((x) => x.id === ref.stepId) ?? null;
        const roles = extractRolesSmart(String(step?.playMarkdown ?? step?.markdown ?? ""));
        const missingRoles = roles.filter((r) => {
          const key = normalizeRoleKey(r);
          return !key || !((data?.roleEmailsByKey ?? {})[key]?.length);
        });
        const actors = roles.flatMap((r) => {
          const key = normalizeRoleKey(r);
          return key ? (data?.roleEmailsByKey ?? {})[key] ?? [] : [];
        });
        return {
          slotId: sl.id,
          time: formatSlotTime(activeSession.startsAt, sl.offsetMin),
          title: `${ref.projectSlug} · #${ref.stepId} ${step?.title ?? ""}`.trim(),
          ready: roles.length === 0 ? true : missingRoles.length === 0,
          missingRoles,
          actors: Array.from(new Set(actors.map((x) => String(x ?? "").trim()).filter(Boolean))),
        };
      });
  }, [activeSession, dataCache]);

  const actorsSummary = useMemo(() => {
    const map = new Map<string, { actor: string; slots: number }>();
    for (const s of slotInsights) {
      for (const a of s.actors) {
        const key = String(a ?? "").trim();
        if (!key) continue;
        map.set(key, { actor: key, slots: (map.get(key)?.slots ?? 0) + 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.slots - a.slots || a.actor.localeCompare(b.actor, "ru"));
  }, [slotInsights]);

  const actorEmails = useMemo(
    () => actorsSummary.map((x) => x.actor).filter(looksLikeEmail).map(normalizeEmail),
    [actorsSummary],
  );

  const [profilesByEmail, setProfilesByEmail] = useState<Map<string, TeamProfile>>(new Map());
  useEffect(() => {
    if (!accessToken) return;
    if (!sessionDateKey) return;
    const uniq = Array.from(new Set(actorEmails)).filter(Boolean);
    if (uniq.length === 0) {
      setProfilesByEmail(new Map());
      return;
    }
    let cancelled = false;
    getProfilesBatch(accessToken, uniq)
      .then((list) => {
        if (cancelled) return;
        const map = new Map<string, TeamProfile>();
        (list ?? []).forEach((p) => {
          const e = normalizeEmail((p as any)?.email);
          if (e) map.set(e, p);
        });
        setProfilesByEmail(map);
      })
      .catch(() => {
        if (!cancelled) setProfilesByEmail(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, actorEmails.join("|"), sessionDateKey]);

  const slotAvailabilityById = useMemo(() => {
    if (!activeSession || !sessionDateKey) return new Map<string, { free: string[]; busy: string[]; unknown: string[] }>();
    const base = getSessionStartLocalMinutes(activeSession.startsAt);
    const slotActorsById = new Map<string, string[]>();
    for (const s of slotInsights) slotActorsById.set(s.slotId, s.actors ?? []);

    const out = new Map<string, { free: string[]; busy: string[]; unknown: string[] }>();
    for (const sl of activeSession.slots ?? []) {
      const actors = slotActorsById.get(sl.id) ?? [];
      if (actors.length === 0) continue;

      const startMin = base + Math.max(0, Math.floor(sl.offsetMin || 0));
      const endMin = startMin + Math.max(1, Math.floor(sl.durationMin || 1));

      const free: string[] = [];
      const busy: string[] = [];
      const unknown: string[] = [];

      for (const actorRaw of actors) {
        const actor = normalizeEmail(actorRaw);
        if (!actor) continue;
        const prof = profilesByEmail.get(actor);
        if (!prof) {
          unknown.push(actorRaw);
          continue;
        }
        const cal = (prof as any)?.availabilityCalendar as Record<string, string> | undefined;
        const st = cal?.[sessionDateKey] === "present" ? "present" : cal?.[sessionDateKey] === "absent" ? "absent" : "unknown";
        if (st === "absent") {
          busy.push(actorRaw);
          continue;
        }
        const ranges = getRangesForDateMinutes(prof, sessionDateKey);
        if (ranges.length > 0) {
          if (isSlotInsideRanges(startMin, endMin, ranges)) free.push(actorRaw);
          else busy.push(actorRaw);
          continue;
        }
        if (st === "present") free.push(actorRaw);
        else unknown.push(actorRaw);
      }

      out.set(sl.id, { free, busy, unknown });
    }
    return out;
  }, [activeSessionId, activeSession?.startsAt, activeSession?.slots, profilesByEmail, sessionDateKey, slotInsights]);

  // Drafts for slot editing (time/duration)
  const [slotDraft, setSlotDraft] = useState<Record<string, { time: string; duration: string }>>({});
  useEffect(() => {
    if (!activeSession) {
      setSlotDraft({});
      return;
    }
    setSlotDraft((prev) => {
      const next = { ...prev };
      for (const sl of activeSession.slots ?? []) {
        if (!next[sl.id]) {
          next[sl.id] = {
            time: formatSlotTime(activeSession.startsAt, sl.offsetMin),
            duration: String(sl.durationMin ?? 30),
          };
        }
      }
      // cleanup removed slots
      Object.keys(next).forEach((id) => {
        if (!(activeSession.slots ?? []).some((s) => s.id === id)) delete next[id];
      });
      return next;
    });
  }, [activeSessionId, activeSession?.slots?.length, activeSession?.startsAt]);

  const commitSlotDraft = async (slotId: string) => {
    if (!activeSession) return;
    const d = slotDraft[slotId];
    const sl = (activeSession.slots ?? []).find((s) => s.id === slotId);
    if (!d || !sl) return;
    const base = getSessionStartLocalMinutes(activeSession.startsAt);
    const abs = parseTimeHHMM(d.time);
    const durNum = Math.max(1, Math.min(480, Math.floor(Number(d.duration))));
    const nextOffset = abs == null ? sl.offsetMin : Math.max(0, Math.floor(abs - base));
    const prevDur = Math.max(1, Math.floor(sl.durationMin || 1));
    const delta = durNum - prevDur;
    await updateSlot(
      slotId,
      { offsetMin: nextOffset, durationMin: durNum },
      { shiftFollowing: autoShiftFollowing, deltaMin: delta }
    );
  };

  if (!accessToken) return <div className="rehearsals-muted">Нужно войти.</div>;
  if (loading) return <div className="rehearsals-muted">Загрузка сессий…</div>;
  if (error) return <div className="rehearsals-error">{error}</div>;

  const sessionsCount = sessions?.length ?? 0;
  const activeIndex = (sessions ?? []).findIndex((s) => s.id === activeSessionId);

  return (
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className="rehearsals-page sessions-page">
            <div className="rehearsals-head">
              <div className="rehearsals-meta">Сборные репетиции</div>
            </div>

            <div className="sessions-layout">
              <aside className="sessions-side">
                <div className="rehearsals-card">

                  <div className="sessions-actions">
                    <button type="button" onClick={createSession}>
                      + Репетиция
                    </button>
                    <button
                      type="button"
                      onClick={() => activeSessionId && void moveSessionDelta(activeSessionId, -1)}
                      disabled={activeIndex <= 0}
                      title="Переместить выбранную сессию вверх"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => activeSessionId && void moveSessionDelta(activeSessionId, 1)}
                      disabled={activeIndex < 0 || activeIndex === sessionsCount - 1}
                      title="Переместить выбранную сессию вниз"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => activeSessionId && void deleteSession(activeSessionId)}
                      disabled={activeIndex < 0}
                      title="Удалить выбранную сессию"
                    >
                      ×
                    </button>
                  </div>
                  <div className="sessions-list">
                    {(sessions ?? []).map((s, index) => (
                      <div
                        key={s.id}
                        className={`sessions-sessionRow ${s.id === activeSessionId ? "active" : ""}`}
                        onClick={() => setActiveSessionId(s.id)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragId = e.dataTransfer.getData("text/plain") || draggedSessionId;
                          if (!dragId) return;
                          void moveSessionBefore(dragId, s.id);
                        }}
                      >
                        <div className="sessions-sessionRow-content">
                          <button
                            type="button"
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("text/plain", s.id);
                              e.dataTransfer.effectAllowed = "move";
                              setDraggedSessionId(s.id);
                            }}
                            onDragEnd={() => setDraggedSessionId(null)}
                            className={`sessions-sessionSelect rehearsals-item ${s.id === activeSessionId ? "active" : ""} ${draggedSessionId === s.id ? "dragging" : ""}`}
                            title="Перетащи для изменения порядка"
                          >
                            <div className="rehearsals-item-title">{s.title}</div>
                            <div className="rehearsals-item-meta">
                              {new Date(s.startsAt).toLocaleString()} · слотов: {s.slots?.length ?? 0}
                            </div>
                          </button>
                          <Link
                            to={`/sessions/${encodeURIComponent(s.id)}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Открыть страницу сессии"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 34,
                              height: 34,
                              borderRadius: 10,
                              background: "rgba(255,255,255,0.04)",
                              color: "inherit",
                              textDecoration: "none",
                              opacity: 0.9,
                            }}
                          >
                            ↗
                          </Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </aside>

              <div className="sessions-main">
                {!activeSession ? (
                  <div className="rehearsals-muted">Выбери или создай сессию.</div>
                ) : (
                  <div className="sessions-panels">
                    <div className="rehearsals-card">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>Открыть:</div>
                        <Link
                          to={`/sessions/${encodeURIComponent(activeSession.id)}`}
                          style={{ fontSize: 12, textDecoration: "none", color: "inherit", opacity: 0.9 }}
                        >
                          /sessions/{activeSession.id}
                        </Link>
                      </div>

                      <label className="sessions-field">

                        <input
                          value={activeSession.title}
                          onChange={(e) => void updateActiveSession({ title: e.target.value })}
                        />
                      </label>
                      <label className="sessions-field">
                        <span className="rehearsals-muted comments-for-bot">
                          Комментарий к сессии (будет прикреплён к сообщению бота)
                        </span>
                        <textarea
                          rows={3}
                          value={String(activeSession.comment ?? "")}
                          onChange={(e) => void updateActiveSession({ comment: e.target.value })}
                          placeholder="Например: сбор к 19:50, разогрев 10 минут, начинаем ровно в 20:00."
                          style={{ resize: "vertical" }}
                        />
                      </label>
                      <div className="sessions-row">
                        <label className="sessions-field">
                          <span className="rehearsals-muted">Дата</span>
                          <input
                            type="date"
                            value={getLocalDateTimeParts(activeSession.startsAt).date}
                            onChange={(e) => {
                              const { time } = getLocalDateTimeParts(activeSession.startsAt);
                              const next = `${e.target.value}T${time || "20:00"}:00`;
                              const d = new Date(next);
                              if (Number.isFinite(d.getTime()))
                                void updateActiveSession({ startsAt: d.toISOString() });
                            }}
                          />
                        </label>
                        <label className="sessions-field">
                          <span className="rehearsals-muted">Старт</span>
                          <input
                            type="time"
                            value={getLocalDateTimeParts(activeSession.startsAt).time}
                            onChange={(e) => {
                              const { date } = getLocalDateTimeParts(activeSession.startsAt);
                              const next = `${date || toDateKey(new Date())}T${e.target.value}:00`;
                              const d = new Date(next);
                              if (Number.isFinite(d.getTime()))
                                void updateActiveSession({ startsAt: d.toISOString() });
                            }}
                          />
                        </label>
                      </div>

                      <div className="sessions-actions">
                        <button type="button" onClick={addSlot}>
                          + Слот
                        </button>
                        <button type="button" onClick={packTimeline}>
                          Выстроить подряд
                        </button>
                        <button
                          type="button"
                          onClick={() => void publishActiveSession()}
                          disabled={publishing}
                          title="Отправить подтверждение явки в Telegram"
                        >
                          {publishing ? "Публикую…" : "Опубликовать в чат"}
                        </button>
                        <label className="sessions-check">
                          <input
                            type="checkbox"
                            checked={autoShiftFollowing}
                            onChange={(e) => setAutoShiftFollowing(e.target.checked)}
                          />
                          <span className="rehearsals-muted">
                            сдвигать последующие при изменении длительности
                          </span>
                        </label>
                      </div>
                      {publishError && (
                        <div className="rehearsals-error">{publishError}</div>
                      )}


                      <div
                        className={`sessions-slots ${timelineDragOver ? "dropActive" : ""}`}
                        onDragEnter={(e) => {
                          // Only highlight for step payload, not slot reordering.
                          if (parseDragStepRef(e.dataTransfer)) setTimelineDragOver(true);
                        }}
                        onDragLeave={() => setTimelineDragOver(false)}
                        onDragOver={(e) => {
                          if (!parseDragStepRef(e.dataTransfer)) return;
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "copy";
                        }}
                        onDrop={(e) => {
                          const payload = parseDragStepRef(e.dataTransfer);
                          setTimelineDragOver(false);
                          if (!payload) return;
                          e.preventDefault();
                          void addSlotFromDroppedStep(payload);
                        }}
                        title="Сюда можно перетащить сцену, чтобы создать новый слот"
                      >
                        {[...(activeSession.slots ?? [])]
                          .sort((a, b) => a.offsetMin - b.offsetMin)
                          .map((sl) => (
                            <div
                              key={sl.id}
                              onClick={() => setActiveSlotId(sl.id)}
                              draggable
                              onDragStart={(e) => {
                                e.dataTransfer.setData("text/plain", sl.id);
                                e.dataTransfer.setData(DND_MIME_SLOT_ID, sl.id);
                                e.dataTransfer.effectAllowed = "move";
                                setDraggedSlotId(sl.id);
                              }}
                              onDragEnd={() => setDraggedSlotId(null)}
                              onDragOver={(e) => e.preventDefault()}
                              onDrop={(e) => {
                                e.preventDefault();
                                const payload = parseDragStepRef(e.dataTransfer);
                                if (payload) {
                                  e.stopPropagation();
                                  void attachStepToSlotByDrop(sl.id, payload);
                                  return;
                                }
                                const dragId = parseDragSlotId(e.dataTransfer) || draggedSlotId;
                                if (!dragId) return;
                                void moveSlotBefore(dragId, sl.id);
                              }}
                              className={`sessions-slot rehearsals-item ${sl.id === activeSlotId ? "active" : ""} ${draggedSlotId === sl.id ? "dragging" : ""}`}
                              title="Перетащи для изменения порядка"
                            >
                              <div className="sessions-slot-head">
                                <div className="sessions-slot-title">
                                  {formatSlotTime(activeSession.startsAt, sl.offsetMin)} ·{" "}
                                  {sl.durationMin} мин
                                </div>
                                <div className="sessions-slot-actions">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void insertSlotAfter(sl.id);
                                    }}
                                    title="Вставить новый слот после"
                                  >
                                    + после
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void removeSlot(sl.id);
                                    }}
                                  >
                                    Удалить
                                  </button>
                                </div>
                              </div>

                              {sl.id === activeSlotId && (
                                <div className="sessions-slot-controls">
                                  <label className="sessions-field">
                                    <span className="rehearsals-muted">Время</span>
                                    <input
                                      type="time"
                                      value={
                                        slotDraft[sl.id]?.time ??
                                        formatSlotTime(activeSession.startsAt, sl.offsetMin)
                                      }
                                      onChange={(e) =>
                                        setSlotDraft((p) => ({
                                          ...p,
                                          [sl.id]: {
                                            ...(p[sl.id] ?? { time: "", duration: "" }),
                                            time: e.target.value,
                                          },
                                        }))
                                      }
                                      onBlur={() => void commitSlotDraft(sl.id)}
                                    />
                                  </label>
                                  <label className="sessions-field">
                                    <span className="rehearsals-muted">Длительность</span>
                                    <input
                                      type="number"
                                      min={1}
                                      max={480}
                                      value={slotDraft[sl.id]?.duration ?? String(sl.durationMin ?? 30)}
                                      onChange={(e) =>
                                        setSlotDraft((p) => ({
                                          ...p,
                                          [sl.id]: {
                                            ...(p[sl.id] ?? { time: "", duration: "" }),
                                            duration: e.target.value,
                                          },
                                        }))
                                      }
                                      onBlur={() => void commitSlotDraft(sl.id)}
                                    />
                                  </label>
                                </div>
                              )}

                              <div className="sessions-slot-meta">
                                {slotInsights.find((x) => x.slotId === sl.id)?.title ??
                                  (sl.ref
                                    ? `${sl.ref.projectSlug} · шаг #${sl.ref.stepId}`
                                    : "Материал не выбран")}
                              </div>
                              {(() => {
                                const av = slotAvailabilityById.get(sl.id);
                                if (!av) return null;
                                const total = av.free.length + av.busy.length + av.unknown.length;
                                if (total === 0) return null;
                                return (
                                  <div className="rehearsals-muted" style={{ marginTop: 4 }}>
                                    по доступности: свободны <b>{av.free.length}</b> / {total}
                                    {av.unknown.length ? <> · не отмечено: <b>{av.unknown.length}</b></> : null}
                                    {av.busy.length ? <> · заняты: <b>{av.busy.length}</b></> : null}
                                  </div>
                                );
                              })()}
                              {(() => {
                                const info = slotInsights.find((x) => x.slotId === sl.id);
                                if (!info || !sl.ref) return null;
                                if (info.ready) {
                                  return (
                                    <div className="rehearsals-muted sessions-slot-ok">
                                      Собирается
                                    </div>
                                  );
                                }
                                if (info.missingRoles.length) {
                                  return (
                                    <div className="rehearsals-error sessions-slot-bad">
                                      Не собирается: нет назначений для{" "}
                                      {info.missingRoles.slice(0, 4).join(", ")}
                                      {info.missingRoles.length > 4
                                        ? ` +${info.missingRoles.length - 4}`
                                        : ""}
                                    </div>
                                  );
                                }
                                return null;
                              })()}
                            </div>
                          ))}
                      </div>
                    </div>

                    <div className="rehearsals-card">
                      <div className="rehearsals-card-title">Материалы</div>
                      <div className="rehearsals-muted sessions-help">
                        Выбранный слот:{" "}
                        <b>
                          {activeSlot
                            ? `${formatSlotTime(activeSession.startsAt, activeSlot.offsetMin)} (+${activeSlot.durationMin} мин)`
                            : "не выбран"}
                        </b>
                      </div>

                      {activeSlot?.ref && (
                        <div className="sessions-preview">
                          <div className="sessions-preview-title">
                            Превью: {activeSlot.ref.projectSlug} · шаг #{activeSlot.ref.stepId}
                          </div>
                          {(() => {
                            const data = dataCache[activeSlot.ref!.projectSlug];
                            const step =
                              data?.steps?.find((x) => x.id === activeSlot.ref!.stepId) ?? null;
                            const text = String(step?.playMarkdown ?? step?.markdown ?? "").trim();
                            const previewText = markdownToPlainText(text);
                            const roles = extractRolesSmart(text);
                            const missing = roles.filter((r) => {
                              const key = normalizeRoleKey(r);
                              return !key || !((data?.roleEmailsByKey ?? {})[key]?.length);
                            });
                            return (
                              <>
                                <div className="rehearsals-muted sessions-preview-sub">
                                  {step?.title ? step.title : "—"}
                                </div>
                                {roles.length > 0 && (
                                  <div className="rehearsals-muted sessions-preview-sub">
                                    роли: {roles.slice(0, 10).join(", ")}
                                    {roles.length > 10 ? ` +${roles.length - 10}` : ""}
                                  </div>
                                )}
                                {missing.length > 0 && (
                                  <div className="rehearsals-error sessions-preview-bad">
                                    нет назначений для: {missing.slice(0, 6).join(", ")}
                                    {missing.length > 6 ? ` +${missing.length - 6}` : ""}
                                  </div>
                                )}
                                {text && (
                                  <pre className="sessions-preview-text">
                                    {previewText.slice(0, 1200)}
                                    {previewText.length > 1200 ? "\n\n… (обрезано)" : ""}
                                  </pre>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      <div className="sessions-row sessions-material-controls">
                        <select
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
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="поиск по названию/тексту"
                        />
                      </div>
                      <div className="sessions-material-subtools">
                        <label className="sessions-check">
                          <input
                            type="checkbox"
                            checked={onlySelectable}
                            onChange={(e) => setOnlySelectable(e.target.checked)}
                          />
                          <span className="rehearsals-muted">
                            только сцены, которые можно выбрать (по ролям свободных актёров)
                          </span>
                        </label>
                        {membersLoading && (
                          <span className="rehearsals-muted">загружаю участников…</span>
                        )}
                      </div>

                      {stepsLoading && (
                        <div className="rehearsals-muted sessions-help">Загружаю шаги…</div>
                      )}

                      <div className="sessions-material-list">
                        {filteredStepsForList.slice(0, 200).map((s) => (
                          <ListItem>
                            <button
                              key={`${projectFilter}:${s.id}`}
                              type="button"
                              draggable
                              onDragStart={(e) => {
                                const payload: DragStepRefPayload = {
                                  kind: "stepRef",
                                  projectSlug: projectFilter,
                                  stepId: s.id,
                                  durationMin:
                                    s.durationMin == null
                                      ? undefined
                                      : Math.max(1, Math.floor(Number(s.durationMin) || 1)),
                                };
                                e.dataTransfer.setData(DND_MIME_STEP_REF, JSON.stringify(payload));
                                e.dataTransfer.effectAllowed = "copy";
                              }}
                              onClick={() => {
                                setMaterialPreview({ projectSlug: projectFilter, step: s });
                              }}
                              className="rehearsals-item"
                              title="Открыть текст и выбрать (или перетащи в слот)"
                            >
                              <div className="rehearsals-item-title">
                                #{s.id} {s.title}
                              </div>
                            </button>
                          </ListItem>
                        ))}
                        {filteredStepsForList.length === 0 && (
                          <div className="rehearsals-muted">Ничего не найдено.</div>
                        )}
                      </div>

                      {materialPreview && (
                        <div
                          className="sessions-modal-backdrop"
                          role="presentation"
                          onClick={() => setMaterialPreview(null)}
                        >
                          <div
                            className="sessions-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Материал"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="sessions-modal-head">
                              <div>
                                <div className="sessions-modal-title">
                                  {materialPreview.projectSlug} · #{materialPreview.step.id}{" "}
                                  {materialPreview.step.title}
                                </div>
                                <div className="rehearsals-muted">
                                  кликни “Назначить”, чтобы положить в выбранный слот
                                </div>
                              </div>
                              <button type="button" onClick={() => setMaterialPreview(null)}>
                                ×
                              </button>
                            </div>
                            <div className="sessions-modal-actions">
                              <button
                                type="button"
                                disabled={!activeSlotId}
                                onClick={() => {
                                  if (!activeSlotId) return;
                                  void attachToSlot(activeSlotId, {
                                    projectSlug: materialPreview.projectSlug,
                                    stepId: materialPreview.step.id,
                                  });
                                  setMaterialPreview(null);
                                }}
                              >
                                Назначить в выбранный слот
                              </button>
                              {!activeSlotId && (
                                <div className="rehearsals-muted">
                                  Сначала выбери слот слева
                                </div>
                              )}
                            </div>
                            <pre className="sessions-modal-text">
                              {markdownToPlainText(
                                String(
                                  materialPreview.step.playMarkdown ??
                                  materialPreview.step.markdown ??
                                  "",
                                ),
                              )}
                            </pre>
                          </div>
                        </div>
                      )}

                      <div className="rehearsals-section">
                        <div className="rehearsals-section-title">
                          График актёров на {sessionDateKey ?? "—"}
                        </div>
                        {!sessionDateKey ? (
                          <div className="rehearsals-muted">Сначала выбери дату сессии.</div>
                        ) : (
                          <>
                            <div className="rehearsals-muted" style={{ marginTop: 6 }}>
                              Месяц: <b>{troupeScheduleMonthKey}</b> · выбранный день подсвечен
                            </div>
                            <div className="troupe-legend" style={{ marginTop: 8 }}>
                              <span className="troupe-legend-item">
                                <span className="troupe-dot free" /> свободен
                              </span>
                              <span className="troupe-legend-item">
                                <span className="troupe-dot partial" /> свободен (время)
                              </span>
                              <span className="troupe-legend-item">
                                <span className="troupe-dot busy" /> занят
                              </span>
                              <span className="troupe-legend-item">
                                <span className="troupe-dot unknown" /> не отмечено
                              </span>
                            </div>

                            <div
                              className="troupe-schedule"
                              role="region"
                              aria-label="График занятости актёров"
                            >
                              <div
                                className="troupe-grid"
                                style={{
                                  gridTemplateColumns: troupeScheduleGridTemplateColumns,
                                  minWidth: 240 + troupeScheduleDays.length * 28,
                                }}
                              >
                                <div className="troupe-cell troupe-sticky troupe-header-cell">
                                  Актёр
                                </div>
                                {troupeScheduleDays.map((d) => {
                                  const dayKey = toDateKey(d);
                                  const isFocus = dayKey === sessionDateKey;
                                  const n = d.toLocaleDateString("ru-RU", { day: "numeric" });
                                  const wd = d.toLocaleDateString("ru-RU", { weekday: "short" });
                                  return (
                                    <div
                                      key={dayKey}
                                      className={`troupe-cell troupe-header-cell ${isFocus ? "focus" : ""}`}
                                      title={dayKey}
                                    >
                                      <div style={{ fontSize: 12, fontWeight: 700, lineHeight: "14px" }}>
                                        {n}
                                      </div>
                                      <div style={{ fontSize: 10, opacity: 0.7, lineHeight: "12px" }}>
                                        {wd}
                                      </div>
                                    </div>
                                  );
                                })}

                                {troupeScheduleActors.length === 0 ? (
                                  <div
                                    className="troupe-cell troupe-empty"
                                    style={{ gridColumn: `1 / span ${troupeScheduleDays.length + 1}` }}
                                  >
                                    Нет данных по участникам проекта (или нет профилей).
                                  </div>
                                ) : (
                                  troupeScheduleActors.slice(0, 200).map((a) => {
                                    const label = a.displayName ? `${a.displayName} (${a.email})` : a.email;
                                    return (
                                      <React.Fragment key={a.email}>
                                        <div className="troupe-cell troupe-sticky troupe-actor-cell" title={label}>
                                          <div style={{ minWidth: 0, display: "flex", gap: 10, alignItems: "center" }}>
                                            <MiniAvatar
                                              src={String(a.avatarUrl ?? "").trim() || null}
                                              label={label}
                                              size={22}
                                            />
                                            <div style={{ display: "flex", flexDirection: "column", gap: 2, justifyContent: "center", minWidth: 0 }}>
                                              <div className="troupe-actor-name" title={label}>
                                                {a.displayName ? a.displayName : a.email}
                                              </div>
                                              <div className="troupe-actor-email" title={a.email}>
                                                {a.email}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                        {troupeScheduleDays.map((d) => {
                                          const dayKey = toDateKey(d);
                                          const cal = a.availabilityCalendar ?? {};
                                          const ranges = (a.availabilityTimeRanges ?? {})[dayKey] ?? [];
                                          const st =
                                            cal?.[dayKey] === "present"
                                              ? "present"
                                              : cal?.[dayKey] === "absent"
                                                ? "absent"
                                                : "unknown";
                                          const cls =
                                            st === "absent"
                                              ? "busy"
                                              : ranges.length > 0
                                                ? "partial"
                                                : st === "present"
                                                  ? "free"
                                                  : "unknown";
                                          const tooltip =
                                            st === "absent"
                                              ? "Занят"
                                              : ranges.length > 0
                                                ? `Свободен: ${ranges.map((r) => `${r.from}–${r.to}`).join(", ")}`
                                                : st === "present"
                                                  ? "Свободен"
                                                  : "Не отмечено";
                                          const isFocus = dayKey === sessionDateKey;
                                          return (
                                            <div
                                              key={`${a.email}:${dayKey}`}
                                              className={`troupe-cell troupe-day-cell ${cls} ${isFocus ? "focus" : ""}`}
                                              title={`${dayKey} • ${tooltip}`}
                                            />
                                          );
                                        })}
                                      </React.Fragment>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                          </>
                        )}
                      </div>




                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

