import { PageLoader } from "@shared/components/page-loader/PageLoader";
import {
  AppEditorMenubar,
  AppEditorMenubarProvider,
  AppEditorScriptFormatPlayMenu,
  AppEditorScriptFormattingMenu,
  AppEditorScriptMarkdownMenu,
  AppEditorScriptModeNav,
  AppEditorScriptPanelsNav,
  AppEditorScriptStepTitle,
  useAppEditorMenubarActionsRender,
  useAppEditorMenubarCenterRender,
  useAppEditorViewMenuRender,
  requestScriptTokenizeMatches,
  type ScriptTokenizeMode,
} from "@shared/components/app-editor-menubar";
import { useIsMobile } from "@shared/hooks/useIsMobile";
import { PlaylistSidebar } from "@shared/components/playlist-sidebar/PlaylistSidebar";
import { useAppDispatch, useAppSelector } from "@shared/store/hooks";
import { Suspense, useCallback, useState } from "react";
import { FormatPlayTextModal } from "../../features/play-format/ui/FormatPlayTextModal";
import { useLocation } from "react-router-dom";
import { useProject } from "../../features/project";
import { useScene } from "../../features/scene";
import { sceneActions } from "../../features/scene/model/scene-slice";
import {
  selectActiveStepMarkdownContext,
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
} from "../../features/show-script-markdown/model/show-script-markdown-slice";
import { useScriptUI } from "../../features/script-ui";
import { scriptUiActions } from "../../features/script-ui/model/script-ui-slice";
import { AppRouteDeclarations } from "./AppRouteDeclarations";
import { getRouteMeta, isScriptMarkdownRoute } from "./routeMeta";
import type { ShowScriptMarkdownMode } from "../../features/show-script-markdown/model/show-script-markdown-slice";

const SCRIPT_SCENE_NAME = "script";

function AppRoutesContent() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const { registerPlaylistPlay, updateStep } = useScene();
  const {
    showPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds,
    toggleHeaderSounds,
    isStepsCollapsed,
    setIsStepsCollapsed,
    toggleStepsCollapsed,
    mobilePlaylistOpen,
    setMobilePlaylistOpen,
    toggleMobilePlaylist,
    mobileStepsOpen,
    setMobileStepsOpen,
    toggleMobileSteps,
    isEditing,
    toggleEditing,
  } = useScriptUI();

  const isMobile = useIsMobile();
  const [formatPlayModalOpen, setFormatPlayModalOpen] = useState(false);

  const { shouldShowScriptState, isSpectacleLayoutRoute } = getRouteMeta(
    location.pathname,
  );
  const isLightPlotRoute = location.pathname === "/light-plot";
  const spectacleRunTextHidden = useAppSelector(
    (state) => state.scriptUi.spectacleRunTextHidden,
  );
  const showScriptMainChrome = isScriptMarkdownRoute(location.pathname);
  const { currentStep, activeMarkdown, activeMarkdownField } = useAppSelector((state) =>
    projectName
      ? selectActiveStepMarkdownContext(state, projectName, SCRIPT_SCENE_NAME)
      : { currentStep: undefined, activeMarkdown: "", activeMarkdownField: "markdown" as const },
  );
  const markdownMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME).markdownMode
      : "notes",
  );
  const playOriginalMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME).playOriginalMode
      : false,
  );
  const editorTocEnabled = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME).editorTocEnabled
      : true,
  );
  const annotationsMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME).annotationsMode
      : true,
  );

  const toggleAnnotations = useCallback(() => {
    if (!projectName || isEditing) return;
    dispatch(
      showScriptMarkdownActions.setAnnotationsMode({
        projectSlug: projectName,
        sceneName: SCRIPT_SCENE_NAME,
        enabled: !annotationsMode,
      }),
    );
  }, [annotationsMode, dispatch, isEditing, projectName]);

  const handleSetMarkdownMode = useCallback(
    (mode: ShowScriptMarkdownMode) => {
      if (!projectName) return;
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem(
            `showScript:markdownMode:${projectName}:${SCRIPT_SCENE_NAME}`,
            mode,
          );
        }
      } catch {
        // ignore
      }
      dispatch(
        showScriptMarkdownActions.setMarkdownMode({
          projectSlug: projectName,
          sceneName: SCRIPT_SCENE_NAME,
          mode,
        }),
      );
    },
    [dispatch, projectName],
  );

  const handleTokenizeMatches = useCallback(
    (query: string, mode: ScriptTokenizeMode) => {
      return requestScriptTokenizeMatches(query, mode)?.count ?? 0;
    },
    [],
  );

  const handleTogglePlayOriginal = useCallback(() => {
    if (!projectName) return;
    const next = !playOriginalMode;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `showScript:playOriginalMode:${projectName}:${SCRIPT_SCENE_NAME}`,
          String(next),
        );
      }
    } catch {
      // ignore
    }
    dispatch(
      showScriptMarkdownActions.setPlayOriginalMode({
        projectSlug: projectName,
        sceneName: SCRIPT_SCENE_NAME,
        enabled: next,
      }),
    );
  }, [dispatch, playOriginalMode, projectName]);

  const kadrMarkdownModes =
    markdownMode === "notes" || markdownMode === "explication" || markdownMode === "play";

  const canFormatPlayText =
    kadrMarkdownModes &&
    Boolean(currentStep) &&
    !(markdownMode === "play" && playOriginalMode);

  const formatPlaySourceText = String(activeMarkdown ?? "");

  const handleToggleEditorToc = useCallback(() => {
    if (!projectName) return;
    const next = !editorTocEnabled;
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(
          `showScript:editorToc:${projectName}:${SCRIPT_SCENE_NAME}`,
          String(next),
        );
      }
    } catch {
      // ignore
    }
    dispatch(
      showScriptMarkdownActions.setEditorTocEnabled({
        projectSlug: projectName,
        sceneName: SCRIPT_SCENE_NAME,
        enabled: next,
      }),
    );
  }, [dispatch, editorTocEnabled, projectName]);

  const isBoardRoute = location.pathname === "/board";

  const isPlaylistVisible = isMobile ? mobilePlaylistOpen : showPlaylistSidebar;
  const isStepsVisible = isMobile ? mobileStepsOpen : !isStepsCollapsed;
  const isHeaderStepsCollapsed = !isStepsVisible;
  const fallbackLabel = isBoardRoute ? "Загрузка доски…" : "Загрузка страницы…";
  const suspenseFallback = isSpectacleLayoutRoute ? (
    <PageLoader
      variant="spectacle"
      showLeftSidebar={isPlaylistVisible}
      showRightSidebar={isStepsVisible}
      showTopBar={showHeaderSounds}
      label="Загрузка страницы…"
    />
  ) : (
    <PageLoader variant="simple" label={fallbackLabel} />
  );

  const handleTogglePlaylist = useCallback(() => {
    if (!isMobile) {
      togglePlaylist();
      return;
    }
    setMobileStepsOpen(false);
    toggleMobilePlaylist();
  }, [isMobile, togglePlaylist, setMobileStepsOpen, toggleMobilePlaylist]);

  const handleToggleSpectacleRunText = useCallback(() => {
    dispatch(scriptUiActions.toggleSpectacleRunTextHidden());
  }, [dispatch]);

  const handleToggleSteps = useCallback(() => {
    if (!isMobile) {
      toggleStepsCollapsed();
      return;
    }
    setMobilePlaylistOpen(false);
    if (!mobileStepsOpen) {
      setIsStepsCollapsed(false);
    }
    toggleMobileSteps();
  }, [
    isMobile,
    mobileStepsOpen,
    setIsStepsCollapsed,
    toggleStepsCollapsed,
    setMobilePlaylistOpen,
    toggleMobileSteps,
  ]);

  useAppEditorViewMenuRender(
    "script-markdown-menu",
    0,
    () =>
      showScriptMainChrome && currentStep ? (
        <>
          <AppEditorScriptMarkdownMenu
            markdownMode={markdownMode}
            onSetMarkdownMode={handleSetMarkdownMode}
          />
          <AppEditorScriptFormattingMenu
            disabled={!isEditing || !kadrMarkdownModes}
            onTokenizeMatches={handleTokenizeMatches}
          />
          <AppEditorScriptFormatPlayMenu
            disabled={!canFormatPlayText}
            onOpen={() => setFormatPlayModalOpen(true)}
          />
        </>
      ) : null,
  );

  const handleStepTitleChange = useCallback(
    (title: string) => {
      if (!currentStep) return;
      updateStep(currentStep.id, { title });
    },
    [currentStep, updateStep],
  );

  useAppEditorMenubarCenterRender(
    "script-step-title",
    0,
    () =>
      showScriptMainChrome && currentStep ? (
        <AppEditorScriptStepTitle
          title={currentStep.title ?? ""}
          isEditing={isEditing}
          onTitleChange={handleStepTitleChange}
        />
      ) : null,
  );

  useAppEditorMenubarActionsRender(
    "script-mode-nav",
    10,
    () =>
      showScriptMainChrome ? (
        <AppEditorScriptModeNav
          isEditing={isEditing}
          onToggleEditing={toggleEditing}
          annotationsMode={annotationsMode}
          onToggleAnnotations={toggleAnnotations}
          playOriginalMode={markdownMode === "play" ? playOriginalMode : undefined}
          onTogglePlayOriginal={
            markdownMode === "play" ? handleTogglePlayOriginal : undefined
          }
          editorTocEnabled={
            isEditing && kadrMarkdownModes ? editorTocEnabled : undefined
          }
          onToggleEditorToc={
            isEditing && kadrMarkdownModes ? handleToggleEditorToc : undefined
          }
        />
      ) : null,
  );

  useAppEditorMenubarActionsRender(
    "script-panels-nav",
    0,
    () =>
      shouldShowScriptState ? (
        <AppEditorScriptPanelsNav
          showPlaylist={isPlaylistVisible}
          onTogglePlaylist={handleTogglePlaylist}
          showHeaderSounds={showHeaderSounds}
          onToggleHeaderSounds={toggleHeaderSounds}
          isStepsCollapsed={isHeaderStepsCollapsed}
          onToggleStepsCollapsed={handleToggleSteps}
          showSpectacleRunTextToggle={isLightPlotRoute}
          spectacleRunTextHidden={spectacleRunTextHidden}
          onToggleSpectacleRunText={
            isLightPlotRoute ? handleToggleSpectacleRunText : undefined
          }
        />
      ) : null,
  );

  const handleApplyFormattedPlayText = useCallback(
    (text: string) => {
      if (!currentStep) return;
      updateStep(currentStep.id, { [activeMarkdownField]: text });
    },
    [activeMarkdownField, currentStep, updateStep],
  );

  const handleApplyFormattedPlayTextSplit = useCallback(
    (args: { chunks: string[]; chunkTitles: string[] }) => {
      if (!currentStep || args.chunks.length === 0) return;
      dispatch(
        sceneActions.splitStepContentIntoSteps({
          sourceStepId: currentStep.id,
          targetField: activeMarkdownField,
          chunks: args.chunks,
          chunkTitles: args.chunkTitles,
        }),
      );
    },
    [activeMarkdownField, currentStep, dispatch],
  );

  return (
    <>
      <Suspense fallback={suspenseFallback}>
        <AppRouteDeclarations />
      </Suspense>
      {projectName ? (
        <PlaylistSidebar
          projectName={projectName}
          sceneName={SCRIPT_SCENE_NAME}
          mode="player"
          onRegisterPlayHandler={registerPlaylistPlay}
        />
      ) : null}
      <FormatPlayTextModal
        isOpen={formatPlayModalOpen}
        sourceText={formatPlaySourceText}
        onClose={() => setFormatPlayModalOpen(false)}
        onApply={handleApplyFormattedPlayText}
        onApplySplit={handleApplyFormattedPlayTextSplit}
      />
    </>
  );
}

function ProjectorRoutesOnly() {
  return (
    <Suspense fallback={<PageLoader variant="view" label="Проектор…" />}>
      <AppRouteDeclarations />
    </Suspense>
  );
}

export function AppRoutes() {
  const location = useLocation();
  const isProjectorOutput = location.pathname === "/projector-output";

  if (isProjectorOutput) {
    return <ProjectorRoutesOnly />;
  }

  return (
    <AppEditorMenubarProvider>
      <div className="app-shell-with-menubar">
        <AppEditorMenubar />
        <div className="app-shell-body">
          <AppRoutesContent />
        </div>
      </div>
    </AppEditorMenubarProvider>
  );
}
