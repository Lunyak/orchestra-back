import type { ComponentType } from "react";
import React, { Suspense, useCallback, useState } from "react";
import { useLocation } from "react-router-dom";
import { HeaderPlayer } from "../../components/header/HeaderPlayer";
import { PlaylistSidebar } from "../../components/playlist-sidebar/PlaylistSidebar";
import { ScriptStepsSidebar } from "../../components/script-steps-sidebar/ScriptStepsSidebar";
import { useProject } from "../../features/project";
import { useScene } from "../../features/scene";
import { useScriptUI } from "../../features/script-ui";
import { useTeam } from "../../features/team";
import type { ScriptStep } from "../../shared/types/script";

const LightPlotPage = React.lazy(() =>
  import("../../components/light-plot/LightPlotPage").then((m) => ({
    default: m.LightPlotPage,
  }))
);
const ShowScript = React.lazy(() =>
  import("../../components/show-script/ShowScript").then((m) => ({
    default: m.ShowScript,
  }))
);
const TheaterScene = React.lazy(() =>
  import("../../components/theater/TheaterScene").then((m) => ({
    default: m.TheaterScene,
  }))
);
const KanbanBoardPage = React.lazy(() =>
  import("../../components/kanban/KanbanBoardPage").then((m) => ({
    default: m.KanbanBoardPage,
  }))
);

export function SpectaclePage() {
  const location = useLocation();
  const { projectName } = useProject();
  const { projectMembers } = useTeam();
  const {
    sceneData,
    steps,
    currentPage,
    setCurrentPage,
    setSteps,
    theaterLayout,
    setTheaterLayout,
    isSceneReady,
    addStep,
    deleteStep,
    reorderSteps,
    registerPlaylistPlay,
    handleTrackLinkClick,
    pushSceneAfterSoundsSave,
  } = useScene();
  const {
    showRequisites,
    toggleRequisites,
    showPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds,
    toggleHeaderSounds,
    isStepsCollapsed,
    toggleStepsCollapsed,
    isEditing,
    setIsEditing,
    swapTheaterPanels: shouldSwapPanels,
    togglePanels,
  } = useScriptUI();

  const [theaterControlsHost, setTheaterControlsHost] =
    useState<HTMLDivElement | null>(null);
  const setTheaterControlsHostRef = useCallback((node: HTMLDivElement | null) => {
    setTheaterControlsHost(node);
  }, []);

  const activeView =
    location.pathname === "/theater"
      ? "theater"
      : location.pathname === "/light-plot"
        ? "light-plot"
        : location.pathname === "/board"
          ? "board"
          : "script";

  React.useEffect(() => {
    localStorage.setItem("activeView", activeView);
  }, [activeView]);

  const shouldShowStepsSidebar =
    activeView === "script" ||
    activeView === "light-plot" ||
    activeView === "theater";
  const isTheaterView = activeView === "theater";
  const isBoardView = activeView === "board";

  const LightPlotView = LightPlotPage as ComponentType<{
    steps: ScriptStep[];
    currentPage: number;
    onStepsChange: React.Dispatch<React.SetStateAction<ScriptStep[]>>;
  }>;

  const projectDisplay = projectName || "fools";

  const playlistNode = !isBoardView ? (
    <div
      className={`playlist-sidebar-wrapper ${!showPlaylistSidebar ? "hidden" : ""}`}
    >
      <PlaylistSidebar
        projectName={projectDisplay}
        tracks={sceneData?.playlist || []}
        sceneName="script"
        onRegisterPlayHandler={registerPlaylistPlay}
      />
    </div>
  ) : null;

  const theaterControlsNode = isTheaterView ? (
    <aside ref={setTheaterControlsHostRef} className="theater-settings-sidebar" />
  ) : null;

  const stepsSidebarNode =
    shouldShowStepsSidebar && !isStepsCollapsed ? (
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
    ) : null;

  return (
    <div className="app-layout">
        {isTheaterView ? (
          <>
            {showPlaylistSidebar && (
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
          {showHeaderSounds && !isBoardView && (
            <div className="sounds-bar">
              <HeaderPlayer
                projectName={projectDisplay}
                sceneName="script"
                sounds={sceneData?.sounds || []}
                onSoundsSaved={pushSceneAfterSoundsSave}
              />
            </div>
          )}
          <main
            className={`main-content${activeView === "theater" ? " main-content-theater" : ""}`}
          >
            {activeView === "theater" && (
              <Suspense
                fallback={
                  <div className="view-loader">Загрузка 3D театра…</div>
                }
              >
                <TheaterScene
                  projectName={projectDisplay}
                  steps={steps}
                  currentPage={currentPage}
                  onStepsChange={setSteps}
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
                fallback={<div className="view-loader">Загрузка схемы…</div>}
              >
                <LightPlotView
                  steps={steps}
                  currentPage={currentPage}
                  onStepsChange={setSteps}
                />
              </Suspense>
            )}
            {activeView === "script" && (
              <Suspense
                fallback={
                  <div className="view-loader">Загрузка сценария…</div>
                }
              >
                <ShowScript
                  title={sceneData?.name}
                  steps={steps}
                  currentPage={currentPage}
                  onStepsChange={setSteps}
                  isEditing={isEditing}
                  onTrackLinkClick={handleTrackLinkClick}
                  showRequisites={showRequisites}
                  projectName={projectDisplay}
                  sceneName="script"
                  canSave={isSceneReady}
                />
              </Suspense>
            )}
            {activeView === "board" && (
              <Suspense fallback={<div className="view-loader">Загрузка доски…</div>}>
                <KanbanBoardPage
                  steps={steps}
                  onStepsChange={setSteps}
                  members={(projectMembers ?? [])
                    .map((m: any) => ({
                      email: m.user?.email,
                      displayName: m.user?.displayName ?? null,
                    }))
                    .filter((x: any) => Boolean(x.email))}
                />
              </Suspense>
            )}
          </main>
        </div>
        {stepsSidebarNode}
      </div>
  );
}
