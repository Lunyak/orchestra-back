import "../App.css";
import { useAuth, useAuthBootstrap } from "../features/auth";
import { ProjectProvider } from "../features/project";
import { SceneProvider } from "../features/scene";
import { ScriptUIProvider } from "../features/script-ui";
import { LoginPage } from "../pages/login/LoginPage";
import { PrivacyPage } from "../pages/legal/PrivacyPage";
import { TermsPage } from "../pages/legal/TermsPage";
import { AppRoutes } from "./router/AppRoutes";
import { PlatformProvider } from "./providers/platform";
import { StoreProvider } from "./providers/StoreProvider";
import { Route, Routes } from "react-router-dom";

export interface AppProps {
  /** После логина/регистрации (только desktop — выгрузка локальных данных). */
  onAfterLogin?: (token: string) => Promise<void>;
  /** Выгрузка всех локальных данных на сервер (только desktop). */
  onPushAllLocal?: () => Promise<void>;
  /** Ручной resync проекта (только desktop). */
  onResyncProject?: (
    projectSlug: string,
  ) => Promise<{ updatedScenes: number; totalScenes: number }>;
}

function AuthenticatedApp({ onAfterLogin }: { onAfterLogin?: (token: string) => Promise<void> }) {
  useAuthBootstrap();
  const { accessToken } = useAuth();

  if (!accessToken) {
    return (
      <Routes>
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="*" element={<LoginPage onAfterLogin={onAfterLogin} />} />
      </Routes>
    );
  }

  return (
    <ProjectProvider>
      <SceneProvider>
        <ScriptUIProvider>
          <AppRoutes />
        </ScriptUIProvider>
      </SceneProvider>
    </ProjectProvider>
  );
}

export default function App({ onAfterLogin, onPushAllLocal, onResyncProject }: AppProps) {
  return (
    <StoreProvider>
      <PlatformProvider value={{ onPushAllLocal, onResyncProject }}>
        <AuthenticatedApp onAfterLogin={onAfterLogin} />
      </PlatformProvider>
    </StoreProvider>
  );
}

