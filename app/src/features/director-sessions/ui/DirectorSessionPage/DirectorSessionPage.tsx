import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { FormTextarea } from "@shared/core/form-textarea/FormTextarea";
import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import { MiniAvatar } from "@shared/components/mini-avatar/MiniAvatar";
import cn from "classnames";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../../auth";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../../directorSessionsSync";
import {
  useDirectorSessionsBundleQuery,
  useLazyProjectMaterialQuery,
  useReplaceDirectorSessionsMutation,
} from "../../api/director-sessions-api";
import { projectMaterialToDirectorSessionCache } from "../../model/build-project-data-cache";
import { useProfilesBatchQuery } from "../../../profile/api/profile-api";
import { projectApi, useProjectMembersQuery, useProjectRolesQuery } from "../../../project/api/project-api";
import { useAppDispatch } from "../../../../shared/store/hooks";
import { useProject } from "../../../project";
import { RehearsalsCard } from "../../../rehearsals-card/RehearsalsCard";
import type { ScriptScene } from "../../../../shared/types/script";
import { markdownToPlainText } from "../../../../shared/utils/textPreview";
import type { TeamProfile } from "../../../../sync/api/profile";
import { profileListAvatarSrc } from "../../../../sync/api/profile";
import { RehearsalPlanSectionChrome } from "../../../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import "../director-sessions.css";
import "./style.css";
import {
  classifyActorSlotAvailability,
  directorSlotRefKey,
  formatSlotTime,
  getSessionStartLocalMinutes,
  findBusyConflictForChangedSessions,
  formatDirectorSessionBusyConflictMessage,
  isReadyScene,
  isSlotScenePickerCustomSlug,
  looksLikeEmail,
  memberEmailsFromProjectMembers,
  normalizeEmail,
  roleMapsFromProjectRoles,
  SLOT_SCENE_PICKER_CUSTOM_SLUG,
  toDateKey,
} from "../../model/session-page-utils";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getEmailsPlannedForDirectorSlot,
  getNormalizedRoleKeysForSlotScene,
  getRolePlannedEmailsForDirectorSlot,
  type DirectorSlotPlannedData,
} from "../../model/session-slot-planned";
import type { DirectorSessionProjectDataCache } from "../../model/session-page-types";
import { DirectorSessionSlotsPanel } from "../DirectorSessionSlotsPanel";
import { SlotParticipantsPickerModal } from "../SlotParticipantsPickerModal";
import { SlotScenePickerModal } from "../SlotScenePickerModal";
import { SlotRoleRehearsalPicker } from "../SlotRoleRehearsalPicker";
import { TroupeSchedulePreview } from "../TroupeSchedulePreview";
import { projectSessionPath, theaterRehearsalsPath, theaterRehearsalSessionPath } from "../../../../app/router/paths";
import { fetchTheaterRehearsals } from "../../../../sync/api/workspaces";
import { useTheaterHomeTroupeQuery } from "../../../troupe/api/troupe-api";
import type { TroupeMemberItem } from "../../../../sync/api/troupe";

dayjs.locale("ru");

function getTroupeMemberLabel(member: TroupeMemberItem) {
  const profileName =
    String(member.profile?.displayName ?? "").trim() ||
    [member.profile?.firstName, member.profile?.lastName]
      .map((part) => String(part ?? "").trim())
      .filter(Boolean)
      .join(" ");
  return profileName || member.email;
}

export function DirectorSessionPage() {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projectName, projects, projectItems } = useProject();
  const navigate = useNavigate();

  const { sessionId, slotId, theaterId: theaterIdParam } = useParams();
  const sid = String(sessionId ?? "").trim();
  const slId =
    slotId != null && String(slotId).trim() !== "" ? String(slotId).trim() : "";
  const theaterId = String(theaterIdParam ?? "").trim();
  const isTheaterContext = Boolean(theaterId);

  const sessionHref = (nextSlotId?: string) =>
    isTheaterContext
      ? theaterRehearsalSessionPath(theaterId, sid, nextSlotId)
      : projectSessionPath(projectName, sid, nextSlotId);

  const sessionsListHref = isTheaterContext
    ? theaterRehearsalsPath(theaterId)
    : `${projectSessionPath(projectName)}?sessionId=${encodeURIComponent(sid)}`;

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const [session, setSession] = useState<DirectorRehearsalSession | null>(null);
  const [slot, setSlot] = useState<DirectorSessionSlot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyConflictError, setBusyConflictError] = useState<string | null>(
    null,
  );
  const [participantsModalOpen, setParticipantsModalOpen] = useState(false);
  const [sceneModalOpen, setSceneModalOpen] = useState(false);

  const {
    data: sessionsBundle,
    isLoading: bundleLoading,
    error: bundleQueryError,
    refetch: refetchSessionsBundle,
  } = useDirectorSessionsBundleQuery(undefined, {
    skip: !accessToken || !sid,
  });
  const [replaceSessions] = useReplaceDirectorSessionsMutation();
  const [fetchProjectMaterial] = useLazyProjectMaterialQuery();
  const { data: theaterTroupe } = useTheaterHomeTroupeQuery(
    { theaterId },
    { skip: !accessToken || !isTheaterContext },
  );

  const [dataCache, setDataCache] = useState<DirectorSessionProjectDataCache>({});
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);
  /** Роли по slug проекта — для расчёта тонов всех слотов (разные проекты в одной сессии). */
  const [roleEmailsByProjectSlug, setRoleEmailsByProjectSlug] = useState<
    Record<string, Record<string, string[]>>
  >({});
  const [theaterProjects, setTheaterProjects] = useState<
    Array<{ slug: string; name: string }> | null
  >(null);

  useEffect(() => {
    if (!isTheaterContext || !accessToken || !theaterId) {
      setTheaterProjects(null);
      return;
    }
    let cancelled = false;
    void fetchTheaterRehearsals(accessToken, theaterId)
      .then((response) => {
        if (cancelled) return;
        setTheaterProjects(
          response.projects.map((project) => ({
            slug: project.slug,
            name: project.name || project.slug,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setTheaterProjects([]);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken, isTheaterContext, theaterId]);

  const visibleProjects = useMemo(() => {
    if (isTheaterContext) {
      if (!theaterProjects) return [];
      return theaterProjects
        .map((project) => project.slug)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru"));
    }
    return (Array.isArray(projects) ? projects : [])
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "ru"));
  }, [isTheaterContext, projects, theaterProjects]);
  const projectLabelBySlug = useMemo(() => {
    const labels = new Map(
      projectItems.map((project) => [
        project.slug,
        project.name || project.slug,
      ]),
    );
    for (const project of theaterProjects ?? []) {
      labels.set(project.slug, project.name || project.slug);
    }
    return labels;
  }, [projectItems, theaterProjects]);

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

  const rolesSlug = useMemo(() => {
    const fromSlot = (slot?.ref?.projectSlug ?? "").trim();
    if (fromSlot) return fromSlot;
    if (isSlotScenePickerCustomSlug(projectFilter)) return "";
    return projectFilter;
  }, [slot?.ref?.projectSlug, projectFilter]);

  const {
    data: membersRes,
    isLoading: membersLoading,
    error: membersQueryError,
  } = useProjectMembersQuery(rolesSlug, {
    skip: !accessToken || !rolesSlug,
  });

  const {
    data: rolesRes,
    isLoading: rolesLoading,
    error: rolesQueryError,
  } = useProjectRolesQuery(rolesSlug, {
    skip: !accessToken || !rolesSlug,
  });

  const projectMemberEmails = useMemo(
    () => memberEmailsFromProjectMembers(membersRes),
    [membersRes],
  );

  const { roleEmailsByKey, roleTitleByKey } = useMemo(
    () => roleMapsFromProjectRoles(rolesRes?.roles),
    [rolesRes?.roles],
  );

  const {
    data: teamProfiles = [],
    error: profilesQueryError,
  } = useProfilesBatchQuery(projectMemberEmails, {
    skip: !accessToken || projectMemberEmails.length === 0,
  });

  const theaterMemberEmails = useMemo(
    () =>
      (theaterTroupe?.members ?? [])
        .map((member) => normalizeEmail(String(member.email ?? "")))
        .filter(Boolean),
    [theaterTroupe?.members],
  );

  const {
    data: theaterScheduleProfiles = [],
    isLoading: theaterScheduleProfilesLoading,
  } = useProfilesBatchQuery(theaterMemberEmails, {
    skip:
      !accessToken ||
      !isTheaterContext ||
      theaterMemberEmails.length === 0,
  });

  const availabilityError = useMemo(() => {
    const pick = (e: unknown, fallback: string) => {
      const msg = (e as { message?: string } | undefined)?.message;
      return msg ? msg : fallback;
    };
    if (membersQueryError)
      return pick(membersQueryError, "Не удалось загрузить участников проекта");
    if (rolesQueryError)
      return pick(rolesQueryError, "Не удалось загрузить роли проекта");
    if (profilesQueryError)
      return pick(profilesQueryError, "Не удалось загрузить профили участников");
    return null;
  }, [membersQueryError, rolesQueryError, profilesQueryError]);

  useEffect(() => {
    if (!accessToken || !sid) return;
    if (bundleLoading) return;
    if (!sessionsBundle) {
      const msg =
        (bundleQueryError as { message?: string } | undefined)?.message ??
        "Не удалось загрузить сессию";
      setError(msg);
      return;
    }
    const list = sessionsBundle.sessions ?? [];
    setSessions(list);
    const s = list.find((x) => x.id === sid) ?? null;
    if (!s) {
      setSession(null);
      setSlot(null);
      setError("Сессия не найдена");
      return;
    }
    setSession(s);
    setError(null);
  }, [accessToken, sid, sessionsBundle, bundleLoading, bundleQueryError]);

  useEffect(() => {
    if (!session) {
      setSlot(null);
      return;
    }
    if (!slId) {
      setSlot(null);
      setError(null);
      return;
    }
    const sl = session.slots.find((item) => item.id === slId) ?? null;
    setSlot(sl);
    if (!sl) {
      const n = session.slots.length;
      setError(
        n === 0
          ? "Слотов пока нет — добавь первый в блоке «Слоты» слева."
          : null,
      );
    } else {
      setError(null);
    }
  }, [session, slId]);

  const loading = bundleLoading;

  useEffect(() => {
    if (!visibleProjects.length) return;
    setProjectFilter((prev) => {
      if (isSlotScenePickerCustomSlug(prev)) return prev;
      const chosen = prev && visibleProjects.includes(prev) ? prev : "";
      return chosen || visibleProjects[0] || "";
    });
  }, [visibleProjects]);

  useEffect(() => {
    try {
      if (projectFilter && !isSlotScenePickerCustomSlug(projectFilter))
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

  const persistSessions = async (
    next: DirectorRehearsalSession[],
  ): Promise<boolean> => {
    if (!accessToken) return false;
    const busyConflict = findBusyConflictForChangedSessions(sessions, next);
    if (busyConflict) {
      setBusyConflictError(
        formatDirectorSessionBusyConflictMessage(busyConflict),
      );
      return false;
    }
    const previousSessions = sessions;
    const previousSession = session;
    const previousSlot = slot;
    const nextSession = next.find((item) => item.id === sid) ?? null;
    const nextSlot =
      nextSession && slId
        ? nextSession.slots.find((item) => item.id === slId) ?? null
        : null;

    setSessions(next);
    setSession(nextSession);
    setSlot(nextSlot);
    setBusyConflictError(null);
    setError(null);
    try {
      await replaceSessions({ sessions: next }).unwrap();
      void refetchSessionsBundle();
      return true;
    } catch (e: unknown) {
      setSessions(previousSessions);
      setSession(previousSession);
      setSlot(previousSlot);
      const err = e as { message?: string; data?: { message?: string } };
      setError(
        err?.data?.message ?? err?.message ?? "Не удалось сохранить сессию",
      );
      throw e;
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

  const theaterMembers = useMemo(
    () => theaterTroupe?.members ?? [],
    [theaterTroupe?.members],
  );

  const selectedParticipantEmails = useMemo(
    () =>
      new Set(
        (slot?.participantEmails ?? []).map((email) =>
          normalizeEmail(String(email ?? "")),
        ),
      ),
    [slot?.participantEmails],
  );

  const selectedParticipantEmailsList = useMemo(
    () => Array.from(selectedParticipantEmails).filter(Boolean),
    [selectedParticipantEmails],
  );

  const selectedTheaterMembers = useMemo(
    () =>
      theaterMembers.filter((member) =>
        selectedParticipantEmails.has(normalizeEmail(member.email)),
      ),
    [theaterMembers, selectedParticipantEmails],
  );

  const applySlotParticipants = (emails: string[]) => {
    if (!slot) return;
    void updateSlot({
      participantEmails: emails.map((email) => normalizeEmail(email)).filter(Boolean),
    });
  };

  useEffect(() => {
    if (!slot) {
      setParticipantsModalOpen(false);
      setSceneModalOpen(false);
    }
  }, [slot]);

  const scenePickerProjects = useMemo(
    () =>
      visibleProjects.map((slug) => ({
        slug,
        label: projectLabelBySlug.get(slug) ?? slug,
      })),
    [visibleProjects, projectLabelBySlug],
  );

  const loadProjectData = async (slug: string) => {
    if (!accessToken) return;
    if (!slug || isSlotScenePickerCustomSlug(slug)) return;
    if (dataCache[slug]) return;
    setScenesLoading(true);
    setScenesError(null);
    try {
      const data = await fetchProjectMaterial(slug).unwrap();
      setDataCache((p) => ({
        ...p,
        [slug]: projectMaterialToDirectorSessionCache(data),
      }));
    } catch (e: unknown) {
      const err = e as { message?: string; data?: { message?: string } };
      setScenesError(
        err?.data?.message ?? err?.message ?? "Не удалось загрузить сцены",
      );
      setDataCache((p) => ({
        ...p,
        [slug]: { scenes: [], sceneId: null, sceneRoles: null },
      }));
    } finally {
      setScenesLoading(false);
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
            const rolesRes = await dispatch(
              projectApi.endpoints.projectRoles.initiate(slug),
            ).unwrap();
            return [
              slug,
              roleMapsFromProjectRoles(rolesRes.roles).roleEmailsByKey,
            ] as const;
          } catch {
            return [slug, {}] as const;
          }
        }),
      );
      if (!cancelled) {
        setRoleEmailsByProjectSlug(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, dispatch, projectSlugsInSession.join("|")]);

  const slotPlannerEmails = useMemo(() => {
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
  }, [session, session?.slots, dataCache, roleEmailsByProjectSlug]);

  const { data: plannerProfiles = [] } = useProfilesBatchQuery(
    slotPlannerEmails,
    { skip: !accessToken || slotPlannerEmails.length === 0 },
  );

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
  }, [
    session?.id,
    session?.startsAt,
    session?.slots,
    sessionDateKey,
    dataCache,
    roleEmailsByProjectSlug,
    profilesForSlotTones,
  ]);

  const emailsBySlotId = useMemo(() => {
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
      out[sl.id] = getEmailsPlannedForDirectorSlot(
        slug,
        ref.sceneId,
        plannedData,
        sl.roleRehearsalPicks ?? null,
      );
    }
    return out;
  }, [session, session?.slots, dataCache, roleEmailsByProjectSlug]);

  useEffect(() => {
    if (!projectFilter || isSlotScenePickerCustomSlug(projectFilter)) return;
    void loadProjectData(projectFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectFilter]);

  useEffect(() => {
    if (!rolesSlug || rolesSlug === projectFilter) return;
    if (isSlotScenePickerCustomSlug(rolesSlug)) return;
    void loadProjectData(rolesSlug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rolesSlug, projectFilter]);

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

  const projectScenes = useMemo(() => {
    if (!projectFilter || isSlotScenePickerCustomSlug(projectFilter)) return [];
    const src = dataCache[projectFilter]?.scenes ?? [];
    return src.filter((s) => !isReadyScene(s));
  }, [dataCache, projectFilter]);

  const selectableScenes = useMemo(() => {
    const out: Array<{
      scene: ScriptScene;
      ok: boolean;
      missing: string[];
      roles: string[];
    }> = [];
    if (!projectFilter || isSlotScenePickerCustomSlug(projectFilter)) return out;
    const freeSet = freeRolesNormSet;
    const pack = dataCache[projectFilter] ?? null;
    const sceneRoles = pack?.sceneRoles ?? null;

    for (const s of projectScenes) {
      const roleKeysNorm = getNormalizedRoleKeysForSlotScene(
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
      out.push({ scene: s, ok: missing.length === 0, missing, roles });
    }
    return out;
  }, [freeRolesNormSet, projectScenes, dataCache, projectFilter, roleTitleByKey]);

  /** Сцены (project + sceneId), которые уже привязаны к какому-либо слоту этой сессии */
  const slotsBySceneRefInSession = useMemo(() => {
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
  }, [session?.id, session?.slots]);

  const selectedScene = useMemo(() => {
    if (!slot?.ref) return null;
    const slug = slot.ref.projectSlug;
    const id = slot.ref.sceneId;
    const data = dataCache[slug];
    return data?.scenes?.find((s) => s.id === id) ?? null;
  }, [dataCache, slot?.ref]);

  const selectedSceneLabel = useMemo(() => {
    if (selectedScene) {
      const title = String(selectedScene.title ?? "").trim();
      return title ? title : `Сцена #${selectedScene.id}`;
    }
    const customTitle = String(slot?.title ?? "").trim();
    return customTitle;
  }, [selectedScene, slot?.title]);

  const selectedSceneProjectLabel = useMemo(() => {
    const slug = String(slot?.ref?.projectSlug ?? "").trim();
    if (slug) return projectLabelBySlug.get(slug) ?? slug;
    if (String(slot?.title ?? "").trim()) return "Без проекта";
    return "";
  }, [slot?.ref?.projectSlug, slot?.title, projectLabelBySlug]);

  const assignSceneToSlot = (scene: ScriptScene) => {
    if (!slot || !projectFilter || isSlotScenePickerCustomSlug(projectFilter))
      return;
    const sceneTitle =
      String(scene.title ?? "").trim() || `Сцена #${scene.id}`;
    void updateSlot({
      title: sceneTitle,
      ref: {
        projectSlug: projectFilter,
        sceneId: scene.id,
      },
      durationMin:
        scene.durationMin == null
          ? slot.durationMin
          : Math.max(1, Math.floor(Number(scene.durationMin) || 1)),
      roleRehearsalPicks: undefined,
    });
  };

  const assignCustomSlotTitle = (title: string) => {
    if (!slot) return;
    const nextTitle = title.trim() || "Без названия";
    void updateSlot({
      title: nextTitle,
      ref: undefined,
      roleRehearsalPicks: undefined,
    });
  };

  const slotDisplayById = useMemo(() => {
    const map = new Map<
      string,
      { projectLabel: string; materialLabel: string }
    >();
    for (const sl of session?.slots ?? []) {
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
  }, [dataCache, projectLabelBySlug, session?.slots]);

  const slotPlannedInput = useMemo((): DirectorSlotPlannedData | null => {
    if (!slot?.ref) return null;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const cached = dataCache[slug];
    return {
      scenes: cached?.scenes ?? [],
      sceneRoles: cached?.sceneRoles ?? null,
      roleEmailsByKey,
    };
  }, [slot?.ref, dataCache, roleEmailsByKey]);

  const slotRoleKeysForPicker = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return [];
    const sceneId = slot.ref.sceneId;
    const scene = slotPlannedInput.scenes.find((s) => s.id === sceneId) ?? null;
    return getNormalizedRoleKeysForSlotScene(
      scene,
      slotPlannedInput.sceneRoles,
      sceneId,
    );
  }, [slot?.ref, slotPlannedInput]);

  const slotChartEmailSet = useMemo(() => {
    if (slot?.ref && slotPlannedInput) {
      const slug = String(slot.ref.projectSlug ?? "").trim();
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
  }, [slot?.ref, slotPlannedInput, selectedParticipantEmailsList]);

  const scheduleProfiles = useMemo(() => {
    if (slot?.ref) return teamProfiles;
    if (isTheaterContext) return theaterScheduleProfiles;
    return teamProfiles;
  }, [
    slot?.ref,
    isTheaterContext,
    teamProfiles,
    theaterScheduleProfiles,
  ]);

  const scheduleMembersLoading = Boolean(
    slot?.ref
      ? membersLoading
      : isTheaterContext
        ? theaterScheduleProfilesLoading
        : membersLoading,
  );

  if (!accessToken) {
    return (
      <div className="director-session-page__message">
        Нужно войти, чтобы открыть страницу сессии.
      </div>
    );
  }
  if (!sid) {
    return (
      <div className="director-session-page__message">Некорректный адрес.</div>
    );
  }

  const pageBody = (
    <>
      <div className="director-session-page__head">
        <div className="director-session-page__title-row">
          <Link to={sessionsListHref} className="director-session-page__back">
            {isTheaterContext ? "← Репетиции" : "← К списку сессий"}
          </Link>
          <h1 className="director-session-page__title">
            {session?.title ?? (isTheaterContext ? "Репетиция" : "Сессия")}
          </h1>
        </div>
      </div>

      {loading ? (
        <PageLoader variant="view" label="Загрузка…" />
      ) : null}
      {error ? (
        <div className="settings-invite-error director-session-page__error">
          {error}
        </div>
      ) : null}

      {session && !loading && (
        <div className="director-session-page__grid">
          <DirectorSessionSlotsPanel
            session={session}
            sessions={sessions}
            slotToneClassById={slotRehearsalToneClassById}
            slotDisplayById={slotDisplayById}
            emailsBySlotId={emailsBySlotId}
            profilesByEmail={profilesForSlotTones}
            sessionDateKey={sessionDateKey}
            selectedSlotId={slId || null}
            onSelectSlot={(id) => navigate(sessionHref(id))}
            onRequestCloseSlot={() => navigate(sessionHref())}
            onNoSlotsLeft={() =>
              navigate(sessionHref(), {
                replace: true,
              })
            }
            persistSessions={persistSessions}
            busyConflictError={busyConflictError}
            onDismissBusyConflictError={() => setBusyConflictError(null)}
            slotSettings={
              slot ? (
                <div className="director-session-page__detail-grid">
                  <RehearsalsCard
                    fluid
                    title=""
                    className="director-session-page__preview"
                  >
                    <div className="director-session-page__slot-field">
                      <button
                        type="button"
                        className="director-session-page__participants-trigger"
                        onClick={() => {
                          if (slot?.ref?.projectSlug) {
                            setProjectFilter(slot.ref.projectSlug);
                          } else if (String(slot?.title ?? "").trim()) {
                            setProjectFilter(SLOT_SCENE_PICKER_CUSTOM_SLUG);
                          } else if (
                            !projectFilter ||
                            isSlotScenePickerCustomSlug(projectFilter)
                          ) {
                            if (visibleProjects[0]) {
                              setProjectFilter(visibleProjects[0]);
                            }
                          }
                          setSceneModalOpen(true);
                        }}
                        aria-label="Сцена или название"
                      >
                        <span className="director-session-page__participants-label">
                          {selectedSceneLabel || "Выбрать сцену или название"}
                        </span>
                        {selectedSceneProjectLabel ? (
                          <span className="director-session-page__scene-project">
                            {selectedSceneProjectLabel}
                          </span>
                        ) : null}
                      </button>
                      <SlotScenePickerModal
                        isOpen={sceneModalOpen}
                        onClose={() => setSceneModalOpen(false)}
                        projects={scenePickerProjects}
                        projectSlug={
                          projectFilter || SLOT_SCENE_PICKER_CUSTOM_SLUG
                        }
                        onProjectChange={setProjectFilter}
                        scenes={selectableScenes}
                        scenesLoading={scenesLoading}
                        scenesError={scenesError}
                        availabilityError={availabilityError}
                        selectedSceneId={
                          slot.ref?.projectSlug === projectFilter
                            ? Number(slot.ref.sceneId) || null
                            : null
                        }
                        currentSlotId={slot.id}
                        sessionStartsAt={session?.startsAt ?? null}
                        slotsBySceneRefInSession={slotsBySceneRefInSession}
                        onSelectScene={assignSceneToSlot}
                        initialCustomTitle={
                          !slot.ref ? String(slot.title ?? "").trim() : ""
                        }
                        onSelectCustom={assignCustomSlotTitle}
                      />
                    </div>

                    {selectedScene ? (
                      <div className="session__selected-scene">
                        <TroupeSchedulePreview
                          sessionDateKey={sessionDateKey}
                          profiles={scheduleProfiles}
                          membersLoading={scheduleMembersLoading}
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
                    ) : null}

                    {isTheaterContext && !slot.ref ? (
                      <div className="director-session-page__slot-field">
                        <span className="form-textarea__label">Участники</span>
                        {theaterMembers.length ? (
                          <>
                            <button
                              type="button"
                              className="director-session-page__participants-trigger"
                              onClick={() => setParticipantsModalOpen(true)}
                            >
                              <span className="director-session-page__participants-avatars">
                                {selectedTheaterMembers.slice(0, 5).map((member) => {
                                  const label = getTroupeMemberLabel(member);
                                  return (
                                    <MiniAvatar
                                      key={member.id}
                                      src={profileListAvatarSrc(member.profile)}
                                      label={label}
                                      size={28}
                                      title={label}
                                    />
                                  );
                                })}
                                {selectedTheaterMembers.length > 5 ? (
                                  <span className="director-session-page__participants-more">
                                    +{selectedTheaterMembers.length - 5}
                                  </span>
                                ) : null}
                              </span>
                              <span className="director-session-page__participants-label">
                                {selectedParticipantEmailsList.length
                                  ? `Выбрано: ${selectedParticipantEmailsList.length}`
                                  : "Выбрать актёров"}
                              </span>
                            </button>
                            <SlotParticipantsPickerModal
                              isOpen={participantsModalOpen}
                              members={theaterMembers}
                              selectedEmails={selectedParticipantEmailsList}
                              onClose={() => setParticipantsModalOpen(false)}
                              onApply={applySlotParticipants}
                            />
                          </>
                        ) : (
                          <div className="rehearsals-muted">
                            В труппе театра пока нет участников.
                          </div>
                        )}
                      </div>
                    ) : null}

                    {!selectedScene && !slot.ref ? (
                      <div className="session__selected-scene">
                        <TroupeSchedulePreview
                          sessionDateKey={sessionDateKey}
                          profiles={scheduleProfiles}
                          membersLoading={scheduleMembersLoading}
                          participantEmailSet={slotChartEmailSet}
                        />
                      </div>
                    ) : null}

                    <FormTextarea
                      rootClassName="form-textarea--section"
                      label="Заметки к слоту"
                      value={slotNotesDraft}
                      onChange={(e) => onSlotNotesChange(e.target.value)}
                      onBlur={onSlotNotesBlur}
                      placeholder="Например: темп, акценты, на что обратить внимание…"
                      rows={4}
                    />

                    {selectedScene ? (
                      <PreviewSlot selectedScene={selectedScene} />
                    ) : null}

                  </RehearsalsCard>

                </div>
              ) : undefined
            }
          />
        </div>
      )}
    </>
  );

  return (
    <div
      className={cn(
        "director-session-page",
        isTheaterContext && "director-session-page--theater",
      )}
    >
      {isTheaterContext ? (
        pageBody
      ) : (
        <RehearsalPlanSectionChrome activeTab="sessions">
          {pageBody}
        </RehearsalPlanSectionChrome>
      )}
    </div>
  );
}

const PreviewSlot = ({ selectedScene }: { selectedScene: any }) => {
  const text = String(
    (selectedScene as any).playMarkdown ??
      (selectedScene as any).markdown ??
      "",
  );
  const plain = markdownToPlainText(text);
  const previewText =
    plain.slice(0, 1600) + (plain.length > 1600 ? "\n\n… (обрезано)" : "");
  const hasPreview = Boolean(plain.trim());

  if (!hasPreview) return null;

  return (
    <details className="director-session-page__preview-fold">
      <summary className="director-session-page__preview-fold-summary">
        Превью текста сцены
      </summary>
      <pre className="director-session-page__preview-pre">{previewText}</pre>
    </details>
  );
};
