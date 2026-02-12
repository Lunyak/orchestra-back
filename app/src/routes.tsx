import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";

// Lazy imports страниц
const SpectaclePage = lazy(() =>
  import("./pages/spectacle/SpectaclePage").then((m) => ({
    default: m.SpectaclePage,
  }))
);

const RehearsalsPage = lazy(() =>
  import("./pages/rehearsals/RehearsalsPage").then((m) => ({
    default: m.RehearsalsPage,
  }))
);

const ProfilePage = lazy(() =>
  import("./pages/profile/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  }))
);

const SettingsPage = lazy(() =>
  import("./pages/settings/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  }))
);

/**
 * Компонент с маршрутами приложения.
 * Используется внутри провайдеров (AuthProvider, ProjectProvider, etc.)
 */
export function AppRoutes() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Routes>
        <Route path="/" element={<SpectaclePage />} />
        <Route path="/theater" element={<SpectaclePage />} />
        <Route path="/light-plot" element={<SpectaclePage />} />
        <Route path="/board" element={<SpectaclePage />} />
        <Route path="/rehearsals" element={<RehearsalsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </Suspense>
  );
}
