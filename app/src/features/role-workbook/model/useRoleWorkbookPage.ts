import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectPath } from "../../../app/router/paths";
import { extractRolePhrasesFromScenes } from "../../actor-trainers/model/rolePhrases";
import { useAuth } from "../../auth";
import { usePlaybook } from "../../playbook";
import { useProject } from "../../project";
import {
  useDeleteProjectRoleMutation,
  useProjectRolesQuery,
  useUpdateProjectRoleMutation,
} from "../../project/api/project-api";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  loadRoleWorkbookThunk,
  roleWorkbookActions,
  selectRoleWorkbook,
} from "./roleWorkbookSlice";
import {
  actorLabel,
  pickLatestWorkbookSnapshotForActor,
  type RoleSceneArc,
} from "./roleWorkbookNote";
import { type WorkbookSectionId } from "./role-workbook-sections";
import { normalizeWorkbookEmail } from "./role-workbook-utils";
import { useRoleWorkbookAutosave } from "./useRoleWorkbookAutosave";
import { useRoleWorkbookReferenceImages } from "./useRoleWorkbookReferenceImages";
import type { WorkbookTextFieldKey } from "../ui/WorkbookTextSection";

export type RoleWorkbookPageViewModel = ReturnType<typeof useRoleWorkbookPage>;

export function useRoleWorkbookPage() {
  const { accessToken } = useAuth();
  const { projectName: projectSlug, ensureRemoteProject } = useProject();
  const { roleId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const s = useAppSelector(selectRoleWorkbook);
  const { scenes } = usePlaybook();
  const { data: rolesRes } = useProjectRolesQuery(projectSlug!, { skip: !projectSlug });
  const projectRoles = rolesRes?.roles ?? [];
  const [updateProjectRole, { isLoading: updatingRoleAvatar }] = useUpdateProjectRoleMutation();
  const [deleteProjectRole, { isLoading: deletingRole }] = useDeleteProjectRoleMutation();
  const [isActorWorkbookOpen, setIsActorWorkbookOpen] = useState(false);
  const [activeWorkbookSection, setActiveWorkbookSection] = useState<WorkbookSectionId | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [remoteProjectId, setRemoteProjectId] = useState<string | null>(null);

  const effectiveRoleId = String(roleId ?? "").trim();

  useEffect(() => {
    if (!accessToken || !projectSlug || !effectiveRoleId) return;
    dispatch(loadRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
  }, [accessToken, dispatch, effectiveRoleId, projectSlug]);

  const assigned = useMemo(() => {
    return (s.allowedActorEmails ?? []).slice().sort((a, b) => String(a).localeCompare(String(b), "ru"));
  }, [s.allowedActorEmails]);

  const visibleActorTiles = useMemo(() => {
    if (s.isProjectOwner) return assigned;
    const me = normalizeWorkbookEmail(s.myEmail);
    return assigned.filter((em) => normalizeWorkbookEmail(em) === me);
  }, [assigned, s.isProjectOwner, s.myEmail]);

  const snapshotsByActorEmail = useMemo(() => {
    const out = new Map<string, string | null>();
    if (!s.isProjectOwner) return out;
    const notes = Array.isArray(s.notes) ? s.notes : [];
    for (const em of assigned) {
      const snap = pickLatestWorkbookSnapshotForActor(notes, em);
      const updated = snap?.note?.updatedAt ? String(snap.note.updatedAt) : null;
      out.set(em, updated || null);
    }
    return out;
  }, [assigned, s.isProjectOwner, s.notes]);

  const selectedActor = normalizeWorkbookEmail(s.selectedActorEmail);
  const myEmail = normalizeWorkbookEmail(s.myEmail);
  const canEdit = Boolean(myEmail && selectedActor && myEmail === selectedActor);
  const canEditDirectorRefs = Boolean(s.isProjectOwner);
  const canViewActorWorkbook = Boolean(s.canViewActorWorkbook);

  const {
    markActorDraftDirty,
    markDirectorRefsDirty,
    saveActorDraftNow,
    saveDirectorRefsNow,
  } = useRoleWorkbookAutosave({
    dispatch,
    accessToken,
    projectSlug,
    effectiveRoleId,
    selectedActor,
    canEdit,
    canEditDirectorRefs,
  });

  const setSelectedActor = useCallback(
    (email: string) => dispatch(roleWorkbookActions.setSelectedActorEmail({ value: email })),
    [dispatch],
  );

  const openActorWorkbook = useCallback(
    (email: string) => {
      setSelectedActor(email);
      setActiveWorkbookSection(null);
      setIsActorWorkbookOpen(true);
    },
    [setSelectedActor],
  );

  const closeActorWorkbook = useCallback(() => {
    void saveActorDraftNow();
    void saveDirectorRefsNow();
    setActiveWorkbookSection(null);
    setIsActorWorkbookOpen(false);
  }, [saveActorDraftNow, saveDirectorRefsNow]);

  const closeWorkbookSection = useCallback(() => {
    void saveActorDraftNow();
    void saveDirectorRefsNow();
    setActiveWorkbookSection(null);
  }, [saveActorDraftNow, saveDirectorRefsNow]);

  useEffect(() => {
    setIsActorWorkbookOpen(false);
    setActiveWorkbookSection(null);
  }, [effectiveRoleId]);

  const onDraftFieldChange = useCallback(
    (key: WorkbookTextFieldKey, value: string) => {
      dispatch(roleWorkbookActions.setDraftField({ key, value }));
      markActorDraftDirty();
    },
    [dispatch, markActorDraftDirty],
  );

  const draft = s.draft;
  const sceneArcs = useMemo(() => draft?.sceneArcs ?? [], [draft?.sceneArcs]);

  const roleLabel = useMemo(() => {
    return String(s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId ?? "").trim();
  }, [effectiveRoleId, s.roleInfo?.key, s.roleInfo?.title]);

  const canEditRoleAvatar = Boolean(s.isProjectOwner);
  const canDeleteRole = Boolean(s.isProjectOwner && s.roleInfo?.id);

  const saveRoleAvatarKey = useCallback(
    async (avatarKey: string | null) => {
      if (!accessToken || !projectSlug || !s.roleInfo?.id || !canEditRoleAvatar) return;
      const updated = await updateProjectRole({
        projectSlug,
        roleId: s.roleInfo.id,
        title: s.roleInfo.title,
        avatarKey,
      }).unwrap();
      if (!updated?.ok) return;
      const fresh = projectRoles.find((r) => r.id === s.roleInfo?.id);
      if (fresh) {
        dispatch(roleWorkbookActions.patchRoleInfo({ role: { ...fresh, avatarKey } }));
      } else if (s.roleInfo) {
        dispatch(roleWorkbookActions.patchRoleInfo({ role: { ...s.roleInfo, avatarKey } }));
      }
    },
    [
      accessToken,
      canEditRoleAvatar,
      dispatch,
      projectRoles,
      projectSlug,
      s.roleInfo,
      updateProjectRole,
    ],
  );

  const deleteRole = useCallback(async () => {
    if (!accessToken || !projectSlug || !s.roleInfo?.id || !canDeleteRole) return;
    const roleTitle = String(s.roleInfo.title ?? roleLabel).trim() || "роль";
    const confirmed =
      typeof window !== "undefined"
        ? window.confirm(`Удалить роль «${roleTitle}»?`)
        : true;
    if (!confirmed) return;
    setDeleteError(null);
    try {
      await deleteProjectRole({
        projectSlug,
        roleId: s.roleInfo.id,
      }).unwrap();
      navigate(projectPath(projectSlug, "roles"));
    } catch {
      setDeleteError("Не удалось удалить роль");
    }
  }, [
    accessToken,
    canDeleteRole,
    deleteProjectRole,
    navigate,
    projectSlug,
    roleLabel,
    s.roleInfo?.id,
    s.roleInfo?.title,
  ]);

  const roleKeyCandidates = useMemo(() => {
    return Array.from(
      new Set(
        [s.roleInfo?.title, s.roleInfo?.key, roleLabel]
          .map((x) => String(x ?? "").trim())
          .filter(Boolean),
      ),
    );
  }, [roleLabel, s.roleInfo?.key, s.roleInfo?.title]);

  const roleSceneIdSet = useMemo(() => {
    const phrases = extractRolePhrasesFromScenes({
      scenes: Array.isArray(scenes) ? scenes : [],
      role: roleLabel,
      roleKeys: roleKeyCandidates,
      preferField: "playMarkdown",
    });
    return new Set<number>(phrases.map((p) => p.sceneId));
  }, [roleKeyCandidates, roleLabel, scenes]);

  const desiredSceneArcs = useMemo(() => {
    const src = Array.isArray(scenes) ? scenes : [];
    const bySceneId = new Map<number, RoleSceneArc>();
    for (const a of sceneArcs ?? []) {
      const id = typeof a?.sceneId === "number" ? a.sceneId : Number(a?.sceneId ?? NaN);
      if (!Number.isFinite(id)) continue;
      bySceneId.set(id, a);
    }
    return src
      .filter((scene) => {
        const sceneId = Number(scene?.id ?? NaN);
        return Number.isFinite(sceneId) && roleSceneIdSet.has(sceneId);
      })
      .map((scene) => {
        const id = Number(scene.id);
        const prev = bySceneId.get(id);
        const sceneTitle = String(scene.title ?? "").trim() || undefined;
        return {
          sceneId: id,
          sceneTitle,
          text: String(prev?.text ?? ""),
        };
      });
  }, [roleSceneIdSet, sceneArcs, scenes]);

  const sceneArcTextBySceneId = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of sceneArcs ?? []) {
      const id = typeof a?.sceneId === "number" ? a.sceneId : Number(a?.sceneId ?? NaN);
      if (!Number.isFinite(id)) continue;
      map.set(Number(id), String(a?.text ?? ""));
    }
    return map;
  }, [sceneArcs]);

  const sceneArcsForView = useMemo(() => {
    return (desiredSceneArcs ?? []).map((a) => {
      const hasStoredText = a.sceneId != null && sceneArcTextBySceneId.has(Number(a.sceneId));
      const text = hasStoredText
        ? String(sceneArcTextBySceneId.get(Number(a.sceneId)) ?? "")
        : String(a.text ?? "");
      return { ...a, text };
    });
  }, [desiredSceneArcs, sceneArcTextBySceneId]);

  const sceneOptionsForQuestions = useMemo(() => {
    return (sceneArcsForView ?? [])
      .filter((a) => a.sceneId != null)
      .map((a) => ({ sceneId: a.sceneId, sceneTitle: a.sceneTitle }));
  }, [sceneArcsForView]);

  const desiredSceneArcsSignature = useMemo(() => {
    return (desiredSceneArcs ?? [])
      .map((a) => `${String(a?.sceneId ?? "")}:${String(a?.sceneTitle ?? "")}`)
      .join("|");
  }, [desiredSceneArcs]);

  const sceneArcsSignature = useMemo(() => {
    return (sceneArcs ?? [])
      .map((a) => `${String(a?.sceneId ?? "")}:${String(a?.sceneTitle ?? "")}`)
      .join("|");
  }, [sceneArcs]);

  useEffect(() => {
    if (!canEdit) return;
    if (!Array.isArray(scenes) || scenes.length === 0) return;
    if (desiredSceneArcsSignature === sceneArcsSignature) return;
    dispatch(roleWorkbookActions.setDraftSceneArcs({ value: desiredSceneArcs }));
  }, [canEdit, desiredSceneArcs, desiredSceneArcsSignature, dispatch, sceneArcsSignature, scenes]);

  const directorImages = useMemo(() => s.directorRefsDraft?.images ?? [], [s.directorRefsDraft?.images]);

  useEffect(() => {
    if (!accessToken || !projectSlug) return;
    let cancelled = false;
    void ensureRemoteProject(accessToken).then((id) => {
      if (!cancelled) setRemoteProjectId(id || null);
    });
    return () => {
      cancelled = true;
    };
  }, [accessToken, ensureRemoteProject, projectSlug]);

  const referenceImages = useRoleWorkbookReferenceImages({
    dispatch,
    accessToken,
    projectSlug,
    effectiveRoleId,
    canEdit,
    canEditDirectorRefs,
    selectedActor,
    draftReferenceImages: draft?.referenceImages,
    directorImages,
    profilesByEmail: s.profilesByEmail,
    directorRefsError: s.directorRefsError,
    ensureRemoteProject,
    markActorDraftDirty,
    markDirectorRefsDirty,
    saveDirectorRefsNow,
  });

  const onBlurSave = useCallback(() => {
    void saveActorDraftNow();
    void saveDirectorRefsNow();
  }, [saveActorDraftNow, saveDirectorRefsNow]);

  const goToProfile = useCallback(() => {
    navigate("/profile");
  }, [navigate]);

  const setSceneArcText = useCallback(
    (idx: number, text: string) => {
      if (!canEdit) return;
      const next: RoleSceneArc[] = sceneArcsForView.map((item) => ({ ...item }));
      next[idx] = { ...(next[idx] as RoleSceneArc), text };
      dispatch(roleWorkbookActions.setDraftSceneArcs({ value: next }));
      markActorDraftDirty();
    },
    [canEdit, dispatch, markActorDraftDirty, sceneArcsForView],
  );

  const onChangeRelationshipEntries = useCallback(
    (next: NonNullable<typeof draft>["relationshipEntries"]) => {
      dispatch(roleWorkbookActions.setDraftRelationshipEntries({ value: next }));
      markActorDraftDirty();
    },
    [dispatch, markActorDraftDirty],
  );

  const onChangeDirectorQuestions = useCallback(
    (next: NonNullable<typeof draft>["directorQuestions"]) => {
      dispatch(roleWorkbookActions.setDraftDirectorQuestions({ value: next }));
      markActorDraftDirty();
    },
    [dispatch, markActorDraftDirty],
  );

  const removeActorRefImage = useCallback(
    (key: string) => {
      dispatch(roleWorkbookActions.removeActorRefImage({ key }));
      markActorDraftDirty();
    },
    [dispatch, markActorDraftDirty],
  );

  const removeDirectorRefImage = useCallback(
    (key: string) => {
      dispatch(roleWorkbookActions.removeDirectorRefImage({ key }));
      markDirectorRefsDirty();
    },
    [dispatch, markDirectorRefsDirty],
  );

  const selectedActorLabel = actorLabel(
    s.profilesByEmail?.[selectedActor] ?? null,
    selectedActor || "—",
  );

  const roleDisplayTitle = s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId;
  const desiredSceneArcsCount = Array.isArray(desiredSceneArcs) ? desiredSceneArcs.length : 0;
  const isDirectorView = Boolean(s.isProjectOwner && !canEdit);
  const pageBooting = Boolean(accessToken && projectSlug && effectiveRoleId && s.loading && !s.roleInfo);

  return {
    accessToken,
    projectSlug,
    effectiveRoleId,
    pageBooting,
    loading: s.loading,
    isActorWorkbookOpen,
    activeWorkbookSection,
    setActiveWorkbookSection,
    deleteError,
    remoteProjectId,
    roleInfo: s.roleInfo,
    roleLabel,
    roleDisplayTitle,
    selectedActor,
    selectedActorLabel,
    canEdit,
    canEditDirectorRefs,
    canViewActorWorkbook,
    canEditRoleAvatar,
    canDeleteRole,
    updatingRoleAvatar,
    deletingRole,
    visibleActorTiles,
    snapshotsByActorEmail,
    profilesByEmail: s.profilesByEmail,
    projectRoles,
    draft,
    error: s.error,
    saving: s.saving,
    snapshotUpdatedAt: s.snapshot?.note?.updatedAt ?? null,
    lastSavedAtIso: s.lastSavedAtIso,
    inboundMentions: s.inboundMentions ?? [],
    sceneArcsForView,
    sceneOptionsForQuestions,
    desiredSceneArcsCount,
    isDirectorView,
    directorImages,
    referenceImages,
    openActorWorkbook,
    closeActorWorkbook,
    closeWorkbookSection,
    onDraftFieldChange,
    onBlurSave,
    goToProfile,
    saveRoleAvatarKey,
    deleteRole,
    setSceneArcText,
    onChangeRelationshipEntries,
    onChangeDirectorQuestions,
    removeActorRefImage,
    removeDirectorRefImage,
  };
}
