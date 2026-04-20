import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import {
  buildScriptEditorInsertMenuRows,
  defaultScriptEditorInsertDefinitions,
  mergeInsertDefinitions,
  ScriptEditorInsertContextMenu,
  type ScriptEditorInsertItemDefinition,
  type ScriptEditorInsertMenuPick,
} from "../../../../features/script-editor-insert-menu";
import { useScriptUI } from "../../../../features/script-ui";
import {
  createAnnotation,
  deleteAnnotation,
  initShowScriptMarkdownUi,
  loadActorAnnotations,
  loadSceneScriptMarkdownMeta,
  selectActiveStepMarkdownContext,
  selectAnnotations,
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
  updateAnnotation,
} from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { ensureProject, uploadProjectFile } from "../../../../sync/api";
import { pasteProjectImageMarkdownSnippetFromClipboard } from "../../../project-assets/pasteProjectImageMarkdownSnippetFromClipboard";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import type { ScriptStep } from "../../../types/script";
import type { NewAnnotationDraft } from "../annotations/ActorAnnotationsPopover";
import { insertAtSelection } from "../utils/insertAtCursor";
import { ScriptMarkdownCodemirror, type ScriptMarkdownEditorHandle } from "./ScriptMarkdownCodemirror";
import { ScriptMarkdownPreview } from "./ScriptMarkdownPreview";

const ScriptMarkdownCodemirrorLazy = lazy(() =>
  import("./ScriptMarkdownCodemirror").then((m) => ({ default: m.ScriptMarkdownCodemirror })),
);

const ScriptMarkdownPreviewLazy = lazy(() =>
  import("./ScriptMarkdownPreview").then((m) => ({ default: m.ScriptMarkdownPreview })),
);
import { ScriptMarkdownToolbar } from "./ScriptMarkdownToolbar";
import { ScriptStepHeader } from "./ScriptStepHeader";

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
  renderBody?: (args: {
    markdownPane: React.ReactNode;
    currentStep: ScriptStep | undefined;
    controls: null | {
      lightChannels: string[];
      onLightChannelsChange: (next: string[]) => void;
      selectedLightSlot: number;
      onSelectedLightSlotChange: (slot: number) => void;
      onInsertText: (text: string) => void;
    };
  }) => React.ReactNode;
  /**
   * Откладывает загрузку CodeMirror / превью (отдельные чанки) до первого показа;
   * для канбан-модалки + граница Suspense по режиму (схема / экспликация / текст × чтение|редактирование).
   */
  lazyScriptBody?: boolean;
}

export function ShowScriptMarkdownSection({
  projectSlug,
  sceneName,
  extraScriptEditorInsertItems,
  updateStepField,
  onTrackLinkClick,
  onSoundLinkClick,
  renderBody,
  lazyScriptBody = false,
}: IProps) {
  const dispatch = useAppDispatch();
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

  const markdownRef = useRef<ScriptMarkdownEditorHandle | null>(null);

  const [newAnnotation, setNewAnnotation] = useState<NewAnnotationDraft | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
  const [insertMenu, setInsertMenu] = useState<{ x: number; y: number } | null>(null);

  /** Секции по `###` в превью (rehypeKadrSections) + TOC «Картины» — для пьесы тоже, иначе в режиме play блоки пропадают. */
  const kadrLayoutEnabled =
    markdownMode === "notes" || markdownMode === "explication" || markdownMode === "play";

  const tocStorageKey = `showScript:editorToc:${projectSlug}:${sceneName}`;
  const [tocEnabled, setTocEnabled] = useState<boolean>(() => {
    try {
      if (typeof window === "undefined") return true;
      const v = localStorage.getItem(tocStorageKey);
      return v == null ? true : v === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      if (typeof window !== "undefined") localStorage.setItem(tocStorageKey, String(tocEnabled));
    } catch {
      // ignore
    }
  }, [tocEnabled, tocStorageKey]);

  const scriptEditorInsertDefinitions = useMemo(
    () =>
      extraScriptEditorInsertItems?.length
        ? mergeInsertDefinitions(defaultScriptEditorInsertDefinitions, extraScriptEditorInsertItems)
        : defaultScriptEditorInsertDefinitions,
    [extraScriptEditorInsertItems],
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
  const annotationsEntry = useAppSelector((s) =>
    annotationsCacheKey ? selectAnnotations(s, annotationsCacheKey) : null,
  );
  const annotations = annotationsEntry?.items ?? [];
  const annotationsLoading = annotationsEntry?.loading ?? false;
  const annotationsError = annotationsEntry?.error ?? null;

  // Аннотации: загрузка для текущего шага + поля (markdown / playMarkdown)
  useEffect(() => {
    if (currentStep?.id == null) {
      setNewAnnotation(null);
      setActiveAnnotationId(null);
      return;
    }
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
    projectSlug,
    sceneName,
  ]);

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
      <ScriptMarkdownToolbar
        isEditing={isEditing}
        onToggleEditing={() => setIsEditing((p: boolean) => !p)}
        markdownMode={markdownMode}
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
        annotations={{
          mode: annotationsMode,
          onToggleMode: () => {
            dispatch(
              showScriptMarkdownActions.setAnnotationsMode({
                projectSlug,
                sceneName,
                enabled: !annotationsMode,
              }),
            );
          },
          loading: annotationsLoading,
          error: annotationsError,
          count: annotations.length,
          onClearSelectionState: () => {
            setNewAnnotation(null);
            setActiveAnnotationId(null);
          },
        }}
        onInsertImage={handleInsertImage}
        onInsertKadr={() => {
          if (!currentStep) return;
          const exp = String(activeMarkdown ?? "");
          const count = (exp.match(/^###\s*Картина\b/gim) ?? []).length;
          const nextN = count + 1;
          insertIntoActiveMarkdown(
            `\n\n### Картина ${nextN}\n\n- **Мизансцена**:\n- **Действие/задача**:\n- **Переход**:\n`,
          );
        }}
        editorToggles={
          isEditing && kadrLayoutEnabled
            ? {
                tocEnabled,
                onToggleToc: () => setTocEnabled((p) => !p),
              }
            : null
        }
      />

      {isEditing ? (
        <div className="form-group form-group-grow">
          <ScriptStepHeader currentStep={currentStep} updateStep={updateStepField} />
          <div className="script-markdown-editor-split">
            {kadrLayoutEnabled && tocEnabled ? (
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
                    className={markdownMode === "play" ? "script-markdown-cm--play-as-preview" : undefined}
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
                  className={markdownMode === "play" ? "script-markdown-cm--play-as-preview" : undefined}
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

  const controls =
    isEditing
      ? {
        lightChannels,
        selectedLightSlot,
        onLightChannelsChange: (next: string[]) => {
          dispatch(
            showScriptMarkdownActions.setLightChannels({
              projectSlug,
              sceneName,
              lightChannels: next,
            }),
          );
        },
        onSelectedLightSlotChange: (slot: number) => {
          dispatch(
            showScriptMarkdownActions.setSelectedLightSlot({
              projectSlug,
              sceneName,
              slot,
            }),
          );
        },
        onInsertText: insertIntoActiveMarkdown,
      }
      : null;

  return (
    <>
      {renderBody ? renderBody({ markdownPane, currentStep, controls }) : markdownPane}
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

