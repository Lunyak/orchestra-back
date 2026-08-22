import { ENABLE_3D_THEATER } from "../../shared/build-features";
import {
  getProjectSectionFromPath,
  globalPaths,
  isProjectPath,
} from "./paths";

export const SUFER_ROUTE_PATH = "/sufer";
export const PROJECT_MEDIA_ROUTE_PATH = "/media";
export const SPECTACLE_HUB_ROUTE_PATH = "/spectacle";
export const PROJECTS_ROUTE_PATH = globalPaths.projects;

function isTheaterRoute(pathname: string) {
  return (
    ENABLE_3D_THEATER &&
    (getProjectSectionFromPath(pathname) === "theater" || pathname === "/theater")
  );
}

export function isTheaterRouteEnabled() {
  return ENABLE_3D_THEATER;
}

/** Хаб + рабочие creative-views: сценарий, light-plot, прогон, 3D. */
export function isSpectacleCreativePath(pathname: string) {
  const section = getProjectSectionFromPath(pathname);
  return (
    section === "spectacle" ||
    section === "script" ||
    section === "light-plot" ||
    section === "sufer" ||
    isTheaterRoute(pathname)
  );
}

function isScriptStateRoute(pathname: string) {
  return isProjectPath(pathname);
}

/** Главная страница сценария (markdown). */
export function isScriptMarkdownRoute(pathname: string) {
  return getProjectSectionFromPath(pathname) === "script";
}

export function isSpectacleRoute(pathname: string) {
  if (!isProjectPath(pathname)) return false;
  const section = getProjectSectionFromPath(pathname);
  return (
    section === "script" ||
    section === "light-plot" ||
    section === "sufer" ||
    section === "media" ||
    section === "board" ||
    section === "sessions" ||
    section === "tasks" ||
    section === "team" ||
    isTheaterRoute(pathname)
  );
}

export function getRouteMeta(pathname: string) {
  return {
    shouldShowScriptState: isScriptStateRoute(pathname),
    isSpectacleLayoutRoute: isSpectacleRoute(pathname),
  };
}
