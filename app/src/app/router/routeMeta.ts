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

function isSessionsRoute(pathname: string) {
  return pathname === "/sessions" || pathname.startsWith("/sessions/");
}

export function isSpectacleRoute(pathname: string) {
  return isScriptStateRoute(pathname) || isSessionsRoute(pathname);
}

export function getRouteMeta(pathname: string) {
  return {
    shouldShowScriptState: isScriptStateRoute(pathname),
    isSpectacleLayoutRoute: isSpectacleRoute(pathname),
  };
}
