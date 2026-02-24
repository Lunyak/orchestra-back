import "../App.css";
import { useAuth, useAuthBootstrap } from "../features/auth";
import { ProjectProvider } from "../features/project";
import { SceneProvider } from "../features/scene";
import { ScriptUIProvider } from "../features/script-ui";
import { LoginPage } from "../pages/login/LoginPage";
import { AppRoutes } from "./router/AppRoutes";
import { PlatformProvider } from "./providers/platform";
import { StoreProvider } from "./providers/StoreProvider";

export interface AppProps {
  /** После логина/регистрации (только desktop — выгрузка локальных данных). */
  onAfterLogin?: (token: string) => Promise<void>;
  /** Выгрузка всех локальных данных на сервер (только desktop). */
  onPushAllLocal?: () => Promise<void>;
}

function AuthenticatedApp({ onAfterLogin }: { onAfterLogin?: (token: string) => Promise<void> }) {
  useAuthBootstrap();
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <LoginPage onAfterLogin={onAfterLogin} />;
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

export default function App({ onAfterLogin, onPushAllLocal }: AppProps) {
  return (
    <StoreProvider>
      <PlatformProvider value={{ onPushAllLocal }}>
        <AuthenticatedApp onAfterLogin={onAfterLogin} />
      </PlatformProvider>
    </StoreProvider>
  );
}

