import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import "./index.css";
import { router } from "./app/router";
import Preloader from "./shared/component/Preloader/Preloader";

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);

root.render(
  <React.StrictMode>
    <HelmetProvider>
      <RouterProvider router={router} fallbackElement={<Preloader fullscreen />} />
    </HelmetProvider>
  </React.StrictMode>
);

