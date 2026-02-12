import "./App.css";
import { AuthProvider, useAuth } from "./features/auth";
import { ProjectProvider } from "./features/project";
import { SceneProvider } from "./features/scene";
import { ScriptUIProvider } from "./features/script-ui";
import { LoginPage } from "./pages/login/LoginPage";
import { PlatformProvider } from "./PlatformContext";
import { AppRoutes } from "./routes";

export interface AppProps {
  /** После логина/регистрации (только desktop — выгрузка локальных данных). */
  onAfterLogin?: (token: string) => Promise<void>;
  /** Выгрузка всех локальных данных на сервер (только desktop). */
  onPushAllLocal?: () => Promise<void>;
}

function AuthenticatedApp() {
  const { accessToken } = useAuth();

  if (!accessToken) {
    return <LoginPage />;
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
    <PlatformProvider value={{ onPushAllLocal }}>
      <AuthProvider onAfterLogin={onAfterLogin}>
        <AuthenticatedApp />
      </AuthProvider>
    </PlatformProvider>
  );
}
