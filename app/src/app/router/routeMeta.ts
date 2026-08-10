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
  const section = getProjectSectionFromPath(pathname);
  return (
    section === "script" ||
    section === "light-plot" ||
    section === "sufer" ||
    section === "media" ||
    isTheaterRoute(pathname)
  );
}

/** Главная страница сценария (markdown). */
export function isScriptMarkdownRoute(pathname: string) {
  return getProjectSectionFromPath(pathname) === "script";
}

function isBoardRoute(pathname: string) {
  return getProjectSectionFromPath(pathname) === "board";
}

function isSessionsRoute(pathname: string) {
  return getProjectSectionFromPath(pathname) === "sessions";
}

function isTasksRoute(pathname: string) {
  return getProjectSectionFromPath(pathname) === "tasks";
}

function isRehearsalPlanRoute(pathname: string) {
  return isBoardRoute(pathname) || isSessionsRoute(pathname) || isTasksRoute(pathname);
}

export function isSpectacleRoute(pathname: string) {
  return (
    isProjectPath(pathname) &&
    (isScriptStateRoute(pathname) || isRehearsalPlanRoute(pathname))
  );
}

export function getRouteMeta(pathname: string) {
  return {
    shouldShowScriptState: isScriptStateRoute(pathname),
    isSpectacleLayoutRoute: isSpectacleRoute(pathname),
  };
}
