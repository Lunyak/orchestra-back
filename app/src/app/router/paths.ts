export const globalPaths = {
  dashboard: "/dashboard",
  projects: "/projects",
  organizations: "/organizations",
  premises: "/premises",
  accounting: "/accounting",
  studios: "/studios",
  profile: "/profile",
  billing: "/billing",
} as const;

export const DEFAULT_APP_PATH = globalPaths.dashboard;

export type ProjectSection =
  | "overview"
  | "spectacle"
  | "script"
  | "light-plot"
  | "sufer"
  | "media"
  | "theater"
  | "board"
  | "sessions"
  | "tasks"
  | "team"
  | "roles"
  | "cast"
  | "premises"
  | "accounting"
  | "settings";

const encodeSegment = (value: string) => encodeURIComponent(value.trim());

export function projectRootPath(projectSlug: string) {
  return `/projects/${encodeSegment(projectSlug)}`;
}

export function projectPath(
  projectSlug: string,
  section: ProjectSection = "overview",
) {
  return `${projectRootPath(projectSlug)}/${section}`;
}

export function projectTaskPath(
  projectSlug: string,
  taskPathParam?: string,
) {
  const root = projectPath(projectSlug, "tasks");
  return taskPathParam ? `${root}/${encodeSegment(taskPathParam)}` : root;
}

export function projectSessionPath(
  projectSlug: string,
  sessionId?: string,
  slotId?: string,
) {
  const root = projectPath(projectSlug, "sessions");
  if (!sessionId) return root;
  const sessionPath = `${root}/${encodeSegment(sessionId)}`;
  return slotId
    ? `${sessionPath}/slots/${encodeSegment(slotId)}`
    : sessionPath;
}

export function theaterOrganizationPath(theaterId?: string) {
  const root = `${globalPaths.organizations}/theaters`;
  if (theaterId) return `${root}/${encodeSegment(theaterId)}`;
  return globalPaths.organizations;
}

export function theaterOverviewPath(theaterId: string) {
  return `${theaterOrganizationPath(theaterId)}/overview`;
}

export function theaterTroupePath(theaterId: string) {
  return `${theaterOrganizationPath(theaterId)}/troupe`;
}

export function theaterRehearsalsPath(theaterId: string) {
  return `${theaterOrganizationPath(theaterId)}/rehearsals`;
}

export function theaterAvailabilityPath(theaterId: string) {
  const id = theaterId.trim();
  if (!id) return globalPaths.organizations;
  return `${theaterOrganizationPath(id)}/availability`;
}

export function theaterRehearsalSessionPath(
  theaterId: string,
  sessionId?: string,
  slotId?: string,
) {
  const root = theaterRehearsalsPath(theaterId);
  if (!sessionId) return root;
  const sessionPath = `${root}/${encodeSegment(sessionId)}`;
  return slotId
    ? `${sessionPath}/slots/${encodeSegment(slotId)}`
    : sessionPath;
}

export function theaterTeamPath(theaterId: string) {
  return `${theaterOrganizationPath(theaterId)}/team`;
}

export function theaterTeamRolePath(theaterId: string, roleId: string) {
  return `${theaterTeamPath(theaterId)}/roles/${encodeSegment(roleId)}`;
}

export function projectTeamRolePath(projectSlug: string, roleId?: string) {
  const root = projectPath(projectSlug, "team");
  return roleId ? `${root}/roles/${encodeSegment(roleId)}` : root;
}

export function projectTheaterInvitePath(token?: string) {
  const root = `${globalPaths.projects}/theater-invite`;
  return token ? `${root}/${encodeSegment(token)}` : root;
}

export function theaterPremisesPath(theaterId: string, premiseId?: string) {
  const root = `${theaterOrganizationPath(theaterId)}/premises`;
  return premiseId ? `${root}/${encodeSegment(premiseId)}` : root;
}

export function projectPremisePath(projectSlug: string, premiseId?: string) {
  const root = projectPath(projectSlug, "premises");
  return premiseId ? `${root}/${encodeSegment(premiseId)}` : root;
}

export function projectAccountingPath(
  projectSlug: string,
  collectionId?: string,
) {
  const root = projectPath(projectSlug, "accounting");
  return collectionId ? `${root}/${encodeSegment(collectionId)}` : root;
}

export function accountingPath(collectionId?: string) {
  return collectionId
    ? `${globalPaths.accounting}/${encodeSegment(collectionId)}`
    : globalPaths.accounting;
}

export function projectSettingsPath(projectSlug: string, bot = false) {
  const root = projectPath(projectSlug, "settings");
  return bot ? `${root}/bot` : root;
}

export function troupeOrganizationPath(troupeId?: string) {
  const root = `${globalPaths.organizations}/troupes`;
  if (troupeId) return `${root}/${encodeSegment(troupeId)}`;
  return globalPaths.organizations;
}

export function organizationsPath(type?: "theater" | "troupe" | "studio") {
  if (!type) return globalPaths.organizations;
  return `${globalPaths.organizations}?type=${type}`;
}

export function studioOrganizationPath(studioId?: string) {
  const root = `${globalPaths.organizations}/studios`;
  if (studioId) return `${root}/${encodeSegment(studioId)}`;
  return globalPaths.organizations;
}

export function studioOverviewPath(studioId: string) {
  return `${studioOrganizationPath(studioId)}/overview`;
}

export function studioMembersPath(studioId: string) {
  return `${studioOrganizationPath(studioId)}/members`;
}

export function studioInvitesPath(studioId: string) {
  return `${studioOrganizationPath(studioId)}/invites`;
}

export function studioProgramSectionPath(studioId: string) {
  return `${studioOrganizationPath(studioId)}/program`;
}

export function studioAssignmentsPath(studioId: string) {
  return `${studioOrganizationPath(studioId)}/assignments`;
}

export function studioVideosSectionPath(studioId: string) {
  return `${studioOrganizationPath(studioId)}/videos`;
}

export function studioOrgPremisesPath(studioId: string, premiseId?: string) {
  const root = `${studioOrganizationPath(studioId)}/premises`;
  return premiseId ? `${root}/${encodeSegment(premiseId)}` : root;
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function getTheaterIdFromPath(pathname: string) {
  const match = pathname.match(
    /^\/organizations\/theaters\/([^/]+)(?:\/|$)/,
  );
  if (!match) return null;
  return decodePathSegment(match[1]);
}

export function getStudioIdFromPath(pathname: string) {
  const orgMatch = pathname.match(
    /^\/organizations\/studios\/([^/]+)(?:\/|$)/,
  );
  if (orgMatch) return decodePathSegment(orgMatch[1]);

  const studioMatch = pathname.match(/^\/studios\/([^/]+)(?:\/|$)/);
  if (!studioMatch) return null;

  const studioId = decodePathSegment(studioMatch[1]);
  if (studioId === "invite") return null;
  return studioId;
}

export function isTheaterOrganizationPath(pathname: string) {
  return getTheaterIdFromPath(pathname) !== null;
}

export function isTheaterTeamPath(pathname: string) {
  return /^\/organizations\/theaters\/[^/]+\/team(?:\/|$)/.test(pathname);
}

export function isTheaterTroupePath(pathname: string) {
  return /^\/organizations\/theaters\/[^/]+\/troupe(?:\/|$)/.test(pathname);
}

export function isTheaterAvailabilityPath(pathname: string) {
  return /^\/organizations\/theaters\/[^/]+\/availability(?:\/|$)/.test(
    pathname,
  );
}

export function studioPath(studioId?: string) {
  return studioId
    ? `${globalPaths.studios}/${encodeSegment(studioId)}`
    : globalPaths.studios;
}

export function studioPremisesPath(studioId: string, premiseId?: string) {
  return studioOrgPremisesPath(studioId, premiseId);
}

export function studioProgramPath(studioId: string, programId: string) {
  return `${studioPath(studioId)}/programs/${encodeSegment(programId)}`;
}

export function studioLessonPath(
  studioId: string,
  programId: string,
  lessonId: string,
) {
  return `${studioProgramPath(studioId, programId)}/lessons/${encodeSegment(lessonId)}`;
}

export function studioAssignmentPath(studioId: string, assignmentId: string) {
  return `${studioPath(studioId)}/assignments/${encodeSegment(assignmentId)}`;
}

export function studioVideoPath(studioId: string, videoId: string) {
  return `${studioPath(studioId)}/videos/${encodeSegment(videoId)}`;
}

export function resolveLegacyStudioPath(pathname: string) {
  const suffix = pathname.startsWith("/studio")
    ? pathname.slice("/studio".length)
    : "";
  return `${globalPaths.studios}${suffix}`;
}

const LEGACY_PROJECT_SECTIONS: ReadonlyArray<{
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

export function resolveLegacyProjectPath(
  pathname: string,
  projectSlug: string | null | undefined,
) {
  if (!projectSlug) return globalPaths.projects;
  if (pathname === "/") return projectPath(projectSlug, "script");

  const legacy = LEGACY_PROJECT_SECTIONS.find(
    ({ path }) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (!legacy) return globalPaths.projects;

  let suffix = pathname.slice(legacy.path.length);
  if (legacy.path === "/rehearsals") suffix = "";
  if (legacy.path === "/notes-run") suffix = "";
  return `${projectPath(projectSlug, legacy.section)}${suffix}`;
}

export function getProjectSlugFromPath(pathname: string) {
  const match = pathname.match(/^\/projects\/([^/]+)(?:\/|$)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

export function isProjectPath(pathname: string) {
  return getProjectSlugFromPath(pathname) !== null;
}

/** Проект / театр / студия — scoped chrome (← назад вместо burger на mobile). */
export function isScopedWorkspacePath(pathname: string) {
  return (
    isProjectPath(pathname) ||
    isTheaterOrganizationPath(pathname) ||
    getStudioIdFromPath(pathname) !== null
  );
}

export function getProjectSectionFromPath(pathname: string) {
  const match = pathname.match(/^\/projects\/[^/]+\/([^/]+)/);
  return (match?.[1] as ProjectSection | undefined) ?? null;
}

/** Родительский экран проекта: раздел → обзор, обзор → список проектов. */
export function resolveProjectScopedBackPath(pathname: string): string | null {
  const slug = getProjectSlugFromPath(pathname);
  if (!slug) return null;

  const parts = pathname.split("/").filter(Boolean);
  const section = parts[2];
  const rest = parts.slice(3);

  if (!section || section === "overview") return globalPaths.projects;

  if (section === "sessions") {
    if (rest[1] === "slots" && rest[0] && rest[2]) {
      return projectSessionPath(slug, rest[0]);
    }
    if (rest[0]) return projectPath(slug, "sessions");
  }

  if (section === "tasks" && rest[0]) return projectPath(slug, "tasks");
  if (section === "team" && rest[0] === "roles") return projectPath(slug, "team");
  if (section === "settings" && rest[0] === "bot") {
    return projectPath(slug, "settings");
  }

  return projectPath(slug, "overview");
}
