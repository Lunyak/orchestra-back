import { ENABLE_3D_THEATER } from "../../shared/build-features";

function isTheaterRoute(pathname: string) {
  return ENABLE_3D_THEATER && pathname === "/theater";
}

export function isTheaterRouteEnabled() {
  return ENABLE_3D_THEATER;
}

function isScriptStateRoute(pathname: string) {
  return (
    pathname === "/" ||
    pathname === "/light-plot" ||
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
  return pathname === "/tasks";
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
