import { Button } from "@shared/core/button/Button";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useProjectRolesQuery, useUpdateProjectRoleMutation } from "../../features/project/api/project-api";
import { RoleAvatarEditor } from "../../features/role-card/RoleAvatarEditor";
import { RolePlayingCard } from "../../features/role-card/RolePlayingCard";
import { WorkbookDirectorQuestionsSection } from "../../features/role-workbook/ui/WorkbookDirectorQuestionsSection";
import { WorkbookInboundMentionsSection } from "../../features/role-workbook/ui/WorkbookInboundMentionsSection";
import { WorkbookRehearsalChecklistSection } from "../../features/role-workbook/ui/WorkbookRehearsalChecklistSection";
import { WorkbookRelationshipsSection } from "../../features/role-workbook/ui/WorkbookRelationshipsSection";
import { WorkbookTransformationSection } from "../../features/role-workbook/ui/WorkbookTransformationSection";
import { useScene } from "../../features/scene";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import {
  roleWorkbookActions,
  selectRoleWorkbook,
  loadRoleWorkbookThunk,
  saveRoleWorkbookThunk,
  saveDirectorRefsThunk,
} from "../../features/role-workbook/model/roleWorkbookSlice";
import {
  actorLabel,
  pickLatestWorkbookSnapshotForActor,
  type RoleSceneArc,
  type RoleWorkbookDataV1,
} from "../../features/role-workbook/model/roleWorkbookNote";
import { extractRolePhrasesFromSteps } from "../../features/actor-trainers/model/rolePhrases";
import { getPlayUrl, uploadProjectFile } from "../../sync/api/files";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import "./style.css";

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

function clipboardImageFile(data: DataTransfer | null | undefined): File | null {
  const directFile = Array.from(data?.files ?? []).find((file) =>
    String(file?.type ?? "").startsWith("image/"),
  );
  if (directFile) return directFile;
  const imageItem =
    Array.from(data?.items ?? []).find((item) =>
      String(item?.type ?? "").startsWith("image/"),
    ) ?? null;
  return imageItem?.getAsFile() ?? null;
}

function imageFilesFromTransfer(data: DataTransfer | null | undefined): File[] {
  const byFiles = Array.from(data?.files ?? []).filter((file) =>
    String(file?.type ?? "").startsWith("image/"),
  );
  if (byFiles.length > 0) return byFiles;
  return Array.from(data?.items ?? [])
    .filter((item) => String(item?.type ?? "").startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter((file): file is File => Boolean(file));
}

type WorkbookTextFieldKey = keyof Omit<
  RoleWorkbookDataV1,
  | "v"
  | "actorEmail"
  | "referenceImages"
  | "referenceLinksLegacy"
  | "sceneArcs"
  | "relationshipEntries"
  | "directorQuestions"
  | "savedAtIso"
>;

function WorkbookTextSection(props: {
  sectionNum: number;
  title: string;
  hint?: ReactNode;
  fieldKey: WorkbookTextFieldKey;
  rows: number;
  placeholder: string;
  value: string;
  canEdit: boolean;
  onFieldChange: (key: WorkbookTextFieldKey, value: string) => void;
}) {
  const { sectionNum, title, hint, fieldKey, rows, placeholder, value, canEdit, onFieldChange } = props;
  return (
    <div className="rolewb-card rolewb-section" id={`rolewb-section-${fieldKey}`}>
      <div className="rolewb-section-head">
        <span className="rolewb-section-num">{sectionNum}</span>
        <div className="rolewb-card-title">{title}</div>
      </div>
      {hint ? <div className="rolewb-hint">{hint}</div> : null}
      <textarea
        className="settings-invite-input"
        rows={rows}
        value={value}
        onChange={(e) => onFieldChange(fieldKey, e.target.value)}
        disabled={!canEdit}
        style={{ maxWidth: "unset", width: "100%" }}
        placeholder={placeholder}
      />
    </div>
  );
}

const ACTOR_WORKBOOK_AUTOSAVE_DELAY_MS = 1200;

type WorkbookSectionId =
  | "givenCircumstances"
  | "biography"
  | "socialPortrait"
  | "relationships"
  | "inbound"
  | "superObjective"
  | "obstacles"
  | "eventSeries"
  | "transformation"
  | "appearance"
  | "referenceImages"
  | "sceneArcs"
  | "directorQuestions"
  | "rehearsalChecklist"
  | "preparation";

const WORKBOOK_SECTIONS: Array<{
  id: WorkbookSectionId;
  title: string;
  hint: string;
}> = [
  {
    id: "givenCircumstances",
    title: "Обстоятельства",
    hint: "Мир пьесы, время, место и правила, которые давят на героя.",
  },
  {
    id: "biography",
    title: "Биография",
    hint: "Прошлое героя и то, что сформировало его характер.",
  },
  {
    id: "socialPortrait",
    title: "Социальный портрет",
    hint: "Возраст, статус, профессия, речь, привычки и среда.",
  },
  {
    id: "relationships",
    title: "Отношения",
    hint: "Связи с другими персонажами, конфликты, близость и цели.",
  },
  {
    id: "inbound",
    title: "Обо мне",
    hint: "Что другие персонажи уже написали о вашей роли.",
  },
  {
    id: "superObjective",
    title: "Сверхзадача",
    hint: "Главная цель героя и сквозное действие.",
  },
  {
    id: "obstacles",
    title: "Препятствия",
    hint: "Что мешает герою достичь цели.",
  },
  {
    id: "eventSeries",
    title: "Событийный ряд",
    hint: "Ключевые события жизни героя в пьесе.",
  },
  {
    id: "transformation",
    title: "Трансформация",
    hint: "Кем герой был, кем стал и где случился перелом.",
  },
  {
    id: "appearance",
    title: "Внешность",
    hint: "Осанка, пластика, голос, темп и внешний образ.",
  },
  {
    id: "referenceImages",
    title: "Референсы",
    hint: "Картинки, фактуры, костюм, пластика и настроение.",
  },
  {
    id: "sceneArcs",
    title: "По сценам",
    hint: "Что меняется с персонажем в каждой сцене.",
  },
  {
    id: "directorQuestions",
    title: "Неясно",
    hint: "Вопросы режиссёру по роли, тексту и сценам.",
  },
  {
    id: "rehearsalChecklist",
    title: "Чеклист",
    hint: "Что уже отработано и что впереди.",
  },
  {
    id: "preparation",
    title: "Подготовка",
    hint: "План самостоятельной подготовки к роли.",
  },
];

function referenceColumnCount(total: number): number {
  if (total <= 4) return 1;
  if (total <= 8) return 2;
  if (total <= 12) return 3;
  return 4;
}

function distributeIntoColumns<T>(items: T[], columnCount: number): T[][] {
  const safeColumnCount = Math.max(1, Math.min(columnCount, items.length || 1));
  const columns = Array.from({ length: safeColumnCount }, () => [] as T[]);
  items.forEach((item, idx) => {
    columns[idx % safeColumnCount].push(item);
  });
  return columns;
}

export function RoleWorkbookPage() {
  const { accessToken } = useAuth();
  const { projectName: projectSlug, ensureRemoteProject } = useProject();
  const { roleId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const s = useAppSelector(selectRoleWorkbook);
  const { steps } = useScene();
  const { data: rolesRes } = useProjectRolesQuery(projectSlug!, { skip: !projectSlug });
  const projectRoles = rolesRes?.roles ?? [];
  const [updateProjectRole, { isLoading: updatingRoleAvatar }] = useUpdateProjectRoleMutation();
  const [actorDraftDirtyRevision, setActorDraftDirtyRevision] = useState(0);
  const actorDraftDirtyRevisionRef = useRef(0);
  const actorDraftSavedRevisionRef = useRef(0);
  const actorDraftAutosaveTimerRef = useRef<number | null>(null);
  const [directorRefsDirtyRevision, setDirectorRefsDirtyRevision] = useState(0);
  const directorRefsDirtyRevisionRef = useRef(0);
  const directorRefsSavedRevisionRef = useRef(0);
  const directorRefsAutosaveTimerRef = useRef<number | null>(null);
  const [isActorWorkbookOpen, setIsActorWorkbookOpen] = useState(false);
  const [activeWorkbookSection, setActiveWorkbookSection] = useState<WorkbookSectionId | null>(null);

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
    const me = normalizeEmail(s.myEmail);
    return assigned.filter((em) => normalizeEmail(em) === me);
  }, [assigned, s.isProjectOwner, s.myEmail]);

  const snapshotsByActorEmail = useMemo(() => {
    // For director: show what each assigned actor saved.
    const out = new Map<string, string | null>();
    if (!s.isProjectOwner) return out;
    const notes = Array.isArray(s.notes) ? s.notes : [];
    for (const em of assigned) {
      const snap = pickLatestWorkbookSnapshotForActor(notes as any, em);
      const updated = snap?.note?.updatedAt ? String(snap.note.updatedAt) : null;
      out.set(em, updated || null);
    }
    return out;
  }, [assigned, s.isProjectOwner, s.notes]);

  const selectedActor = normalizeEmail(s.selectedActorEmail);
  const myEmail = normalizeEmail(s.myEmail);
  const canEdit = Boolean(myEmail && selectedActor && myEmail === selectedActor);
  const canEditDirectorRefs = Boolean(s.isProjectOwner);
  const canViewActorWorkbook = Boolean((s as any).canViewActorWorkbook);

  const clearActorAutosaveTimer = useCallback(() => {
    const timer = actorDraftAutosaveTimerRef.current;
    if (timer == null) return;
    window.clearTimeout(timer);
    actorDraftAutosaveTimerRef.current = null;
  }, []);

  const clearDirectorRefsAutosaveTimer = useCallback(() => {
    const timer = directorRefsAutosaveTimerRef.current;
    if (timer == null) return;
    window.clearTimeout(timer);
    directorRefsAutosaveTimerRef.current = null;
  }, []);

  const markActorDraftDirty = useCallback(() => {
    if (!canEdit) return;
    const nextRevision = actorDraftDirtyRevisionRef.current + 1;
    actorDraftDirtyRevisionRef.current = nextRevision;
    setActorDraftDirtyRevision(nextRevision);
  }, [canEdit]);

  const markDirectorRefsDirty = useCallback(() => {
    if (!canEditDirectorRefs) return;
    const nextRevision = directorRefsDirtyRevisionRef.current + 1;
    directorRefsDirtyRevisionRef.current = nextRevision;
    setDirectorRefsDirtyRevision(nextRevision);
  }, [canEditDirectorRefs]);

  const saveActorDraftNow = useCallback(async () => {
    if (!canEdit || !accessToken || !projectSlug || !effectiveRoleId) return;
    const targetRevision = actorDraftDirtyRevisionRef.current;
    if (targetRevision <= actorDraftSavedRevisionRef.current) return;
    clearActorAutosaveTimer();
    await dispatch(saveRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
    actorDraftSavedRevisionRef.current = targetRevision;
  }, [
    accessToken,
    canEdit,
    clearActorAutosaveTimer,
    dispatch,
    effectiveRoleId,
    projectSlug,
  ]);

  const saveDirectorRefsNow = useCallback(async () => {
    if (!canEditDirectorRefs || !accessToken || !projectSlug || !effectiveRoleId) return;
    const targetRevision = directorRefsDirtyRevisionRef.current;
    if (targetRevision <= directorRefsSavedRevisionRef.current) return;
    clearDirectorRefsAutosaveTimer();
    await dispatch(saveDirectorRefsThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
    directorRefsSavedRevisionRef.current = targetRevision;
  }, [
    accessToken,
    canEditDirectorRefs,
    clearDirectorRefsAutosaveTimer,
    dispatch,
    effectiveRoleId,
    projectSlug,
  ]);

  useEffect(() => {
    clearActorAutosaveTimer();
    actorDraftDirtyRevisionRef.current = 0;
    actorDraftSavedRevisionRef.current = 0;
    setActorDraftDirtyRevision(0);
  }, [clearActorAutosaveTimer, effectiveRoleId, selectedActor]);

  useEffect(() => {
    clearDirectorRefsAutosaveTimer();
    directorRefsDirtyRevisionRef.current = 0;
    directorRefsSavedRevisionRef.current = 0;
    setDirectorRefsDirtyRevision(0);
  }, [clearDirectorRefsAutosaveTimer, effectiveRoleId]);

  useEffect(() => {
    if (!canEdit) return;
    if (actorDraftDirtyRevision <= actorDraftSavedRevisionRef.current) return;
    clearActorAutosaveTimer();
    actorDraftAutosaveTimerRef.current = window.setTimeout(() => {
      void saveActorDraftNow();
    }, ACTOR_WORKBOOK_AUTOSAVE_DELAY_MS);
    return clearActorAutosaveTimer;
  }, [actorDraftDirtyRevision, canEdit, clearActorAutosaveTimer, saveActorDraftNow]);

  useEffect(() => {
    if (!canEditDirectorRefs) return;
    if (directorRefsDirtyRevision <= directorRefsSavedRevisionRef.current) return;
    clearDirectorRefsAutosaveTimer();
    directorRefsAutosaveTimerRef.current = window.setTimeout(() => {
      void saveDirectorRefsNow();
    }, ACTOR_WORKBOOK_AUTOSAVE_DELAY_MS);
    return clearDirectorRefsAutosaveTimer;
  }, [
    canEditDirectorRefs,
    clearDirectorRefsAutosaveTimer,
    directorRefsDirtyRevision,
    saveDirectorRefsNow,
  ]);

  useEffect(() => {
    return () => {
      clearActorAutosaveTimer();
      clearDirectorRefsAutosaveTimer();
    };
  }, [clearActorAutosaveTimer, clearDirectorRefsAutosaveTimer]);

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

  const roleKeyCandidates = useMemo(() => {
    return Array.from(
      new Set(
        [s.roleInfo?.title, s.roleInfo?.key, roleLabel]
          .map((x) => String(x ?? "").trim())
          .filter(Boolean),
      ),
    );
  }, [roleLabel, s.roleInfo?.key, s.roleInfo?.title]);

  const roleStepIdSet = useMemo(() => {
    const phrases = extractRolePhrasesFromSteps({
      steps: Array.isArray(steps) ? steps : [],
      role: roleLabel,
      roleKeys: roleKeyCandidates,
      preferField: "playMarkdown",
    });
    return new Set<number>(phrases.map((p) => p.stepId));
  }, [roleKeyCandidates, roleLabel, steps]);

  const desiredSceneArcs = useMemo(() => {
    const src = Array.isArray(steps) ? steps : [];
    const byStepId = new Map<number, RoleSceneArc>();
    for (const a of sceneArcs ?? []) {
      const id = typeof a?.stepId === "number" ? a.stepId : Number(a?.stepId ?? NaN);
      if (!Number.isFinite(id)) continue;
      byStepId.set(id, a);
    }
    return src
      .filter((st) => st && Number.isFinite(Number((st as any).id)) && roleStepIdSet.has(Number((st as any).id)))
      .map((st) => {
        const id = Number((st as any).id);
        const prev = byStepId.get(id);
        return {
          stepId: id,
          stepTitle: String((st as any).title ?? "").trim() || undefined,
          text: String(prev?.text ?? ""),
        };
      });
  }, [roleStepIdSet, sceneArcs, steps]);

  const sceneArcTextByStepId = useMemo(() => {
    const map = new Map<number, string>();
    for (const a of sceneArcs ?? []) {
      const id = typeof a?.stepId === "number" ? a.stepId : Number(a?.stepId ?? NaN);
      if (!Number.isFinite(id)) continue;
      map.set(Number(id), String(a?.text ?? ""));
    }
    return map;
  }, [sceneArcs]);

  const sceneArcsForView = useMemo(() => {
    return (desiredSceneArcs ?? []).map((a) => ({
      ...a,
      text:
        a.stepId != null && sceneArcTextByStepId.has(Number(a.stepId))
          ? String(sceneArcTextByStepId.get(Number(a.stepId)) ?? "")
          : String(a.text ?? ""),
    }));
  }, [desiredSceneArcs, sceneArcTextByStepId]);

  const sceneOptionsForQuestions = useMemo(() => {
    return (sceneArcsForView ?? [])
      .filter((a) => a.stepId != null)
      .map((a) => ({ stepId: a.stepId, stepTitle: a.stepTitle }));
  }, [sceneArcsForView]);

  const desiredSceneArcsSignature = useMemo(() => {
    return (desiredSceneArcs ?? [])
      .map((a) => `${String((a as any)?.stepId ?? "")}:${String((a as any)?.stepTitle ?? "")}`)
      .join("|");
  }, [desiredSceneArcs]);

  const sceneArcsSignature = useMemo(() => {
    return (sceneArcs ?? [])
      .map((a) => `${String((a as any)?.stepId ?? "")}:${String((a as any)?.stepTitle ?? "")}`)
      .join("|");
  }, [sceneArcs]);

  useEffect(() => {
    if (!canEdit) return;
    // Автосписок сцен: только те шаги, где роль присутствует в "Тексте" (playMarkdown).
    // Важно: подписи/тексты арок сохраняем по stepId.
    if (!Array.isArray(steps) || steps.length === 0) return;
    if (desiredSceneArcsSignature === sceneArcsSignature) return;
    dispatch(roleWorkbookActions.setDraftSceneArcs({ value: desiredSceneArcs as any }));
  }, [canEdit, desiredSceneArcs, desiredSceneArcsSignature, dispatch, sceneArcsSignature, steps]);

  // --- Director image references ---
  const directorImages = useMemo(() => s.directorRefsDraft?.images ?? [], [s.directorRefsDraft?.images]);
  const [uploading, setUploading] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const directorFileInputRef = useRef<HTMLInputElement | null>(null);
  const directorRefsSectionRef = useRef<HTMLDivElement | null>(null);

  const urlCacheRef = useRef<Map<string, string>>(new Map());
  const [urlTick, setUrlTick] = useState(0);
  const ensureImageUrl = useCallback(
    async (key: string) => {
      const k = String(key ?? "").trim();
      if (!k) return null;
      const cached = urlCacheRef.current.get(k);
      if (cached) return cached;
      if (!accessToken) return null;
      try {
        const { url } = await getPlayUrl(accessToken, k);
        if (url) {
          urlCacheRef.current.set(k, url);
          setUrlTick((x) => x + 1);
        }
        return url ?? null;
      } catch {
        return null;
      }
    },
    [accessToken],
  );

  const uploadDirectorClipboardImage = useCallback(
    async (file: File | null) => {
      if (!canEditDirectorRefs || !file) return;
      if (!accessToken || !projectSlug) return;
      const projectId = await ensureRemoteProject(accessToken);
      if (!projectId) return;

      setUploading(true);
      try {
        const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file });
        if (!key) return;
        dispatch(roleWorkbookActions.addDirectorRefImages({ images: [{ key, url }] as any }));
        markDirectorRefsDirty();
      } finally {
        setUploading(false);
      }
    },
    [
      accessToken,
      canEditDirectorRefs,
      dispatch,
      ensureRemoteProject,
      markDirectorRefsDirty,
      projectSlug,
    ],
  );

  const onDirectorRefsPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!canEditDirectorRefs) return;
      const file = clipboardImageFile(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      await uploadDirectorClipboardImage(file);
    },
    [canEditDirectorRefs, uploadDirectorClipboardImage],
  );

  useEffect(() => {
    if (!canEditDirectorRefs) return;
    const onPaste = (e: ClipboardEvent) => {
      const file = clipboardImageFile(e.clipboardData);
      if (!file) return;

      const section = directorRefsSectionRef.current;
      const target = e.target;
      const targetNode = target instanceof Node ? target : null;
      const pastedInsideRefs = Boolean(section && targetNode && section.contains(targetNode));
      const active = document.activeElement;
      const pastedWithoutFocusedField =
        active === document.body || active == null || active === document.documentElement;
      if (!pastedInsideRefs && !pastedWithoutFocusedField) return;

      e.preventDefault();
      void uploadDirectorClipboardImage(file);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [canEditDirectorRefs, uploadDirectorClipboardImage]);

  // --- Actor image references ---
  const actorImages = useMemo(() => draft?.referenceImages ?? [], [draft?.referenceImages]);
  const [actorUploading, setActorUploading] = useState(false);
  const [actorLightboxIdx, setActorLightboxIdx] = useState<number | null>(null);
  const actorFileInputRef = useRef<HTMLInputElement | null>(null);
  const [remoteProjectId, setRemoteProjectId] = useState<string | null>(null);

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

  const uploadActorImages = useCallback(
    async (files: File[] | FileList | null) => {
      if (!canEdit) return;
      if (!files || files.length === 0) return;
      if (!accessToken || !projectSlug) return;
      const selected = Array.from(files).slice(0, 20);
      if (selected.length === 0) return;
      const projectId = await ensureRemoteProject(accessToken);
      if (!projectId) return;
      setActorUploading(true);
      try {
        const uploaded: Array<{ key: string; url?: string }> = [];
        for (const f of selected) {
          const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file: f });
          if (key) {
            if (url) urlCacheRef.current.set(key, url);
            uploaded.push({ key, url });
          }
        }
        if (uploaded.length > 0) {
          setUrlTick((x) => x + 1);
          dispatch(roleWorkbookActions.addActorRefImages({ images: uploaded as any }));
          markActorDraftDirty();
          // Persist immediately so refs don't disappear after refresh.
          if (effectiveRoleId) {
            await dispatch(
              saveRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }),
            );
          }
        }
      } finally {
        setActorUploading(false);
      }
    },
    [accessToken, canEdit, dispatch, ensureRemoteProject, markActorDraftDirty, projectSlug, effectiveRoleId],
  );

  const canAddReferenceImages = Boolean(canEdit || canEditDirectorRefs);
  const referenceUploading = Boolean(actorUploading || uploading);

  const referenceAuthorLabel = canEdit
    ? `актёра ${actorLabel(s.profilesByEmail?.[selectedActor] ?? null, selectedActor)}`
    : "режиссёра";

  const combinedReferenceImages = useMemo(() => {
    const actorName = actorLabel(s.profilesByEmail?.[selectedActor] ?? null, selectedActor);
    return [
      ...actorImages.map((img, idx) => ({
        source: "actor" as const,
        sourceLabel: `от актёра ${actorName}`,
        img,
        idx,
      })),
      ...directorImages.map((img, idx) => ({
        source: "director" as const,
        sourceLabel: "от режиссёра",
        img,
        idx,
      })),
    ];
  }, [actorImages, directorImages, s.profilesByEmail, selectedActor]);

  const referenceColumns = useMemo(() => {
    return distributeIntoColumns(
      combinedReferenceImages,
      referenceColumnCount(combinedReferenceImages.length),
    );
  }, [combinedReferenceImages]);

  const onActorRefsPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!canEdit) return;
      e.stopPropagation();
      const cd = e.clipboardData;
      if (!cd) return;
      const items = Array.from(cd.items ?? []);
      const imageItem = items.find((it) => String(it.type ?? "").startsWith("image/")) ?? null;
      if (!imageItem) return;
      e.preventDefault();
      if (!accessToken || !projectSlug) return;
      const projectId = await ensureRemoteProject(accessToken);
      if (!projectId) return;
      setActorUploading(true);
      try {
        const file = imageItem.getAsFile();
        if (!file) return;
        const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file });
        if (!key) return;
        if (url) {
          urlCacheRef.current.set(key, url);
          setUrlTick((x) => x + 1);
        }
        {
          dispatch(roleWorkbookActions.addActorRefImages({ images: [{ key, url }] as any }));
          markActorDraftDirty();
          // Persist immediately so refs don't disappear after refresh.
          if (effectiveRoleId) {
            await dispatch(
              saveRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }),
            );
          }
        }
      } finally {
        setActorUploading(false);
      }
    },
    [accessToken, canEdit, dispatch, ensureRemoteProject, markActorDraftDirty, projectSlug, effectiveRoleId],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = actorImages.slice(0, 200);
      for (const img of list) {
        if (cancelled) return;
        if (!img?.key) continue;
        if (!urlCacheRef.current.get(img.key)) await ensureImageUrl(img.key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [actorImages, ensureImageUrl]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Preload all (bounded) so the gallery is fully visible.
      const list = directorImages.slice(0, 200);
      for (const img of list) {
        if (cancelled) return;
        if (!img?.key) continue;
        if (!urlCacheRef.current.get(img.key)) await ensureImageUrl(img.key);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [directorImages, ensureImageUrl]);

  const uploadDirectorImages = useCallback(async (files: File[] | FileList | null) => {
    const selected = Array.from(files ?? [])
      .filter((file) => String(file?.type ?? "").startsWith("image/"))
      .slice(0, 20);
    if (selected.length === 0) return;
    if (!accessToken || !projectSlug) return;
    if (!effectiveRoleId) return;
    const projectId = await ensureRemoteProject(accessToken);
    if (!projectId) return;
    setUploading(true);
    try {
      const uploaded: Array<{ key: string; url?: string }> = [];
      for (const f of selected) {
        const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file: f });
        if (key) {
          if (url) urlCacheRef.current.set(key, url);
          uploaded.push({ key, url });
        }
      }
      if (uploaded.length > 0) {
        setUrlTick((x) => x + 1);
        dispatch(roleWorkbookActions.addDirectorRefImages({ images: uploaded as any }));
        markDirectorRefsDirty();
        await saveDirectorRefsNow();
      }
    } finally {
      setUploading(false);
    }
  }, [accessToken, dispatch, ensureRemoteProject, markDirectorRefsDirty, projectSlug, saveDirectorRefsNow]);

  const onDropDirectorImages = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      await uploadDirectorImages(files);
    },
    [uploadDirectorImages],
  );

  const uploadReferenceImages = useCallback(
    async (files: File[] | FileList | null) => {
      if (canEdit) {
        await uploadActorImages(files);
        return;
      }
      if (canEditDirectorRefs) {
        await uploadDirectorImages(files);
      }
    },
    [canEdit, canEditDirectorRefs, uploadActorImages, uploadDirectorImages],
  );

  const onReferenceRefsPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!canAddReferenceImages) return;
      const file = clipboardImageFile(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      e.stopPropagation();
      await uploadReferenceImages([file]);
    },
    [canAddReferenceImages, uploadReferenceImages],
  );

  useEffect(() => {
    if (lightboxIdx == null) return;
    const img = directorImages[lightboxIdx];
    if (!img?.key) return;
    if (!urlCacheRef.current.get(img.key)) void ensureImageUrl(img.key);
  }, [directorImages, ensureImageUrl, lightboxIdx]);

  useEffect(() => {
    if (actorLightboxIdx == null) return;
    const img = actorImages[actorLightboxIdx];
    if (!img?.key) return;
    if (!urlCacheRef.current.get(img.key)) void ensureImageUrl(img.key);
  }, [actorImages, actorLightboxIdx, ensureImageUrl]);

  if (!accessToken) return <div>Нужно войти, чтобы открыть страницу роли.</div>;
  if (!projectSlug) return <div>Не выбран проект.</div>;
  if (!effectiveRoleId) return <div>Роль не указана.</div>;

  return (
    <div className="app-layout rolewb-layout">
      <div className="app-content">
        <main className="main-content">
          <div
            className="rolewb-view"
            onBlurCapture={() => {
              void saveActorDraftNow();
              void saveDirectorRefsNow();
            }}
          >
            <div className="rolewb-header">
              <div>
                <h2 className="rolewb-header__title">
                  {isActorWorkbookOpen ? "Актёрская тетрадь" : "Рисунок роли"}
                </h2>
                <p className="rolewb-subtitle">
                  Проект: <b>{projectSlug}</b> · Роль:{" "}
                  <b>{s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId}</b>
                  {isActorWorkbookOpen ? (
                    <>
                      {" · "}
                      Актёр:{" "}
                      <b>
                        {actorLabel(s.profilesByEmail?.[selectedActor] ?? null, selectedActor || "—")}
                      </b>
                      {!canEdit ? <> · только просмотр</> : null}
                    </>
                  ) : null}
                </p>
              </div>
              <div className="rolewb-row">
                {isActorWorkbookOpen ? (
                  <Button className="secondary" type="button" onClick={closeActorWorkbook}>
                    ← Назад к роли
                  </Button>
                ) : null}
                {isActorWorkbookOpen && activeWorkbookSection ? (
                  <Button className="secondary" type="button" onClick={closeWorkbookSection}>
                    ← К разделам
                  </Button>
                ) : null}
                <Button className="secondary" type="button" onClick={() => navigate("/profile")}>
                  Профиль
                </Button>
              </div>
            </div>

            <div className="rolewb-grid">
              {!isActorWorkbookOpen ? (
                <div className="rolewb-card rolewb-card--compact rolewb-view-card">
                  <div className="rolewb-overview">
                    {s.roleInfo ? (
                      <div className="rolewb-overview-portrait" aria-label="Карточка роли">
                        {canEditRoleAvatar && accessToken && remoteProjectId ? (
                          <RoleAvatarEditor
                            accessToken={accessToken}
                            projectId={remoteProjectId}
                            role={s.roleInfo}
                            canEdit
                            busy={updatingRoleAvatar}
                            onSaveAvatarKey={saveRoleAvatarKey}
                          />
                        ) : (
                          <RolePlayingCard role={s.roleInfo} accessToken={accessToken} size="lg" />
                        )}
                      </div>
                    ) : null}
                    <div className="rolewb-overview-body">
                      <div className="rolewb-view-head">
                        <div>
                          <div className="rolewb-card-title">{roleLabel || "Просмотр"}</div>
                          <div className="rolewb-hint">
                            Выберите актёра, чтобы открыть его тетрадку рисунка роли.
                            {canEditRoleAvatar ? " Портрет роли меняет режиссёр." : ""}
                          </div>
                        </div>
                      </div>

                      {!canViewActorWorkbook ? (
                        <div className="rolewb-hint">
                          Актёрская тетрадка недоступна: вы не назначены на эту роль.
                        </div>
                      ) : null}

                      {canViewActorWorkbook && visibleActorTiles.length > 0 ? (
                        <div className="rolewb-actor-quick-view">
                          <div className="rolewb-hint" style={{ marginTop: 0 }}>
                            Актёры:
                          </div>
                          <div className="rolewb-actor-avatar-list">
                            {visibleActorTiles.map((em) => {
                              const profile = s.profilesByEmail?.[em] ?? null;
                              const updatedAtIso = snapshotsByActorEmail.get(em) ?? null;
                              const label = actorLabel(profile, em);
                              const title = updatedAtIso
                                ? `${label}\nСохранено: ${new Date(updatedAtIso).toLocaleString("ru-RU")}`
                                : `${label}\nНет сохранений`;
                              return (
                                <button
                                  key={`actor-snap-${em}`}
                                  type="button"
                                  className={`rolewb-actor-avatar-btn${updatedAtIso ? " has-save" : ""}`}
                                  onClick={() => openActorWorkbook(em)}
                                  title={title}
                                  aria-label={`Открыть тетрадку актёра: ${label}`}
                                >
                                  <MiniAvatar
                                    src={String(profile?.avatarUrl ?? "").trim() || null}
                                    label={label}
                                    size={52}
                                    title={title}
                                  />
                                  <span className="rolewb-actor-avatar-status" aria-hidden="true" />
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {s.error ? <div className="settings-invite-error">{s.error}</div> : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {isActorWorkbookOpen && canViewActorWorkbook ? (
                <>
                  {!activeWorkbookSection ? (
                  <div className="rolewb-card rolewb-intro">
                    <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                      <div className="rolewb-card-title">Актёрская тетрадь · рисунок роли</div>
                    </div>
                    <div className="rolewb-hint">
                      Выберите раздел тетрадки. Всё открывается здесь же, без перехода на отдельные страницы.
                    </div>
                      <div className="rolewb-section-grid" aria-label="Разделы рисунка роли">
                        {WORKBOOK_SECTIONS.map((item) => (
                          <button
                            key={item.id}
                            type="button"
                            className="rolewb-section-tile"
                            onClick={() => setActiveWorkbookSection(item.id)}
                          >
                            <span className="rolewb-section-tile__title">{item.title}</span>
                            <span className="rolewb-section-tile__hint">{item.hint}</span>
                          </button>
                        ))}
                      </div>
                    <div className="rolewb-row rolewb-view-actions">
                      <div className="rolewb-hint">
                        {s.saving ? (
                          <>Автосохранение…</>
                        ) : s.snapshot?.note?.updatedAt ? (
                          <>
                            Последняя версия: <b>{new Date(s.snapshot.note.updatedAt).toLocaleString("ru-RU")}</b>
                          </>
                        ) : (
                          <>Пока нет сохранённой версии для выбранного актёра.</>
                        )}
                      </div>
                      {s.lastSavedAtIso ? (
                        <div style={{ fontSize: 12, color: "var(--color-status-success-bright)" }}>
                          Сохранено: {new Date(s.lastSavedAtIso).toLocaleString("ru-RU")}
                        </div>
                      ) : null}
                    </div>
                    {s.error ? <div className="settings-invite-error">{s.error}</div> : null}
                  </div>
                  ) : null}

                  <div hidden={activeWorkbookSection !== "givenCircumstances"}>
                    <WorkbookTextSection
                      sectionNum={1}
                      title="Данные обстоятельства"
                      hint="Время, место, эпоха, социальная среда пьесы. Что задано автором и что важно для героя в этих условиях."
                      fieldKey="givenCircumstances"
                      rows={4}
                      placeholder="Где и когда происходит действие? Какая атмосфера, правила мира, что влияет на поведение персонажа?"
                      value={String(draft?.givenCircumstances ?? "")}
                      canEdit={canEdit}
                      onFieldChange={onDraftFieldChange}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "biography"}>
                    <WorkbookTextSection
                      sectionNum={2}
                      title="Биография и внерамочная жизнь"
                      hint="Прошлое героя до начала пьесы и то, что происходит «за кадром»: травмы, опыт, привычки, что сформировало характер."
                      fieldKey="biography"
                      rows={6}
                      placeholder="Детство, ключевые события, семья, образование, тайны, что персонаж помнит и чего избегает…"
                      value={String(draft?.biography ?? "")}
                      canEdit={canEdit}
                      onFieldChange={onDraftFieldChange}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "socialPortrait"}>
                    <WorkbookTextSection
                      sectionNum={3}
                      title="Социальный портрет"
                      hint="Возраст, профессия, класс, статус, манера речи, привычки, что выдаёт социальное положение."
                      fieldKey="socialPortrait"
                      rows={4}
                      placeholder="Кто он в обществе? Как говорит, одет, двигается? Что отличает его от других?"
                      value={String(draft?.socialPortrait ?? "")}
                      canEdit={canEdit}
                      onFieldChange={onDraftFieldChange}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "relationships"}>
                    <WorkbookRelationshipsSection
                      sectionNum={4}
                      currentRoleId={effectiveRoleId}
                      projectRoles={projectRoles}
                      entries={draft?.relationshipEntries ?? []}
                      legacyNotes={String(draft?.relationships ?? "")}
                      accessToken={accessToken}
                      canEdit={canEdit}
                      onChangeEntries={(next) => {
                        dispatch(roleWorkbookActions.setDraftRelationshipEntries({ value: next }));
                        markActorDraftDirty();
                      }}
                      onChangeLegacyNotes={(value) =>
                        onDraftFieldChange("relationships", value)
                      }
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "inbound"}>
                    <WorkbookInboundMentionsSection
                      mentions={s.inboundMentions ?? []}
                      profilesByEmail={s.profilesByEmail}
                      accessToken={accessToken}
                      targetRoleTitle={roleLabel}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "superObjective"}>
                    <WorkbookTextSection
                      sectionNum={5}
                      title="Сверхзадача и сквозное действие"
                      hint={
                        <>
                          Главная цель героя на всю пьесу. Формулируй через действие: добиться, удержать, защитить, сломать —
                          не через абстрактное чувство.
                        </>
                      }
                      fieldKey="superObjective"
                      rows={3}
                      placeholder="Чего персонаж хочет больше всего на протяжении всей истории?"
                      value={String(draft?.superObjective ?? "")}
                      canEdit={canEdit}
                      onFieldChange={onDraftFieldChange}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "obstacles"}>
                    <WorkbookTextSection
                      sectionNum={6}
                      title="Препятствия"
                      hint="Что мешает достичь сверхзадачи: внешние силы, другие персонажи, внутренние барьеры, обстоятельства."
                      fieldKey="obstacles"
                      rows={4}
                      placeholder="Кто или что стоит на пути? В чём главное противодействие?"
                      value={String(draft?.obstacles ?? "")}
                      canEdit={canEdit}
                      onFieldChange={onDraftFieldChange}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "eventSeries"}>
                    <WorkbookTextSection
                      sectionNum={7}
                      title="Событийный ряд"
                      hint="Ключевые события жизни героя в пьесе по порядку — линия развития от начала к финалу (до разбора по сценам)."
                      fieldKey="eventSeries"
                      rows={5}
                      placeholder="1) … 2) … 3) … — как меняется положение и самоощущение героя?"
                      value={String(draft?.eventSeries ?? "")}
                      canEdit={canEdit}
                      onFieldChange={onDraftFieldChange}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "transformation"}>
                    <WorkbookTransformationSection
                      sectionNum={8}
                      start={String(draft?.transformationStart ?? "")}
                      end={String(draft?.transformationEnd ?? "")}
                      turningPoint={String(draft?.transformationTurningPoint ?? "")}
                      canEdit={canEdit}
                      onChangeStart={(v) => onDraftFieldChange("transformationStart", v)}
                      onChangeEnd={(v) => onDraftFieldChange("transformationEnd", v)}
                      onChangeTurningPoint={(v) => onDraftFieldChange("transformationTurningPoint", v)}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "appearance"}>
                    <WorkbookTextSection
                      sectionNum={9}
                      title="Внешность и пластика"
                      hint="Внутренний и внешний облик: осанка, жесты, походка, темп, голос, что заметно при первом взгляде."
                      fieldKey="appearance"
                      rows={4}
                      placeholder="Осанка, жесты, походка, темп/ритм, голос, что заметно при первом взгляде…"
                      value={String(draft?.appearance ?? "")}
                      canEdit={canEdit}
                      onFieldChange={onDraftFieldChange}
                    />
                  </div>

                  <div
                    className="rolewb-actor-reference-panel"
                    hidden={activeWorkbookSection !== "referenceImages"}
                  >
                    <div
                      ref={directorRefsSectionRef}
                      className="rolewb-card rolewb-section"
                      id="rolewb-section-referenceImages"
                    >
                      <div className="rolewb-section-head">
                        <span className="rolewb-section-num">10</span>
                        <div className="rolewb-card-title">Референсы</div>
                      </div>
                      <div className="rolewb-hint">
                        Общая доска картинок для роли: актёрские наблюдения, фактуры, костюм, пластика и настроение.
                        Добавлять может актёр своей тетрадки и режиссёр; у каждой картинки будет виден автор.
                      </div>
                      {canAddReferenceImages ? (
                        <div className="rolewb-hint">Новые картинки будут помечены как добавленные от {referenceAuthorLabel}.</div>
                      ) : null}
                      <input
                        ref={actorFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          void uploadActorImages(files);
                          e.currentTarget.value = "";
                        }}
                      />
                      <input
                        ref={directorFileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        hidden
                        onChange={(e) => {
                          const files = Array.from(e.target.files ?? []);
                          void uploadDirectorImages(files);
                          e.currentTarget.value = "";
                        }}
                      />
                      <div
                        className="rolewb-dropzone"
                        tabIndex={0}
                        onPaste={onReferenceRefsPaste}
                        onDragOver={(e) => {
                          if (!canAddReferenceImages) return;
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          if (!canAddReferenceImages) return;
                          e.preventDefault();
                          const files = imageFilesFromTransfer(e.dataTransfer);
                          void uploadReferenceImages(files);
                        }}
                        onClick={(e) => {
                          try {
                            (e.currentTarget as HTMLDivElement).focus();
                          } catch {}
                          if (!canAddReferenceImages) return;
                          if (canEdit) actorFileInputRef.current?.click();
                          else directorFileInputRef.current?.click();
                        }}
                        style={{ marginTop: 6 }}
                        title="Кликни сюда и нажми Ctrl+V, либо перетащи файлы"
                      >
                        {referenceUploading
                          ? "Загрузка…"
                          : canAddReferenceImages
                            ? "Кликни сюда, вставь картинку (Ctrl+V) или перетащи файлы сюда."
                            : "Только просмотр."}
                      </div>

                      {s.directorRefsError ? <div className="settings-invite-error">{s.directorRefsError}</div> : null}
                      {combinedReferenceImages.length === 0 ? (
                        <div className="rolewb-hint">Пока нет картинок.</div>
                      ) : (
                        <div
                          className={
                            combinedReferenceImages.length <= 4
                              ? "rolewb-gallery rolewb-reference-gallery rolewb-reference-gallery_row"
                              : "rolewb-reference-columns"
                          }
                          style={
                            combinedReferenceImages.length > 4
                              ? ({ "--rolewb-ref-cols": referenceColumns.length } as CSSProperties)
                              : { marginTop: 8 }
                          }
                        >
                          {combinedReferenceImages.length <= 4
                            ? combinedReferenceImages.map((item) => {
                                const { img } = item;
                                const url = urlCacheRef.current.get(img.key) || String(img.url ?? "");
                                const canEditThisImage =
                                  item.source === "actor" ? canEdit : canEditDirectorRefs;
                                return (
                                  <div key={`${item.source}-${img.key}`} className="rolewb-img-tile">
                                    <div className="rolewb-img-source">{item.sourceLabel}</div>
                                    {url ? (
                                      <img
                                        className="rolewb-img"
                                        src={url}
                                        alt={img.caption || "reference"}
                                        onClick={() =>
                                          item.source === "actor"
                                            ? setActorLightboxIdx(item.idx)
                                            : setLightboxIdx(item.idx)
                                        }
                                        onError={() => {
                                          urlCacheRef.current.delete(img.key);
                                          void ensureImageUrl(img.key);
                                        }}
                                      />
                                    ) : (
                                      <div
                                        style={{
                                          height: 140,
                                          display: "grid",
                                          placeItems: "center",
                                          fontSize: 12,
                                          opacity: 0.7,
                                        }}
                                        onClick={() => {
                                          void ensureImageUrl(img.key);
                                          if (item.source === "actor") setActorLightboxIdx(item.idx);
                                          else setLightboxIdx(item.idx);
                                        }}
                                      >
                                        загрузка…
                                      </div>
                                    )}
                                    {canEditThisImage ? (
                                      <Button
                                        className="danger rolewb-img-delete"
                                        type="button"
                                        onClick={() => {
                                          if (item.source === "actor") {
                                            dispatch(roleWorkbookActions.removeActorRefImage({ key: img.key }));
                                            markActorDraftDirty();
                                            return;
                                          }
                                          dispatch(roleWorkbookActions.removeDirectorRefImage({ key: img.key }));
                                          markDirectorRefsDirty();
                                        }}
                                        aria-label="Удалить референс"
                                        title="Удалить"
                                      >
                                        Удалить
                                      </Button>
                                    ) : null}
                                  </div>
                                );
                              })
                            : referenceColumns.map((column, columnIdx) => (
                                <div key={`ref-col-${columnIdx}`} className="rolewb-reference-column">
                                  {column.map((item) => {
                                    const { img } = item;
                                    const url = urlCacheRef.current.get(img.key) || String(img.url ?? "");
                                    const canEditThisImage =
                                      item.source === "actor" ? canEdit : canEditDirectorRefs;
                                    return (
                                      <div key={`${item.source}-${img.key}`} className="rolewb-img-tile">
                                        <div className="rolewb-img-source">{item.sourceLabel}</div>
                                        {url ? (
                                          <img
                                            className="rolewb-img"
                                            src={url}
                                            alt={img.caption || "reference"}
                                            onClick={() =>
                                              item.source === "actor"
                                                ? setActorLightboxIdx(item.idx)
                                                : setLightboxIdx(item.idx)
                                            }
                                            onError={() => {
                                              urlCacheRef.current.delete(img.key);
                                              void ensureImageUrl(img.key);
                                            }}
                                          />
                                        ) : (
                                          <div
                                            style={{
                                              height: 140,
                                              display: "grid",
                                              placeItems: "center",
                                              fontSize: 12,
                                              opacity: 0.7,
                                            }}
                                            onClick={() => {
                                              void ensureImageUrl(img.key);
                                              if (item.source === "actor") setActorLightboxIdx(item.idx);
                                              else setLightboxIdx(item.idx);
                                            }}
                                          >
                                            загрузка…
                                          </div>
                                        )}
                                        {canEditThisImage ? (
                                          <Button
                                            className="danger rolewb-img-delete"
                                            type="button"
                                            onClick={() => {
                                              if (item.source === "actor") {
                                                dispatch(roleWorkbookActions.removeActorRefImage({ key: img.key }));
                                                markActorDraftDirty();
                                                return;
                                              }
                                              dispatch(roleWorkbookActions.removeDirectorRefImage({ key: img.key }));
                                              markDirectorRefsDirty();
                                            }}
                                            aria-label="Удалить референс"
                                            title="Удалить"
                                          >
                                            Удалить
                                          </Button>
                                        ) : null}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                        </div>
                      )}
                    </div>

                    {actorLightboxIdx != null && actorImages[actorLightboxIdx] ? (
                      <div
                        className="rolewb-lightbox"
                        role="dialog"
                        aria-modal="true"
                        onClick={() => setActorLightboxIdx(null)}
                      >
                        <div className="rolewb-lightbox-inner" onClick={(e) => e.stopPropagation()}>
                          <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>
                              {actorImages[actorLightboxIdx]?.caption || `Кадр ${actorLightboxIdx + 1}`}
                            </div>
                            <Button className="secondary" type="button" onClick={() => setActorLightboxIdx(null)}>
                              Закрыть
                            </Button>
                          </div>

                      <img
                        className="rolewb-lightbox-img"
                        src={
                          urlCacheRef.current.get(actorImages[actorLightboxIdx]!.key) ||
                          String(actorImages[actorLightboxIdx]?.url ?? "")
                        }
                        alt={actorImages[actorLightboxIdx]?.caption || "reference"}
                        onError={() => {
                          const k = actorImages[actorLightboxIdx]!.key;
                          urlCacheRef.current.delete(k);
                          void ensureImageUrl(k);
                        }}
                      />

                      <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                        <Button
                          className="secondary"
                          type="button"
                          onClick={() =>
                            setActorLightboxIdx((i) => (i == null ? null : (i - 1 + actorImages.length) % actorImages.length))
                          }
                        >
                          ←
                        </Button>
                        <div style={{ fontSize: 12, opacity: 0.75 }}>
                          {actorLightboxIdx + 1} / {actorImages.length}
                        </div>
                        <Button
                          className="secondary"
                          type="button"
                          onClick={() =>
                            setActorLightboxIdx((i) => (i == null ? null : (i + 1) % actorImages.length))
                          }
                        >
                          →
                        </Button>
                      </div>
                        </div>
                      </div>
                    ) : null}
                    {lightboxIdx != null && directorImages[lightboxIdx] ? (
                      <div
                        className="rolewb-lightbox"
                        role="dialog"
                        aria-modal="true"
                        onClick={() => setLightboxIdx(null)}
                      >
                        <div className="rolewb-lightbox-inner" onClick={(e) => e.stopPropagation()}>
                          <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                            <div style={{ fontSize: 12, opacity: 0.85 }}>
                              {directorImages[lightboxIdx]?.caption || `Кадр ${lightboxIdx + 1}`}
                            </div>
                            <Button className="secondary" type="button" onClick={() => setLightboxIdx(null)}>
                              Закрыть
                            </Button>
                          </div>

                          <img
                            className="rolewb-lightbox-img"
                            src={
                              urlCacheRef.current.get(directorImages[lightboxIdx]!.key) ||
                              String(directorImages[lightboxIdx]?.url ?? "")
                            }
                            alt={directorImages[lightboxIdx]?.caption || "reference"}
                            onError={() => {
                              const k = directorImages[lightboxIdx]!.key;
                              urlCacheRef.current.delete(k);
                              void ensureImageUrl(k);
                            }}
                          />

                          <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                            <Button
                              className="secondary"
                              type="button"
                              onClick={() =>
                                setLightboxIdx((i) =>
                                  i == null ? null : (i - 1 + directorImages.length) % directorImages.length,
                                )
                              }
                            >
                              ←
                            </Button>
                            <div style={{ fontSize: 12, opacity: 0.75 }}>
                              {lightboxIdx + 1} / {directorImages.length}
                            </div>
                            <Button
                              className="secondary"
                              type="button"
                              onClick={() =>
                                setLightboxIdx((i) => (i == null ? null : (i + 1) % directorImages.length))
                              }
                            >
                              →
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : null}
                    {urlTick ? null : null}
                  </div>



                  <div hidden={activeWorkbookSection !== "sceneArcs"}>
                    <div className="rolewb-card rolewb-section" id="rolewb-section-sceneArcs">
                      <div className="rolewb-section-head">
                        <span className="rolewb-section-num">11</span>
                        <div className="rolewb-card-title">Арка по сценам (что меняется)</div>
                      </div>
                      <div className="rolewb-hint">
                        Для каждой сцены опиши, что происходит с персонажем: чего хочет, что делает, что получает, в чём
                        поворот.
                      </div>
                      <div className="rolewb-hint" style={{ marginTop: 6 }}>
                        Список сцен формируется автоматически из сценария: берём только те шаги, где роль{" "}
                        <b>{s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId}</b> встречается в “Тексте” (формат{" "}
                        <code>РОЛЬ: ...</code> или <code>[[РОЛЬ]] ...</code>). Найдено сцен:{" "}
                        <b>{Array.isArray(desiredSceneArcs) ? desiredSceneArcs.length : 0}</b>
                      </div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {sceneArcsForView.length === 0 ? (
                          <div className="rolewb-hint">
                            Пока нет сцен с этой ролью в тексте сценария.
                          </div>
                        ) : null}
                        {sceneArcsForView.map((a, idx) => (
                          <div key={`arc-${idx}`} className="rolewb-scene-block">
                            <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                              <div style={{ fontSize: 12, opacity: 0.8 }}>
                                {a.stepTitle ? (
                                  <>
                                    <b>{a.stepTitle}</b>{" "}
                                    {a.stepId ? <span style={{ opacity: 0.75 }}>· #{a.stepId}</span> : null}
                                  </>
                                ) : (
                                  <b>Сцена #{idx + 1}</b>
                                )}
                              </div>
                            </div>
                            <textarea
                              className="settings-invite-input"
                              rows={3}
                              value={String(a.text ?? "")}
                              disabled={!canEdit}
                              onChange={(e) => {
                                if (!canEdit) return;
                                const next: RoleSceneArc[] = sceneArcsForView.map((item) => ({ ...item }));
                                next[idx] = { ...(next[idx] as RoleSceneArc), text: e.target.value };
                                dispatch(roleWorkbookActions.setDraftSceneArcs({ value: next }));
                                markActorDraftDirty();
                              }}
                              style={{ maxWidth: "unset", width: "100%" }}
                              placeholder="Что происходит с персонажем в этой сцене? В чём поворот?"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div hidden={activeWorkbookSection !== "directorQuestions"}>
                    <WorkbookDirectorQuestionsSection
                      sectionNum={12}
                      questions={draft?.directorQuestions ?? []}
                      sceneOptions={sceneOptionsForQuestions}
                      canEdit={canEdit}
                      isDirectorView={Boolean(s.isProjectOwner && !canEdit)}
                      onChangeQuestions={(next) => {
                        dispatch(roleWorkbookActions.setDraftDirectorQuestions({ value: next }));
                        markActorDraftDirty();
                      }}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "rehearsalChecklist"}>
                    <WorkbookRehearsalChecklistSection
                      sectionNum={13}
                      done={String(draft?.rehearsalDone ?? "")}
                      todo={String(draft?.rehearsalTodo ?? "")}
                      nextStep={String(draft?.rehearsalNextStep ?? "")}
                      canEdit={canEdit}
                      onChangeDone={(v) => onDraftFieldChange("rehearsalDone", v)}
                      onChangeTodo={(v) => onDraftFieldChange("rehearsalTodo", v)}
                      onChangeNextStep={(v) => onDraftFieldChange("rehearsalNextStep", v)}
                    />
                  </div>

                  <div hidden={activeWorkbookSection !== "preparation"}>
                    <WorkbookTextSection
                      sectionNum={14}
                      title="Подготовка к роли"
                      hint="План работы: дневник персонажа, наблюдения, физические привычки, голос, репетиционные задания."
                      fieldKey="preparation"
                      rows={5}
                      placeholder="Что изучить, что попробовать, какие упражнения и задания себе дать до выхода на сцену?"
                      value={String(draft?.preparation ?? "")}
                      canEdit={canEdit}
                      onFieldChange={onDraftFieldChange}
                    />
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

