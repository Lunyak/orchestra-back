import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { useMyProfileQuery } from "../../profile/api/profile-api";
import { useProject } from "../../project";
import { useScene } from "../../scene";
import { useScriptUI } from "../../script-ui";
import { useTeam } from "../../team";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
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

  const prevIsEditingRef = useRef(isEditing);
  useEffect(() => {
    const prev = prevIsEditingRef.current;
    prevIsEditingRef.current = isEditing;
    if (prev && !isEditing) {
      void saveStepsForLightPlot();
    }
  }, [isEditing, saveStepsForLightPlot]);

  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 980);
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
    ENABLE_3D_THEATER && location.pathname === "/theater"
      ? "theater"
      : location.pathname === "/light-plot"
        ? "light-plot"
        : location.pathname === "/board"
          ? "board"
          : location.pathname === "/sessions" ||
              location.pathname.startsWith("/sessions/")
            ? "sessions"
            : "script";

  useEffect(() => {
    localStorage.setItem("activeView", activeView);
  }, [activeView]);

  const shouldShowStepsSidebar =
    activeView === "script" ||
    activeView === "light-plot" ||
    activeView === "theater";
  const isTheaterView = activeView === "theater";
  const compactMainChrome = activeView === "board" || activeView === "sessions";

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
  };
}
