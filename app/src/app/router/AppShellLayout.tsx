import {
  AppEditorMenubar,
  AppEditorScriptPanelsNav,
  useAppEditorMenubarActionsRender,
} from "@shared/components/app-editor-menubar";
import { PageLoader } from "@shared/components/page-loader/PageLoader";
import {
  PageBootLoader,
  usePageBoot,
} from "@shared/components/page-loader/page-boot";
import { useIsMobile } from "@shared/hooks/useIsMobile";
import { useAppDispatch, useAppSelector } from "@shared/store/hooks";
import cn from "classnames";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { FormatPlayTextModal } from "../../features/play-format/ui/FormatPlayTextModal";
import { useProject } from "../../features/project";
import { playbookActions } from "../../features/playbook/model/playbook-slice";
import { useScriptUI } from "../../features/script-ui";
import { scriptUiActions } from "../../features/script-ui/model/script-ui-slice";
import { selectActiveSceneMarkdownContext } from "../../features/show-script-markdown/model/show-script-markdown-slice";
import { subscribeOpenFormatPlay } from "../../features/spectacle/model/format-play-request";
import { AppRouteDeclarations } from "./AppRouteDeclarations";
import { getProjectSectionFromPath, isProjectPath } from "./paths";
import { getRouteMeta } from "./routeMeta";

const SCRIPT_SCENE_NAME = "script";

function FormatPlayModalHost() {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const [open, setOpen] = useState(false);

  useEffect(() => subscribeOpenFormatPlay(() => setOpen(true)), []);

  const markdownContext = useAppSelector((state) =>
    open && projectName
      ? selectActiveSceneMarkdownContext(state, projectName, SCRIPT_SCENE_NAME)
      : null,
  );

  const handleApplyFormattedPlayText = useCallback(
    (text: string) => {
      if (!markdownContext?.currentScene) return;
      dispatch(
        playbookActions.updateScene({
          id: markdownContext.currentScene.id,
          changes: { [markdownContext.activeMarkdownField]: text },
        }),
      );
    },
    [dispatch, markdownContext],
  );

  const handleApplyFormattedPlayTextSplit = useCallback(
    (args: { chunks: string[]; chunkTitles: string[] }) => {
      if (!markdownContext?.currentScene || args.chunks.length === 0) return;
      dispatch(
        playbookActions.splitSceneContentIntoScenes({
          sourceSceneId: markdownContext.currentScene.id,
          targetField: markdownContext.activeMarkdownField,
          chunks: args.chunks,
          chunkTitles: args.chunkTitles,
        }),
      );
    },
    [dispatch, markdownContext],
  );

  if (!open) return null;

  return (
    <FormatPlayTextModal
      isOpen
      sourceText={String(markdownContext?.activeMarkdown ?? "")}
      onClose={() => setOpen(false)}
      onApply={handleApplyFormattedPlayText}
      onApplySplit={handleApplyFormattedPlayTextSplit}
    />
  );
}

function AppRoutesContent() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const {
    showPlaylistSidebar,
    togglePlaylist,
    isScenesCollapsed,
    setIsScenesCollapsed,
    toggleScenesCollapsed,
    mobilePlaylistOpen,
    setMobilePlaylistOpen,
    toggleMobilePlaylist,
    mobileScenesOpen,
    setMobileScenesOpen,
    toggleMobileScenes,
  } = useScriptUI();
  const isMobile = useIsMobile();

  const { shouldShowScriptState, isSpectacleLayoutRoute } = getRouteMeta(
    location.pathname,
  );
  const projectSection = getProjectSectionFromPath(location.pathname);
  const isLightPlotRoute = projectSection === "light-plot";
  const isSuferRoute = projectSection === "sufer";
  const isRehearsalPlanRoute =
    projectSection === "board" ||
    projectSection === "tasks" ||
    projectSection === "sessions";
  const spectacleRunTextHidden = useAppSelector(
    (state) => state.scriptUi.spectacleRunTextHidden,
  );

  const isPlaylistVisible = isMobile ? mobilePlaylistOpen : showPlaylistSidebar;
  const isScenesVisible = isMobile ? mobileScenesOpen : !isScenesCollapsed;
  const isHeaderScenesCollapsed = !isScenesVisible;
  const fallbackLabel = isRehearsalPlanRoute
    ? "Загрузка репетиций…"
    : "Загрузка страницы…";
  const pageLoaderLabel = isSpectacleLayoutRoute
    ? "Загрузка страницы…"
    : fallbackLabel;
  const suspenseFallback = <PageBootLoader label={pageLoaderLabel} />;

  const handleTogglePlaylist = useCallback(() => {
    if (!isMobile) {
      togglePlaylist();
      return;
    }
    setMobileScenesOpen(false);
    toggleMobilePlaylist();
  }, [isMobile, setMobileScenesOpen, toggleMobilePlaylist, togglePlaylist]);

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
    setMobilePlaylistOpen,
    toggleMobileScenes,
    toggleScenesCollapsed,
  ]);

  useAppEditorMenubarActionsRender(
    "script-panels-nav",
    0,
    () =>
      shouldShowScriptState && !isSuferRoute ? (
        <AppEditorScriptPanelsNav
          showScenesToggle={!isLightPlotRoute}
          showPlaylist={isPlaylistVisible}
          onTogglePlaylist={handleTogglePlaylist}
          isScenesCollapsed={isHeaderScenesCollapsed}
          onToggleScenesCollapsed={handleToggleScenes}
          showSpectacleRunTextToggle={isLightPlotRoute}
          spectacleRunTextHidden={spectacleRunTextHidden}
          onToggleSpectacleRunText={
            isLightPlotRoute ? handleToggleSpectacleRunText : undefined
          }
        />
      ) : null,
    [
      handleTogglePlaylist,
      handleToggleScenes,
      handleToggleSpectacleRunText,
      isHeaderScenesCollapsed,
      isLightPlotRoute,
      isPlaylistVisible,
      isSuferRoute,
      shouldShowScriptState,
      spectacleRunTextHidden,
    ],
  );

  return (
    <>
      <Suspense fallback={suspenseFallback}>
        <AppRouteDeclarations />
      </Suspense>
      <FormatPlayModalHost />
    </>
  );
}

export function AppShellLayout() {
  const location = useLocation();
  const { isProjectsLoaded, projectName } = useProject();
  const isPlaybookReady = useAppSelector(
    (state) => state.playbook.isPlaybookReady,
  );
  const { blocking, label } = usePageBoot();
  const isMobile = useIsMobile();
  const { showPlaylistSidebar, isScenesCollapsed } = useScriptUI();
  const isProjectRoute = isProjectPath(location.pathname);
  const projectSection = getProjectSectionFromPath(location.pathname);
  const { shouldShowScriptState } = getRouteMeta(location.pathname);
  const hideScenesDock =
    !shouldShowScriptState || projectSection === "light-plot";
  const hidePlaylistDock = !shouldShowScriptState;

  const projectsBlocked = !isProjectsLoaded;
  const projectRouteNeedsPlaybook =
    isProjectRoute &&
    projectSection !== null &&
    projectSection !== "overview" &&
    projectSection !== "sessions" &&
    projectSection !== "availability" &&
    projectSection !== "team";
  const playbookBlocked =
    projectRouteNeedsPlaybook && Boolean(projectName) && !isPlaybookReady;
  const chromeHidden = projectsBlocked || playbookBlocked || blocking;
  const loaderLabel = projectsBlocked
    ? "Загрузка проектов…"
    : playbookBlocked
      ? "Загрузка сцены…"
      : label;

  const dockPlaylist =
    !chromeHidden && !isMobile && showPlaylistSidebar && !hidePlaylistDock;
  const dockScenes =
    !chromeHidden && !isMobile && !isScenesCollapsed && !hideScenesDock;

  return (
    <div
      className={cn(
        "app-shell-with-menubar",
        chromeHidden && "app-shell-with-menubar--booting",
      )}
      data-dock-playlist={dockPlaylist ? "true" : "false"}
      data-dock-scenes={dockScenes ? "true" : "false"}
    >
      {!chromeHidden ? <AppEditorMenubar /> : null}
      <div className="app-shell-body">
        {chromeHidden ? <PageLoader label={loaderLabel} /> : null}
        <div
          className={cn(
            "app-shell-boot-mount",
            chromeHidden && "app-shell-boot-mount--pending",
          )}
        >
          <AppRoutesContent />
        </div>
      </div>
    </div>
  );
}
