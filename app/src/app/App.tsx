import "../index.css";
import { bootstrapTheme } from "../shared/styles/theme/apply-theme";
import { ThemeProvider } from "../shared/styles/theme/ThemeProvider";
import { useAuth, useAuthBootstrap } from "../features/auth";
import { ProjectProvider } from "../features/project";
import { SceneSyncRunner } from "../features/scene";
import { ScriptUIProvider } from "../features/script-ui";
import { LoginPage } from "../pages/login/LoginPage";
import { ResetPasswordPage } from "../pages/login/ResetPasswordPage";
import { PrivacyPage } from "../pages/legal/PrivacyPage";
import { TermsPage } from "../pages/legal/TermsPage";
import { SpectaclePageLockGuard } from "./SpectaclePageLockGuard";
import { AppRoutes } from "./router/AppRoutes";
import { PlatformProvider } from "./providers/platform";
import { StoreProvider } from "./providers/StoreProvider";
import { Route, Routes } from "react-router-dom";
import { ChatDock } from "../features/chat";

bootstrapTheme();

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
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="*" element={<LoginPage onAfterLogin={onAfterLogin} />} />
      </Routes>
    );
  }

  const isProjectorOutput =
    typeof window !== "undefined" &&
    window.location.pathname.replace(/\/$/, "").endsWith("/projector-output");

  return (
    <ProjectProvider>
      <SceneSyncRunner>
        <ScriptUIProvider>
          <>
            <AppRoutes />
            {!isProjectorOutput ? <ChatDock /> : null}
          </>
        </ScriptUIProvider>
      </SceneSyncRunner>
    </ProjectProvider>
  );
}

export default function App({ onAfterLogin, onPushAllLocal, onResyncProject }: AppProps) {
  return (
    <ThemeProvider>
      <StoreProvider>
        <SpectaclePageLockGuard />
        <PlatformProvider value={{ onPushAllLocal, onResyncProject }}>
          <AuthenticatedApp onAfterLogin={onAfterLogin} />
        </PlatformProvider>
      </StoreProvider>
    </ThemeProvider>
  );
}
