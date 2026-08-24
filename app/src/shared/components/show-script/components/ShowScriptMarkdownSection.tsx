import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import {
  defaultScriptEditorInsertDefinitions,
  mergeInsertDefinitions,
  ScriptEditorInsertContextMenu,
  type ScriptEditorInsertItemDefinition,
} from "../../../../features/script-editor-insert-menu";
import { useScriptUI } from "../../../../features/script-ui";
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
import { ScriptMarkdownCodemirror, type ScriptMarkdownEditorHandle } from "./ScriptMarkdownCodemirror";
import { ScriptMarkdownPreview } from "./ScriptMarkdownPreview";
import { ScriptMarkdownToolbar } from "./ScriptMarkdownToolbar";
import { normalizeRoleToken } from "./markdown-preview-kadr-parsing";
import { useShowScriptKadrLayout } from "../hooks/useShowScriptKadrLayout";
import { useShowScriptMarkdownAnnotations } from "../hooks/useShowScriptMarkdownAnnotations";
import { useShowScriptMarkdownInsert } from "../hooks/useShowScriptMarkdownInsert";
import { useShowScriptSceneComment } from "../hooks/useShowScriptSceneComment";
import { AppEditorScriptAnnotationsToggle, AppEditorScriptModeToggle, AppEditorScriptPlayOriginalToggle, AppEditorScriptSceneTitle } from "../../app-editor-menubar";
import { useAppEditorMenubarEndToolsRender } from "../../app-editor-menubar/AppEditorMenubarContext";
import {
  SpectacleTechChromePortal,
  useSpectacleTechChromeCenterTarget,
} from "../../../../features/spectacle/ui/spectacle-tech-chrome-slots";
import { ScriptSceneChromeMenu } from "./ScriptSceneChromeMenu";
import type { ShowScriptMarkdownMode } from "../../../../features/show-script-markdown/model/show-script-markdown-slice";

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
  renderBody,
  lazyScriptBody = false,
  inlineMarkdownTabs = true,
}: IProps) {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
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

  const { isEditing, toggleEditing } = useScriptUI();
  const compactStrip = useCompactKadrStrip();
  const directionSwitchCenter = useSpectacleTechChromeCenterTarget();

  const { currentScene, activeMarkdownField, activeMarkdown, activeField } = useAppSelector(
    (s) => selectActiveSceneMarkdownContext(s, projectSlug, sceneName),
  );

  const markdownRef = useRef<ScriptMarkdownEditorHandle | null>(null);

  const [newAnnotation, setNewAnnotation] = useState<NewAnnotationDraft | null>(null);
  const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

  const scriptEditorInsertDefinitions = useMemo(
    () =>
      extraScriptEditorInsertItems?.length
        ? mergeInsertDefinitions(defaultScriptEditorInsertDefinitions, extraScriptEditorInsertItems)
        : defaultScriptEditorInsertDefinitions,
    [extraScriptEditorInsertItems],
  );

  const { kadrLayoutEnabled } = useShowScriptKadrLayout({
    activeMarkdown,
    markdownMode,
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

  const handleSetMarkdownMode = useCallback(
    (mode: ShowScriptMarkdownMode) => {
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
    },
    [dispatch, projectSlug, sceneName],
  );

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

  const titleInDirectionSwitch = Boolean(directionSwitchCenter);

  const toggleAnnotationsMode = useCallback(() => {
    if (isEditing) return;
    dispatch(
      showScriptMarkdownActions.setAnnotationsMode({
        projectSlug,
        sceneName,
        enabled: !annotationsMode,
      }),
    );
  }, [annotationsMode, dispatch, isEditing, projectSlug, sceneName]);

  const annotationsToggle =
    currentScene && markdownMode !== "comments" ? (
      <AppEditorScriptAnnotationsToggle
        className="script-annotations-toggle--dock"
        annotationsMode={annotationsMode}
        onToggle={toggleAnnotationsMode}
        disabled={isEditing}
      />
    ) : null;

  const playOriginalToggle =
    currentScene && markdownMode === "play" ? (
      <AppEditorScriptPlayOriginalToggle
        className="script-play-original-toggle--dock"
        playOriginalMode={ui.playOriginalMode}
        onToggle={togglePlayOriginalMode}
      />
    ) : null;

  const belowModeStack =
    !titleInDirectionSwitch && (annotationsToggle || playOriginalToggle) ? (
      <div className="script-scene-title-below-mode">
        {annotationsToggle}
        {playOriginalToggle}
      </div>
    ) : null;

  const sceneChromeMenu =
    compactStrip && titleInDirectionSwitch && currentScene ? (
      <ScriptSceneChromeMenu
        variant="menubar"
        markdownMode={markdownMode}
        onSetMarkdownMode={handleSetMarkdownMode}
        isModeEditing={isEditing}
        onToggleModeEditing={toggleEditing}
        showEditToggle={markdownMode !== "comments"}
        annotationsMode={annotationsMode}
        onToggleAnnotations={toggleAnnotationsMode}
        annotationsDisabled={isEditing}
        showAnnotations={markdownMode !== "comments"}
        playOriginalMode={ui.playOriginalMode}
        onTogglePlayOriginal={togglePlayOriginalMode}
        showPlayOriginal={markdownMode === "play"}
      />
    ) : null;

  useAppEditorMenubarEndToolsRender(
    "script-scene-chrome-menu",
    10,
    () => sceneChromeMenu,
  );

  const showSceneTitleInChrome =
    Boolean(currentScene) &&
    (markdownMode !== "comments" || (compactStrip && titleInDirectionSwitch));

  const sceneTitleNode =
    showSceneTitleInChrome && currentScene ? (
      <AppEditorScriptSceneTitle
        title={currentScene.title ?? ""}
        titleEditable={isEditing}
        onTitleChange={handleSceneTitleChange}
        isModeEditing={isEditing}
        onToggleModeEditing={toggleEditing}
        showModeToggle={!titleInDirectionSwitch && markdownMode !== "comments"}
        belowModeToggle={
          !titleInDirectionSwitch && markdownMode !== "comments" ? belowModeStack : null
        }
      />
    ) : null;

  const sceneTitleInline =
    sceneTitleNode && !titleInDirectionSwitch ? (
      <div className="script-scene-title-mount">{sceneTitleNode}</div>
    ) : null;

  const editModeToggleDock =
    currentScene && markdownMode !== "comments" && titleInDirectionSwitch ? (
      <AppEditorScriptModeToggle
        className="script-scene-title-mode-btn--in-dock"
        isModeEditing={isEditing}
        onToggleModeEditing={toggleEditing}
      />
    ) : null;

  const scriptChromeDock =
    !compactStrip &&
    titleInDirectionSwitch &&
    (editModeToggleDock || annotationsToggle || playOriginalToggle) ? (
      <div className="script-scene-chrome-dock">
        {editModeToggleDock}
        {annotationsToggle}
        {playOriginalToggle}
      </div>
    ) : null;

  const markdownPane = currentScene ? (
    <div className="script-markdown-pane" data-markdown-mode={markdownMode}>
      {scriptChromeDock}
      {inlineMarkdownTabs ? (
        <ScriptMarkdownToolbar
          markdownMode={markdownMode}
          showTabs={inlineMarkdownTabs}
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
        />
      ) : null}

      {sceneTitleInline}

      {markdownMode === "comments" ? (
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
                <Suspense key={`${markdownMode}-ed`} fallback={null}>
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
        <div
          className={[
            "form-group form-group-grow",
            kadrLayoutEnabled ? "script-markdown-edit--kadr" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {lazyScriptBody ? (
            <Suspense key={`${markdownMode}-ro`} fallback={null}>
              <ScriptMarkdownPreviewLazy
                projectName={projectSlug}
                sceneName={sceneName}
                showSceneTitle={false}
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
              showSceneTitle={false}
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
      <SpectacleTechChromePortal center={sceneTitleNode} />
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
