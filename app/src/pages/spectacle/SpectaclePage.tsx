import type { ComponentType } from "react";
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { HeaderPlayer } from "../../components/header/HeaderPlayer";
import { PlaylistSidebar } from "../../components/playlist-sidebar/PlaylistSidebar";
import { ScriptStepsSidebar } from "../../components/script-steps-sidebar/ScriptStepsSidebar";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useScene } from "../../features/scene";
import { useScriptUI } from "../../features/script-ui";
import { useTeam } from "../../features/team";
import type { ScriptStep } from "../../shared/types/script";
import { getMyProfile, type MyProfile } from "../../sync/api";

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
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const { projectMembers, projectOwner } = useTeam();
  const {
    sceneData,
    setRoleAssignments,
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
    saveStepsForLightPlot,
    pushSceneAfterSoundsSave,
  } = useScene();
  const {
    showRequisites,
    showPlaylistSidebar,
    showHeaderSounds,
    isStepsCollapsed,
    setIsStepsCollapsed,
    isEditing,
    setIsEditing,
    swapTheaterPanels: shouldSwapPanels,
    togglePanels,
  } = useScriptUI();

  // При выходе из режима редактирования — принудительно сохраняем/пушим последние правки.
  // Это закрывает кейс: пользователь сделал правку и сразу вышел из edit (таймер дебаунса мог не успеть отработать).
  const prevIsEditingRef = useRef(isEditing);
  useEffect(() => {
    const prev = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;
    if (prev && !isEditing) {
      void saveStepsForLightPlot();
    }
  }, [isEditing, saveStepsForLightPlot]);

  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  useEffect(() => {
    if (!accessToken) {
      setMyProfile(null);
      return;
    }
    let cancelled = false;
    getMyProfile(accessToken)
      .then((p) => {
        if (!cancelled) setMyProfile(p ?? null);
      })
      .catch(() => {
        if (!cancelled) setMyProfile(null);
      });
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  const [isMobilePlaylistOpen, setIsMobilePlaylistOpen] = useState(false);
  const [isMobileStepsOpen, setIsMobileStepsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 980);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile && (isMobilePlaylistOpen || isMobileStepsOpen)) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, isMobilePlaylistOpen, isMobileStepsOpen]);

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
      className={`playlist-sidebar-wrapper ${isMobile ? "mobile" : ""} ${isMobilePlaylistOpen ? "open" : ""} ${(!isMobile && !showPlaylistSidebar) || (isMobile && !isMobilePlaylistOpen) ? "hidden" : ""}`}
    >
      {isMobile && (
        <button
          className="mobile-panel-close"
          onClick={() => setIsMobilePlaylistOpen(false)}
          aria-label="Закрыть плейлист"
        >
          ×
        </button>
      )}
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
    ((!isMobile && shouldShowStepsSidebar && !isStepsCollapsed) ||
      (isMobile && isMobileStepsOpen && shouldShowStepsSidebar && !isStepsCollapsed)) ? (
      <div
        className={`steps-sidebar-wrapper ${isMobile ? "mobile" : ""} ${isMobileStepsOpen ? "open" : ""}`}
      >
        {isMobile && (
          <button
            className="mobile-panel-close"
            onClick={() => setIsMobileStepsOpen(false)}
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
          {showHeaderSounds && !isBoardView && !isMobile && (
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
                  roleAssignments={sceneData?.roleAssignments}
                  onRoleAssignmentsChange={setRoleAssignments}
                  members={[
                    ...(myProfile?.email
                      ? [{ email: myProfile.email, displayName: myProfile.displayName ?? null }]
                      : []),
                    ...(projectOwner?.email
                      ? [{ email: projectOwner.email, displayName: projectOwner.displayName ?? null }]
                      : []),
                    ...(projectMembers ?? []).map((m: any) => ({
                      email: m.user?.email,
                      displayName: m.user?.displayName ?? null,
                    })),
                  ].filter((x: any) => Boolean(x?.email))}
                />
              </Suspense>
            )}
          </main>
        </div>
        {stepsSidebarNode}
        {isMobile && !isBoardView && (
          <div className="mobile-bottom-buttons">
            {shouldShowStepsSidebar && (
              <button
                className="mobile-bottom-btn"
                onClick={() => {
                  setIsStepsCollapsed(false);
                  setIsMobileStepsOpen(true);
                }}
                aria-label="Открыть шаги"
              >
                Шаги
              </button>
            )}
            {showPlaylistSidebar && (
              <button
                className="mobile-bottom-btn"
                onClick={() => setIsMobilePlaylistOpen(true)}
                aria-label="Открыть плейлист"
              >
                Плейлист
              </button>
            )}
          </div>
        )}
        {isMobile && (isMobilePlaylistOpen || isMobileStepsOpen) && (
          <div
            className="mobile-overlay"
            onClick={() => {
              setIsMobilePlaylistOpen(false);
              setIsMobileStepsOpen(false);
            }}
          />
        )}
      </div>
  );
}
