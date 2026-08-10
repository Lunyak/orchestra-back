import { PageLoader } from "@shared/components/page-loader/PageLoader";
import {
  AppEditorMenubar,
  AppEditorMenubarProvider,
  AppEditorScriptModeNav,
  AppEditorScriptPanelsNav,
  useAppEditorMenubarActionsRender,
} from "@shared/components/app-editor-menubar";
import { useIsMobile } from "@shared/hooks/useIsMobile";
import { PlaylistSidebar } from "@shared/components/playlist-sidebar/PlaylistSidebar";
import { useAppDispatch, useAppSelector } from "@shared/store/hooks";
import { Suspense, useCallback, useEffect, useState } from "react";
import { FormatPlayTextModal } from "../../features/play-format/ui/FormatPlayTextModal";
import { subscribeOpenFormatPlay } from "../../features/spectacle/model/format-play-request";
import { useLocation } from "react-router-dom";
import { useProject } from "../../features/project";
import { usePlaybook } from "../../features/playbook";
import { playbookActions } from "../../features/playbook/model/playbook-slice";
import {
  selectActiveSceneMarkdownContext,
  selectShowScriptMarkdownUi,
  showScriptMarkdownActions,
} from "../../features/show-script-markdown/model/show-script-markdown-slice";
import { useScriptUI } from "../../features/script-ui";
import { scriptUiActions } from "../../features/script-ui/model/script-ui-slice";
import { RecentOrganizationsTracker } from "../../features/global-dashboard/ui/RecentOrganizationsTracker";
import { AppRouteDeclarations } from "./AppRouteDeclarations";
import { getRouteMeta, isScriptMarkdownRoute } from "./routeMeta";
import {
  getProjectSectionFromPath,
  isProjectPath,
} from "./paths";

const SCRIPT_SCENE_NAME = "script";

function AppRoutesContent() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const { registerPlaylistPlay, updateScene } = usePlaybook();
  const {
    showPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds,
    toggleHeaderSounds,
    isScenesCollapsed,
    setIsScenesCollapsed,
    toggleScenesCollapsed,
    mobilePlaylistOpen,
    setMobilePlaylistOpen,
    toggleMobilePlaylist,
    mobileScenesOpen,
    setMobileScenesOpen,
    toggleMobileScenes,
    isEditing,
  } = useScriptUI();

  const isMobile = useIsMobile();
  const [formatPlayModalOpen, setFormatPlayModalOpen] = useState(false);

  const { shouldShowScriptState, isSpectacleLayoutRoute } = getRouteMeta(
    location.pathname,
  );
  const projectSection = getProjectSectionFromPath(location.pathname);
  const isProjectRoute = isProjectPath(location.pathname);
  const isLightPlotRoute = projectSection === "light-plot";
  const spectacleRunTextHidden = useAppSelector(
    (state) => state.scriptUi.spectacleRunTextHidden,
  );
  const showScriptMainChrome = isScriptMarkdownRoute(location.pathname);
  const { currentScene, activeMarkdown, activeMarkdownField } = useAppSelector((state) =>
    projectName
      ? selectActiveSceneMarkdownContext(state, projectName, SCRIPT_SCENE_NAME)
      : { currentScene: undefined, activeMarkdown: "", activeMarkdownField: "markdown" as const },
  );
  const markdownMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME).markdownMode
      : "play",
  );
  const playOriginalMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME).playOriginalMode
      : false,
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

  useEffect(() => subscribeOpenFormatPlay(() => setFormatPlayModalOpen(true)), []);

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

  const formatPlaySourceText = String(activeMarkdown ?? "");

  const isRehearsalPlanRoute =
    projectSection === "board" ||
    projectSection === "tasks" ||
    projectSection === "sessions";

  const isPlaylistVisible = isMobile ? mobilePlaylistOpen : showPlaylistSidebar;
  const isScenesVisible = isMobile ? mobileScenesOpen : !isScenesCollapsed;
  const isHeaderScenesCollapsed = !isScenesVisible;
  const fallbackLabel = isRehearsalPlanRoute
    ? "Загрузка репетиций…"
    : "Загрузка страницы…";
  const suspenseFallback = isSpectacleLayoutRoute ? (
    <PageLoader
      variant="spectacle"
      showLeftSidebar={isPlaylistVisible}
      showRightSidebar={isScenesVisible}
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
    setMobileScenesOpen(false);
    toggleMobilePlaylist();
  }, [isMobile, togglePlaylist, setMobileScenesOpen, toggleMobilePlaylist]);

  const handleToggleSpectacleRunText = useCallback(() => {
    dispatch(scriptUiActions.toggleSpectacleRunTextHidden());
  }, [dispatch]);

  const handleToggleScenes = useCallback(() => {
    if (!isMobile) {
      toggleScenesCollapsed();
      return;
    }
    setMobilePlaylistOpen(false);
    if (!mobileScenesOpen) {
      setIsScenesCollapsed(false);
    }
    toggleMobileScenes();
  }, [
    isMobile,
    mobileScenesOpen,
    setIsScenesCollapsed,
    toggleScenesCollapsed,
    setMobilePlaylistOpen,
    toggleMobileScenes,
  ]);

  useAppEditorMenubarActionsRender(
    "script-mode-nav",
    10,
    () =>
      showScriptMainChrome ? (
        <AppEditorScriptModeNav
          isEditing={isEditing}
          annotationsMode={annotationsMode}
          onToggleAnnotations={toggleAnnotations}
          playOriginalMode={markdownMode === "play" ? playOriginalMode : undefined}
          onTogglePlayOriginal={
            markdownMode === "play" ? handleTogglePlayOriginal : undefined
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
          isScenesCollapsed={isHeaderScenesCollapsed}
          onToggleScenesCollapsed={handleToggleScenes}
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
      if (!currentScene) return;
      updateScene(currentScene.id, { [activeMarkdownField]: text });
    },
    [activeMarkdownField, currentScene, updateScene],
  );

  const handleApplyFormattedPlayTextSplit = useCallback(
    (args: { chunks: string[]; chunkTitles: string[] }) => {
      if (!currentScene || args.chunks.length === 0) return;
      dispatch(
        playbookActions.splitSceneContentIntoScenes({
          sourceSceneId: currentScene.id,
          targetField: activeMarkdownField,
          chunks: args.chunks,
          chunkTitles: args.chunkTitles,
        }),
      );
    },
    [activeMarkdownField, currentScene, dispatch],
  );

  return (
    <>
      <Suspense fallback={suspenseFallback}>
        <AppRouteDeclarations />
      </Suspense>
      {projectName && isProjectRoute ? (
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
      <RecentOrganizationsTracker />
      <div className="app-shell-with-menubar">
        <AppEditorMenubar />
        <div className="app-shell-body">
          <AppRoutesContent />
        </div>
      </div>
    </AppEditorMenubarProvider>
  );
}
