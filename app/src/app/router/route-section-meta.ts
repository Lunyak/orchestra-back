import type { ProjectSection } from "./paths";

export function isProjectOperationsSection(
  section: ProjectSection | null,
): boolean {
  return (
    section === "tasks" ||
    section === "sessions" ||
    section === "availability" ||
    section === "team"
  );
}

export function shouldShowScriptStateForSection(
  section: ProjectSection | null,
): boolean {
  if (!section || section === "overview") return false;
  return !isProjectOperationsSection(section);
}

export function isSpectacleLayoutSection(
  section: ProjectSection | null,
): boolean {
  return (
    section === "script" ||
    section === "light-plot" ||
    section === "sufer" ||
    section === "media" ||
    section === "board"
  );
}
