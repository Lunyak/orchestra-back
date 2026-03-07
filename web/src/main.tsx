import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./AppShell.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";
import { installViewportHeightCssVars } from "@app/shared/platform/viewport";

installViewportHeightCssVars();

const baseUrl = String(import.meta.env.BASE_URL || "/");
const routerBasename = baseUrl === "/" ? undefined : baseUrl.replace(/\/$/, "");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <BrowserRouter
        basename={routerBasename}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <App />
      </BrowserRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
