import { resolveRehearsalPlanEntryPath } from "./rehearsalPlanTab";

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
  if (pathname === "/tasks" || pathname.startsWith("/tasks/")) return "tasks";
  if (
    pathname === "/board" ||
    pathname === "/sessions" ||
    pathname.startsWith("/sessions/")
  ) {
    return "plan";
  }
  if (pathname.startsWith("/accounting")) return "accounting";
  if (pathname.startsWith("/premises")) return "premises";
  if (pathname === "/troupe" || pathname.startsWith("/troupe/")) {
    return "team";
  }
  return null;
}

export function resolveAdminPlanEntryPath(): string {
  return resolveRehearsalPlanEntryPath({ excludeTasks: true });
}

export function resolveAdminEntryPath(): string {
  const section = readAdminSection();
  if (section === "team") return "/troupe";
  if (section === "tasks") return "/tasks";
  if (section === "accounting") return "/accounting";
  if (section === "premises") return "/premises";
  return resolveAdminPlanEntryPath();
}

export function isAdminPlanPath(pathname: string): boolean {
  return (
    pathname === "/board" ||
    pathname === "/sessions" ||
    pathname.startsWith("/sessions/")
  );
}

export function isAdminTeamPath(pathname: string): boolean {
  return pathname === "/troupe" || pathname.startsWith("/troupe/");
}

export function isAdminTasksPath(pathname: string): boolean {
  return pathname === "/tasks" || pathname.startsWith("/tasks/");
}

export function isAdminAccountingPath(pathname: string): boolean {
  return pathname.startsWith("/accounting");
}

export function isAdminPremisesPath(pathname: string): boolean {
  return pathname.startsWith("/premises");
}
