const PROG_RUN_PAUSED_KEY_PREFIX = "orchestra-prog-run-paused:";

export function progRunPausedStorageKey(projectName: string): string {
  return `${PROG_RUN_PAUSED_KEY_PREFIX}${projectName}`;
}

export function readProgRunPaused(projectName: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(progRunPausedStorageKey(projectName));
    return stored !== null ? stored === "true" : true;
  } catch {
    return true;
  }
}

export function persistProgRunPaused(projectName: string, paused: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(progRunPausedStorageKey(projectName), String(paused));
  } catch {
    // ignore
  }
}
