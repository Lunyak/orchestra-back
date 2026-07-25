import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import React, { Suspense } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import "./style.css";
import { HeaderPlayer } from "../../../shared/components/header/HeaderPlayer";
import { PlaylistSidebar } from "../../../shared/components/playlist-sidebar/PlaylistSidebar";
import { ScriptScenesSidebar } from "../../../shared/components/script-scenes-sidebar/ScriptScenesSidebar";
import { OfflinePackStatus } from "../../../shared/components/offline/OfflinePackStatus";
import { MAIN_CONTENT_VIEW_MODIFIERS } from "../model/spectacle-page-types";
import {
  useSpectaclePage,
  type SpectaclePageViewModel,
} from "../model/useSpectaclePage";
import { SpectacleDirectionSwitch } from "./SpectacleDirectionSwitch";

const LightPlotPage = React.lazy(() =>
  import("../../../shared/components/light-plot/LightPlotPage").then((m) => ({
    default: m.LightPlotPage,
  })),
);
const NotesRunPageSection = React.lazy(() =>
  import("../../notes-run/ui/NotesRunPageSection").then((m) => ({
    default: m.NotesRunPageSection,
  })),
);
const ProjectMediaPageSection = React.lazy(() =>
  import("../../project-media/ui/ProjectMediaPageSection").then((m) => ({
    default: m.ProjectMediaPageSection,
  })),
);
const ShowScript = React.lazy(() =>
  import("../../../shared/components/show-script/ShowScript").then((m) => ({
    default: m.ShowScript,
  })),
);
const TheaterScene = React.lazy(() =>
  import("../../theater").then((m) => ({ default: m.TheaterScene })),
);
const KanbanBoardPage = React.lazy(() =>
  import("../../../shared/components/kanban/KanbanBoardPage").then((m) => ({
    default: m.KanbanBoardPage,
  })),
);

export type { SpectaclePageViewModel } from "../model/useSpectaclePage";
export { useSpectaclePage } from "../model/useSpectaclePage";

export function SpectaclePageView({ vm }: { vm: SpectaclePageViewModel }) {
  const navigate = useNavigate();
  const {
    activeView,
    addScene,
    closeMobilePanels,
    compactMainChrome,
    currentPage,
    deleteScene,
    isEditing,
    isMobile,
    isProjectsLoaded,
    isPlaybookReady,
    isScenesCollapsed,
    isTheaterView,
    kanbanMembers,
    mobilePlaylistOpen,
    mobileScenesOpen,
    projectName,
    projects,
    pushPlaybookAfterSoundsSave,
    registerPlaylistPlay,
    registerSoundToggle,
    reorderScenes,
    playbookData,
    setCurrentPage,
    setIsEditing,
    setIsScenesCollapsed,
    setMobilePlaylistOpen,
    setMobileScenesOpen,
    setShowTheaterControls,
    setTheaterOutlinerHostRef,
    setTheaterLayout,
    shouldShowScenesSidebar,
    shouldSwapPanels,
    showHeaderSounds,
    showPlaylistSidebar,
    showTheaterControls,
    scenes,
    theaterImmersiveMode,
    setTheaterImmersiveMode,
    theaterOutlinerHost,
    theaterLayout,
    togglePanels,
    togglePlaylist,
  } = vm;

  if (!isProjectsLoaded) {
    return (
      <PageLoader
        variant="spectacle"
        showLeftSidebar
        showRightSidebar
        showTopBar
        label="Загрузка проектов…"
      />
    );
  }

  if (!projectName) {
    return (
      <div className="app-layout">
        <div className="app-content">
          <main className="main-content">
            <div className="empty-project">
              <h2>Проект не выбран</h2>
              <p>
                {projects.length > 0
                  ? "Выберите проект в меню «Проект» в верхней панели или в настройках."
                  : "Создайте проект в настройках или дождитесь загрузки списка."}
              </p>
              <button
                type="button"
                className="empty-project-btn"
                onClick={() => navigate("/settings")}
              >
                Перейти в настройки
              </button>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const projectDisplay = projectName;

  if (!isPlaybookReady) {
    return (
      <PageLoader
        variant="spectacle"
        showLeftSidebar={isMobile ? mobilePlaylistOpen : showPlaylistSidebar}
        showRightSidebar={isMobile ? mobileScenesOpen : !isScenesCollapsed}
        showTopBar={showHeaderSounds}
        label="Загрузка сцены…"
      />
    );
  }

  const forceHidePlaylistPanel =
    (isTheaterView && shouldSwapPanels) || (isTheaterView && theaterImmersiveMode);
  const playlistPanelHidden =
    forceHidePlaylistPanel ||
    (!isMobile && !showPlaylistSidebar) ||
    (isMobile && !mobilePlaylistOpen);
  const playlistNode = !compactMainChrome ? (
    <div
      className={cn(
        "playlist-sidebar-container",
        isMobile && "playlist-sidebar-container--mobile",
        mobilePlaylistOpen && "playlist-sidebar-container--open",
        playlistPanelHidden && "playlist-sidebar-container--hidden",
      )}
    >
      {isMobile && (
        <button
          className="mobile-drawer__close"
          onClick={() => setMobilePlaylistOpen(false)}
          aria-label="Закрыть плейлист"
        >
          ×
        </button>
      )}
      <PlaylistSidebar
        projectName={projectDisplay}
        sceneName="script"
        mode="list"
        onRegisterPlayHandler={registerPlaylistPlay}
      />
    </div>
  ) : null;

  const showTheaterSettingsHost =
    isTheaterView && shouldSwapPanels && !theaterImmersiveMode;
  const theaterHostMounted =
    showTheaterSettingsHost && (isMobile || showTheaterControls);

  const theaterOutlinerNode = showTheaterSettingsHost ? (
    <aside
      ref={setTheaterOutlinerHostRef}
      className={cn(
        "theater-settings-sidebar theater-settings-sidebar--right theater-outliner-sidebar",
        isMobile && "theater-settings-sidebar--mobile",
        isMobile && showTheaterControls && "theater-settings-sidebar--open",
      )}
      aria-label="Настройки 3D-сцены"
      aria-hidden={isMobile ? !showTheaterControls : undefined}
    >
      {isMobile && showTheaterControls ? (
        <button
          type="button"
          className="mobile-drawer__close"
          onClick={() => setShowTheaterControls(false)}
          aria-label="Закрыть панель настроек"
        >
          ×
        </button>
      ) : null}
    </aside>
  ) : null;

  /** Сцены на 3D-театре — только в режиме «Музыка и сцены». */
  const theaterRehearsalMode =
    isTheaterView && !shouldSwapPanels && !theaterImmersiveMode;
  const showScenesSidebar =
    shouldShowScenesSidebar &&
    !theaterImmersiveMode &&
    (!isTheaterView || theaterRehearsalMode);

  const stepsSidebarVisible =
    showScenesSidebar &&
    ((isMobile && mobileScenesOpen) || (!isMobile && !isScenesCollapsed));

  const showModeSwitch =
    activeView === "script" || activeView === "light-plot";

  const stepsSidebarNode = stepsSidebarVisible ? (
      <div
        className={cn(
          "scenes-sidebar-container",
          isMobile && "scenes-sidebar-container--mobile",
          mobileScenesOpen && "scenes-sidebar-container--open",
        )}
      >
        {isMobile && (
          <button
            className="mobile-drawer__close"
            onClick={() => setMobileScenesOpen(false)}
            aria-label="Закрыть сцены"
          >
            ×
          </button>
        )}
        <ScriptScenesSidebar
          scenes={scenes}
          currentIndex={currentPage}
          onSelect={setCurrentPage}
          onPrev={() => setCurrentPage((p: number) => Math.max(0, p - 1))}
          onNext={() =>
            setCurrentPage((p: number) => Math.min(scenes.length - 1, p + 1))
          }
          onDelete={deleteScene}
          onReorder={reorderScenes}
          isEditing={isEditing}
          onToggleEditing={() => setIsEditing((p: boolean) => !p)}
          onAddScene={addScene}
        />
      </div>
    ) : null;

  return (
    <div className="app-layout">
      {isTheaterView ? (
        <>
          {playlistNode}
        </>
      ) : (
        playlistNode
      )}
      <div className="app-content">
        {showModeSwitch ? <SpectacleDirectionSwitch /> : null}
        <OfflinePackStatus />
        {showHeaderSounds && !compactMainChrome && !isMobile && (
          <div className="sounds-bar">
            <HeaderPlayer
              projectName={projectDisplay}
              sceneName="script"
              sounds={playbookData?.sounds || []}
              onSoundsSaved={pushPlaybookAfterSoundsSave}
              onRegisterToggleHandler={registerSoundToggle}
            />
          </div>
        )}
        <main
          className={cn("main-content", MAIN_CONTENT_VIEW_MODIFIERS[activeView])}
        >
          {activeView === "theater" && (
            <Suspense
              fallback={
                <PageLoader variant="view" label="Загрузка 3D театра…" />
              }
            >
              <TheaterScene
                projectName={projectDisplay}
                theaterLayout={theaterLayout}
                onTheaterLayoutChange={setTheaterLayout}
                isPanelsSwapped={shouldSwapPanels}
                onTogglePanels={togglePanels}
                outlinerHost={theaterHostMounted ? theaterOutlinerHost : null}
                controlsInPanel={shouldSwapPanels}
                immersiveMode={theaterImmersiveMode}
                onImmersiveModeChange={setTheaterImmersiveMode}
              />
            </Suspense>
          )}
          {activeView === "light-plot" && (
            <Suspense
              fallback={<PageLoader variant="view" label="Загрузка спектакля…" />}
            >
              <LightPlotPage />
            </Suspense>
          )}
          {activeView === "sufer" && (
            <Suspense fallback={<PageLoader variant="view" label="Загрузка прогона…" />}>
              <NotesRunPageSection />
            </Suspense>
          )}
          {activeView === "media" && (
            <Suspense fallback={<PageLoader variant="view" label="Загрузка медиа…" />}>
              <ProjectMediaPageSection />
            </Suspense>
          )}
          {activeView === "script" && (
            <Suspense
              fallback={
                <PageLoader variant="view" label="Загрузка сценария…" />
              }
            >
              <ShowScript />
            </Suspense>
          )}
          {activeView === "board" && (
            <Suspense fallback={<PageLoader variant="view" label="Загрузка репетиций…" />}>
              <KanbanBoardPage members={kanbanMembers} />
            </Suspense>
          )}
          {activeView === "tasks" && (
            <Suspense fallback={<PageLoader variant="view" label="Загрузка задач…" />}>
              <Outlet />
            </Suspense>
          )}
          {activeView === "sessions" && <Outlet />}
        </main>
      </div>
      {theaterHostMounted ? theaterOutlinerNode : null}
      {stepsSidebarNode}
      {isMobile &&
        (mobilePlaylistOpen ||
          mobileScenesOpen ||
          (showTheaterSettingsHost && showTheaterControls)) && (
        <div
          className="mobile-drawer__overlay"
          onClick={() => {
            closeMobilePanels();
            if (showTheaterSettingsHost && showTheaterControls) {
              setShowTheaterControls(false);
            }
          }}
        />
      )}
    </div>
  );
}

export function SpectaclePage() {
  const vm = useSpectaclePage();
  return <SpectaclePageView vm={vm} />;
}
