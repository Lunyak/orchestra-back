import cn from "classnames";
import { Button } from "@shared/core/button/Button";
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { projectPath } from "../../app/router/paths";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import {
  useDeleteProjectRoleMutation,
  useProjectRolesQuery,
  useUpdateProjectRoleMutation,
} from "../../features/project/api/project-api";
import { RoleAvatarEditor } from "../../features/role-card/RoleAvatarEditor";
import { RolePlayingCard } from "../../features/role-card/RolePlayingCard";
import { WorkbookDirectorQuestionsSection } from "../../features/role-workbook/ui/WorkbookDirectorQuestionsSection";
import { WorkbookInboundMentionsSection } from "../../features/role-workbook/ui/WorkbookInboundMentionsSection";
import { WorkbookRehearsalChecklistSection } from "../../features/role-workbook/ui/WorkbookRehearsalChecklistSection";
import { WorkbookRelationshipsSection } from "../../features/role-workbook/ui/WorkbookRelationshipsSection";
import { WorkbookTransformationSection } from "../../features/role-workbook/ui/WorkbookTransformationSection";
import { WorkbookTextSection, type WorkbookTextFieldKey } from "../../features/role-workbook/ui/WorkbookTextSection";
import { usePlaybook } from "../../features/playbook";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import {
  roleWorkbookActions,
  selectRoleWorkbook,
  loadRoleWorkbookThunk,
} from "../../features/role-workbook/model/roleWorkbookSlice";
import {
  actorLabel,
  pickLatestWorkbookSnapshotForActor,
  type RoleSceneArc,
} from "../../features/role-workbook/model/roleWorkbookNote";
import { extractRolePhrasesFromScenes } from "../../features/actor-trainers/model/rolePhrases";
import { MiniAvatar } from "../../shared/components/mini-avatar/MiniAvatar";
import {
  WORKBOOK_SECTIONS,
  type WorkbookSectionId,
} from "../../features/role-workbook/model/role-workbook-sections";
import { normalizeWorkbookEmail } from "../../features/role-workbook/model/role-workbook-utils";
import { useRoleWorkbookAutosave } from "../../features/role-workbook/model/useRoleWorkbookAutosave";
import { useRoleWorkbookReferenceImages } from "../../features/role-workbook/model/useRoleWorkbookReferenceImages";
import "./style.css";

export function RoleWorkbookPage() {
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

  const selectedActor = normalizeWorkbookEmail(s.selectedActorEmail);
  const myEmail = normalizeWorkbookEmail(s.myEmail);
  const canEdit = Boolean(myEmail && selectedActor && myEmail === selectedActor);
  const canEditDirectorRefs = Boolean(s.isProjectOwner);
  const canViewActorWorkbook = Boolean((s as any).canViewActorWorkbook);

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
      .filter((scene) => scene && Number.isFinite(Number((scene as any).id)) && roleSceneIdSet.has(Number((scene as any).id)))
      .map((scene) => {
        const id = Number((scene as any).id);
        const prev = bySceneId.get(id);
        return {
          sceneId: id,
          sceneTitle: String((scene as any).title ?? "").trim() || undefined,
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
    return (desiredSceneArcs ?? []).map((a) => ({
      ...a,
      text:
        a.sceneId != null && sceneArcTextBySceneId.has(Number(a.sceneId))
          ? String(sceneArcTextBySceneId.get(Number(a.sceneId)) ?? "")
          : String(a.text ?? ""),
    }));
  }, [desiredSceneArcs, sceneArcTextBySceneId]);

  const sceneOptionsForQuestions = useMemo(() => {
    return (sceneArcsForView ?? [])
      .filter((a) => a.sceneId != null)
      .map((a) => ({ sceneId: a.sceneId, sceneTitle: a.sceneTitle }));
  }, [sceneArcsForView]);

  const desiredSceneArcsSignature = useMemo(() => {
    return (desiredSceneArcs ?? [])
      .map((a) => `${String((a as any)?.sceneId ?? "")}:${String((a as any)?.sceneTitle ?? "")}`)
      .join("|");
  }, [desiredSceneArcs]);

  const sceneArcsSignature = useMemo(() => {
    return (sceneArcs ?? [])
      .map((a) => `${String((a as any)?.sceneId ?? "")}:${String((a as any)?.sceneTitle ?? "")}`)
      .join("|");
  }, [sceneArcs]);

  useEffect(() => {
    if (!canEdit) return;
    // Автосписок сцен: только те сцены, где роль присутствует в "Тексте" (playMarkdown).
    // Важно: подписи/тексты арок сохраняем по sceneId.
    if (!Array.isArray(scenes) || scenes.length === 0) return;
    if (desiredSceneArcsSignature === sceneArcsSignature) return;
    dispatch(roleWorkbookActions.setDraftSceneArcs({ value: desiredSceneArcs as any }));
  }, [canEdit, desiredSceneArcs, desiredSceneArcsSignature, dispatch, sceneArcsSignature, scenes]);

  const directorImages = useMemo(() => s.directorRefsDraft?.images ?? [], [s.directorRefsDraft?.images]);
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

  const {
    actorImages,
    actorFileInputRef,
    directorFileInputRef,
    directorRefsSectionRef,
    uploadActorImages,
    uploadDirectorImages,
    uploadReferenceImages,
    onReferenceRefsPaste,
    canAddReferenceImages,
    referenceUploading,
    referenceAuthorLabel,
    combinedReferenceImages,
    referenceColumns,
    directorRefsError,
    urlCacheRef,
    ensureImageUrl,
    lightboxIdx,
    setLightboxIdx,
    actorLightboxIdx,
    setActorLightboxIdx,
    imageFilesFromTransfer,
    urlTick,
  } = useRoleWorkbookReferenceImages({
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
                          <div className="rolewb-hint rolewb-hint--flush">
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
                                  className={cn("rolewb-actor-avatar-btn", updatedAtIso && "rolewb-actor-avatar-btn--has-save")}
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
                      {deleteError ? (
                        <div className="settings-invite-error">{deleteError}</div>
                      ) : null}

                      {canDeleteRole ? (
                        <div className="rolewb-overview-danger">
                          <Button
                            className="danger"
                            type="button"
                            disabled={deletingRole}
                            onClick={() => void deleteRole()}
                          >
                            Удалить роль
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {isActorWorkbookOpen && canViewActorWorkbook ? (
                <>
                  {!activeWorkbookSection ? (
                  <div className="rolewb-card rolewb-intro">
                    <div className="rolewb-row rolewb-row--between">
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
                        <div className="rolewb-saved-status">
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
                        className="rolewb-dropzone rolewb-dropzone--spaced"
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
                        title="Кликни сюда и нажми Ctrl+V, либо перетащи файлы"
                      >
                        {referenceUploading
                          ? "Загрузка…"
                          : canAddReferenceImages
                            ? "Кликни сюда, вставь картинку (Ctrl+V) или перетащи файлы сюда."
                            : "Только просмотр."}
                      </div>

                      {directorRefsError ? <div className="settings-invite-error">{directorRefsError}</div> : null}
                      {combinedReferenceImages.length === 0 ? (
                        <div className="rolewb-hint">Пока нет картинок.</div>
                      ) : (
                        <div
                          className={
                            combinedReferenceImages.length <= 4
                              ? "rolewb-gallery rolewb-reference-gallery rolewb-reference-gallery_row rolewb-reference-gallery--spaced"
                              : "rolewb-reference-columns"
                          }
                          style={
                            combinedReferenceImages.length > 4
                              ? ({ "--rolewb-ref-cols": referenceColumns.length } as CSSProperties)
                              : undefined
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
                                        className="rolewb-img-placeholder"
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
                                            className="rolewb-img-placeholder"
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
                          <div className="rolewb-row rolewb-row--between">
                            <div className="rolewb-meta">
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

                      <div className="rolewb-row rolewb-row--between">
                        <Button
                          className="secondary"
                          type="button"
                          onClick={() =>
                            setActorLightboxIdx((i) => (i == null ? null : (i - 1 + actorImages.length) % actorImages.length))
                          }
                        >
                          ←
                        </Button>
                        <div className="rolewb-meta rolewb-meta--muted">
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
                          <div className="rolewb-row rolewb-row--between">
                            <div className="rolewb-meta">
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

                          <div className="rolewb-row rolewb-row--between">
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
                            <div className="rolewb-meta rolewb-meta--muted">
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
                      <div className="rolewb-hint rolewb-hint--tight">
                        Список сцен формируется автоматически из сценария: берём только те сцены, где роль{" "}
                        <b>{s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId}</b> встречается в “Тексте” (формат{" "}
                        <code>РОЛЬ: ...</code> или <code>[[РОЛЬ]] ...</code>). Найдено сцен:{" "}
                        <b>{Array.isArray(desiredSceneArcs) ? desiredSceneArcs.length : 0}</b>
                      </div>
                      <div className="rolewb-scene-arcs-grid">
                        {sceneArcsForView.length === 0 ? (
                          <div className="rolewb-hint">
                            Пока нет сцен с этой ролью в тексте сценария.
                          </div>
                        ) : null}
                        {sceneArcsForView.map((a, idx) => (
                          <div key={`arc-${idx}`} className="rolewb-scene-block">
                            <div className="rolewb-row rolewb-row--between">
                              <div className="rolewb-meta rolewb-meta--soft">
                                {a.sceneTitle ? (
                                  <>
                                    <b>{a.sceneTitle}</b>{" "}
                                    {a.sceneId ? <span className="rolewb-scene-id">· #{a.sceneId}</span> : null}
                                  </>
                                ) : (
                                  <b>Сцена #{idx + 1}</b>
                                )}
                              </div>
                            </div>
                            <textarea
                              className={cn("settings-invite-input", "rolewb-textarea")}
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
                      rehearsalFocus={String(draft?.rehearsalNextStep ?? "")}
                      canEdit={canEdit}
                      onChangeDone={(v) => onDraftFieldChange("rehearsalDone", v)}
                      onChangeTodo={(v) => onDraftFieldChange("rehearsalTodo", v)}
                      onChangeRehearsalFocus={(v) => onDraftFieldChange("rehearsalNextStep", v)}
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

