const ASSEMBLY_PLAYER_EXPANDED_KEY_PREFIX = "orchestra-assembly-player-expanded:";

export function assemblyPlayerExpandedStorageKey(projectName: string): string {
  return `${ASSEMBLY_PLAYER_EXPANDED_KEY_PREFIX}${projectName}`;
}

export function readAssemblyPlayerExpanded(projectName: string): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = localStorage.getItem(assemblyPlayerExpandedStorageKey(projectName));
    return stored !== "false";
  } catch {
    return true;
  }
}

export function persistAssemblyPlayerExpanded(projectName: string, expanded: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(assemblyPlayerExpandedStorageKey(projectName), String(expanded));
  } catch {
    /* ignore */
  }
}
