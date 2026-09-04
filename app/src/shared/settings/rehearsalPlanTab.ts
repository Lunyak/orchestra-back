import {
  getProjectSectionFromPath,
  globalPaths,
  projectPath,
} from "../../app/router/paths";
import { readSelectedProjectSlug } from "./selectedProject";

export type RehearsalPlanTab = "sessions" | "board" | "tasks";

const KEY = "orchestra:rehearsal-plan-tab";

const DEFAULT_TAB: RehearsalPlanTab = "sessions";

export function readRehearsalPlanTab(): RehearsalPlanTab {
  if (typeof window === "undefined") return DEFAULT_TAB;
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "sessions" || stored === "board" || stored === "tasks") {
      return stored;
    }
  } catch {
    // ignore
  }
  return DEFAULT_TAB;
}

export function writeRehearsalPlanTab(tab: RehearsalPlanTab): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(KEY, tab);
  } catch {
    // ignore
  }
}

export function rehearsalPlanTabFromPath(pathname: string): RehearsalPlanTab | null {
  const section = getProjectSectionFromPath(pathname);
  if (section === "board") return "board";
  if (section === "tasks") return "tasks";
  if (section === "sessions") return "sessions";
  return null;
}

export function resolveRehearsalPlanEntryPath(options?: {
  projectSlug?: string | null;
  excludeTasks?: boolean;
}): string {
  const projectSlug = options?.projectSlug ?? readSelectedProjectSlug();
  const tab = readRehearsalPlanTab();
  const resolvedTab =
    options?.excludeTasks && tab === "tasks" ? "sessions" : tab;

  if (!projectSlug) return globalPaths.projects;
  return projectPath(projectSlug, resolvedTab);
}
