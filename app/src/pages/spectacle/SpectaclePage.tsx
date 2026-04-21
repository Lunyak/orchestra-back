import { PageLoader } from "@shared/components/page-loader/PageLoader";
import cn from 'classnames';
import React, { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth";
import { useProject } from "../../features/project";
import { useScene } from "../../features/scene";
import { useScriptUI } from "../../features/script-ui";
import { useTeam } from "../../features/team";
import { HeaderPlayer } from "../../shared/components/header/HeaderPlayer";
import { PlaylistSidebar } from "../../shared/components/playlist-sidebar/PlaylistSidebar";
import { ScriptStepsSidebar } from "../../shared/components/script-steps-sidebar/ScriptStepsSidebar";
import { getMyProfile, type MyProfile } from "../../sync/api";

const LightPlotPage = React.lazy(() =>
  import("../../shared/components/light-plot/LightPlotPage").then((m) => ({
    default: m.LightPlotPage,
  }))
);
const ShowScript = React.lazy(() =>
  import("../../shared/components/show-script/ShowScript").then((m) => ({
    default: m.ShowScript,
  }))
);
const TheaterScene = React.lazy(() =>
  import("../../shared/components/theater/TheaterScene").then((m) => ({
    default: m.TheaterScene,
  }))
);
const KanbanBoardPage = React.lazy(() =>
  import("../../shared/components/kanban/KanbanBoardPage").then((m) => ({
    default: m.KanbanBoardPage,
  }))
);

type SpectacleActiveView = "theater" | "light-plot" | "board" | "script" | "sessions";

/** Доп. классы на `<main class="main-content">` по активному разделу (одна строка или массив). */
const MAIN_CONTENT_VIEW_MODIFIERS: Record<
  SpectacleActiveView,
  string | readonly string[] | undefined
> = {
  theater: "main-content-theater",
  "light-plot": undefined,
  board: "main-content-kanban",
  script: "show-script",
  sessions: "main-content-sessions",
};

export function SpectaclePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { accessToken } = useAuth();
  const { projectName, isProjectsLoaded } = useProject();
  const { projectMembers, projectOwner } = useTeam();
  const {
    sceneData,
    steps,
    currentPage,
    setCurrentPage,
    theaterLayout,
    setTheaterLayout,
    isSceneReady,
    addStep,
    deleteStep,
    reorderSteps,
    registerPlaylistPlay,
    registerSoundToggle,
    saveStepsForLightPlot,
    pushSceneAfterSoundsSave,
  } = useScene();
  const {
    showRequisites,
    showPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds,
    isStepsCollapsed,
    setIsStepsCollapsed,
    mobilePlaylistOpen,
    setMobilePlaylistOpen,
    mobileStepsOpen,
    setMobileStepsOpen,
    closeMobilePanels,
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
    if (isMobile && (mobilePlaylistOpen || mobileStepsOpen)) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobile, mobilePlaylistOpen, mobileStepsOpen]);

  const [theaterControlsHost, setTheaterControlsHost] =
    useState<HTMLDivElement | null>(null);
  const setTheaterControlsHostRef = useCallback((node: HTMLDivElement | null) => {
    setTheaterControlsHost(node);
  }, []);

  const activeView: SpectacleActiveView =
    location.pathname === "/theater"
      ? "theater"
      : location.pathname === "/light-plot"
        ? "light-plot"
        : location.pathname === "/board"
          ? "board"
          : location.pathname === "/sessions" || location.pathname.startsWith("/sessions/")
            ? "sessions"
            : "script";

  React.useEffect(() => {
    localStorage.setItem("activeView", activeView);
  }, [activeView]);

  const shouldShowStepsSidebar =
    activeView === "script" ||
    activeView === "light-plot" ||
    activeView === "theater";
  const isTheaterView = activeView === "theater";
  /** Доска и сессии: без плейлиста/звуковой полосы и кнопок боковых панелей в стиле спектакля. */
  const compactMainChrome = activeView === "board" || activeView === "sessions";

  // Не показываем "пустую" страницу между lazy-загрузкой и подгрузкой проектов/сцены.
  // Важно: хуки должны вызываться в одинаковом порядке на каждом рендере.
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
              <p>Выберите проект в «Настройки» → «Сменить проект».</p>
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
    <div className={`playlist-sidebar-wrapper ${isMobile ? "mobile" : ""} ${mobilePlaylistOpen ? "open" : ""} ${(!isMobile && !showPlaylistSidebar) || (isMobile && !mobilePlaylistOpen) ? "hidden" : ""}`}
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
              <KanbanBoardPage
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
