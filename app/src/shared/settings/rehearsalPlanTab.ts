import { getProjectSectionFromPath } from "../../app/router/paths";

export type RehearsalPlanTab = "sessions" | "board" | "tasks";

const KEY = "orchestra:rehearsal-plan-tab";

const DEFAULT_TAB: RehearsalPlanTab = "sessions";

const TAB_PATH: Record<RehearsalPlanTab, string> = {
  sessions: "/sessions",
  board: "/board",
  tasks: "/tasks",
};

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
  excludeTasks?: boolean;
}): string {
  const tab = readRehearsalPlanTab();
  if (options?.excludeTasks && tab === "tasks") {
    return TAB_PATH.sessions;
  }
  return TAB_PATH[tab];
}
