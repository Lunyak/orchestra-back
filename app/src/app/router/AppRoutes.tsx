import { lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { useScriptUI } from "../../features/script-ui";
import { Header } from "../../shared/components/header/Header";

// Lazy imports страниц
const SpectaclePage = lazy(() =>
  import("../../pages/spectacle/SpectaclePage").then((m) => ({
    default: m.SpectaclePage,
  }))
);

const RehearsalsPage = lazy(() =>
  import("../../pages/rehearsals/RehearsalsPage").then((m) => ({
    default: m.RehearsalsPage,
  }))
);

const DirectorSessionsPage = lazy(() =>
  import("../../pages/sessions/DirectorSessionsPage").then((m) => ({
    default: m.DirectorSessionsPage,
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
    isStepsCollapsed,
    toggleStepsCollapsed,
  } = useScriptUI();

  // Определяем, нужно ли показывать scriptState controls в Header
  const shouldShowScriptState =
    location.pathname === "/" ||
    location.pathname === "/theater" ||
    location.pathname === "/light-plot";

  return (
    <>
      <Header
        scriptState={
          shouldShowScriptState
            ? {
              showRequisites,
              onToggleRequisites: toggleRequisites,
              showPlaylist: showPlaylistSidebar,
              onTogglePlaylist: togglePlaylist,
              showHeaderSounds,
              onToggleHeaderSounds: toggleHeaderSounds,
              isStepsCollapsed,
              onToggleStepsCollapsed: toggleStepsCollapsed,
            }
            : undefined
        }
      />
      <Suspense fallback={<div>Loading...</div>}>
        <Routes>
          <Route path="/" element={<SpectaclePage />} />
          <Route path="/theater" element={<SpectaclePage />} />
          <Route path="/light-plot" element={<SpectaclePage />} />
          <Route path="/board" element={<SpectaclePage />} />
          <Route path="/rehearsals" element={<RehearsalsPage />} />
          <Route path="/sessions" element={<DirectorSessionsPage />} />
          <Route path="/actor" element={<ActorPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/troupe" element={<TroupePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/settings/bot" element={<SettingsBotPage />} />
        </Routes>
      </Suspense>
    </>
  );
}

