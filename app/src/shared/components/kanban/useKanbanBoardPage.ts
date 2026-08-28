import { useEffect, useMemo, useState, type DragEvent } from "react";
import { useSearchParams } from "react-router-dom";
import {
  extractRolesSmart,
  formatMemberLabel,
  normalizeEmail,
  normalizeRoleName,
} from "../../../features/rehearsals/model/rehearsals-page-utils";
import { useAuth } from "../../../features/auth";
import { mergeKanbanRoleAssignmentMembers } from "../../../features/kanban/model/kanban-role-members";
import {
  useProjectMembersQuery,
  useProjectRolesQuery,
} from "../../../features/project/api/project-api";
import { useProject } from "../../../features/project";
import { usePlaybook } from "../../../features/playbook";
import { useMyTroupeQuery } from "../../../features/troupe/api/troupe-api";
import { loadActorSceneNote } from "../../../features/show-script/model/show-script-slice";
import type { ScriptScene } from "../../types/script";
import type { ProjectRoleInfo } from "../../../sync/api/projects";
import type { TroupeMemberItem } from "../../../sync/api/troupe";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  applyMove,
  normalizeMissingOrders,
  orderOf,
  type KanbanMemberInfo,
} from "./kanban-board-helpers";
import { STATUSES, statusOf, type KanbanStatus } from "./kanban-constants";

export type KanbanBoardPageProps = {
  members?: KanbanMemberInfo[];
};

function normalizeRoleKey(v: unknown): string {
  return normalizeRoleName(String(v ?? ""));
}

export function useKanbanBoardPage({ members }: KanbanBoardPageProps) {
  const dispatch = useAppDispatch();
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [searchParams] = useSearchParams();
  const { playbookData, scenes, setScenes } = usePlaybook();
  const actorNoteSceneName = String(playbookData?.name ?? "script").trim() || "script";
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [openedSceneId, setOpenedSceneId] = useState<number | null>(null);
  const [expandedCommentSceneIds, setExpandedCommentSceneIds] = useState<Set<number>>(
    () => new Set(),
  );
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [actorFilter, setActorFilter] = useState("");
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);

  const normalizedMembers: KanbanMemberInfo[] = useMemo(() => {
    const list = Array.isArray(members) ? members : [];
    const uniq = new Map<string, KanbanMemberInfo>();
    for (const member of list) {
      if (!member || typeof member.email !== "string") continue;
      const email = normalizeEmail(member.email);
      if (!email) continue;
      const displayName =
        member.displayName != null ? String(member.displayName) : null;
      uniq.set(email, { email, displayName });
    }
    return Array.from(uniq.values()).sort((a, b) =>
      formatMemberLabel(a).localeCompare(formatMemberLabel(b), "ru"),
    );
  }, [members]);

  const normalizedScenes = useMemo(() => normalizeMissingOrders(scenes), [scenes]);

  useEffect(() => {
    if (normalizedScenes !== scenes) setScenes(normalizedScenes);
  }, [normalizedScenes, setScenes, scenes]);

  useEffect(() => {
    const rawSceneId = searchParams.get("scene") ?? searchParams.get("sceneId");
    if (!rawSceneId) return;
    const sceneId = Number(rawSceneId);
    if (!Number.isFinite(sceneId)) return;
    setOpenedSceneId(sceneId);
  }, [searchParams]);

  const effectiveRoleAssignmentsFallback = (playbookData?.roleAssignments ?? {}) as Record<
    string,
    string[]
  >;

  const skipRoles = !accessToken || !projectName;
  const {
    data: rolesRes,
    isLoading: rolesLoading,
    error: rolesQueryError,
  } = useProjectRolesQuery(projectName, { skip: skipRoles });
  const { data: troupeRes } = useMyTroupeQuery({}, { skip: !accessToken });
  const { data: projectMembersRes } = useProjectMembersQuery(projectName, {
    skip: skipRoles,
  });

  const projectRoles = rolesRes?.roles ?? [];
  const troupeMembers = (troupeRes?.members ?? []) as TroupeMemberItem[];

  const rolesError = rolesQueryError
    ? String(
        (rolesQueryError as { message?: string }).message ??
          "Не удалось загрузить роли/труппу",
      )
    : null;

  const roleAssignmentMembers = useMemo(
    () => mergeKanbanRoleAssignmentMembers(troupeRes, projectMembersRes),
    [troupeRes, projectMembersRes],
  );

  const troupeAsMembers = useMemo((): KanbanMemberInfo[] => {
    const result: KanbanMemberInfo[] = [];
    for (const member of troupeMembers) {
      const email = normalizeEmail(String(member.email ?? ""));
      if (!email) continue;
      const profile = member.profile;
      const displayName =
        String(profile?.displayName ?? "").trim() ||
        `${String(profile?.firstName ?? "").trim()} ${String(profile?.lastName ?? "").trim()}`.trim() ||
        null;
      result.push({ email, displayName });
    }
    return result;
  }, [troupeMembers]);

  const allKnownMembers = useMemo(() => {
    const map = new Map<string, KanbanMemberInfo>();
    const add = (member: KanbanMemberInfo | null | undefined) => {
      const email = member?.email ? normalizeEmail(member.email) : "";
      if (!email) return;
      const existing = map.get(email);
      if (!existing) {
        map.set(email, { email, displayName: member?.displayName ?? null });
        return;
      }
      if (!existing.displayName && member?.displayName) {
        map.set(email, { ...existing, displayName: member.displayName });
      }
    };
    normalizedMembers.forEach(add);
    troupeAsMembers.forEach(add);
    return Array.from(map.values()).sort((a, b) =>
      formatMemberLabel(a).localeCompare(formatMemberLabel(b), "ru"),
    );
  }, [normalizedMembers, troupeAsMembers]);

  const roleInfoByKey = useMemo(() => {
    const map = new Map<string, ProjectRoleInfo>();
    for (const role of projectRoles) {
      const key = normalizeRoleKey(role.key ?? role.title);
      if (key) map.set(key, role);
    }
    return map;
  }, [projectRoles]);

  const roleInfoByAliasKey = useMemo(() => {
    const map = new Map<string, ProjectRoleInfo>();
    for (const role of projectRoles) {
      const aliases = Array.isArray(role.aliases) ? role.aliases : [];
      for (const alias of aliases) {
        const key = normalizeRoleKey(alias);
        if (key && !map.has(key)) map.set(key, role);
      }
    }
    return map;
  }, [projectRoles]);

  const resolveRoleInfo = (rawRole: string): ProjectRoleInfo | null => {
    const key = normalizeRoleKey(rawRole);
    if (!key) return null;
    return roleInfoByKey.get(key) ?? roleInfoByAliasKey.get(key) ?? null;
  };

  const getFallbackRoleActors = (roleRaw: string): string[] => {
    const direct = effectiveRoleAssignmentsFallback[roleRaw] ?? [];
    const cleaned = (Array.isArray(direct) ? direct : [])
      .map((item) => String(item ?? "").trim())
      .filter(Boolean);
    if (cleaned.length) return cleaned;
    const roleKey = normalizeRoleKey(roleRaw);
    if (!roleKey) return [];
    for (const [key, value] of Object.entries(effectiveRoleAssignmentsFallback)) {
      if (normalizeRoleKey(key) === roleKey) {
        return (Array.isArray(value) ? value : [])
          .map((item) => String(item ?? "").trim())
          .filter(Boolean);
      }
    }
    return [];
  };

  const getRoleActors = (_scene: ScriptScene, roleRaw: string): string[] => {
    const info = resolveRoleInfo(roleRaw);
    const emails = Array.isArray(info?.emails) ? info.emails : [];
    const cleaned = emails.map((item) => String(item ?? "").trim()).filter(Boolean);
    if (cleaned.length) return cleaned;
    return getFallbackRoleActors(roleRaw);
  };

  const displayRoleTitle = (roleRaw: string): string => {
    const info = resolveRoleInfo(roleRaw);
    const title = info?.title ? String(info.title).trim() : "";
    return title || roleRaw;
  };

  const formatActorList = (actors: string[]) => {
    const uniq = Array.from(
      new Set((actors ?? []).map((item) => String(item ?? "").trim()).filter(Boolean)),
    );
    if (uniq.length === 0) return "—";
    return uniq
      .map((raw) => {
        const email = normalizeEmail(raw);
        const hit =
          allKnownMembers.find((member) => normalizeEmail(member.email) === email) ??
          null;
        return hit ? formatMemberLabel(hit) : raw;
      })
      .join(", ");
  };

  const allRoleKeys = useMemo(() => {
    const set = new Set<string>();
    for (const scene of normalizedScenes) {
      const text = scene.playMarkdown ?? scene.markdown;
      extractRolesSmart(text)
        .map((role) => normalizeRoleKey(role))
        .filter(Boolean)
        .forEach((key) => set.add(key));
    }
    return Array.from(set);
  }, [normalizedScenes]);

  const roleFilterOptions = useMemo(() => {
    return allRoleKeys
      .map((key) => {
        const info = roleInfoByKey.get(key) ?? roleInfoByAliasKey.get(key) ?? null;
        const label = info?.title ? String(info.title).trim() : "";
        return { key, label: label || key };
      })
      .sort((a, b) => a.label.localeCompare(b.label, "ru"));
  }, [allRoleKeys, roleInfoByAliasKey, roleInfoByKey]);

  const allActors = useMemo(() => {
    const set = new Set<string>();
    for (const scene of normalizedScenes) {
      const text = scene.playMarkdown ?? scene.markdown;
      const roles = extractRolesSmart(text);
      for (const role of roles) {
        getRoleActors(scene, role).forEach((actor) => {
          const value = String(actor ?? "").trim();
          if (value) set.add(value);
        });
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, "ru"));
  }, [normalizedScenes, projectRoles, troupeMembers, playbookData]);

  const normalizedQuery = query.trim().toLowerCase();

  const filteredScenes = useMemo(() => {
    const matchesQuery = (scene: ScriptScene, roles: string[]) => {
      if (!normalizedQuery) return true;
      const inTitle = (scene.title ?? "").toLowerCase().includes(normalizedQuery);
      const inRoles = roles.some((role) =>
        String(displayRoleTitle(role) ?? "").toLowerCase().includes(normalizedQuery),
      );
      const inActors = roles.some((role) =>
        getRoleActors(scene, role).some((actor) =>
          String(actor ?? "").toLowerCase().includes(normalizedQuery),
        ),
      );
      return inTitle || inRoles || inActors;
    };

    return normalizedScenes.filter((scene) => {
      const text = scene.playMarkdown ?? scene.markdown;
      const roles = extractRolesSmart(text);
      if (!matchesQuery(scene, roles)) return false;
      if (roleFilter) {
        const hasRole = roles.some((role) => normalizeRoleKey(role) === roleFilter);
        if (!hasRole) return false;
      }
      if (actorFilter) {
        const hasActor = roles.some((role) =>
          getRoleActors(scene, role).some((actor) => actor === actorFilter),
        );
        if (!hasActor) return false;
      }
      if (onlyUnassigned) {
        if (roles.length === 0) return true;
        const hasMissing = roles.some((role) => getRoleActors(scene, role).length === 0);
        if (!hasMissing) return false;
      }
      return true;
    });
  }, [
    actorFilter,
    normalizedQuery,
    normalizedScenes,
    onlyUnassigned,
    roleFilter,
    projectRoles,
    troupeMembers,
    playbookData,
  ]);

  const actorNotesByKey = useAppSelector((state) => state.showScript.actorNotesByKey);

  const columns = useMemo(() => {
    const byStatus = new Map<KanbanStatus, ScriptScene[]>();
    STATUSES.forEach((status) => byStatus.set(status.id, []));
    filteredScenes.forEach((scene) => {
      const status = statusOf(scene);
      const column = byStatus.get(status) ?? [];
      column.push(scene);
      byStatus.set(status, column);
    });
    for (const [status, column] of byStatus.entries()) {
      column.sort((a, b) => orderOf(a, 0) - orderOf(b, 0));
      byStatus.set(status, column);
    }
    return byStatus;
  }, [filteredScenes]);

  const openedScene = useMemo(
    () =>
      openedSceneId != null
        ? (normalizedScenes.find((scene) => scene.id === openedSceneId) ?? null)
        : null,
    [openedSceneId, normalizedScenes],
  );

  const openedRoles = useMemo(() => {
    if (!openedScene) return [];
    const text = openedScene.playMarkdown ?? openedScene.markdown;
    return extractRolesSmart(text);
  }, [openedScene]);

  useEffect(() => {
    if (!accessToken || !projectName) return;
    filteredScenes.forEach((scene) => {
      const cacheKey = `${projectName}:${actorNoteSceneName}:${scene.id}`;
      const entry = actorNotesByKey[cacheKey];
      if (entry) return;
      void dispatch(
        loadActorSceneNote({
          cacheKey,
          projectSlug: projectName,
          sceneName: actorNoteSceneName,
          sceneId: scene.id,
        }),
      );
    });
  }, [
    accessToken,
    actorNoteSceneName,
    actorNotesByKey,
    dispatch,
    filteredScenes,
    projectName,
  ]);

  const onCardDragStart = (ev: DragEvent, id: number) => {
    ev.dataTransfer.setData("text/plain", String(id));
    ev.dataTransfer.effectAllowed = "move";
    setDraggedId(id);
  };

  const onDropToColumn = (ev: DragEvent, toStatus: KanbanStatus) => {
    ev.preventDefault();
    const id = Number(ev.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(id)) return;
    setScenes(applyMove(normalizedScenes, id, toStatus));
    setDraggedId(null);
  };

  const onDropBeforeCard = (
    ev: DragEvent,
    toStatus: KanbanStatus,
    beforeId: number,
  ) => {
    ev.preventDefault();
    const id = Number(ev.dataTransfer.getData("text/plain"));
    if (!Number.isFinite(id)) return;
    setScenes(applyMove(normalizedScenes, id, toStatus, beforeId));
    setDraggedId(null);
  };

  const setSceneStatus = (id: number, status: KanbanStatus) => {
    setScenes((prev) =>
      prev.map((scene) => (scene.id === id ? { ...scene, kanbanStatus: status } : scene)),
    );
  };

  const setSceneDurationMin = (id: number, durationMin: number | undefined) => {
    setScenes((prev) =>
      prev.map((scene) => (scene.id === id ? { ...scene, durationMin } : scene)),
    );
  };

  const resetFilters = () => {
    setQuery("");
    setRoleFilter("");
    setActorFilter("");
    setOnlyUnassigned(false);
  };

  const toggleCommentExpanded = (sceneId: number) => {
    setExpandedCommentSceneIds((prev) => {
      const next = new Set(prev);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const sceneRoles = (scene: ScriptScene) => {
    const text = scene.playMarkdown ?? scene.markdown;
    return extractRolesSmart(text);
  };

  const noteTextForScene = (sceneId: number) => {
    const noteCacheKey = `${projectName ?? ""}:${actorNoteSceneName}:${sceneId}`;
    return String(actorNotesByKey[noteCacheKey]?.text ?? "").trim();
  };

  return {
    rolesError,
    rolesLoading,
    query,
    setQuery,
    roleFilter,
    setRoleFilter,
    actorFilter,
    setActorFilter,
    onlyUnassigned,
    setOnlyUnassigned,
    roleFilterOptions,
    allActors,
    formatActorList,
    resetFilters,
    columns,
    draggedId,
    onCardDragStart,
    onCardDragEnd: () => setDraggedId(null),
    onDropToColumn,
    onDropBeforeCard,
    openScene: (id: number) => setOpenedSceneId(id),
    sceneRoles,
    displayRoleTitle,
    noteTextForScene,
    isCommentExpanded: (sceneId: number) => expandedCommentSceneIds.has(sceneId),
    toggleCommentExpanded,
    openedScene,
    closeScene: () => setOpenedSceneId(null),
    setSceneStatus,
    setSceneDurationMin,
    openedRoles,
    getRoleActors,
    resolveRoleInfo,
    projectName,
    projectRoles,
    roleAssignmentMembers,
  };
}
