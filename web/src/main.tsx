import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./AppShell.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";
import { installViewportHeightCssVars } from "@app/shared/platform/viewport";

installViewportHeightCssVars();

const baseUrl = String(import.meta.env.BASE_URL || "/");
const routerBasename = baseUrl === "/" ? undefined : baseUrl.replace(/\/$/, "");

const router = createBrowserRouter(
  [{ path: "*", element: <App /> }],
  routerBasename ? { basename: routerBasename } : undefined,
);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  </React.StrictMode>,
);
