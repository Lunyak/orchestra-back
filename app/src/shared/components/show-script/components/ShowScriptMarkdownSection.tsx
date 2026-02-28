import React, { useEffect, useRef, useState } from "react";
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
import { pasteProjectImageMarkdownSnippetFromClipboard } from "../../../project-assets/pasteProjectImageMarkdownSnippetFromClipboard";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import type { ScriptStep } from "../../../types/script";
import type { NewAnnotationDraft } from "../annotations/ActorAnnotationsPopover";
import { insertAtSelection } from "../utils/insertAtCursor";
import { ensureProject, uploadProjectFile } from "../../../../sync/api";
import { ScriptMarkdownPreview } from "./ScriptMarkdownPreview";
import { ScriptMarkdownToolbar } from "./ScriptMarkdownToolbar";
import { ScriptStepHeader } from "./ScriptStepHeader";

interface IProps {
  projectSlug: string;
  sceneName: string;
  updateStepField: <K extends keyof ScriptStep>(
    id: number,
    field: K,
    value: ScriptStep[K],
  ) => void;
  onTrackLinkClick: (trackId: number) => void;
  renderBody?: (args: {
    markdownPane: React.ReactNode;
    currentStep: ScriptStep | undefined;
  }) => React.ReactNode;
}

export function ShowScriptMarkdownSection({ projectSlug, sceneName, updateStepField, onTrackLinkClick, renderBody }: IProps) {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);

  const ui = useAppSelector((s) => selectShowScriptMarkdownUi(s, projectSlug, sceneName));
  const markdownMode = ui.markdownMode;
  const annotationsMode = ui.annotationsMode;
  const playlistOptions = ui.playlistOptions;
  const selectedTrackId = ui.selectedTrackId;
  const lightChannels = ui.lightChannels;
  const selectedLightSlot = ui.selectedLightSlot;

  const {
    isEditing,
    setIsEditing,
  } = useScriptUI();

  const { currentStep, activeMarkdownField, activeMarkdown, activeField } = useAppSelector(
    (s) => selectActiveStepMarkdownContext(s, projectSlug, sceneName),
  );

  const markdownRef = useRef<HTMLTextAreaElement | null>(null);

  const [newAnnotation, setNewAnnotation] = useState<NewAnnotationDraft | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  useEffect(() => {
    void dispatch(initShowScriptMarkdownUi({ projectSlug, sceneName }));
    void dispatch(loadSceneScriptMarkdownMeta({ projectSlug, sceneName }));
  }, [dispatch, projectSlug, sceneName]);

  // Метки недоступны в режиме редактирования (там textarea).
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
  }, [annotationsMode, dispatch, isEditing, projectSlug, sceneName]);

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

    const textarea = markdownRef.current;
    const currentValue = String(activeMarkdown ?? "");

    const { value: nextValue, cursor } = insertAtSelection({
      value: currentValue,
      insert: text,
      selectionStart: textarea?.selectionStart,
      selectionEnd: textarea?.selectionEnd,
    });

    updateStepField(currentStep.id, activeMarkdownField, nextValue);

    if (!textarea) return;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
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

  const handlePasteImage = async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
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
    <div className="script-markdown-pane">
      <ScriptMarkdownToolbar
        isEditing={isEditing}
        onToggleEditing={() => setIsEditing((p: boolean) => !p)}
        markdownMode={markdownMode}
        onSetMarkdownMode={(mode) => {
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
      />

      {isEditing ? (
        <div className="form-group form-group-grow">
          <label htmlFor={`markdown-${currentStep.id}`}></label>
          <textarea
            id={`markdown-${currentStep.id}`}
            className="form-textarea"
            ref={markdownRef}
            value={activeMarkdown}
            onChange={(e) =>
              updateStepField(currentStep.id, activeMarkdownField, e.target.value)
            }
            onPaste={handlePasteImage}
            placeholder={
              markdownMode === "play"
                ? "Текст пьесы для этого шага"
                : "Текст, изображения и ссылки на музыку"
            }
            rows={12}
          />
        </div>
      ) : (
        <div className="form-group">
          <ScriptMarkdownPreview
            projectName={projectSlug}
            sceneName={sceneName}
            onTrackLinkClick={onTrackLinkClick}
            newAnnotation={newAnnotation}
            setNewAnnotation={setNewAnnotation}
            activeAnnotationId={activeAnnotationId}
            setActiveAnnotationId={setActiveAnnotationId}
            onCreateAnnotation={handleCreateAnnotation}
            onUpdateAnnotation={handleUpdateAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
          />
        </div>
      )}
    </div>
  ) : null;

  return (
    <>
      <ScriptStepHeader
        isEditing={isEditing}
        currentStep={currentStep}
        updateStep={updateStepField}
        controls={
          isEditing
            ? {
              selectedTrackId,
              playlistOptions,
              lightChannels,
              selectedLightSlot,
              onSelectedTrackIdChange: (trackId) => {
                dispatch(
                  showScriptMarkdownActions.setSelectedTrackId({
                    projectSlug,
                    sceneName,
                    trackId,
                  }),
                );
              },
              onLightChannelsChange: (next) => {
                dispatch(
                  showScriptMarkdownActions.setLightChannels({
                    projectSlug,
                    sceneName,
                    lightChannels: next,
                  }),
                );
              },
              onSelectedLightSlotChange: (slot) => {
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
            : null
        }
      />
      {renderBody ? renderBody({ markdownPane, currentStep }) : markdownPane}
    </>
  );
}

