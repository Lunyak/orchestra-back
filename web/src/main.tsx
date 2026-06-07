import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  createHashRouter,
  RouterProvider,
} from "react-router-dom";
import App from "./AppShell.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";
import { installViewportHeightCssVars } from "@app/shared/platform/viewport";

installViewportHeightCssVars();

function resolveRouterBasename(): string | undefined {
  const baseUrl = String(import.meta.env.BASE_URL || "/");
  if (baseUrl === "/" || baseUrl === "./") return undefined;
  const basename = baseUrl.replace(/\/$/, "");
  return basename || undefined;
}

async function bootstrap() {
  if (import.meta.env.VITE_CAPACITOR === "1") {
    const { initCapacitorPlatform } = await import(
      "@app/shared/platform/mobile/init"
    );
    await initCapacitorPlatform();
  }

  const routes = [{ path: "*", element: <App /> }];
  // Electron грузит index.html через file:// — BrowserRouter ломает маршруты (пустой экран).
  const isDesktop = import.meta.env.MODE === "desktop";
  const router = isDesktop
    ? createHashRouter(routes)
    : createBrowserRouter(routes, { basename: resolveRouterBasename() });

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <RouterProvider router={router} />
      </AppErrorBoundary>
    </React.StrictMode>,
  );
}

void bootstrap();
