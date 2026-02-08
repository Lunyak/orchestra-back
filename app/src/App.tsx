import { Route, Routes } from "react-router-dom";
import "./App.css";
import { AuthProvider, useAuth } from "./features/auth";
import { ProjectProvider } from "./features/project";
import { SceneProvider } from "./features/scene";
import { ScriptUIProvider } from "./features/script-ui";
import { LoginPage } from "./pages/login/LoginPage";
import { SettingsPage } from "./pages/settings/SettingsPage";
import { SpectaclePage } from "./pages/spectacle/SpectaclePage";
import { PlatformProvider } from "./PlatformContext";

export interface AppProps {
  /** После логина/регистрации (только desktop — выгрузка локальных данных). */
  onAfterLogin?: (token: string) => Promise<void>;
  /** Выгрузка всех локальных данных на сервер (только desktop). */
  onPushAllLocal?: () => Promise<void>;
}

function AppRoutes() {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <LoginPage />;
  }

  return (
    <ProjectProvider>
      <SceneProvider>
        <ScriptUIProvider>
          <Routes>
            <Route path="/" element={<SpectaclePage />} />
            <Route path="/theater" element={<SpectaclePage />} />
            <Route path="/light-plot" element={<SpectaclePage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </ScriptUIProvider>
      </SceneProvider>
    </ProjectProvider>
  );
}

export default function App({ onAfterLogin, onPushAllLocal }: AppProps) {
  return (
    <PlatformProvider value={{ onPushAllLocal }}>
      <AuthProvider onAfterLogin={onAfterLogin}>
        <AppRoutes />
      </AuthProvider>
    </PlatformProvider>
  );
}
