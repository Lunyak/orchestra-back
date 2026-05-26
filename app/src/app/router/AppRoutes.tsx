import { PageLoader } from "@shared/components/page-loader/PageLoader";
import { useIsMobile } from "@shared/hooks/useIsMobile";
import { type ComponentProps, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { useScriptUI } from "../../features/script-ui";
import { Header } from "../../shared/components/header/Header";
import { AppRouteDeclarations } from "./AppRouteDeclarations";
import { getRouteMeta } from "./routeMeta";

export function AppRoutes() {
  const location = useLocation();
  const {
    showPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds,
    toggleHeaderSounds,
    isStepsCollapsed,
    toggleStepsCollapsed,
    mobilePlaylistOpen,
    setMobilePlaylistOpen,
    toggleMobilePlaylist,
    mobileStepsOpen,
    setMobileStepsOpen,
    toggleMobileSteps,
  } = useScriptUI();

  const isMobile = useIsMobile();

  const { shouldShowScriptState, isSpectacleLayoutRoute } = getRouteMeta(
    location.pathname,
  );

  const isBoardRoute = location.pathname === "/board";

  const isPlaylistVisible = isMobile ? mobilePlaylistOpen : showPlaylistSidebar;
  const isStepsVisible = isMobile ? mobileStepsOpen : !isStepsCollapsed;
  const isHeaderStepsCollapsed = !isStepsVisible;
  const fallbackLabel = isBoardRoute ? "Загрузка доски…" : "Загрузка страницы…";
  const suspenseFallback = isSpectacleLayoutRoute ? (
    <PageLoader
      variant="spectacle"
      showLeftSidebar={isPlaylistVisible}
      showRightSidebar={isStepsVisible}
      showTopBar={showHeaderSounds}
      label="Загрузка страницы…"
    />
  ) : (
    <PageLoader variant="simple" label={fallbackLabel} />
  );

  const handleTogglePlaylist = () => {
    if (!isMobile) {
      togglePlaylist();
      return;
    }
    // На мобилке открываем плейлист как оверлей, не трогая desktop-персист.
    setMobileStepsOpen(false);
    toggleMobilePlaylist();
  };

  const handleToggleSteps = () => {
    if (!isMobile) {
      toggleStepsCollapsed();
      return;
    }
    setMobilePlaylistOpen(false);
    toggleMobileSteps();
  };

  const scriptState: ComponentProps<typeof Header>["scriptState"] =
    shouldShowScriptState
      ? {
          showPlaylist: isPlaylistVisible,
          onTogglePlaylist: handleTogglePlaylist,
          showHeaderSounds,
          onToggleHeaderSounds: toggleHeaderSounds,
          isStepsCollapsed: isHeaderStepsCollapsed,
          onToggleStepsCollapsed: handleToggleSteps,
        }
      : undefined;

  return (
    <>
      <Header
        scriptState={scriptState}
      />
      <Suspense fallback={suspenseFallback}>
        <AppRouteDeclarations />
      </Suspense>
    </>
  );
}
