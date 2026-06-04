import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from "classnames";
import React, { Suspense } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import "./style.css";
import { HeaderPlayer } from "../../../shared/components/header/HeaderPlayer";
import { PlaylistSidebar } from "../../../shared/components/playlist-sidebar/PlaylistSidebar";
import { ScriptStepsSidebar } from "../../../shared/components/script-steps-sidebar/ScriptStepsSidebar";
import { OfflinePackStatus } from "../../../shared/components/offline/OfflinePackStatus";
import { MAIN_CONTENT_VIEW_MODIFIERS } from "../model/spectacle-page-types";
import {
  useSpectaclePage,
  type SpectaclePageViewModel,
} from "../model/useSpectaclePage";

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
    projectName,
    projects,
    pushSceneAfterSoundsSave,
    registerSoundToggle,
    reorderSteps,
    sceneData,
    setCurrentPage,
    setIsEditing,
    setIsStepsCollapsed,
    setMobilePlaylistOpen,
    setMobileStepsOpen,
    setShowTheaterControls,
    setTheaterOutlinerHostRef,
    setTheaterLayout,
    shouldShowStepsSidebar,
    shouldSwapPanels,
    showHeaderSounds,
    showPlaylistSidebar,
    showTheaterControls,
    steps,
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

  const forceHidePlaylistPanel = isTheaterView && shouldSwapPanels;
  const playlistNode = !compactMainChrome ? (
    <div
      className={`playlist-sidebar-wrapper ${isMobile ? "mobile" : ""} ${mobilePlaylistOpen ? "open" : ""} ${forceHidePlaylistPanel || (!isMobile && !showPlaylistSidebar) || (isMobile && !mobilePlaylistOpen) ? "hidden" : ""}`}
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
        mode="list"
      />
    </div>
  ) : null;

  const showTheaterSettingsHost = isTheaterView && shouldSwapPanels;
  const theaterHostMounted =
    showTheaterSettingsHost && (isMobile || showTheaterControls);

  const theaterOutlinerNode = showTheaterSettingsHost ? (
    <aside
      ref={setTheaterOutlinerHostRef}
      className={cn(
        "theater-settings-sidebar theater-settings-sidebar--right theater-outliner-sidebar",
        isMobile && "mobile",
        isMobile && showTheaterControls && "open",
      )}
      aria-label="Настройки 3D-сцены"
      aria-hidden={isMobile ? !showTheaterControls : undefined}
    >
      {isMobile && showTheaterControls ? (
        <button
          type="button"
          className="mobile-panel-close"
          onClick={() => setShowTheaterControls(false)}
          aria-label="Закрыть панель настроек"
        >
          ×
        </button>
      ) : null}
    </aside>
  ) : null;

  /** Шаги на 3D-театре — только в режиме «Музыка и шаги». */
  const theaterRehearsalMode = isTheaterView && !shouldSwapPanels;
  const showStepsSidebar =
    shouldShowStepsSidebar && (!isTheaterView || theaterRehearsalMode);

  const stepsSidebarVisible =
    showStepsSidebar &&
    ((isMobile && mobileStepsOpen) || (!isMobile && !isStepsCollapsed));

  const stepsSidebarNode = stepsSidebarVisible ? (
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
          {playlistNode}
        </>
      ) : (
        playlistNode
      )}
      <div className="app-content">
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
                outlinerHost={theaterHostMounted ? theaterOutlinerHost : null}
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
      {theaterHostMounted ? theaterOutlinerNode : null}
      {stepsSidebarNode}
      {!isMobile && !compactMainChrome && (
        <div className="desktop-panel-buttons" aria-label="Панели">
          {showStepsSidebar && isStepsCollapsed && (
            <button
              type="button"
              className="desktop-panel-btn"
              onClick={() => setIsStepsCollapsed(false)}
              aria-label="Показать шаги"
            >
              Шаги
            </button>
          )}
          {!showPlaylistSidebar && (!isTheaterView || theaterRehearsalMode) && (
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

      {isMobile &&
        (mobilePlaylistOpen ||
          mobileStepsOpen ||
          (showTheaterSettingsHost && showTheaterControls)) && (
        <div
          className="mobile-overlay"
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
