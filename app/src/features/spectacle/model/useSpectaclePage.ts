import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../auth";
import { useMyProfileQuery } from "../../profile/api/profile-api";
import { useProject } from "../../project";
import { useScene } from "../../scene";
import { useScriptUI } from "../../script-ui";
import { useTeam } from "../../team";
import { ENABLE_3D_THEATER } from "../../../shared/build-features";
import { patchTheaterViewPrefs, readTheaterViewPrefs } from "../../theater/model/theater-view-prefs-storage";
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
      void saveStepsForLightPlot();
    }
  }, [isEditing, saveStepsForLightPlot]);

  const { data: myProfile } = useMyProfileQuery(undefined, {
    skip: !accessToken,
  });

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
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
      (mobilePlaylistOpen || mobileStepsOpen || (isTheaterView && showTheaterControls))
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
    mobileStepsOpen,
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

  const shouldShowStepsSidebar =
    activeView === "script" ||
    activeView === "light-plot" ||
    activeView === "theater";
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
    togglePanels: togglePanelsWithPersist,
    toggleTheaterControls,
    togglePlaylist,
    setShowTheaterControls,
  };
}
