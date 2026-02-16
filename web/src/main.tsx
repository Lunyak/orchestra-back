import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./AppShell.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";
import { installViewportHeightCssVars } from "@app/shared/platform/viewport";

installViewportHeightCssVars();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <HashRouter>
        <App />
      </HashRouter>
    </AppErrorBoundary>
  </React.StrictMode>,
);
