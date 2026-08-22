import { PageLoader } from "@shared/components/page-loader/PageLoader";
import {
  PageBootLoader,
  PageBootProvider,
  usePageBoot,
} from "@shared/components/page-loader/page-boot";
import {
  AppEditorMenubar,
  AppEditorMenubarProvider,
  AppEditorScriptPanelsNav,
  useAppEditorMenubarActionsRender,
} from "@shared/components/app-editor-menubar";
import { useIsMobile } from "@shared/hooks/useIsMobile";
import { useAppDispatch, useAppSelector } from "@shared/store/hooks";
import cn from "classnames";
import { Suspense, useCallback, useEffect, useState } from "react";
import { FormatPlayTextModal } from "../../features/play-format/ui/FormatPlayTextModal";
import { subscribeOpenFormatPlay } from "../../features/spectacle/model/format-play-request";
import { useLocation } from "react-router-dom";
import { useProject } from "../../features/project";
import { usePlaybook } from "../../features/playbook";
import { playbookActions } from "../../features/playbook/model/playbook-slice";
import {
  selectActiveSceneMarkdownContext,
} from "../../features/show-script-markdown/model/show-script-markdown-slice";
import { useScriptUI } from "../../features/script-ui";
import { scriptUiActions } from "../../features/script-ui/model/script-ui-slice";
import { RecentOrganizationsTracker } from "../../features/global-dashboard/ui/RecentOrganizationsTracker";
import { AppRouteDeclarations } from "./AppRouteDeclarations";
import { getRouteMeta } from "./routeMeta";
import {
  getProjectSectionFromPath,
  isProjectPath,
} from "./paths";

const SCRIPT_SCENE_NAME = "script";

function AppRoutesContent() {
  const location = useLocation();
  const dispatch = useAppDispatch();
  const { projectName } = useProject();
  const { updateScene } = usePlaybook();
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
  const [formatPlayModalOpen, setFormatPlayModalOpen] = useState(false);

  const { shouldShowScriptState, isSpectacleLayoutRoute } = getRouteMeta(
    location.pathname,
  );
  const projectSection = getProjectSectionFromPath(location.pathname);
  const isLightPlotRoute = projectSection === "light-plot";
  const spectacleRunTextHidden = useAppSelector(
    (state) => state.scriptUi.spectacleRunTextHidden,
  );
  const { currentScene, activeMarkdown, activeMarkdownField } = useAppSelector((state) =>
    projectName
      ? selectActiveSceneMarkdownContext(state, projectName, SCRIPT_SCENE_NAME)
      : { currentScene: undefined, activeMarkdown: "", activeMarkdownField: "markdown" as const },
  );

  useEffect(() => subscribeOpenFormatPlay(() => setFormatPlayModalOpen(true)), []);

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
  const suspenseFallback = (
    <PageBootLoader
      label={isSpectacleLayoutRoute ? "Загрузка страницы…" : fallbackLabel}
    />
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
    "script-panels-nav",
    0,
    () =>
      shouldShowScriptState ? (
        <AppEditorScriptPanelsNav
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
      <PageBootProvider>
        <AppShellFrame />
      </PageBootProvider>
    </AppEditorMenubarProvider>
  );
}

function AppShellFrame() {
  const location = useLocation();
  const { isProjectsLoaded, projectName } = useProject();
  const isPlaybookReady = useAppSelector((state) => state.playbook.isPlaybookReady);
  const { blocking, label } = usePageBoot();
  const isMobile = useIsMobile();
  const { showPlaylistSidebar, isScenesCollapsed } = useScriptUI();
  const isProjectRoute = isProjectPath(location.pathname);

  const projectsBlocked = !isProjectsLoaded;
  const playbookBlocked =
    isProjectRoute && Boolean(projectName) && !isPlaybookReady;
  const chromeHidden = projectsBlocked || playbookBlocked || blocking;

  const loaderLabel = projectsBlocked
    ? "Загрузка проектов…"
    : playbookBlocked
      ? "Загрузка сцены…"
      : label;

  const dockPlaylist = !chromeHidden && !isMobile && showPlaylistSidebar;
  const dockScenes = !chromeHidden && !isMobile && !isScenesCollapsed;

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
