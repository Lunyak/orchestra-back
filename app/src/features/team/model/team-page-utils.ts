import {
  getProjectSectionFromPath,
  isTheaterAvailabilityPath,
  isTheaterTeamPath,
  isTheaterTroupePath,
} from "../../../app/router/paths";

/** Маршруты, на которых нужен список участников проекта (кэш RTK). */
export function shouldLoadProjectMembers(pathname: string): boolean {
  if (
    isTheaterTeamPath(pathname) ||
    isTheaterTroupePath(pathname) ||
    isTheaterAvailabilityPath(pathname)
  )
    return true;
  const section = getProjectSectionFromPath(pathname);
  return (
    section === "settings" ||
    section === "board" ||
    section === "roles" ||
    section === "cast" ||
    section === "tasks" ||
    section === "sessions"
  );
}
