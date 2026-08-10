import { resolveRehearsalPlanEntryPath } from "./rehearsalPlanTab";
import {
  getProjectSectionFromPath,
  globalPaths,
  isTheaterTeamPath,
} from "../../app/router/paths";

export type AdminSection =
  | "plan"
  | "team"
  | "tasks"
  | "accounting"
  | "premises";

const KEY = "orchestra:admin-section";

const DEFAULT_SECTION: AdminSection = "plan";

export function readAdminSection(): AdminSection {
  if (typeof window === "undefined") return DEFAULT_SECTION;
  try {
    const stored = localStorage.getItem(KEY);
    if (
      stored === "plan" ||
      stored === "team" ||
      stored === "tasks" ||
      stored === "accounting" ||
      stored === "premises"
    ) {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_SECTION;
}

export function writeAdminSection(section: AdminSection): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, section);
  } catch {
    // ignore
  }
}

export function adminSectionFromPath(pathname: string): AdminSection | null {
  const section = getProjectSectionFromPath(pathname);
  if (section === "tasks") return "tasks";
  if (section === "board" || section === "sessions") return "plan";
  if (
    section === "accounting" ||
    pathname === globalPaths.accounting ||
    pathname.startsWith(`${globalPaths.accounting}/`)
  ) {
    return "accounting";
  }
  if (section === "premises") return "premises";
  if (isTheaterTeamPath(pathname) || section === "team") return "team";
  return null;
}

export function resolveAdminPlanEntryPath(): string {
  return resolveRehearsalPlanEntryPath({ excludeTasks: true });
}

export function resolveAdminEntryPath(): string {
  const section = readAdminSection();
  if (section === "team") return globalPaths.organizations;
  if (section === "tasks") return "/tasks";
  if (section === "accounting") return "/accounting";
  if (section === "premises") return "/premises";
  return resolveAdminPlanEntryPath();
}

export function isAdminPlanPath(pathname: string): boolean {
  const section = getProjectSectionFromPath(pathname);
  return section === "board" || section === "sessions";
}

export function isAdminTeamPath(pathname: string): boolean {
  return isTheaterTeamPath(pathname);
}

export function isAdminTasksPath(pathname: string): boolean {
  return getProjectSectionFromPath(pathname) === "tasks";
}

export function isAdminAccountingPath(pathname: string): boolean {
  return (
    pathname === globalPaths.accounting ||
    pathname.startsWith(`${globalPaths.accounting}/`) ||
    getProjectSectionFromPath(pathname) === "accounting"
  );
}

export function isAdminPremisesPath(pathname: string): boolean {
  return getProjectSectionFromPath(pathname) === "premises";
}
