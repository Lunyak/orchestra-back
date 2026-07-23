import { ENABLE_3D_THEATER } from "../../shared/build-features";

export const SUFER_ROUTE_PATH = "/sufer";
export const PROJECT_MEDIA_ROUTE_PATH = "/media";
export const SPECTACLE_HUB_ROUTE_PATH = "/spectacle";
export const APP_HUB_ROUTE_PATH = "/home";

function isTheaterRoute(pathname: string) {
  return ENABLE_3D_THEATER && pathname === "/theater";
}

export function isTheaterRouteEnabled() {
  return ENABLE_3D_THEATER;
}

/** Хаб + рабочие creative-views: сценарий, light-plot, прогон, 3D. */
export function isSpectacleCreativePath(pathname: string) {
  return (
    pathname === SPECTACLE_HUB_ROUTE_PATH ||
    pathname === "/" ||
    pathname === "/light-plot" ||
    pathname === SUFER_ROUTE_PATH ||
    isTheaterRoute(pathname)
  );
}

function isScriptStateRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/light-plot" ||
    pathname === SUFER_ROUTE_PATH ||
    pathname === PROJECT_MEDIA_ROUTE_PATH ||
    pathname === "/notes-run" ||
    isTheaterRoute(pathname)
  );
}

/** Главная страница сценария (markdown). */
export function isScriptMarkdownRoute(pathname: string) {
  return pathname === "/";
}

function isBoardRoute(pathname: string) {
  return pathname === "/board";
}

function isSessionsRoute(pathname: string) {
  return pathname === "/sessions" || pathname.startsWith("/sessions/");
}

function isTasksRoute(pathname: string) {
  return pathname === "/tasks" || pathname.startsWith("/tasks/");
}

function isRehearsalPlanRoute(pathname: string) {
  return isBoardRoute(pathname) || isSessionsRoute(pathname) || isTasksRoute(pathname);
}

export function isSpectacleRoute(pathname: string) {
  return isScriptStateRoute(pathname) || isRehearsalPlanRoute(pathname);
}

export function getRouteMeta(pathname: string) {
  return {
    shouldShowScriptState: isScriptStateRoute(pathname),
    isSpectacleLayoutRoute: isSpectacleRoute(pathname),
  };
}
