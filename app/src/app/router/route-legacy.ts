import {
  globalPaths,
  projectPath,
  type ProjectSection,
} from "./paths";

export const LEGACY_PROJECT_ROUTES: ReadonlyArray<{
  path: string;
  section: ProjectSection;
}> = [
  { path: "/spectacle", section: "spectacle" },
  { path: "/light-plot", section: "light-plot" },
  { path: "/sufer", section: "sufer" },
  { path: "/notes-run", section: "sufer" },
  { path: "/media", section: "media" },
  { path: "/theater", section: "theater" },
  { path: "/board", section: "board" },
  { path: "/sessions", section: "sessions" },
  { path: "/rehearsals", section: "sessions" },
  { path: "/tasks", section: "tasks" },
  { path: "/troupe", section: "team" },
  { path: "/premises", section: "premises" },
  { path: "/settings", section: "settings" },
  { path: "/roles", section: "roles" },
  { path: "/admin", section: "sessions" },
];

export function resolveLegacyStudioPath(pathname: string) {
  const suffix = pathname.startsWith("/studio")
    ? pathname.slice("/studio".length)
    : "";
  return `${globalPaths.studios}${suffix}`;
}

export function resolveLegacyProjectPath(
  pathname: string,
  projectSlug: string | null | undefined,
) {
  if (!projectSlug) return globalPaths.projects;
  if (pathname === "/") return projectPath(projectSlug, "script");

  const legacy = LEGACY_PROJECT_ROUTES.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!legacy) return globalPaths.projects;

  let suffix = pathname.slice(legacy.path.length);
  if (legacy.path === "/rehearsals") suffix = "";
  if (legacy.path === "/notes-run") suffix = "";
  return `${projectPath(projectSlug, legacy.section)}${suffix}`;
}
