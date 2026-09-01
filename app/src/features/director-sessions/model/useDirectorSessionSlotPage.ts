import { useDebouncedSyncedText } from "@shared/hooks/useDebouncedSyncedText";
import dayjs from "dayjs";
import "dayjs/locale/ru";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectSessionPath } from "../../../app/router/paths";
import type { ScriptScene } from "../../../shared/types/script";
import { markdownToPlainText } from "../../../shared/utils/textPreview";
import { useAuth } from "../../auth";
import {
  useMyProfileQuery,
  useProfilesBatchQuery,
} from "../../profile/api/profile-api";
import {
  mergeSelfEmail,
  mergeSelfIntoProfiles,
} from "../../profile/model/availability-calendar";
import { useProject } from "../../project";
import {
  useProjectMembersQuery,
  useProjectRolesQuery,
} from "../../project/api/project-api";
import { extractRolesSmart } from "../../rehearsals/model/rehearsals-page-utils";
import type { TeamProfile } from "../../../sync/api/profile";
import {
  useDirectorSessionsBundleQuery,
  useLazyProjectMaterialQuery,
  useReplaceDirectorSessionsMutation,
} from "../api/director-sessions-api";
import type {
  DirectorRehearsalSession,
  DirectorSessionSlot,
} from "../directorSessionsSync";
import { projectMaterialToDirectorSessionCache } from "./build-project-data-cache";
import {
  formatSlotTime,
  formatTimeHHMM,
  getRangesForDateMinutes,
  getSessionStartLocalMinutes,
  isReadyScene,
  isSlotInsideRanges,
  looksLikeEmail,
  memberEmailsFromProjectMembers,
  normalizeEmail,
  normalizeRoleKey,
  roleMapsFromProjectRoles,
  toDateKey,
} from "./session-page-utils";
import type { DirectorSessionProjectDataCache } from "./session-page-types";
import {
  getAllAssigneeEmailsForDirectorSlotChart,
  getNormalizedRoleKeysForSlotScene,
  type DirectorSlotPlannedData,
} from "./session-slot-planned";

dayjs.locale("ru");

export type DirectorSessionSlotSelectableScene = {
  scene: ScriptScene;
  ok: boolean;
  missing: string[];
  roles: string[];
};

export type DirectorSessionSlotPageViewModel = ReturnType<
  typeof useDirectorSessionSlotPage
>;

function scenePlayText(scene: ScriptScene): string {
  return String(scene.playMarkdown ?? scene.markdown ?? "");
}

function scenePreviewPlain(scene: ScriptScene): string {
  const plain = markdownToPlainText(scenePlayText(scene));
  const truncated = plain.length > 1600;
  return plain.slice(0, 1600) + (truncated ? "\n\n… (обрезано)" : "");
}

export function useDirectorSessionSlotPage() {
  const { accessToken } = useAuth();
  const { projectName, projects, projectItems } = useProject();
  const navigate = useNavigate();

  const { sessionId, slotId } = useParams();
  const sid = String(sessionId ?? "").trim();
  const slId = String(slotId ?? "").trim();

  const [sessions, setSessions] = useState<DirectorRehearsalSession[]>([]);
  const [session, setSession] = useState<DirectorRehearsalSession | null>(null);
  const [slot, setSlot] = useState<DirectorSessionSlot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    data: sessionsBundle,
    isLoading: bundleLoading,
    error: bundleQueryError,
  } = useDirectorSessionsBundleQuery(undefined, {
    skip: !accessToken || !sid || !slId,
  });
  const [replaceSessions] = useReplaceDirectorSessionsMutation();
  const [fetchProjectMaterial] = useLazyProjectMaterialQuery();

  const [dataCache, setDataCache] = useState<DirectorSessionProjectDataCache>(
    {},
  );
  const [scenesLoading, setScenesLoading] = useState(false);
  const [scenesError, setScenesError] = useState<string | null>(null);

  const visibleProjects = useMemo(
    () =>
      (Array.isArray(projects) ? projects : [])
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [projects],
  );
  const projectLabelBySlug = useMemo(
    () =>
      new Map(
        projectItems.map((project) => [
          project.slug,
          project.name || project.slug,
        ]),
      ),
    [projectItems],
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
    if (bundleLoading) return;
    if (!sessionsBundle) {
      const msg =
        (bundleQueryError as { message?: string } | undefined)?.message ??
        "Не удалось загрузить слот";
      setError(msg);
      return;
    }
    setError(null);
    const list = sessionsBundle.sessions ?? [];
    setSessions(list);
    const foundSession = list.find((item) => item.id === sid) ?? null;
    if (!foundSession) {
      setSession(null);
      setSlot(null);
      setError("Сессия не найдена");
      return;
    }
    const foundSlot =
      (foundSession.slots ?? []).find((item) => item.id === slId) ?? null;
    if (!foundSlot) {
      setSession(foundSession);
      setSlot(null);
      setError("Слот не найден");
      return;
    }
    setSession(foundSession);
    setSlot(foundSlot);
  }, [accessToken, sid, slId, sessionsBundle, bundleLoading, bundleQueryError]);

  const loading = bundleLoading;

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
    const date = new Date(session.startsAt);
    return Number.isFinite(date.getTime()) ? toDateKey(date) : null;
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
    const previousSessions = sessions;
    const previousSession = session;
    const previousSlot = slot;
    const nextSession = next.find((item) => item.id === sid) ?? null;
    const nextSlot =
      nextSession?.slots.find((item) => item.id === slId) ?? null;

    setSessions(next);
    setSession(nextSession);
    setSlot(nextSlot);
    setError(null);
    try {
      await replaceSessions({ sessions: next }).unwrap();
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
      const nextSessions = (sessions ?? []).map((item) => {
        if (item.id !== session.id) return item;
        return {
          ...item,
          slots: (item.slots ?? []).map((slotItem) =>
            slotItem.id === targetSlotId
              ? { ...slotItem, ...patch }
              : slotItem,
          ),
          updatedAt: new Date().toISOString(),
        };
      });
      await persistSessions(nextSessions);
      const nextSession =
        nextSessions.find((item) => item.id === session.id) ?? null;
      setSession(nextSession);
      setSlot((prev) => {
        if (!prev || prev.id !== targetSlotId) return prev;
        return (
          nextSession?.slots?.find((item) => item.id === targetSlotId) ?? null
        );
      });
    },
    // persistSessions closes over latest session/slot/sessions
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [session, sessions],
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
    setScenesLoading(true);
    setScenesError(null);
    try {
      const data = await fetchProjectMaterial(slug).unwrap();
      setDataCache((prev) => ({
        ...prev,
        [slug]: projectMaterialToDirectorSessionCache(data),
      }));
    } catch (e: unknown) {
      const err = e as { message?: string; data?: { message?: string } };
      setScenesError(
        err?.data?.message ?? err?.message ?? "Не удалось загрузить сцены",
      );
      setDataCache((prev) => ({
        ...prev,
        [slug]: { scenes: [], sceneId: null, sceneRoles: null },
      }));
    } finally {
      setScenesLoading(false);
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

  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });

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
    () =>
      mergeSelfEmail(
        memberEmailsFromProjectMembers(membersRes),
        myProfile?.email,
      ),
    [membersRes, myProfile?.email],
  );

  const { roleEmailsByKey, roleTitleByKey } = useMemo(
    () => roleMapsFromProjectRoles(rolesRes?.roles),
    [rolesRes?.roles],
  );

  const { data: teamProfilesRaw = [], error: profilesQueryError } =
    useProfilesBatchQuery(projectMemberEmails, {
      skip: !accessToken || projectMemberEmails.length === 0,
    });
  const teamProfiles = useMemo(
    () => mergeSelfIntoProfiles(teamProfilesRaw, myProfile),
    [myProfile, teamProfilesRaw],
  );

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

  const freeRolesNormSet = useMemo(() => {
    const set = new Set<string>();
    if (!sessionDateKey) return set;
    if (!slotWindow) return set;
    const roleEmails = roleEmailsByKey ?? {};
    for (const profile of teamProfiles ?? []) {
      const email = normalizeEmail(profile.email);
      if (!email) continue;
      if (!looksLikeEmail(email)) continue;
      const cal = (
        profile as TeamProfile & {
          availabilityCalendar?: Record<string, string>;
        }
      )?.availabilityCalendar;
      const dayStatus =
        cal?.[sessionDateKey] === "present"
          ? "present"
          : cal?.[sessionDateKey] === "absent"
            ? "absent"
            : "unknown";
      if (dayStatus !== "present") continue;
      const ranges = getRangesForDateMinutes(profile, sessionDateKey);
      if (ranges.length > 0) {
        const insideWindow = isSlotInsideRanges(
          slotWindow.startMin,
          slotWindow.endMin,
          ranges,
        );
        if (!insideWindow) continue;
      }
      for (const [roleKey, emails] of Object.entries(roleEmails)) {
        if (!roleKey) continue;
        if (!Array.isArray(emails) || emails.length === 0) continue;
        if (!emails.includes(email)) continue;
        set.add(roleKey);
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

  const sessionBackHref = useMemo(
    () =>
      `${projectSessionPath(projectName)}?sessionId=${encodeURIComponent(sid)}`,
    [projectName, sid],
  );

  const slotWindowLabel = useMemo(() => {
    if (!sessionDateKey || !slotWindow) return null;
    return {
      dateKey: sessionDateKey,
      range: `${formatTimeHHMM(slotWindow.startMin)}–${formatTimeHHMM(slotWindow.endMin)}`,
    };
  }, [sessionDateKey, slotWindow]);

  const filteredScenes = useMemo(() => {
    const src = projectFilter ? (dataCache[projectFilter]?.scenes ?? []) : [];
    const base = src.filter((scene) => !isReadyScene(scene));
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return base;
    return base.filter((scene) => {
      const inTitle = String(scene.title ?? "")
        .toLowerCase()
        .includes(normalizedQuery);
      const inText = markdownToPlainText(scenePlayText(scene))
        .toLowerCase()
        .includes(normalizedQuery);
      return inTitle || inText;
    });
  }, [dataCache, projectFilter, query]);

  const selectableScenes = useMemo((): DirectorSessionSlotSelectableScene[] => {
    const out: DirectorSessionSlotSelectableScene[] = [];
    for (const scene of filteredScenes) {
      const roles = extractRolesSmart(scenePlayText(scene));
      const missing: string[] = [];
      for (const role of roles) {
        const norm = normalizeRoleKey(role);
        if (norm && !freeRolesNormSet.has(norm)) missing.push(role);
      }
      out.push({
        scene,
        ok: missing.length === 0,
        missing,
        roles,
      });
    }
    return out;
  }, [freeRolesNormSet, filteredScenes]);

  const scenesForList = useMemo(() => {
    if (!onlySelectable) return selectableScenes;
    return selectableScenes.filter((item) => item.ok);
  }, [onlySelectable, selectableScenes]);

  const selectedScene = useMemo(() => {
    if (!slot?.ref) return null;
    const slug = slot.ref.projectSlug;
    const id = slot.ref.sceneId;
    const data = dataCache[slug];
    return data?.scenes?.find((scene) => scene.id === id) ?? null;
  }, [dataCache, slot?.ref]);

  const selectedScenePreviewText = useMemo(
    () => (selectedScene ? scenePreviewPlain(selectedScene) : ""),
    [selectedScene],
  );

  const selectedProjectLabel = useMemo(() => {
    if (!slot?.ref) return "";
    return (
      projectLabelBySlug.get(slot.ref.projectSlug) ?? slot.ref.projectSlug
    );
  }, [projectLabelBySlug, slot?.ref]);

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
    const scene =
      slotPlannedInput.scenes.find((item) => item.id === sceneId) ?? null;
    return getNormalizedRoleKeysForSlotScene(
      scene,
      slotPlannedInput.sceneRoles,
      sceneId,
    );
  }, [slot?.ref, slotPlannedInput]);

  const slotChartEmailSet = useMemo(() => {
    if (!slot?.ref || !slotPlannedInput) return undefined;
    const slug = String(slot.ref.projectSlug ?? "").trim();
    const list = getAllAssigneeEmailsForDirectorSlotChart(
      slug,
      slot.ref.sceneId,
      slotPlannedInput,
    );
    return new Set(list);
  }, [slot?.ref, slotPlannedInput]);

  const clearSlotMaterial = useCallback(() => {
    void updateSlot({
      ref: undefined,
      roleRehearsalPicks: undefined,
    });
  }, [updateSlot]);

  const goBackToSession = useCallback(() => {
    navigate(sessionBackHref);
  }, [navigate, sessionBackHref]);

  const assignSceneToSlot = useCallback(
    (scene: ScriptScene) => {
      const nextDuration =
        scene.durationMin == null
          ? slot?.durationMin
          : Math.max(1, Math.floor(Number(scene.durationMin) || 1));
      void updateSlot({
        title: String(scene.title ?? "").trim() || `Сцена #${scene.id}`,
        ref: { projectSlug: projectFilter, sceneId: scene.id },
        durationMin: nextDuration,
        roleRehearsalPicks: undefined,
      });
    },
    [projectFilter, slot?.durationMin, updateSlot],
  );

  const onRoleRehearsalPicksChange = useCallback(
    (next: NonNullable<DirectorSessionSlot["roleRehearsalPicks"]>) => {
      void updateSlot({ roleRehearsalPicks: next });
    },
    [updateSlot],
  );

  return {
    accessToken,
    sid,
    slId,
    loading,
    error,
    session,
    slot,
    sessionBackHref,
    headerTimeLabel,
    slotTimeLabel,
    selectedProjectLabel,
    selectedScene,
    selectedScenePreviewText,
    sessionDateKey,
    slotWindowLabel,
    teamProfiles,
    membersLoading,
    rolesLoading,
    slotChartEmailSet,
    slotRoleKeysForPicker,
    roleTitleByKey,
    roleEmailsByKey,
    slotNotesDraft,
    onSlotNotesChange,
    onSlotNotesBlur,
    clearSlotMaterial,
    goBackToSession,
    onRoleRehearsalPicksChange,
    projectFilter,
    setProjectFilter,
    visibleProjects,
    projectLabelBySlug,
    query,
    setQuery,
    onlySelectable,
    setOnlySelectable,
    scenesLoading,
    scenesError,
    availabilityError,
    scenesForList,
    assignSceneToSlot,
  };
}
