import "./App.css";
import { useAuth, useAuthBootstrap } from "./features/auth";
import { ProjectProvider } from "./features/project";
import { SceneProvider } from "./features/scene";
import { ScriptUIProvider } from "./features/script-ui";
import { LoginPage } from "./pages/login/LoginPage";
import { PlatformProvider } from "./PlatformContext";
import { AppRoutes } from "./routes";
import { Provider as ReduxProvider } from "react-redux";
import { store } from "./shared/store/store";

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
    <ReduxProvider store={store}>
      <PlatformProvider value={{ onPushAllLocal }}>
        <AuthenticatedApp onAfterLogin={onAfterLogin} />
      </PlatformProvider>
    </ReduxProvider>
  );
}
