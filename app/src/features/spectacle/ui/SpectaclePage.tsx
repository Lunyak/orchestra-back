import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import React, { Suspense } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { HeaderPlayer } from "../../../shared/components/header/HeaderPlayer";
import { PlaylistSidebar } from "../../../shared/components/playlist-sidebar/PlaylistSidebar";
import { ScriptStepsSidebar } from "../../../shared/components/script-steps-sidebar/ScriptStepsSidebar";
import { OfflinePackStatus } from "../../../shared/components/offline/OfflinePackStatus";
import { MAIN_CONTENT_VIEW_MODIFIERS } from "../model/spectacle-page-types";
import {
  useSpectaclePage,
  type SpectaclePageViewModel,
} from "../model/useSpectaclePage";
import { SpectacleProjectPicker } from "./SpectacleProjectPicker";

const LightPlotPage = React.lazy(() =>
  import("../../../shared/components/light-plot/LightPlotPage").then((m) => ({
    default: m.LightPlotPage,
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
    addStep,
    closeMobilePanels,
    compactMainChrome,
    currentPage,
    deleteStep,
    isEditing,
    isMobile,
    isProjectsLoaded,
    isSceneReady,
    isStepsCollapsed,
    isTheaterView,
    kanbanMembers,
    mobilePlaylistOpen,
    mobileStepsOpen,
    onProjectChange,
    projectName,
    projects,
    projectsLoading,
    pushSceneAfterSoundsSave,
    registerPlaylistPlay,
    registerSoundToggle,
    reorderSteps,
    sceneData,
    setCurrentPage,
    setIsEditing,
    setIsStepsCollapsed,
    setMobilePlaylistOpen,
    setMobileStepsOpen,
    setTheaterControlsHostRef,
    setTheaterLayout,
    shouldShowStepsSidebar,
    shouldSwapPanels,
    showHeaderSounds,
    showPlaylistSidebar,
    steps,
    theaterControlsHost,
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
    const showPicker = projects.length > 0;
    return (
      <div className="app-layout">
        <div className="app-content">
          {showPicker ? (
            <SpectacleProjectPicker
              projects={projects}
              projectName={projectName}
              projectsLoading={projectsLoading}
              onProjectChange={onProjectChange}
            />
          ) : null}
          <main className="main-content">
            <div className="empty-project">
              <h2>Проект не выбран</h2>
              <p>
                {showPicker
                  ? "Выберите проект в списке выше или в настройках."
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

  if (!isSceneReady) {
    return (
      <PageLoader
        variant="spectacle"
        showLeftSidebar={isMobile ? mobilePlaylistOpen : showPlaylistSidebar}
        showRightSidebar={isMobile ? mobileStepsOpen : !isStepsCollapsed}
        showTopBar={showHeaderSounds}
        label="Загрузка сцены…"
      />
    );
  }

  const playlistNode = !compactMainChrome ? (
    <div
      className={`playlist-sidebar-wrapper ${isMobile ? "mobile" : ""} ${mobilePlaylistOpen ? "open" : ""} ${(!isMobile && !showPlaylistSidebar) || (isMobile && !mobilePlaylistOpen) ? "hidden" : ""}`}
    >
      {isMobile && (
        <button
          className="mobile-panel-close"
          onClick={() => setMobilePlaylistOpen(false)}
          aria-label="Закрыть плейлист"
        >
          ×
        </button>
      )}
      <PlaylistSidebar
        projectName={projectDisplay}
        sceneName="script"
        onRegisterPlayHandler={registerPlaylistPlay}
      />
    </div>
  ) : null;

  const theaterControlsNode = isTheaterView ? (
    <aside ref={setTheaterControlsHostRef} className="theater-settings-sidebar" />
  ) : null;

  const stepsSidebarNode =
    ((!isMobile && shouldShowStepsSidebar && !isStepsCollapsed) ||
      (isMobile && mobileStepsOpen && shouldShowStepsSidebar && !isStepsCollapsed)) ? (
      <div
        className={`steps-sidebar-wrapper ${isMobile ? "mobile" : ""} ${mobileStepsOpen ? "open" : ""}`}
      >
        {isMobile && (
          <button
            className="mobile-panel-close"
            onClick={() => setMobileStepsOpen(false)}
            aria-label="Закрыть шаги"
          >
            ×
          </button>
        )}
        <ScriptStepsSidebar
          steps={steps}
          currentIndex={currentPage}
          onSelect={setCurrentPage}
          onPrev={() => setCurrentPage((p: number) => Math.max(0, p - 1))}
          onNext={() =>
            setCurrentPage((p: number) => Math.min(steps.length - 1, p + 1))
          }
          onDelete={deleteStep}
          onReorder={reorderSteps}
          isEditing={isEditing}
          onToggleEditing={() => setIsEditing((p: boolean) => !p)}
          onAddStep={addStep}
        />
      </div>
    ) : null;

  return (
    <div className="app-layout">
      {isTheaterView ? (
        <>
          {(isMobile ? mobilePlaylistOpen : showPlaylistSidebar) && (
            <div style={{ display: shouldSwapPanels ? "none" : "block" }}>
              {playlistNode}
            </div>
          )}
          {shouldSwapPanels ? theaterControlsNode : null}
        </>
      ) : (
        playlistNode
      )}
      <div className="app-content">
        <SpectacleProjectPicker
          projects={projects}
          projectName={projectName}
          projectsLoading={projectsLoading}
          onProjectChange={onProjectChange}
        />
        <OfflinePackStatus />
        {showHeaderSounds && !compactMainChrome && !isMobile && (
          <div className="sounds-bar">
            <HeaderPlayer
              projectName={projectDisplay}
              sceneName="script"
              sounds={sceneData?.sounds || []}
              onSoundsSaved={pushSceneAfterSoundsSave}
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
                controlsHost={shouldSwapPanels ? theaterControlsHost : null}
                controlsInPanel={shouldSwapPanels}
              />
            </Suspense>
          )}
          {activeView === "light-plot" && (
            <Suspense
              fallback={<PageLoader variant="view" label="Загрузка схемы…" />}
            >
              <LightPlotPage />
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
            <Suspense fallback={<PageLoader variant="view" label="Загрузка доски…" />}>
              <KanbanBoardPage members={kanbanMembers} />
            </Suspense>
          )}
          {activeView === "sessions" && <Outlet />}
        </main>
      </div>
      {stepsSidebarNode}
      {!isMobile && !compactMainChrome && (
        <div className="desktop-panel-buttons" aria-label="Панели">
          {shouldShowStepsSidebar && isStepsCollapsed && (
            <button
              type="button"
              className="desktop-panel-btn"
              onClick={() => setIsStepsCollapsed(false)}
              aria-label="Показать шаги"
            >
              Шаги
            </button>
          )}
          {!showPlaylistSidebar && (
            <button
              type="button"
              className="desktop-panel-btn"
              onClick={togglePlaylist}
              aria-label="Показать плейлист"
            >
              Плейлист
            </button>
          )}
        </div>
      )}

      {isMobile && (mobilePlaylistOpen || mobileStepsOpen) && (
        <div
          className="mobile-overlay"
          onClick={() => {
            closeMobilePanels();
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
