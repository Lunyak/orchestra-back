import { Button } from "@shared/core/button/Button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useScene } from "../../features/scene";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import {
  roleWorkbookActions,
  selectRoleWorkbook,
  loadRoleWorkbookThunk,
  saveRoleWorkbookThunk,
  saveDirectorRefsThunk,
  cleanupProjectImagesThunk,
} from "../../features/role-workbook/model/roleWorkbookSlice";
import { actorLabel } from "../../features/role-workbook/model/roleWorkbookNote";
import { extractRolePhrasesFromSteps } from "../../features/actor-trainers/model/rolePhrases";
import { getPlayUrl, uploadProjectFile } from "../../sync/api";
import "./style.css";

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export function RoleWorkbookPage() {
  const { accessToken } = useAuth();
  const { projectName: projectSlug, ensureRemoteProject } = useProject();
  const { roleId } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const s = useAppSelector(selectRoleWorkbook);
  const { steps } = useScene();

  const effectiveRoleId = String(roleId ?? "").trim();

  type ViewStyle = "diary" | "dossier" | "compact";
  const viewStyleStorageKey = useMemo(() => `roleWorkbook:viewStyle`, []);
  const [viewStyle, setViewStyle] = useState<ViewStyle>(() => {
    if (typeof window === "undefined") return "diary";
    try {
      const raw = String(localStorage.getItem(viewStyleStorageKey) ?? "");
      if (raw === "dossier") return "dossier";
      if (raw === "compact") return "compact";
      return "diary";
    } catch {
      return "diary";
    }
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(viewStyleStorageKey, viewStyle);
    } catch {}
  }, [viewStyle, viewStyleStorageKey]);

  const entryDateLabel = useMemo(() => {
    const d = new Date();
    return d.toLocaleString("ru-RU", {
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }, []);

  const caseIdShort = useMemo(() => {
    const id = String(effectiveRoleId ?? "").trim();
    return id ? id.slice(0, 8) : "—";
  }, [effectiveRoleId]);

  useEffect(() => {
    if (!accessToken || !projectSlug || !effectiveRoleId) return;
    dispatch(loadRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
  }, [accessToken, dispatch, effectiveRoleId, projectSlug]);

  const assigned = useMemo(() => {
    return (s.allowedActorEmails ?? []).slice().sort((a, b) => String(a).localeCompare(String(b), "ru"));
  }, [s.allowedActorEmails]);

  const selectedActor = normalizeEmail(s.selectedActorEmail);
  const myEmail = normalizeEmail(s.myEmail);
  const canEdit = Boolean(myEmail && selectedActor && myEmail === selectedActor);
  const canEditDirectorRefs = Boolean(s.isProjectOwner);

  const setSelectedActor = useCallback(
    (email: string) => dispatch(roleWorkbookActions.setSelectedActorEmail({ value: email })),
    [dispatch],
  );

  const draft = s.draft;

  const sceneArcs = useMemo(() => draft?.sceneArcs ?? [], [draft?.sceneArcs]);

  const roleLabel = useMemo(() => {
    return String(s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId ?? "").trim();
  }, [effectiveRoleId, s.roleInfo?.key, s.roleInfo?.title]);

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
    const byStepId = new Map<number, { stepId?: number; stepTitle?: string; text?: string }>();
    for (const a of sceneArcs ?? []) {
      const id = typeof (a as any)?.stepId === "number" ? (a as any).stepId : Number((a as any)?.stepId ?? NaN);
      if (!Number.isFinite(id)) continue;
      byStepId.set(id, a as any);
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

  const onDirectorRefsPaste = useCallback(
    async (e: React.ClipboardEvent<HTMLDivElement>) => {
      if (!canEditDirectorRefs) return;
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

      setUploading(true);
      try {
        const file = imageItem.getAsFile();
        if (!file) return;
        const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file });
        if (!key) return;
        dispatch(roleWorkbookActions.addDirectorRefImages({ images: [{ key, url }] as any }));
        // Auto-save so refs persist after refresh.
        if (effectiveRoleId) {
          await dispatch(saveDirectorRefsThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
        }
      } finally {
        setUploading(false);
      }
    },
    [accessToken, canEditDirectorRefs, dispatch, ensureRemoteProject, projectSlug, effectiveRoleId],
  );

  // --- Actor image references ---
  const actorImages = useMemo(() => draft?.referenceImages ?? [], [draft?.referenceImages]);
  const [actorUploading, setActorUploading] = useState(false);
  const [actorLightboxIdx, setActorLightboxIdx] = useState<number | null>(null);

  const uploadActorImages = useCallback(
    async (files: FileList | null) => {
      if (!canEdit) return;
      if (!files || files.length === 0) return;
      if (!accessToken || !projectSlug) return;
      const projectId = await ensureRemoteProject(accessToken);
      if (!projectId) return;
      setActorUploading(true);
      try {
        const selected = Array.from(files).slice(0, 20);
        const uploaded: Array<{ key: string; url?: string }> = [];
        for (const f of selected) {
          const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file: f });
          if (key) uploaded.push({ key, url });
        }
        if (uploaded.length > 0) {
          dispatch(roleWorkbookActions.addActorRefImages({ images: uploaded as any }));
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
    [accessToken, canEdit, dispatch, ensureRemoteProject, projectSlug, effectiveRoleId],
  );

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
        {
          dispatch(roleWorkbookActions.addActorRefImages({ images: [{ key, url }] as any }));
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
    [accessToken, canEdit, dispatch, ensureRemoteProject, projectSlug, effectiveRoleId],
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

  const uploadDirectorImages = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!accessToken || !projectSlug) return;
    if (!effectiveRoleId) return;
    const projectId = await ensureRemoteProject(accessToken);
    if (!projectId) return;
    setUploading(true);
    try {
      const selected = Array.from(files).slice(0, 20);
      const uploaded: Array<{ key: string; url?: string }> = [];
      for (const f of selected) {
        const { key, url } = await uploadProjectFile(accessToken, { projectId, type: "image", file: f });
        if (key) uploaded.push({ key, url });
      }
      if (uploaded.length > 0) {
        dispatch(roleWorkbookActions.addDirectorRefImages({ images: uploaded as any }));
        await dispatch(saveDirectorRefsThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
      }
    } finally {
      setUploading(false);
    }
  }, [accessToken, dispatch, effectiveRoleId, ensureRemoteProject, projectSlug]);

  const onDropDirectorImages = useCallback(
    async (files: FileList | null) => {
      if (!files) return;
      await uploadDirectorImages(files);
    },
    [uploadDirectorImages],
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
    <div className="app-layout">
      <div className="app-content">
        <main className="main-content">
          <div className={`rolewb-view mode-${viewStyle}`}>
            <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
              <div>
                <h2 style={{ marginBottom: 0 }}>Страница роли</h2>
                <div className="rolewb-dateline">
                  {viewStyle === "dossier" ? (
                    <>
                      CASE FILE · #{caseIdShort} · {entryDateLabel}
                    </>
                  ) : (
                    <>Запись: {entryDateLabel}</>
                  )}
                </div>
                <div className="rolewb-subtitle">
                  Проект: <b>{projectSlug}</b> · Роль:{" "}
                  <b>{s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId}</b>
                  {" · "}
                  Актёр:{" "}
                  <b>
                    {actorLabel(s.profilesByEmail?.[selectedActor] ?? null, selectedActor || "—")}
                  </b>
                  {!canEdit ? (
                    <>
                      {" "}
                      · <span style={{ opacity: 0.85 }}>только просмотр</span>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="rolewb-row">
                <Button
                  className="secondary"
                  type="button"
                  onClick={() =>
                    setViewStyle((v) => (v === "dossier" ? "diary" : v === "diary" ? "compact" : "dossier"))
                  }
                  title="Переключить стиль страницы"
                >
                  {viewStyle === "dossier" ? "Вид: досье" : viewStyle === "compact" ? "Вид: компакт" : "Вид: дневник"}
                </Button>
                <Button className="secondary" type="button" onClick={() => navigate("/profile")}>
                  Профиль
                </Button>
                <Button className="secondary" type="button" onClick={() => navigate("/roles")}>
                  Роли (админ)
                </Button>
              </div>
            </div>

            {viewStyle === "dossier" ? (
              <div className="rolewb-casehead" aria-label="Обложка дела">
                <div className="rolewb-casehead-left">
                  <div className="rolewb-casehead-kicker">ORCHESTRA ARCHIVE</div>
                  <div className="rolewb-casehead-title">DOSSIER</div>
                  <div className="rolewb-casehead-meta">
                    SUBJECT: <b>{s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId}</b>
                    {" · "}
                    ACTOR: <b>{actorLabel(s.profilesByEmail?.[selectedActor] ?? null, selectedActor || "—")}</b>
                  </div>
                </div>
                <div className="rolewb-stamp" aria-label="Штамп секретности">
                  CONFIDENTIAL
                </div>
              </div>
            ) : null}

            <div className="rolewb-grid">
              <div className="rolewb-card">
                <div className="rolewb-card-title">Просмотр</div>
                <div className="rolewb-row">
                  <div className="rolewb-hint">
                    Страница роли у каждого актёра своя. Просмотр доступен только тем, кто в одной труппе и назначен на эту роль.
                  </div>
                </div>
                <div className="rolewb-row" style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 12, opacity: 0.75 }}>Актёр:</div>
                  <select
                    className="settings-invite-input"
                    value={selectedActor || ""}
                    onChange={(e) => setSelectedActor(e.target.value)}
                    style={{ maxWidth: 520 }}
                  >
                    {assigned.length === 0 ? <option value="">Нет доступа / нет назначений в труппе</option> : null}
                    {assigned.map((em) => (
                      <option key={em} value={em}>
                        {actorLabel(s.profilesByEmail?.[em] ?? null, em)}
                      </option>
                    ))}
                  </select>
                  {myEmail && assigned.includes(myEmail) ? (
                    <Button className="secondary" type="button" onClick={() => setSelectedActor(myEmail)}>
                      Моя
                    </Button>
                  ) : null}
                </div>

                <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                  <div className="rolewb-hint">
                    {s.snapshot?.note?.updatedAt ? (
                      <>
                        Последняя версия: <b>{new Date(s.snapshot.note.updatedAt).toLocaleString("ru-RU")}</b>
                      </>
                    ) : (
                      <>Пока нет сохранённой версии для выбранного актёра.</>
                    )}
                  </div>
                  <div className="rolewb-row">
                    <Button
                      className="secondary"
                      type="button"
                      onClick={() => dispatch(roleWorkbookActions.resetDraftFromSnapshot())}
                      disabled={s.loading || s.saving}
                      title="Сбросить черновик к последней сохранённой версии"
                    >
                      Сбросить
                    </Button>
                    <Button
                      className="primary"
                      type="button"
                      disabled={!canEdit || s.saving}
                      onClick={async () => {
                        if (!accessToken || !projectSlug || !effectiveRoleId) return;
                        await dispatch(saveRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
                      }}
                    >
                      {s.saving ? "Сохранение…" : "Сохранить"}
                    </Button>
                  </div>
                </div>

                {s.error ? <div className="settings-invite-error">{s.error}</div> : null}
                {s.lastSavedAtIso ? (
                  <div style={{ fontSize: 12, color: "#7ee787" }}>
                    Сохранено: {new Date(s.lastSavedAtIso).toLocaleString("ru-RU")}
                  </div>
                ) : null}
                {s.cleanImagesError ? <div className="settings-invite-error">{s.cleanImagesError}</div> : null}
                <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                  <div className="rolewb-hint">
                    Очистка изображений удаляет с сервера файлы, на которые нет ссылок (включая референсы роли).
                    {s.lastCleanupAtIso ? (
                      <>
                        {" "}
                        Последняя очистка: <b>{new Date(s.lastCleanupAtIso).toLocaleString("ru-RU")}</b>
                      </>
                    ) : null}
                  </div>
                  <Button
                    className="secondary"
                    type="button"
                    disabled={s.cleaningImages || !accessToken || !projectSlug}
                    onClick={async () => {
                      if (!accessToken || !projectSlug) return;
                      await dispatch(cleanupProjectImagesThunk({ accessToken, projectSlug }));
                    }}
                    title="Удалить неиспользуемые изображения проекта"
                  >
                    {s.cleaningImages ? "Очистка…" : "Очистить изображения"}
                  </Button>
                </div>
              </div>

              <div className="rolewb-card">
                <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                  <div className="rolewb-card-title">Референсы режиссёра (картинки)</div>
                  <div className="rolewb-row">
                    <Button
                      className="primary"
                      type="button"
                      disabled={!canEditDirectorRefs || s.savingDirectorRefs}
                      onClick={async () => {
                        if (!accessToken || !projectSlug || !effectiveRoleId) return;
                        await dispatch(saveDirectorRefsThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
                      }}
                    >
                      {s.savingDirectorRefs ? "Сохранение…" : "Сохранить"}
                    </Button>
                    <Button
                      className="secondary"
                      type="button"
                      disabled={!canEditDirectorRefs || s.savingDirectorRefs}
                      onClick={() => dispatch(roleWorkbookActions.resetDirectorRefsFromSnapshot())}
                      title="Сбросить к последней сохранённой версии"
                    >
                      Сбросить
                    </Button>
                  </div>
                </div>
                <div className="rolewb-hint">
                  Здесь только изображения. Добавление: вставь из буфера (Ctrl+V) или перетащи файлы в зону ниже.
                  Нажми по картинке, чтобы открыть просмотр. Редактировать может только режиссёр.
                </div>

                <div
                  className="rolewb-dropzone"
                  tabIndex={0}
                  onPaste={onDirectorRefsPaste}
                  onDragOver={(e) => {
                    if (!canEditDirectorRefs) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!canEditDirectorRefs) return;
                    e.preventDefault();
                    void onDropDirectorImages(e.dataTransfer?.files ?? null);
                  }}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLDivElement).focus();
                    } catch {}
                  }}
                  style={{ marginTop: 6 }}
                  title="Кликни сюда и нажми Ctrl+V, либо перетащи файлы"
                >
                  {uploading ? "Загрузка…" : "Кликни сюда и вставь картинку (Ctrl+V) или перетащи файлы сюда."}
                </div>
                {s.directorRefsError ? <div className="settings-invite-error">{s.directorRefsError}</div> : null}
                {s.directorRefsLastSavedAtIso ? (
                  <div style={{ fontSize: 12, color: "#7ee787" }}>
                    Сохранено: {new Date(s.directorRefsLastSavedAtIso).toLocaleString("ru-RU")}
                  </div>
                ) : null}

                {directorImages.length === 0 ? (
                  <div className="rolewb-hint">Пока нет картинок.</div>
                ) : (
                  <div className="rolewb-gallery">
                    {directorImages.map((img, idx) => {
                      const url = urlCacheRef.current.get(img.key) || "";
                      return (
                        <div key={img.key} className="rolewb-img-tile">
                          {url ? (
                            <img
                              className="rolewb-img"
                              src={url}
                              alt={img.caption || "reference"}
                              onClick={() => setLightboxIdx(idx)}
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
                                setLightboxIdx(idx);
                              }}
                            >
                              загрузка…
                            </div>
                          )}
                          <div className="rolewb-img-cap">
                            <input
                              className="settings-invite-input"
                              value={String(img.caption ?? "")}
                              onChange={(e) =>
                                dispatch(
                                  roleWorkbookActions.setDirectorRefCaption({
                                    key: img.key,
                                    caption: e.target.value,
                                  }),
                                )
                              }
                              placeholder="подпись (опционально)…"
                              disabled={!canEditDirectorRefs}
                              style={{ maxWidth: "unset" }}
                            />
                            <Button
                              className="danger"
                              type="button"
                              onClick={() => {
                                dispatch(roleWorkbookActions.removeDirectorRefImage({ key: img.key }));
                                void dispatch(saveDirectorRefsThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
                              }}
                              disabled={!canEditDirectorRefs}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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
                        src={urlCacheRef.current.get(directorImages[lightboxIdx]!.key) || ""}
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
                            setLightboxIdx((i) => (i == null ? null : (i - 1 + directorImages.length) % directorImages.length))
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
                {/* re-render trigger for url cache */}
                {urlTick ? null : null}
              </div>

              <div className="rolewb-card">
                <div className="rolewb-card-title">Биография</div>
                <textarea
                  className="settings-invite-input"
                  rows={6}
                  value={String(draft?.biography ?? "")}
                  onChange={(e) =>
                    dispatch(roleWorkbookActions.setDraftField({ key: "biography", value: e.target.value }))
                  }
                  disabled={!canEdit}
                  style={{ maxWidth: "unset", width: "100%" }}
                  placeholder="Прошлое персонажа, травмы, привычки, что сформировало характер…"
                />
              </div>

              <div className="rolewb-card">
                <div className="rolewb-card-title">Сквозное действие (супер‑цель)</div>
                <textarea
                  className="settings-invite-input"
                  rows={3}
                  value={String(draft?.superObjective ?? "")}
                  onChange={(e) =>
                    dispatch(roleWorkbookActions.setDraftField({ key: "superObjective", value: e.target.value }))
                  }
                  disabled={!canEdit}
                  style={{ maxWidth: "unset", width: "100%" }}
                  placeholder="Чего персонаж хочет больше всего на протяжении всей истории?"
                />
                <div className="rolewb-hint">
                  Подход “как у киноактёров”: формулируй цель через действие (добиться/удержать/сломать/защитить), а не через чувство.
                </div>
              </div>

              <div className="rolewb-card">
                <div className="rolewb-card-title">Внешность и пластика</div>
                <textarea
                  className="settings-invite-input"
                  rows={4}
                  value={String(draft?.appearance ?? "")}
                  onChange={(e) =>
                    dispatch(roleWorkbookActions.setDraftField({ key: "appearance", value: e.target.value }))
                  }
                  disabled={!canEdit}
                  style={{ maxWidth: "unset", width: "100%" }}
                  placeholder="Осанка, жесты, походка, темп/ритм, голос, что заметно при первом взгляде…"
                />
              </div>

              <div className="rolewb-card">
                <div className="rolewb-card-title">Референсы</div>
                <div className="rolewb-hint">
                  Картинки для роли (наблюдения, фактуры, костюм/пластика, настроение). Добавление: Ctrl+V или перетащи файлы.
                </div>
                <div
                  className="rolewb-dropzone"
                  tabIndex={0}
                  onPaste={onActorRefsPaste}
                  onDragOver={(e) => {
                    if (!canEdit) return;
                    e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (!canEdit) return;
                    e.preventDefault();
                    void uploadActorImages(e.dataTransfer?.files ?? null);
                  }}
                  onClick={(e) => {
                    try {
                      (e.currentTarget as HTMLDivElement).focus();
                    } catch {}
                  }}
                  style={{ marginTop: 6 }}
                  title="Кликни сюда и нажми Ctrl+V, либо перетащи файлы"
                >
                  {actorUploading
                    ? "Загрузка…"
                    : canEdit
                      ? "Кликни сюда и вставь картинку (Ctrl+V) или перетащи файлы сюда."
                      : "Только просмотр (выбран другой актёр)."}
                </div>

                {actorImages.length === 0 ? (
                  <div className="rolewb-hint">Пока нет картинок.</div>
                ) : (
                  <div className="rolewb-gallery" style={{ marginTop: 8 }}>
                    {actorImages.map((img, idx) => {
                      const url = urlCacheRef.current.get(img.key) || "";
                      return (
                        <div key={img.key} className="rolewb-img-tile">
                          {url ? (
                            <img
                              className="rolewb-img"
                              src={url}
                              alt={img.caption || "reference"}
                              onClick={() => setActorLightboxIdx(idx)}
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
                                setActorLightboxIdx(idx);
                              }}
                            >
                              загрузка…
                            </div>
                          )}
                          <div className="rolewb-img-cap">
                            <input
                              className="settings-invite-input"
                              value={String(img.caption ?? "")}
                              onChange={(e) =>
                                dispatch(
                                  roleWorkbookActions.setActorRefCaption({
                                    key: img.key,
                                    caption: e.target.value,
                                  }),
                                )
                              }
                              placeholder="подпись (опционально)…"
                              disabled={!canEdit}
                              style={{ maxWidth: "unset" }}
                            />
                            <Button
                              className="danger"
                              type="button"
                              onClick={() => {
                                dispatch(roleWorkbookActions.removeActorRefImage({ key: img.key }));
                                void dispatch(saveRoleWorkbookThunk({ accessToken, projectSlug, roleId: effectiveRoleId }));
                              }}
                              disabled={!canEdit}
                            >
                              Удалить
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

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
                        src={urlCacheRef.current.get(actorImages[actorLightboxIdx]!.key) || ""}
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
              </div>

              <div className="rolewb-card">
                <div className="rolewb-card-title">Арка по сценам (что меняется)</div>
                <div className="rolewb-hint">
                  Для каждой сцены фиксируй: “что я хочу”, “что делаю”, “что получаю”, “в чём сдвиг”.
                </div>
                <div className="rolewb-hint" style={{ marginTop: 6 }}>
                  Список сцен формируется автоматически из сценария: берём только те шаги, где роль{" "}
                  <b>{s.roleInfo?.title ?? s.roleInfo?.key ?? effectiveRoleId}</b> встречается в “Тексте” (формат{" "}
                  <code>РОЛЬ: ...</code> или <code>[[РОЛЬ]] ...</code>). Найдено сцен:{" "}
                  <b>{Array.isArray(desiredSceneArcs) ? desiredSceneArcs.length : 0}</b>
                </div>
                <div style={{ display: "grid", gap: 8 }}>
                  {sceneArcs.length === 0 ? (
                    <div className="rolewb-hint">
                      Пока нет сцен с этой ролью в тексте сценария.
                    </div>
                  ) : null}
                  {sceneArcs.map((a, idx) => (
                    <div
                      key={`arc-${idx}`}
                      style={{
                        border: "1px solid rgba(255,255,255,0.10)",
                        borderRadius: 10,
                        padding: 10,
                        background: "rgba(255,255,255,0.03)",
                        display: "grid",
                        gap: 8,
                      }}
                    >
                      <div className="rolewb-row" style={{ justifyContent: "space-between" }}>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {a.stepTitle ? (
                            <>
                              <b>{a.stepTitle}</b> {a.stepId ? <span style={{ opacity: 0.75 }}>· #{a.stepId}</span> : null}
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
                          const next = sceneArcs.slice();
                          next[idx] = { ...(next[idx] as any), text: e.target.value };
                          dispatch(roleWorkbookActions.setDraftSceneArcs({ value: next as any }));
                        }}
                        style={{ maxWidth: "unset", width: "100%" }}
                        placeholder="Что происходит с персонажем в этой сцене? В чём поворот?"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rolewb-card">
                <div className="rolewb-card-title">Как готовиться (киношный подход)</div>
                <div className="rolewb-hint">
                  Идеи: дневник персонажа, “физические привычки”, референсы, наблюдения, “что я скрываю”, “что я защищаю”, голос/темп, отношения.
                </div>
                <textarea
                  className="settings-invite-input"
                  rows={5}
                  value={String(draft?.preparation ?? "")}
                  onChange={(e) =>
                    dispatch(roleWorkbookActions.setDraftField({ key: "preparation", value: e.target.value }))
                  }
                  disabled={!canEdit}
                  style={{ maxWidth: "unset", width: "100%" }}
                  placeholder="План подготовки: что изучить, что попробовать, какие задания себе дать…"
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

