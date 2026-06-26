const SCENE_PAGE_KEY_PREFIX = "selectedScenePage:";

export function readSelectedScenePage(projectName: string): number | null {
  if (typeof window === "undefined" || !projectName) return null;
  try {
    const stored = localStorage.getItem(`${SCENE_PAGE_KEY_PREFIX}${projectName}`);
    if (stored == null || stored === "") return null;
    const page = Number(stored);
    return Number.isFinite(page) ? page : null;
  } catch {
    return null;
  }
}

export function writeSelectedScenePage(projectName: string, page: number): void {
  if (typeof window === "undefined" || !projectName) return;
  try {
    localStorage.setItem(`${SCENE_PAGE_KEY_PREFIX}${projectName}`, String(page));
  } catch {
    // ignore
  }
}
