import { PlaylistSidebar } from "@shared/components/playlist-sidebar/PlaylistSidebar";
import { ScriptScenesSidebar } from "@shared/components/script-scenes-sidebar/ScriptScenesSidebar";
import { useIsMobile } from "@shared/hooks/useIsMobile";
import cn from "classnames";
import { useState } from "react";
import { Outlet, useMatch, useNavigate } from "react-router-dom";
import { projectPath } from "../../../app/router/paths";
import { usePlaybook } from "../../playbook";
import { useProject } from "../model/project-context";
import { useScriptUI } from "../../script-ui";
import "@shared/layout/app-shell.css";
import "@shared/components/mobile-drawer/mobile-drawer.css";

const SCRIPT_SCENE_NAME = "script";

export function ProjectPlaybookDocksLayout() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isOverviewRoute = Boolean(
    useMatch({ path: "/projects/:projectSlug/overview", end: true }),
  );
  const { projectName } = useProject();
  const {
    scenes,
    currentPage,
    setCurrentPage,
    addScene,
    deleteScene,
    reorderScenes,
    registerPlaylistPlay,
    isPlaybookReady,
  } = usePlaybook();
  const {
    showPlaylistSidebar,
    isScenesCollapsed,
    mobilePlaylistOpen,
    mobileScenesOpen,
    setMobilePlaylistOpen,
    setMobileScenesOpen,
  } = useScriptUI();
  const [isEditing, setIsEditing] = useState(false);

  const isPlaylistVisible = isMobile ? mobilePlaylistOpen : showPlaylistSidebar;
  const isScenesVisible = isMobile ? mobileScenesOpen : !isScenesCollapsed;

  const handleSelectScene = (index: number) => {
    setCurrentPage(index);
    if (!projectName) return;
    navigate(projectPath(projectName, "script"));
  };

  if (!projectName || !isPlaybookReady || isOverviewRoute) {
    return <Outlet />;
  }

  return (
    <div
      className={cn(
        "app-layout",
        !isMobile && "app-layout--docks-cluster",
      )}
    >
      <div
        className={cn(
          "playlist-sidebar-container",
          isMobile && "playlist-sidebar-container--mobile",
          mobilePlaylistOpen && "playlist-sidebar-container--open",
          !isPlaylistVisible && "playlist-sidebar-container--hidden",
        )}
      >
        {isMobile ? (
          <button
            type="button"
            className="mobile-drawer__close"
            onClick={() => setMobilePlaylistOpen(false)}
            aria-label="Закрыть плейлист"
          >
            ×
          </button>
        ) : null}
        <PlaylistSidebar
          projectName={projectName}
          sceneName={SCRIPT_SCENE_NAME}
          mode="full"
          onRegisterPlayHandler={registerPlaylistPlay}
        />
      </div>

      <div className="app-content">
        <Outlet />
      </div>

      {isScenesVisible ? (
        <div
          className={cn(
            "scenes-sidebar-container",
            isMobile && "scenes-sidebar-container--mobile",
            mobileScenesOpen && "scenes-sidebar-container--open",
          )}
        >
          {isMobile ? (
            <button
              type="button"
              className="mobile-drawer__close"
              onClick={() => setMobileScenesOpen(false)}
              aria-label="Закрыть сцены"
            >
              ×
            </button>
          ) : null}
          <ScriptScenesSidebar
            scenes={scenes}
            currentIndex={currentPage}
            onSelect={handleSelectScene}
            onPrev={() => setCurrentPage((page) => Math.max(0, page - 1))}
            onNext={() =>
              setCurrentPage((page) => Math.min(scenes.length - 1, page + 1))
            }
            onDelete={deleteScene}
            onReorder={reorderScenes}
            isEditing={isEditing}
            onToggleEditing={() => setIsEditing((value) => !value)}
            onAddScene={addScene}
          />
        </div>
      ) : null}

      {isMobile && (mobilePlaylistOpen || mobileScenesOpen) ? (
        <div
          className="mobile-drawer__overlay"
          onClick={() => {
            setMobilePlaylistOpen(false);
            setMobileScenesOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
