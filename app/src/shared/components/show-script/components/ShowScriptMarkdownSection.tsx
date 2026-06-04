import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  buildScriptEditorInsertMenuRows,
  defaultScriptEditorInsertDefinitions,
  mergeInsertDefinitions,
  ScriptEditorInsertContextMenu,
  type ScriptEditorInsertItemDefinition,
  type ScriptEditorInsertMenuPick,
} from "../../../../features/script-editor-insert-menu";
import { useScriptUI } from "../../../../features/script-ui";
import { useScene, type SceneLightFadersDataV1 } from "../../../../features/scene";
import { patchSceneDataForLightChannelCount } from "../../light-console/light-channels-mutate";
import {
  subscribeScriptTokenizeRequests,
  wrapMarkdownMatchesAsTokens,
  wrapNextMarkdownMatchAsToken,
} from "../../app-editor-menubar";
import {
  loadActorStepNote,
  saveActorStepNote,
  selectActorNote,
} from "../../../../features/show-script/model/show-script-slice";
import {
  createAnnotation,
  deleteAnnotation,
  initShowScriptMarkdownUi,
  loadActorAnnotations,
  loadSceneScriptMarkdownMeta,
  selectActiveStepMarkdownContext,
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
  updateAnnotation,
} from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { ensureProject } from "../../../../sync/api/projects";
import { uploadProjectFile } from "../../../../sync/api/files";
import { pasteProjectImageMarkdownSnippetFromClipboard } from "../../../project-assets/pasteProjectImageMarkdownSnippetFromClipboard";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import type { ScriptStep } from "../../../types/script";
import type { NewAnnotationDraft } from "../annotations/ActorAnnotationsPopover";
import { insertAtSelection } from "../utils/insertAtCursor";
import { ScriptLightChannelsPanel } from "./ScriptLightChannelsPanel";
import { LightKadrPanel } from "../../light-console/LightKadrPanel";
import "../../light-console/light-console.css";
import {
  findKadrSectionAtOffset,
  lightKadrsStableKey,
  readStepLightKadrs,
  syncLightKadrsFromMarkdown,
  scanMarkdownKadrSections,
} from "../../../../features/theater/model/light-kadrs";
import { ScriptMarkdownCodemirror, type ScriptMarkdownEditorHandle } from "./ScriptMarkdownCodemirror";
import { ScriptMarkdownPreview } from "./ScriptMarkdownPreview";

const ScriptMarkdownCodemirrorLazy = lazy(() =>
  import("./ScriptMarkdownCodemirror").then((m) => ({ default: m.ScriptMarkdownCodemirror })),
);

const ScriptMarkdownPreviewLazy = lazy(() =>
  import("./ScriptMarkdownPreview").then((m) => ({ default: m.ScriptMarkdownPreview })),
);
import { ScriptMarkdownToolbar } from "./ScriptMarkdownToolbar";

interface IProps {
  projectSlug: string;
  sceneName: string;
  /** Доп. пункты контекстного меню вставки (режим редактирования). */
  extraScriptEditorInsertItems?: ScriptEditorInsertItemDefinition[];
  updateStepField: <K extends keyof ScriptStep>(
    id: number,
    field: K,
    value: ScriptStep[K],
  ) => void;
  onTrackLinkClick: (trackId: number) => void;
  onSoundLinkClick?: (soundId: number) => void;
  onCreateStepFromSelection?: (
    selectedText: string,
    targetField: "markdown" | "playMarkdown" | "explicationMarkdown",
  ) => void;
  requisitesPane?: React.ReactNode;
  renderBody?: (args: {
    markdownPane: React.ReactNode;
    currentStep: ScriptStep | undefined;
  }) => React.ReactNode;
  /**
   * Откладывает загрузку CodeMirror / превью (отдельные чанки) до первого показа;
   * для канбан-модалки + граница Suspense по режиму (схема / экспликация / текст × чтение|редактирование).
   */
  lazyScriptBody?: boolean;
  /** Табы режима шага в теле страницы (на главной — в menubar). */
  inlineMarkdownTabs?: boolean;
}

export function ShowScriptMarkdownSection({
  projectSlug,
  sceneName,
  extraScriptEditorInsertItems,
  updateStepField,
  onTrackLinkClick,
  onSoundLinkClick,
  onCreateStepFromSelection,
  requisitesPane,
  renderBody,
  lazyScriptBody = false,
  inlineMarkdownTabs = true,
}: IProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { sceneData, setSceneData } = useScene();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const sceneDataRevision = useAppSelector((s) => (s as any).scene?.sceneDataRevision ?? 0);
  const serverShadowRevision = useAppSelector((s) => (s as any).scene?.serverShadowRevision ?? 0);

  const ui = useAppSelector((s) => selectShowScriptMarkdownUi(s, projectSlug, sceneName));
  const markdownMode = ui.markdownMode;
  const annotationsMode = ui.annotationsMode;
  const playlistOptions = ui.playlistOptions;
  const soundsOptions = ui.soundsOptions;
  const lightChannels = ui.lightChannels;
  const selectedLightSlot = ui.selectedLightSlot;

  const {
    isEditing,
    setIsEditing,
  } = useScriptUI();

  const { currentStep, activeMarkdownField, activeMarkdown, activeField } = useAppSelector(
    (s) => selectActiveStepMarkdownContext(s, projectSlug, sceneName),
  );

  const lightFaders =
    sceneData?.lightFaders && sceneData.lightFaders.v === 1
      ? sceneData.lightFaders
      : null;
  const lightPrograms =
    sceneData?.lightPrograms && sceneData.lightPrograms.v === 1
      ? sceneData.lightPrograms
      : null;

  const markdownRef = useRef<ScriptMarkdownEditorHandle | null>(null);
  const lastSyncedLightKadrsKeyRef = useRef<string>("");

  useEffect(() => {
    if (currentStep?.id == null) {
      setActiveLightKadrId(null);
      lastSyncedLightKadrsKeyRef.current = "";
      return;
    }
    const markdown = String(currentStep.markdown ?? "");
    const prev = readStepLightKadrs(currentStep);
    const synced = syncLightKadrsFromMarkdown({ markdown, kadrs: prev });
    const syncKey = `${currentStep.id}:${markdown.length}:${lightKadrsStableKey(synced)}`;
    if (lightKadrsStableKey(prev) === lightKadrsStableKey(synced)) {
      lastSyncedLightKadrsKeyRef.current = syncKey;
      return;
    }
    if (lastSyncedLightKadrsKeyRef.current === syncKey) return;
    lastSyncedLightKadrsKeyRef.current = syncKey;
    updateStepField(currentStep.id, "lightKadrs", synced);
  }, [currentStep?.markdown, currentStep?.id, currentStep?.lightKadrs, updateStepField]);

  useEffect(() => {
    const ed = markdownRef.current;
    const sel = ed?.getSelection();
    const offset = sel?.from ?? String(activeMarkdown ?? "").length;
    const section = findKadrSectionAtOffset(String(activeMarkdown ?? ""), offset);
    const nextId = section?.id ?? null;
    setActiveLightKadrId((prev) => (prev === nextId ? prev : nextId));
  }, [activeMarkdown, isEditing]);

  const [newAnnotation, setNewAnnotation] = useState<NewAnnotationDraft | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [insertMenu, setInsertMenu] = useState<{ x: number; y: number } | null>(null);
  const [activeLightKadrId, setActiveLightKadrId] = useState<string | null>(null);
  const [stepCommentDraft, setStepCommentDraft] = useState("");

  /** Секции по `###` в превью (rehypeKadrSections) + TOC «Картины» — для пьесы тоже, иначе в режиме play блоки пропадают. */
  const kadrLayoutEnabled =
    markdownMode === "notes" || markdownMode === "explication" || markdownMode === "play";

  const editorTocEnabled = ui.editorTocEnabled;

  const scriptEditorInsertDefinitions = useMemo(
    () =>
      extraScriptEditorInsertItems?.length
        ? mergeInsertDefinitions(defaultScriptEditorInsertDefinitions, extraScriptEditorInsertItems)
        : defaultScriptEditorInsertDefinitions,
    [extraScriptEditorInsertItems],
  );

  const hasKadrSections = useMemo(
    () => scanMarkdownKadrSections(String(activeMarkdown ?? "")).length > 0,
    [activeMarkdown],
  );

  const tocItems = useMemo(() => {
    if (!kadrLayoutEnabled) return [];
    const text = String(activeMarkdown ?? "");
    const re = /^(#{1,3})\s+(.+)$/gm;
    const items: Array<{ level: number; title: string; offset: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const level = m[1]?.length ?? 3;
      const title = String(m[2] ?? "").trim() || "…";
      const offset = Number(m.index) || 0;
      items.push({ level, title, offset });
      if (items.length > 2000) break;
    }
    return items;
  }, [activeMarkdown, kadrLayoutEnabled]);

  const jumpToOffset = (offset: number) => {
    const ed = markdownRef.current;
    const max = (ed?.getDoc() ?? String(activeMarkdown ?? "")).length;
    const pos = Math.max(0, Math.min(max, Math.trunc(offset)));
    ed?.focus();
    ed?.setSelection(pos, pos);
  };

  const togglePlayOriginalMode = useCallback(() => {
    const next = !ui.playOriginalMode;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `showScript:playOriginalMode:${projectSlug}:${sceneName}`,
          String(next),
        );
      }
    } catch {
      // ignore
    }
    dispatch(
      showScriptMarkdownActions.setPlayOriginalMode({
        projectSlug,
        sceneName,
        enabled: next,
      }),
    );
  }, [dispatch, projectSlug, sceneName, ui.playOriginalMode]);

  useEffect(() => {
    void dispatch(initShowScriptMarkdownUi({ projectSlug, sceneName }));
    void dispatch(loadSceneScriptMarkdownMeta({ projectSlug, sceneName }));
  }, [dispatch, projectSlug, sceneName, sceneDataRevision, serverShadowRevision]);

  // Метки недоступны в режиме редактирования (там редактор кода).
  useEffect(() => {
    if (isEditing && annotationsMode) {
      dispatch(
        showScriptMarkdownActions.setAnnotationsMode({
          projectSlug,
          sceneName,
          enabled: false,
        }),
      );
      setNewAnnotation(null);
      setActiveAnnotationId(null);
    }
  }, [annotationsMode, dispatch, isEditing, markdownMode, projectSlug, sceneName]);

  const annotationsCacheKey =
    currentStep?.id != null
      ? `${projectSlug}:${sceneName}:${currentStep.id}:${activeField}`
      : null;
  const stepCommentCacheKey =
    currentStep?.id != null ? `${projectSlug}:${sceneName}:${currentStep.id}` : null;
  const stepCommentEntry = useAppSelector((s) =>
    stepCommentCacheKey ? selectActorNote(s, stepCommentCacheKey) : null,
  );

  useEffect(() => {
    setStepCommentDraft(stepCommentEntry?.text ?? "");
  }, [stepCommentEntry?.text, stepCommentCacheKey]);

  // Аннотации: загрузка для текущего шага + поля (markdown / playMarkdown)
  useEffect(() => {
    if (currentStep?.id == null) {
      setNewAnnotation(null);
      setActiveAnnotationId(null);
      return;
    }
    if (markdownMode === "comments" || markdownMode === "requisites" || markdownMode === "light") return;
    const cacheKey = `${projectSlug}:${sceneName}:${currentStep.id}:${activeField}`;
    void dispatch(
      loadActorAnnotations({
        cacheKey,
        projectSlug,
        sceneName,
        stepId: currentStep.id,
        field: activeField,
      }),
    );
  }, [
    activeField,
    currentStep?.id,
    dispatch,
    markdownMode,
    projectSlug,
    sceneName,
  ]);

  useEffect(() => {
    if (currentStep?.id == null || !stepCommentCacheKey) return;
    void dispatch(
      loadActorStepNote({
        cacheKey: stepCommentCacheKey,
        projectSlug,
        sceneName,
        stepId: currentStep.id,
      }),
    );
  }, [currentStep?.id, dispatch, projectSlug, sceneName, stepCommentCacheKey]);

  const saveStepComment = () => {
    if (!currentStep || !stepCommentCacheKey) return;
    const next = stepCommentDraft.trim();
    if (next === String(stepCommentEntry?.text ?? "").trim()) return;
    void dispatch(
      saveActorStepNote({
        cacheKey: stepCommentCacheKey,
        projectSlug,
        sceneName,
        stepId: currentStep.id,
        text: next,
      }),
    );
  };

  const insertIntoActiveMarkdown = (text: string) => {
    if (!currentStep) return;

    const ed = markdownRef.current;
    const currentValue = ed?.getDoc() ?? String(activeMarkdown ?? "");
    const sel = ed?.getSelection();

    const { value: nextValue, cursor } = insertAtSelection({
      value: currentValue,
      insert: text,
      selectionStart: sel?.from,
      selectionEnd: sel?.to,
    });

    if (ed) {
      ed.applyDocument(nextValue, cursor);
    } else {
      updateStepField(currentStep.id, activeMarkdownField, nextValue);
    }
  };

  useEffect(() => {
    return subscribeScriptTokenizeRequests(({ query, mode }) => {
      if (!currentStep) return { value: String(activeMarkdown ?? ""), count: 0 };

      const ed = markdownRef.current;
      const currentValue = ed?.getDoc() ?? String(activeMarkdown ?? "");
      const selection = ed?.getSelection();
      const result =
        mode === "next"
          ? wrapNextMarkdownMatchAsToken(currentValue, query, selection?.to ?? 0)
          : wrapMarkdownMatchesAsTokens(currentValue, query);

      if (result.count === 0) return result;

      if (ed) {
        const cursor = result.selection?.to ?? selection?.to ?? 0;
        ed.applyDocument(result.value, cursor);
        if (result.selection) {
          ed.setSelection(result.selection.from, result.selection.to);
        }
      } else {
        updateStepField(currentStep.id, activeMarkdownField, result.value);
      }

      return result;
    });
  }, [activeMarkdown, activeMarkdownField, currentStep, updateStepField]);

  const handleInsertImage = async () => {
    if (!currentStep) return;
    const token =
      accessToken ??
      (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);
    if (!token) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = false;
    input.onchange = async () => {
      const file = input.files?.[0] ?? null;
      if (!file) return;
      try {
        const project = await ensureProject(
          token,
          projectSlug,
          `Проект ${projectSlug}`,
        );
        const { key } = await uploadProjectFile(token, {
          projectId: project.id,
          type: "image",
          file,
        });
        const alt = file.name.replace(/\.[^.]+$/, "") || "image";
        const snippet = `\n\n![${alt}](orchestra-image:${encodeURIComponent(key)})\n\n`;
        insertIntoActiveMarkdown(snippet);
      } catch (e) {
        console.error("insert image failed:", e);
      }
    };
    input.click();
  };

  const tokenForAssets =
    accessToken ??
    (typeof window !== "undefined" ? window.localStorage.getItem("accessToken") : null);

  const insertMenuRows = useMemo(() => {
    if (!insertMenu) return [];
    const ed = markdownRef.current;
    const sel = ed?.getSelection();
    const canCopySelection = Boolean(ed && sel && sel.from !== sel.to);
    const canPasteFromClipboard =
      typeof navigator !== "undefined" &&
      Boolean(navigator.clipboard && typeof navigator.clipboard.readText === "function");
    return buildScriptEditorInsertMenuRows(
      {
        playlistOptions,
        soundsOptions,
        lightChannels,
        activeMarkdown: String(activeMarkdown ?? ""),
        canInsertImage: Boolean(tokenForAssets),
        canCopySelection,
        canPasteFromClipboard,
      },
      scriptEditorInsertDefinitions,
    );
  }, [
    insertMenu,
    scriptEditorInsertDefinitions,
    playlistOptions,
    soundsOptions,
    lightChannels,
    activeMarkdown,
    tokenForAssets,
  ]);

  const copyEditorSelection = async () => {
    const ed = markdownRef.current;
    if (!ed) return;
    const doc = ed.getDoc();
    const { from, to } = ed.getSelection();
    if (from === to) return;
    const sliceFrom = Math.min(from, to);
    const sliceTo = Math.max(from, to);
    const text = doc.slice(sliceFrom, sliceTo);
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      console.error("copy failed:", e);
    }
  };

  const pasteFromClipboard = async () => {
    if (!markdownRef.current) return;
    try {
      const text = await navigator.clipboard.readText();
      insertIntoActiveMarkdown(text);
    } catch (e) {
      console.error("paste failed:", e);
    }
  };

  const handleInsertMenuPick = (pick: ScriptEditorInsertMenuPick) => {
    if (pick.kind === "snippet") {
      insertIntoActiveMarkdown(pick.text);
      return;
    }
    if (pick.kind === "copy-selection") {
      void copyEditorSelection();
      return;
    }
    if (pick.kind === "paste-clipboard") {
      void pasteFromClipboard();
      return;
    }
    if (pick.kind === "create-step-from-selection") {
      const ed = markdownRef.current;
      if (!ed) return;
      const selection = ed.getSelection();
      if (!selection) return;
      const selectionFrom = Math.min(selection.from, selection.to);
      const selectionTo = Math.max(selection.from, selection.to);
      if (selectionFrom === selectionTo) return;
      const selectedText = ed.getDoc().slice(selectionFrom, selectionTo);
      if (!onCreateStepFromSelection) return;
      onCreateStepFromSelection?.(
        selectedText,
        activeMarkdownField as "markdown" | "playMarkdown" | "explicationMarkdown",
      );
      const currentValue = ed.getDoc();
      const { value: nextValue, cursor } = insertAtSelection({
        value: currentValue,
        insert: "",
        selectionStart: selectionFrom,
        selectionEnd: selectionTo,
      });
      ed.applyDocument(nextValue, cursor);
      return;
    }
    void handleInsertImage();
  };

  const handleClipboardImagePaste = async (event: ClipboardEvent) => {
    const pasted = await pasteProjectImageMarkdownSnippetFromClipboard(event, {
      projectSlug,
      sceneName,
      accessToken,
    });
    if (!pasted) return;
    insertIntoActiveMarkdown(pasted.snippet);
  };

  const handleCreateAnnotation = async (draft: NewAnnotationDraft) => {
    if (!currentStep?.id) return;
    if (!annotationsCacheKey) return;
    await dispatch(
      createAnnotation({
        cacheKey: annotationsCacheKey,
        projectSlug,
        sceneName,
        stepId: currentStep.id,
        field: activeField,
        startOffset: draft.start,
        endOffset: draft.end,
        selectedText: draft.selectedText,
        noteText: draft.noteText,
      }),
    );
  };

  const handleUpdateAnnotation = async (id: string, noteText: string) => {
    if (!annotationsCacheKey) return;
    await dispatch(updateAnnotation({ cacheKey: annotationsCacheKey, id, noteText }));
  };

  const handleDeleteAnnotation = async (id: string) => {
    if (!annotationsCacheKey) return;
    await dispatch(deleteAnnotation({ cacheKey: annotationsCacheKey, id }));
  };

  const markdownPane = currentStep ? (
    <div className="script-markdown-pane" data-markdown-mode={markdownMode}>
      {inlineMarkdownTabs ? (
        <ScriptMarkdownToolbar
          markdownMode={markdownMode}
          showTabs={inlineMarkdownTabs}
          playOriginalMode={ui.playOriginalMode}
          onTogglePlayOriginal={togglePlayOriginalMode}
          onSetMarkdownMode={(mode) => {
            try {
              if (typeof window !== "undefined") {
                localStorage.setItem(
                  `showScript:markdownMode:${projectSlug}:${sceneName}`,
                  mode,
                );
              }
            } catch {
              // ignore
            }
            dispatch(
              showScriptMarkdownActions.setMarkdownMode({
                projectSlug,
                sceneName,
                mode,
              }),
            );
          }}
          editorToggles={
            isEditing && kadrLayoutEnabled
              ? {
                  tocEnabled: editorTocEnabled,
                  onToggleToc: () => {
                    const next = !editorTocEnabled;
                    try {
                      if (typeof window !== "undefined") {
                        localStorage.setItem(
                          `showScript:editorToc:${projectSlug}:${sceneName}`,
                          String(next),
                        );
                      }
                    } catch {
                      // ignore
                    }
                    dispatch(
                      showScriptMarkdownActions.setEditorTocEnabled({
                        projectSlug,
                        sceneName,
                        enabled: next,
                      }),
                    );
                  },
                }
              : null
          }
        />
      ) : null}

      {markdownMode === "notes" && hasKadrSections ? (
        <div className="script-kadr-light-banner" role="note">
          <p>
            Здесь — текст картин. Проход спектакля с лентой картин, схемой и пультом (запись вживую)
            — на странице <strong>«Репетиция»</strong> в верхнем меню. Вкладка «Свет» — настройка
            одного шага.
          </p>
          <div className="script-kadr-light-banner__actions">
            <button
              type="button"
              className="script-kadr-light-banner__btn script-kadr-light-banner__btn--primary"
              onClick={() => navigate("/light-plot")}
            >
              Репетиция спектакля
            </button>
            <button
              type="button"
              className="script-kadr-light-banner__btn"
              onClick={() => {
                try {
                  if (typeof window !== "undefined") {
                    localStorage.setItem(
                      `showScript:markdownMode:${projectSlug}:${sceneName}`,
                      "light",
                    );
                  }
                } catch {
                  // ignore
                }
                dispatch(
                  showScriptMarkdownActions.setMarkdownMode({
                    projectSlug,
                    sceneName,
                    mode: "light",
                  }),
                );
              }}
            >
              Свет этого шага
            </button>
          </div>
        </div>
      ) : null}

      {markdownMode === "light" ? (
        <div className="script-step-light-pane">
          <div className="script-kadr-light-banner script-kadr-light-banner--compact" role="note">
            <p>
              Пульт для <strong>текущего шага</strong>. Сквозная лента по всем картинам спектакля —
              страница <strong>«Репетиция»</strong> (верхнее меню).
            </p>
            <button
              type="button"
              className="script-kadr-light-banner__btn script-kadr-light-banner__btn--primary"
              onClick={() => navigate("/light-plot")}
            >
              Открыть репетицию
            </button>
          </div>
          <LightKadrPanel
            projectName={projectSlug}
            step={currentStep}
            markdown={String(activeMarkdown ?? "")}
            activeKadrId={activeLightKadrId}
            onActiveKadrIdChange={setActiveLightKadrId}
            lightChannels={lightChannels}
            lightFaders={lightFaders}
            lightPrograms={lightPrograms}
            spotlights={currentStep?.theaterSpotlights}
            onUpdateStep={(changes) => {
              if (!currentStep) return;
              if (changes.lightKadrs) {
                updateStepField(currentStep.id, "lightKadrs", changes.lightKadrs);
              }
            }}
            onUpdateMarkdown={(next) => {
              if (!currentStep) return;
              const ed = markdownRef.current;
              if (ed) {
                ed.applyDocument(next, ed.getSelection()?.from ?? next.length);
              } else {
                updateStepField(currentStep.id, activeMarkdownField, next);
              }
            }}
          />
          <ScriptLightChannelsPanel
            lightChannels={lightChannels}
            selectedLightSlot={selectedLightSlot}
            lightFaders={lightFaders}
            onLightChannelsChange={(next) => {
              dispatch(
                showScriptMarkdownActions.setLightChannels({
                  projectSlug,
                  sceneName,
                  lightChannels: next,
                }),
              );
              setSceneData((prev) => ({
                ...(prev ?? {}),
                ...patchSceneDataForLightChannelCount(prev, next, lightChannels.length),
              }));
            }}
            onSelectedLightSlotChange={(slot) => {
              dispatch(
                showScriptMarkdownActions.setSelectedLightSlot({
                  projectSlug,
                  sceneName,
                  slot,
                }),
              );
            }}
            onLightFadersChange={(next: SceneLightFadersDataV1) => {
              setSceneData((prev) => ({
                ...(prev ?? {}),
                lightFaders: next,
              }));
            }}
            spotlights={currentStep?.theaterSpotlights}
            onSpotlightsChange={(next) => updateStepField(currentStep.id, "theaterSpotlights", next)}
            onInsertText={insertIntoActiveMarkdown}
          />
        </div>
      ) : markdownMode === "requisites" ? (
        <div className="script-step-requisites-pane">
          {requisitesPane}
        </div>
      ) : markdownMode === "comments" ? (
        <div className="script-step-comment-pane">
          <textarea
            id={`step-comment-${currentStep.id}`}
            className="script-step-comment-pane__input"
            value={stepCommentDraft}
            rows={10}
            disabled={Boolean(stepCommentEntry?.loading)}
            placeholder="Заметки, договорённости и комментарии к этому шагу…"
            onChange={(e) => setStepCommentDraft(e.target.value)}
            onBlur={saveStepComment}
          />
          <div className="script-step-comment-pane__hint">
            {stepCommentEntry?.saving
              ? "Сохраняем…"
              : stepCommentEntry?.error
                ? stepCommentEntry.error
                : "Сохраняется при выходе из поля."}
          </div>
        </div>
      ) : isEditing ? (
        <div
          className={[
            "form-group form-group-grow",
            kadrLayoutEnabled ? "script-markdown-edit--kadr" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <div className="script-markdown-editor-split">
            {kadrLayoutEnabled && editorTocEnabled ? (
              <div className="script-markdown-toc" aria-label="Картины">
                <div className="script-markdown-toc__title">Картины</div>
                {tocItems.length ? (
                  <div className="script-markdown-toc__list">
                    {tocItems.map((it, idx) => (
                      <button
                        key={`${it.offset}-${idx}`}
                        type="button"
                        className="script-markdown-toc__item"
                        data-level={String(it.level)}
                        title={it.title}
                        onClick={() => jumpToOffset(it.offset)}
                      >
                        {it.title}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="script-markdown-toc__empty">Добавь заголовок `### ...`</div>
                )}
              </div>
            ) : null}

            <div
              className="script-markdown-editor-main"
              onContextMenu={(event) => {
                event.preventDefault();
                setInsertMenu({ x: event.clientX, y: event.clientY });
              }}
            >
              <label className="visually-hidden" htmlFor={`markdown-${currentStep.id}`}>
                Текст шага
              </label>
              {lazyScriptBody ? (
                <Suspense
                  key={`${markdownMode}-ed`}
                  fallback={<div className="script-markdown-body-fallback">Загрузка редактора…</div>}
                >
                  <ScriptMarkdownCodemirrorLazy
                    key={`md-${currentStep.id}-${String(activeMarkdownField)}`}
                    ref={markdownRef}
                    id={`markdown-${currentStep.id}`}
                    className={
                      kadrLayoutEnabled ? "script-markdown-cm--kadr-layout" : undefined
                    }
                    kadrSectionBlocks={kadrLayoutEnabled}
                    value={String(activeMarkdown ?? "")}
                    projectSlug={projectSlug}
                    accessToken={accessToken}
                    lightChannels={lightChannels}
                    onTrackLinkClick={onTrackLinkClick}
                    onChange={(next) => updateStepField(currentStep.id, activeMarkdownField, next)}
                    onClipboardImagePaste={handleClipboardImagePaste}
                    placeholder={
                      markdownMode === "play"
                        ? "Текст пьесы для этого шага"
                        : markdownMode === "explication"
                          ? "Режиссёрская экспликация для этого шага"
                          : "Текст, изображения и ссылки на музыку"
                    }
                  />
                </Suspense>
              ) : (
                <ScriptMarkdownCodemirror
                  key={`md-${currentStep.id}-${String(activeMarkdownField)}`}
                  ref={markdownRef}
                  id={`markdown-${currentStep.id}`}
                  className={
                    kadrLayoutEnabled ? "script-markdown-cm--kadr-layout" : undefined
                  }
                  kadrSectionBlocks={kadrLayoutEnabled}
                  value={String(activeMarkdown ?? "")}
                  projectSlug={projectSlug}
                  accessToken={accessToken}
                  lightChannels={lightChannels}
                  onTrackLinkClick={onTrackLinkClick}
                  onChange={(next) => updateStepField(currentStep.id, activeMarkdownField, next)}
                  onClipboardImagePaste={handleClipboardImagePaste}
                  placeholder={
                    markdownMode === "play"
                      ? "Текст пьесы для этого шага"
                      : markdownMode === "explication"
                        ? "Режиссёрская экспликация для этого шага"
                        : "Текст, изображения и ссылки на музыку"
                  }
                />
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="form-group">
          {lazyScriptBody ? (
            <Suspense
              key={`${markdownMode}-ro`}
              fallback={<div className="script-markdown-body-fallback">Загрузка превью…</div>}
            >
              <ScriptMarkdownPreviewLazy
                projectName={projectSlug}
                sceneName={sceneName}
                showStepTitle={inlineMarkdownTabs}
                onTrackLinkClick={onTrackLinkClick}
                onSoundLinkClick={onSoundLinkClick}
                newAnnotation={newAnnotation}
                setNewAnnotation={setNewAnnotation}
                activeAnnotationId={activeAnnotationId}
                setActiveAnnotationId={setActiveAnnotationId}
                onCreateAnnotation={handleCreateAnnotation}
                onUpdateAnnotation={handleUpdateAnnotation}
                onDeleteAnnotation={handleDeleteAnnotation}
              />
            </Suspense>
          ) : (
            <ScriptMarkdownPreview
              projectName={projectSlug}
              sceneName={sceneName}
              showStepTitle={inlineMarkdownTabs}
              onTrackLinkClick={onTrackLinkClick}
              onSoundLinkClick={onSoundLinkClick}
              newAnnotation={newAnnotation}
              setNewAnnotation={setNewAnnotation}
              activeAnnotationId={activeAnnotationId}
              setActiveAnnotationId={setActiveAnnotationId}
              onCreateAnnotation={handleCreateAnnotation}
              onUpdateAnnotation={handleUpdateAnnotation}
              onDeleteAnnotation={handleDeleteAnnotation}
            />
          )}
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      {renderBody ? renderBody({ markdownPane, currentStep }) : markdownPane}
      <ScriptEditorInsertContextMenu
        open={insertMenu != null}
        anchorX={insertMenu?.x ?? 0}
        anchorY={insertMenu?.y ?? 0}
        rows={insertMenuRows}
        onClose={() => setInsertMenu(null)}
        onPick={handleInsertMenuPick}
      />
    </>
  );
}

