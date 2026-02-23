import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useScriptUI } from '../../features/script-ui';
import { getDesktopApi } from "../../shared/platform/desktop-api";
import { ScriptRequisite, ScriptStep } from "../../shared/types/script";
import { pruneSceneImages } from "../../shared/utils/markdownImages";
import { ensureProject, type ActorAnnotationField } from "../../sync/api";
import { insertAtSelection } from "./utils/insertAtCursor";
import type { NewAnnotationDraft } from "./annotations/ActorAnnotationsPopover";
import { ScriptStepHeader } from "./components/ScriptStepHeader";
import { ScriptMarkdownToolbar } from "./components/ScriptMarkdownToolbar";
import { RequisitesPanel } from "./components/RequisitesPanel";
import { ScriptMarkdownPreview } from "./components/ScriptMarkdownPreview";
import {
  createAnnotation,
  deleteAnnotation,
  initShowScriptUi,
  loadSceneScriptMeta,
  loadActorAnnotations,
  selectAnnotations,
  selectShowScriptUi,
  showScriptActions,
  updateAnnotation,
} from "../../features/show-script/model/show-script-slice";
import { useAppDispatch, useAppSelector } from "../../shared/store/hooks";
import './style.css';


interface ShowScriptProps {
  steps?: ScriptStep[];
  title?: string;
  projectName?: string;
  sceneName?: string;
  currentPage?: number;
  onStepsChange?: (steps: ScriptStep[]) => void;
  isEditing?: boolean;
  onTrackLinkClick?: (trackId: number) => void;
  showRequisites?: boolean;
  canSave?: boolean;
}

export const ShowScript: React.FC<ShowScriptProps> = ({
  steps: initialSteps,
  title = 'Сценарий спектакля',
  projectName = 'fools',
  sceneName = 'script',
  currentPage: controlledPage,
  onStepsChange,
  isEditing: controlledEditing,
  onTrackLinkClick,
  showRequisites: controlledShowRequisites,
  canSave = true,
}) => {
  const pageStorageKey = `showScript:currentPage:${projectName}:${sceneName}`;
  const [localPage, setLocalPage] = useState(() => {
    if (typeof window === "undefined") return 0;
    const raw = localStorage.getItem(pageStorageKey);
    const n = raw == null ? 0 : Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
  });
  const [localSteps, setLocalSteps] = useState<ScriptStep[]>(
    initialSteps || [
      {
        id: 1,
        title: 'Шаг 1',
        markdown:
          'Тестовый шаг.\n\n![Свет](./assets/light.png)\n\n[Музыка](./assets/intro.mp3)',
        requisites: [],
      },
    ]
  );
  const markdownRef = useRef<HTMLTextAreaElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const hasMountedRef = useRef(false);
  const [newRequisite, setNewRequisite] = useState('');
  const requisitesClipboardRef = useRef<ScriptRequisite[] | null>(null);
  const steps = initialSteps ?? localSteps;
  const setSteps = onStepsChange ?? setLocalSteps;
  const currentPage = controlledPage ?? localPage;
  const isEditing = controlledEditing ?? false;
  const showRequisites = controlledShowRequisites ?? false;

  const {
    setIsEditing
  } = useScriptUI();

  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const ui = useAppSelector((s) => selectShowScriptUi(s, projectName, sceneName));
  const markdownMode = ui.markdownMode;
  const annotationsMode = ui.annotationsMode;
  const playlistOptions = ui.playlistOptions;
  const selectedTrackId = ui.selectedTrackId;
  const lightChannels = ui.lightChannels;
  const selectedLightSlot = ui.selectedLightSlot;
  const [newAnnotation, setNewAnnotation] = useState<NewAnnotationDraft | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  useEffect(() => {
    if (!onStepsChange && initialSteps && initialSteps.length > 0) {
      setLocalSteps(initialSteps);
      setLocalPage((prev) => Math.min(prev, initialSteps.length - 1));
    }
  }, [initialSteps, onStepsChange]);

  useEffect(() => {
    void dispatch(initShowScriptUi({ projectSlug: projectName, sceneName }));
    void dispatch(loadSceneScriptMeta({ projectSlug: projectName, sceneName }));
  }, [dispatch, projectName, sceneName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(pageStorageKey, String(currentPage));
  }, [currentPage, pageStorageKey]);

  useEffect(() => {
    if (controlledPage != null) return;
    if (steps.length <= 0) {
      setLocalPage(0);
      return;
    }
    setLocalPage((prev) => Math.max(0, Math.min(prev, steps.length - 1)));
  }, [controlledPage, steps.length]);

  const saveScene = useCallback(async () => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) return;
    try {
      const current = await desktopApi.readProjectScene(projectName, sceneName);
      const images = pruneSceneImages(current?.images as Record<string, { remoteKey?: string; remoteUrl?: string }> | undefined, steps);
      const payload = { ...current, name: title, steps, lightChannels, images };
      const result = await desktopApi.saveProjectScene(
        projectName,
        sceneName,
        payload,
      );
      if (!result?.ok) {
        console.error("Failed to save scene:", result?.error);
        return;
      }
      console.log("Scene saved:", result.path);
    } catch (err) {
      console.error("Failed to save scene:", err);
    }
  }, [projectName, sceneName, steps, title, lightChannels]);

  useEffect(() => {
    if (!canSave || steps.length === 0) return;
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      return;
    }
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void saveScene();
    }, 600);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [canSave, saveScene, steps.length]);

  const handlePasteImage = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    const desktopApi = getDesktopApi();
    if (!desktopApi) return;
    if (!event.clipboardData) return;
    const items = Array.from(event.clipboardData.items || []);
    const imageItem = items.find((item) => item.type.startsWith("image/"));
    if (!imageItem) return;
    const file = imageItem.getAsFile();
    if (!file) return;

    event.preventDefault();
    try {
      const buffer = await file.arrayBuffer();
      const res = await desktopApi.addProjectImage(
        projectName,
        buffer,
        file.type,
        file.name,
      );
      if (!res?.ok) {
        console.error("Failed to paste image:", res?.error);
        return;
      }
      const markdownPath = res.markdownPath as string;
      const filename = markdownPath.replace(/^\.?\//, "").replace(/^images\/?/, "").trim() || markdownPath.split("/").pop() || "image.png";
      const accessToken = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
      const projectIdKey = `projectId:${projectName}`;
      let projectId = typeof window !== "undefined" ? localStorage.getItem(projectIdKey) : null;
      if (accessToken && !projectId) {
        try {
          const project = await ensureProject(accessToken, projectName, `Проект ${projectName}`);
          projectId = project.id;
          if (typeof window !== "undefined") localStorage.setItem(projectIdKey, projectId);
        } catch (_) { }
      }
      if (accessToken && projectId) {
        try {
          const api = getDesktopApi();
          if (api?.invoke) {
            const up = (await api.invoke("upload-project-file", {
              projectName,
              file: filename,
              accessToken,
              projectId,
              type: "image",
            })) as { ok?: boolean; key?: string; url?: string };
            if (up?.ok && up?.url) {
              const current = await desktopApi.readProjectScene(projectName, sceneName);
              const images = { ...(current?.images as Record<string, { remoteKey?: string; remoteUrl?: string }> | undefined), [filename]: { remoteKey: up.key, remoteUrl: up.url } };
              await desktopApi.saveProjectScene(projectName, sceneName, { ...current, images });
            }
          }
        } catch (err) {
          console.error("Markdown image upload failed:", err);
        }
      }
      const markdownSnippet = `\n\n![image](${markdownPath})\n\n`;
      insertIntoActiveMarkdown(markdownSnippet);
    } catch (err) {
      console.error("Failed to paste image:", err);
    }
  };

  const updateStep = <K extends keyof ScriptStep>(
    id: number,
    field: K,
    value: ScriptStep[K],
  ) => {
    setSteps(
      steps.map((step) => (step.id === id ? { ...step, [field]: value } : step))
    );
  };

  const insertIntoActiveMarkdown = (text: string) => {
    const step = steps[currentPage];
    if (!step) return;

    const textarea = markdownRef.current;
    type MarkdownField = "markdown" | "playMarkdown";
    const field: MarkdownField =
      markdownMode === "play" ? "playMarkdown" : "markdown";
    const currentValue = String(step[field] ?? "");

    const { value: nextValue, cursor } = insertAtSelection({
      value: currentValue,
      insert: text,
      selectionStart: textarea?.selectionStart,
      selectionEnd: textarea?.selectionEnd,
    });

    updateStep(step.id, field, nextValue);

    if (!textarea) return;
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(cursor, cursor);
    });
  };


  const currentStep = steps[currentPage];
  const currentRequisites = currentStep?.requisites ?? [];
  const activeMarkdownField: keyof ScriptStep =
    markdownMode === 'play' ? 'playMarkdown' : 'markdown';
  const activeMarkdown = (currentStep?.[activeMarkdownField] ?? '') as string;
  const activeField = (activeMarkdownField === 'playMarkdown'
    ? 'playMarkdown'
    : 'markdown') as ActorAnnotationField;

  const annotationsCacheKey =
    currentStep?.id != null
      ? `${projectName}:${sceneName}:${currentStep.id}:${activeField}`
      : null;
  const annotationsEntry = useAppSelector((s) =>
    annotationsCacheKey ? selectAnnotations(s, annotationsCacheKey) : null,
  );
  const annotations = annotationsEntry?.items ?? [];
  const annotationsLoading = annotationsEntry?.loading ?? false;
  const annotationsError = annotationsEntry?.error ?? null;

  // Метки недоступны в режиме редактирования (там textarea).
  useEffect(() => {
    if (isEditing && annotationsMode) {
      dispatch(
        showScriptActions.setAnnotationsMode({
          projectSlug: projectName,
          sceneName,
          enabled: false,
        }),
      );
      setNewAnnotation(null);
      setActiveAnnotationId(null);
    }
  }, [annotationsMode, dispatch, isEditing, projectName, sceneName]);

  // Аннотации: загрузка для текущего шага + поля (markdown / playMarkdown)
  useEffect(() => {
    if (currentStep?.id == null) {
      setNewAnnotation(null);
      setActiveAnnotationId(null);
      return;
    }
    if (!accessToken) return;
    const cacheKey = `${projectName}:${sceneName}:${currentStep.id}:${activeField}`;
    void dispatch(
      loadActorAnnotations({
        cacheKey,
        projectSlug: projectName,
        sceneName,
        stepId: currentStep.id,
        field: activeField,
      }),
    );
  }, [
    accessToken,
    activeField,
    currentStep?.id,
    dispatch,
    projectName,
    sceneName,
  ]);

  const toggleRequisite = (requisiteId: number) => {
    if (!currentStep) return;
    const nextRequisites = currentRequisites.map((item) =>
      item.id === requisiteId ? { ...item, checked: !item.checked } : item
    );
    updateStep(currentStep.id, 'requisites', nextRequisites);
  };

  const removeRequisite = (requisiteId: number) => {
    if (!currentStep) return;
    const nextRequisites = currentRequisites.filter((item) => item.id !== requisiteId);
    updateStep(currentStep.id, 'requisites', nextRequisites);
  };

  const addRequisite = () => {
    if (!currentStep) return;
    const label = newRequisite.trim();
    if (!label) return;
    const nextId =
      currentRequisites.reduce((acc, item) => Math.max(acc, item.id), 0) + 1;
    const nextItem: ScriptRequisite = { id: nextId, label, checked: false };
    updateStep(currentStep.id, 'requisites', [...currentRequisites, nextItem]);
    setNewRequisite('');
  };

  const copyRequisites = () => {
    if (!currentStep) return;
    requisitesClipboardRef.current = currentRequisites.map((item) => ({ ...item }));
  };

  const resetRequisites = () => {
    setSteps(
      steps.map((step) => ({
        ...step,
        requisites: (step.requisites ?? []).map((item) => ({
          ...item,
          checked: false,
        })),
      }))
    );
  };

  const pasteRequisites = () => {
    if (!currentStep || !requisitesClipboardRef.current) return;
    const cloned = requisitesClipboardRef.current.map((item) => ({ ...item }));
    updateStep(currentStep.id, 'requisites', cloned);
  };

  const hasCopiedRequisites = requisitesClipboardRef.current != null;

  return (
    <div className="show-script">
      <div className="script-content">
        <ScriptStepHeader
          isEditing={isEditing}
          currentStep={currentStep}
          updateStep={updateStep}
          controls={
            isEditing
              ? {
                  selectedTrackId,
                  playlistOptions,
                  lightChannels,
                  selectedLightSlot,
                  onSelectedTrackIdChange: (trackId) => {
                    dispatch(
                      showScriptActions.setSelectedTrackId({
                        projectSlug: projectName,
                        sceneName,
                        trackId,
                      }),
                    );
                  },
                  onLightChannelsChange: (next) => {
                    dispatch(
                      showScriptActions.setLightChannels({
                        projectSlug: projectName,
                        sceneName,
                        lightChannels: next,
                      }),
                    );
                  },
                  onSelectedLightSlotChange: (slot) => {
                    dispatch(
                      showScriptActions.setSelectedLightSlot({
                        projectSlug: projectName,
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

        {currentStep && (
          <div className="script-step-editor">

            <div className="script-step-body">
              <div className="script-markdown-pane">
                <ScriptMarkdownToolbar
                  isEditing={isEditing}
                  onToggleEditing={() => setIsEditing((p: boolean) => !p)}
                  markdownMode={markdownMode}
                  onSetMarkdownMode={(mode) => {
                    dispatch(
                      showScriptActions.setMarkdownMode({
                        projectSlug: projectName,
                        sceneName,
                        mode,
                      }),
                    );
                  }}
                  annotations={{
                    mode: annotationsMode,
                    onToggleMode: () => {
                      dispatch(
                        showScriptActions.setAnnotationsMode({
                          projectSlug: projectName,
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
                        updateStep(currentStep.id, activeMarkdownField, e.target.value)
                      }
                      onPaste={handlePasteImage}
                      placeholder={
                        markdownMode === 'play'
                          ? 'Текст пьесы для этого шага'
                          : 'Текст, изображения и ссылки на музыку'
                      }
                      rows={12}
                    />

                  </div>
                ) : (
                  <div className="form-group">
                    <ScriptMarkdownPreview
                      markdown={activeMarkdown}
                      projectName={projectName}
                      playlistOptions={playlistOptions}
                      lightChannels={lightChannels}
                      onTrackLinkClick={onTrackLinkClick}
                      annotationsMode={annotationsMode}
                      annotations={annotations}
                      newAnnotation={newAnnotation}
                      setNewAnnotation={setNewAnnotation}
                      activeAnnotationId={activeAnnotationId}
                      setActiveAnnotationId={setActiveAnnotationId}
                      onCreateAnnotation={async (draft) => {
                        if (!currentStep?.id) return;
                        if (!annotationsCacheKey) return;
                        void dispatch(
                          createAnnotation({
                            cacheKey: annotationsCacheKey,
                            projectSlug: projectName,
                            sceneName,
                            stepId: currentStep.id,
                            field: activeField,
                            startOffset: draft.start,
                            endOffset: draft.end,
                            selectedText: draft.selectedText,
                            noteText: draft.noteText,
                          }),
                        );
                      }}
                      onUpdateAnnotation={async (id, noteText) => {
                        if (!annotationsCacheKey) return;
                        void dispatch(
                          updateAnnotation({ cacheKey: annotationsCacheKey, id, noteText }),
                        );
                      }}
                      onDeleteAnnotation={async (id) => {
                        if (!annotationsCacheKey) return;
                        void dispatch(deleteAnnotation({ cacheKey: annotationsCacheKey, id }));
                      }}
                    />
                  </div>
                )}
              </div>
              <RequisitesPanel
                show={showRequisites}
                isEditing={isEditing}
                requisites={currentRequisites}
                hasCopiedRequisites={hasCopiedRequisites}
                newRequisite={newRequisite}
                setNewRequisite={setNewRequisite}
                onCopy={copyRequisites}
                onPaste={pasteRequisites}
                onResetAll={resetRequisites}
                onAdd={addRequisite}
                onToggle={toggleRequisite}
                onRemove={removeRequisite}
              />
            </div>

          </div>
        )}
      </div>
    </div >
  );
};
