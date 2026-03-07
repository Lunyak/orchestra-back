import { lazy, Suspense, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useScriptUI } from "../../features/script-ui";
import { Header } from "../../shared/components/header/Header";
import { PageLoader } from "@shared/components/page-loader/PageLoader";

// Lazy imports страниц
const SpectaclePage = lazy(() =>
  import("../../pages/spectacle/SpectaclePage").then((m) => ({
    default: m.SpectaclePage,
  }))
);

const DirectorSessionsPage = lazy(() =>
  import("../../pages/sessions/DirectorSessionsPage").then((m) => ({
    default: m.DirectorSessionsPage,
  }))
);

const DirectorSessionDetailsPage = lazy(() =>
  import("../../pages/sessions/DirectorSessionDetailsPage").then((m) => ({
    default: m.DirectorSessionDetailsPage,
  }))
);

const DirectorSessionPage = lazy(() =>
  import("../../pages/sessions/DirectorSessionPage").then((m) => ({
    default: m.DirectorSessionPage,
  }))
);

const DirectorSessionSlotPage = lazy(() =>
  import("../../pages/sessions/DirectorSessionSlotPage").then((m) => ({
    default: m.DirectorSessionSlotPage,
  }))
);

const ProfilePage = lazy(() =>
  import("../../pages/profile/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  }))
);

const TroupePage = lazy(() =>
  import("../../pages/troupe/TroupePage").then((m) => ({
    default: m.TroupePage,
  }))
);

const RolesPage = lazy(() =>
  import("../../pages/roles/RolesPage").then((m) => ({
    default: m.RolesPage,
  }))
);

const SettingsPage = lazy(() =>
  import("../../pages/settings/SettingsPage/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  }))
);

const SettingsBotPage = lazy(() =>
  import("../../pages/settings/SettingsBotPage").then((m) => ({
    default: m.SettingsBotPage,
  }))
);

const ActorPage = lazy(() =>
  import("../../pages/actor/ActorPage").then((m) => ({
    default: m.ActorPage,
  }))
);

const TrainersPage = lazy(() =>
  import("../../pages/trainers/TrainersPage").then((m) => ({
    default: m.TrainersPage,
  }))
);

const SpeechTrainerPage = lazy(() =>
  import("../../pages/trainers/SpeechTrainerPage").then((m) => ({
    default: m.SpeechTrainerPage,
  }))
);

const DictionTrainerPage = lazy(() =>
  import("../../pages/trainers/DictionTrainerPage").then((m) => ({
    default: m.DictionTrainerPage,
  }))
);

const RoleWorkbookPage = lazy(() =>
  import("../../pages/role-workbook/RoleWorkbookPage").then((m) => ({
    default: m.RoleWorkbookPage,
  }))
);

const PrivacyPage = lazy(() =>
  import("../../pages/legal/PrivacyPage").then((m) => ({
    default: m.PrivacyPage,
  }))
);

const TermsPage = lazy(() =>
  import("../../pages/legal/TermsPage").then((m) => ({
    default: m.TermsPage,
  }))
);

/**
 * Компонент с маршрутами приложения.
 * Используется внутри провайдеров (AuthProvider, ProjectProvider, etc.)
 */
export function AppRoutes() {
  const location = useLocation();
  const {
    showRequisites,
    toggleRequisites,
    showPlaylistSidebar,
    togglePlaylist,
    showHeaderSounds,
    toggleHeaderSounds,
    showStepRoles,
    toggleStepRoles,
    showScriptEditorTools,
    toggleScriptEditorTools,
    isStepsCollapsed,
    toggleStepsCollapsed,
    mobilePlaylistOpen,
    setMobilePlaylistOpen,
    toggleMobilePlaylist,
    mobileStepsOpen,
    setMobileStepsOpen,
    toggleMobileSteps,
  } = useScriptUI();

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(typeof window !== "undefined" ? window.innerWidth < 980 : false);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  // Определяем, нужно ли показывать scriptState controls в Header
  const shouldShowScriptState =
    location.pathname === "/" ||
    location.pathname === "/theater" ||
    location.pathname === "/light-plot";

  const isSpectacleLayoutRoute =
    location.pathname === "/" ||
    location.pathname === "/theater" ||
    location.pathname === "/light-plot";

  const isBoardRoute = location.pathname === "/board";

  const headerShowPlaylist = isMobile ? mobilePlaylistOpen : showPlaylistSidebar;
  const headerIsStepsCollapsed = isMobile ? !mobileStepsOpen : isStepsCollapsed;

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

  return (
    <>
      <Header
        scriptState={
          shouldShowScriptState
            ? {
              showRequisites,
              onToggleRequisites: toggleRequisites,
              showPlaylist: headerShowPlaylist,
              onTogglePlaylist: handleTogglePlaylist,
              showHeaderSounds,
              onToggleHeaderSounds: toggleHeaderSounds,
              showRoles: showStepRoles,
              onToggleRoles: toggleStepRoles,
              showScriptEditorTools,
              onToggleScriptEditorTools: toggleScriptEditorTools,
              isStepsCollapsed: headerIsStepsCollapsed,
              onToggleStepsCollapsed: handleToggleSteps,
            }
            : undefined
        }
      />
      <Suspense
        fallback={
          isSpectacleLayoutRoute ? (
            <PageLoader
              variant="spectacle"
              showLeftSidebar={isMobile ? mobilePlaylistOpen : showPlaylistSidebar}
              showRightSidebar={isMobile ? mobileStepsOpen : !isStepsCollapsed}
              showTopBar={showHeaderSounds}
              label="Загрузка страницы…"
            />
          ) : (
            <PageLoader variant="simple" label={isBoardRoute ? "Загрузка доски…" : "Загрузка страницы…"} />
          )
        }
      >
        <Routes>
          <Route path="/" element={<SpectaclePage />} />
          <Route path="/theater" element={<SpectaclePage />} />
          <Route path="/light-plot" element={<SpectaclePage />} />
          <Route path="/board" element={<SpectaclePage />} />
          <Route path="/rehearsals" element={<Navigate to="/sessions" replace />} />
          <Route path="/rehearsals/:rehearsalId" element={<Navigate to="/sessions" replace />} />
          <Route path="/sessions" element={<DirectorSessionsPage />} />
          <Route path="/sessions/:sessionId" element={<DirectorSessionPage />} />
          <Route path="/sessions/:sessionId/slots/:slotId" element={<DirectorSessionSlotPage />} />
          <Route path="/sessions/:sessionId/attendance" element={<DirectorSessionDetailsPage />} />
          <Route path="/actor" element={<ActorPage />} />
          <Route path="/trainers" element={<TrainersPage />} />
          <Route path="/trainers/speech" element={<SpeechTrainerPage />} />
          <Route path="/trainers/diction" element={<DictionTrainerPage />} />
          <Route path="/role-workbook/:roleId" element={<RoleWorkbookPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/troupe" element={<TroupePage />} />
          <Route path="/roles" element={<RolesPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/bot" element={<SettingsBotPage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

