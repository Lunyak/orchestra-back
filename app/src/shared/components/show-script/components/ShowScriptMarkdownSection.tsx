import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  defaultScriptEditorInsertDefinitions,
  mergeInsertDefinitions,
  ScriptEditorInsertContextMenu,
  type ScriptEditorInsertItemDefinition,
} from "../../../../features/script-editor-insert-menu";
import { useScriptUI } from "../../../../features/script-ui";
import { usePlaybook } from "../../../../features/playbook";
import { useProjectRolesQuery } from "../../../../features/project/api/project-api";
import {
  initShowScriptMarkdownUi,
  loadSceneScriptMarkdownMeta,
  selectActiveSceneMarkdownContext,
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
} from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { useAppDispatch, useAppSelector } from "../../../store/hooks";
import type { ScriptScene } from "../../../types/script";
import type { NewAnnotationDraft } from "../annotations/ActorAnnotationsPopover";
import { LightKadrPanel } from "../../light-console/LightKadrPanel";
import "../../light-console/light-console.css";
import { ScriptMarkdownCodemirror, type ScriptMarkdownEditorHandle } from "./ScriptMarkdownCodemirror";
import { ScriptMarkdownPreview } from "./ScriptMarkdownPreview";
import { ScriptMarkdownToolbar } from "./ScriptMarkdownToolbar";
import { ShowScriptMarkdownToc } from "./ShowScriptMarkdownToc";
import { normalizeRoleToken } from "./markdown-preview-kadr-parsing";
import { useShowScriptLightKadrsSync } from "../hooks/useShowScriptLightKadrsSync";
import { useShowScriptMarkdownAnnotations } from "../hooks/useShowScriptMarkdownAnnotations";
import { useShowScriptMarkdownInsert } from "../hooks/useShowScriptMarkdownInsert";
import { useShowScriptMarkdownToc } from "../hooks/useShowScriptMarkdownToc";
import { useShowScriptSceneComment } from "../hooks/useShowScriptSceneComment";

const ScriptMarkdownCodemirrorLazy = lazy(() =>
  import("./ScriptMarkdownCodemirror").then((m) => ({ default: m.ScriptMarkdownCodemirror })),
);

const ScriptMarkdownPreviewLazy = lazy(() =>
  import("./ScriptMarkdownPreview").then((m) => ({ default: m.ScriptMarkdownPreview })),
);

interface IProps {
  projectSlug: string;
  sceneName: string;
  /** Доп. пункты контекстного меню вставки (режим редактирования). */
  extraScriptEditorInsertItems?: ScriptEditorInsertItemDefinition[];
  updateSceneField: <K extends keyof ScriptScene>(
    id: number,
    field: K,
    value: ScriptScene[K],
  ) => void;
  onTrackLinkClick: (trackId: number) => void;
  onSoundLinkClick?: (soundId: number) => void;
  onCreateSceneFromSelection?: (
    sourceSceneId: number,
    selectedText: string,
    trimmedSourceText: string,
    targetField: "markdown" | "playMarkdown" | "explicationMarkdown",
  ) => void;
  requisitesPane?: React.ReactNode;
  renderBody?: (args: {
    markdownPane: React.ReactNode;
    currentScene: ScriptScene | undefined;
  }) => React.ReactNode;
  /**
   * Откладывает загрузку CodeMirror / превью (отдельные чанки) до первого показа;
   * для канбан-модалки + граница Suspense по режиму (схема / экспликация / текст × чтение|редактирование).
   */
  lazyScriptBody?: boolean;
  /** Табы режима сцены в теле страницы (на главной — в menubar). */
  inlineMarkdownTabs?: boolean;
}

export function ShowScriptMarkdownSection({
  projectSlug,
  sceneName,
  extraScriptEditorInsertItems,
  updateSceneField,
  onTrackLinkClick,
  onSoundLinkClick,
  onCreateSceneFromSelection,
  requisitesPane,
  renderBody,
  lazyScriptBody = false,
  inlineMarkdownTabs = true,
}: IProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { playbookData } = usePlaybook();
  const { data: rolesRes } = useProjectRolesQuery(projectSlug, {
    skip: !projectSlug,
  });
  const roles = rolesRes?.roles ?? [];
  const accessToken = useAppSelector((s) => s.auth.accessToken);
  const playbookDataRevision = useAppSelector((s) => s.playbook.playbookDataRevision);
  const serverShadowRevision = useAppSelector((s) => s.playbook.serverShadowRevision);

  const ui = useAppSelector((s) => selectShowScriptMarkdownUi(s, projectSlug, sceneName));
  const markdownMode = ui.markdownMode;
  const annotationsMode = ui.annotationsMode;
  const playlistOptions = ui.playlistOptions;
  const soundsOptions = ui.soundsOptions;
  const lightChannels = ui.lightChannels;

  const { isEditing } = useScriptUI();

  const { currentScene, activeMarkdownField, activeMarkdown, activeField } = useAppSelector(
    (s) => selectActiveSceneMarkdownContext(s, projectSlug, sceneName),
  );

  const lightFaders =
    playbookData?.lightFaders && playbookData.lightFaders.v === 1
      ? playbookData.lightFaders
      : null;
  const lightPrograms =
    playbookData?.lightPrograms && playbookData.lightPrograms.v === 1
      ? playbookData.lightPrograms
      : null;

  const markdownRef = useRef<ScriptMarkdownEditorHandle | null>(null);

  const [newAnnotation, setNewAnnotation] = useState<NewAnnotationDraft | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  const editorTocEnabled = ui.editorTocEnabled;

  const scriptEditorInsertDefinitions = useMemo(
    () =>
      extraScriptEditorInsertItems?.length
        ? mergeInsertDefinitions(defaultScriptEditorInsertDefinitions, extraScriptEditorInsertItems)
        : defaultScriptEditorInsertDefinitions,
    [extraScriptEditorInsertItems],
  );

  const { kadrLayoutEnabled, hasKadrSections, tocItems, jumpToOffset } = useShowScriptMarkdownToc({
    activeMarkdown,
    markdownMode,
  });

  const { activeLightKadrId, setActiveLightKadrId } = useShowScriptLightKadrsSync({
    currentScene,
    activeMarkdown,
    isEditing,
    updateSceneField,
    markdownRef,
  });

  const {
    sceneCommentDraft,
    setSceneCommentDraft,
    sceneCommentEntry,
    saveSceneComment,
  } = useShowScriptSceneComment({
    projectSlug,
    sceneName,
    sceneId: currentScene?.id,
  });

  const {
    insertMenu,
    setInsertMenu,
    insertMenuRows,
    handleInsertMenuPick,
    handleClipboardImagePaste,
    insertIntoActiveMarkdown,
  } = useShowScriptMarkdownInsert({
    projectSlug,
    sceneName,
    accessToken,
    currentScene,
    activeMarkdown,
    activeMarkdownField,
    playlistOptions,
    soundsOptions,
    lightChannels,
    scriptEditorInsertDefinitions,
    markdownRef,
    updateSceneField,
    onCreateSceneFromSelection,
  });

  const {
    handleCreateAnnotation,
    handleUpdateAnnotation,
    handleDeleteAnnotation,
  } = useShowScriptMarkdownAnnotations({
    projectSlug,
    sceneName,
    sceneId: currentScene?.id,
    activeField,
  });

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
  }, [dispatch, projectSlug, sceneName, playbookDataRevision, serverShadowRevision]);

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

  const handleSceneTitleChange = useCallback(
    (title: string) => {
      if (!currentScene) return;
      updateSceneField(currentScene.id, "title", title);
    },
    [currentScene, updateSceneField],
  );

  const handleRoleLabelClick = useCallback(
    (roleToken: string) => {
      const token = normalizeRoleToken(roleToken);
      if (!token) return;
      const match =
        roles.find((role) => normalizeRoleToken(String(role?.title ?? "")) === token) ??
        roles.find((role) => normalizeRoleToken(String(role?.key ?? "")) === token) ??
        roles.find((role) =>
          (Array.isArray(role?.aliases) ? role.aliases : []).some(
            (alias) => normalizeRoleToken(String(alias ?? "")) === token,
          ),
        );
      const roleId = match?.id != null ? String(match.id) : "";
      if (!roleId) return;
      navigate(`/role-workbook/${encodeURIComponent(roleId)}`);
    },
    [navigate, roles],
  );

  const markdownEditorProps = currentScene
    ? {
        ref: markdownRef,
        id: `markdown-${currentScene.id}`,
        className: kadrLayoutEnabled ? "script-markdown-cm--kadr-layout" : undefined,
        kadrSectionBlocks: kadrLayoutEnabled,
        playTextMode: markdownMode === "play",
        value: String(activeMarkdown ?? ""),
        projectSlug,
        accessToken,
        lightChannels,
        onTrackLinkClick,
        onRoleLabelClick: handleRoleLabelClick,
        onChange: (next: string) => updateSceneField(currentScene.id, activeMarkdownField, next),
        onClipboardImagePaste: handleClipboardImagePaste,
        sceneTitle: currentScene.title ?? "",
        sceneTitleEditing: isEditing,
        onSceneTitleChange: handleSceneTitleChange,
        placeholder:
          markdownMode === "play"
            ? "Текст пьесы для этой сцены"
            : markdownMode === "explication"
              ? "Режиссёрская экспликация для этой сцены"
              : "Текст, изображения и ссылки на музыку",
      }
    : null;

  const markdownEditorKey = currentScene
    ? `md-${currentScene.id}-${String(activeMarkdownField)}`
    : null;

  const markdownPane = currentScene ? (
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
          <div className="script-kadr-light-banner__actions">
            <button
              type="button"
              className="script-kadr-light-banner__btn script-kadr-light-banner__btn--primary"
              onClick={() => navigate("/light-plot")}
            >
              Спектакль
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
              Свет этой сцены
            </button>
          </div>
        </div>
      ) : null}

      {markdownMode === "light" ? (
        <div className="script-scene-light-pane">
          <div className="script-kadr-light-banner script-kadr-light-banner--compact" role="note">
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
            scene={currentScene}
            markdown={String(activeMarkdown ?? "")}
            activeKadrId={activeLightKadrId}
            onActiveKadrIdChange={setActiveLightKadrId}
            lightChannels={lightChannels}
            lightFaders={lightFaders}
            lightPrograms={lightPrograms}
            spotlights={currentScene?.theaterSpotlights}
            onUpdateScene={(changes) => {
              if (!currentScene) return;
              if (changes.lightKadrs) {
                updateSceneField(currentScene.id, "lightKadrs", changes.lightKadrs);
              }
            }}
            onUpdateMarkdown={(next) => {
              if (!currentScene) return;
              const ed = markdownRef.current;
              if (ed) {
                ed.applyDocument(next, ed.getSelection()?.from ?? next.length);
              } else {
                updateSceneField(currentScene.id, activeMarkdownField, next);
              }
            }}
          />
        </div>
      ) : markdownMode === "requisites" ? (
        <div className="script-scene-requisites-pane">
          {requisitesPane}
        </div>
      ) : markdownMode === "comments" ? (
        <div className="script-scene-comment-pane">
          <textarea
            id={`scene-comment-${currentScene.id}`}
            className="script-scene-comment-pane__input"
            value={sceneCommentDraft}
            rows={10}
            disabled={Boolean(sceneCommentEntry?.loading)}
            placeholder="Заметки, договорённости и комментарии к этой сцене…"
            onChange={(e) => setSceneCommentDraft(e.target.value)}
            onBlur={saveSceneComment}
          />
          <div className="script-scene-comment-pane__hint">
            {sceneCommentEntry?.saving
              ? "Сохраняем…"
              : sceneCommentEntry?.error
                ? sceneCommentEntry.error
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
              <ShowScriptMarkdownToc
                items={tocItems}
                onJump={(offset) =>
                  jumpToOffset(offset, markdownRef, String(activeMarkdown ?? ""))
                }
              />
            ) : null}

            <div
              className={[
                "script-markdown-editor-main",
                markdownMode === "play" ? "script-markdown-editor-main--play" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onContextMenu={(event) => {
                event.preventDefault();
                setInsertMenu({ x: event.clientX, y: event.clientY });
              }}
            >
              <label className="visually-hidden" htmlFor={`markdown-${currentScene.id}`}>
                Текст сцены
              </label>
              {lazyScriptBody ? (
                <Suspense
                  key={`${markdownMode}-ed`}
                  fallback={<div className="script-markdown-body-fallback">Загрузка редактора…</div>}
                >
                  {markdownEditorProps && markdownEditorKey ? (
                    <ScriptMarkdownCodemirrorLazy key={markdownEditorKey} {...markdownEditorProps} />
                  ) : null}
                </Suspense>
              ) : markdownEditorProps && markdownEditorKey ? (
                <ScriptMarkdownCodemirror key={markdownEditorKey} {...markdownEditorProps} />
              ) : null}
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
                showSceneTitle={inlineMarkdownTabs}
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
              showSceneTitle={inlineMarkdownTabs}
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
      {renderBody ? renderBody({ markdownPane, currentScene }) : markdownPane}
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
