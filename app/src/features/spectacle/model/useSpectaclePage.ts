import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { useMyProfileQuery } from "../../profile/api/profile-api";
import { useProject } from "../../project";
import { usePlaybook } from "../../playbook";
import { useScriptUI } from "../../script-ui";
import { useTeam } from "../../team";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
import { useIsMobile } from "../../../shared/hooks/useIsMobile";
import { patchTheaterViewPrefs, readTheaterViewPrefs } from "../../theater/model/theater-view-prefs-storage";
import { writeRehearsalPlanTab } from "../../../shared/settings/rehearsalPlanTab";
import { PROJECT_MEDIA_ROUTE_PATH, SUFER_ROUTE_PATH } from "../../../app/router/routeMeta";
import type { SpectacleActiveView } from "./spectacle-page-types";

export type SpectaclePageViewModel = ReturnType<typeof useSpectaclePage>;

export function useSpectaclePage() {
  const location = useLocation();
  const { accessToken } = useAuth();
  const {
    projectName,
    isProjectsLoaded,
    projects,
    projectsLoading,
    onProjectChange,
  } = useProject();
  const { projectMembers, projectOwner } = useTeam();
  const {
    playbookData,
    scenes,
    currentPage,
    setCurrentPage,
    theaterLayout,
    setTheaterLayout,
    isPlaybookReady,
    addScene,
    deleteScene,
    reorderScenes,
    registerPlaylistPlay,
    registerSoundToggle,
    saveScenesForLightPlot,
    pushPlaybookAfterSoundsSave,
  } = usePlaybook();
  const {
    showPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds,
    isScenesCollapsed,
    setIsScenesCollapsed,
    mobilePlaylistOpen,
    setMobilePlaylistOpen,
    mobileScenesOpen,
    setMobileScenesOpen,
    closeMobilePanels,
    isEditing,
    setIsEditing,
    swapTheaterPanels: shouldSwapPanels,
    togglePanels,
    showTheaterControls,
    setShowTheaterControls,
    setSwapTheaterPanels,
    toggleTheaterControls,
  } = useScriptUI();

  useLayoutEffect(() => {
    if (!projectName) return;
    const prefs = readTheaterViewPrefs(projectName);
    setSwapTheaterPanels(prefs.swapTheaterPanels);
    setShowTheaterControls(prefs.showTheaterControls);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restore only on project switch
  }, [projectName]);

  const togglePanelsWithPersist = useCallback(() => {
    const nextSwap = !shouldSwapPanels;
    togglePanels();
    if (projectName) {
      patchTheaterViewPrefs(projectName, {
        swapTheaterPanels: nextSwap,
        ...(nextSwap ? { showTheaterControls: true } : {}),
      });
    }
  }, [projectName, shouldSwapPanels, togglePanels]);

  const prevIsEditingRef = useRef(isEditing);
  useEffect(() => {
    const prev = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;
    if (prev && !isEditing) {
      void saveScenesForLightPlot();
    }
  }, [isEditing, saveScenesForLightPlot]);

  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });

  const isMobile = useIsMobile();

  const activeView: SpectacleActiveView =
    ENABLE_3D_THEATER && location.pathname === "/theater"
      ? "theater"
      : location.pathname === "/light-plot"
        ? "light-plot"
        : location.pathname === SUFER_ROUTE_PATH || location.pathname === "/notes-run"
          ? "sufer"
          : location.pathname === PROJECT_MEDIA_ROUTE_PATH
            ? "media"
            : location.pathname === "/board"
            ? "board"
            : location.pathname === "/tasks"
              ? "tasks"
              : location.pathname === "/sessions" ||
                  location.pathname.startsWith("/sessions/")
                ? "sessions"
                : "script";
  const isTheaterView = activeView === "theater";

  const [theaterOutlinerHost, setTheaterOutlinerHost] =
    useState<HTMLDivElement | null>(null);
  const appliedMobileTheaterPanelDefaultRef = useRef(false);
  const setTheaterOutlinerHostRef = useCallback((node: HTMLDivElement | null) => {
    setTheaterOutlinerHost(node);
  }, []);

  useEffect(() => {
    if (
      isMobile &&
      (mobilePlaylistOpen || mobileScenesOpen || (isTheaterView && showTheaterControls))
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [
    isMobile,
    isTheaterView,
    mobilePlaylistOpen,
    mobileScenesOpen,
    showTheaterControls,
  ]);

  useEffect(() => {
    if (!isMobile || activeView !== "theater") {
      appliedMobileTheaterPanelDefaultRef.current = false;
      return;
    }

    if (!appliedMobileTheaterPanelDefaultRef.current) {
      appliedMobileTheaterPanelDefaultRef.current = true;
      setShowTheaterControls(false);
    }
  }, [activeView, isMobile, setShowTheaterControls]);

  useEffect(() => {
    localStorage.setItem("activeView", activeView);
  }, [activeView]);

  useEffect(() => {
    if (
      activeView === "board" ||
      activeView === "sessions" ||
      activeView === "tasks"
    ) {
      writeRehearsalPlanTab(activeView);
    }
  }, [activeView]);

  const shouldShowScenesSidebar =
    activeView === "script" ||
    activeView === "light-plot" ||
    activeView === "sufer" ||
    activeView === "theater";
  const compactMainChrome =
    activeView === "board" ||
    activeView === "sessions" ||
    activeView === "tasks" ||
    activeView === "media";

  const kanbanMembers = useMemo(
    () =>
      [
        ...(myProfile?.email
          ? [
              {
                email: myProfile.email,
                displayName: myProfile.displayName ?? null,
              },
            ]
          : []),
        ...(projectOwner?.email
          ? [
              {
                email: projectOwner.email,
                displayName: projectOwner.displayName ?? null,
              },
            ]
          : []),
        ...(projectMembers ?? []).map((m) => ({
          email: m.user?.email,
          displayName: m.user?.displayName ?? null,
        })),
      ].filter((x) => Boolean(x?.email)),
    [myProfile, projectMembers, projectOwner?.displayName, projectOwner?.email],
  );

  return {
    accessToken,
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
    onProjectChange,
    projectName,
    projects,
    projectsLoading,
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
    setTheaterOutlinerHostRef,
    setTheaterLayout,
    shouldShowScenesSidebar,
    shouldSwapPanels,
    showHeaderSounds,
    showPlaylistSidebar,
    showTheaterControls,
    scenes,
    theaterOutlinerHost,
    theaterLayout,
    togglePanels: togglePanelsWithPersist,
    toggleTheaterControls,
    togglePlaylist,
    setShowTheaterControls,
  };
}
