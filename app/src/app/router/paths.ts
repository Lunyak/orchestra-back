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

function encodeSegment(value: string) {
  return encodeURIComponent(value.trim());
}

function decodePathSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function pathSegments(pathname: string) {
  return pathname.split("/").filter(Boolean);
}

function withChild(root: string, child?: string) {
  if (!child) return root;
  return `${root}/${encodeSegment(child)}`;
}

export function projectRootPath(projectSlug: string) {
  return `/projects/${encodeSegment(projectSlug)}`;
}

export function projectPath(
  projectSlug: string,
  section: ProjectSection = "overview",
) {
  return `${projectRootPath(projectSlug)}/${section}`;
}

export function projectTaskPath(projectSlug: string, taskId?: string) {
  return withChild(projectPath(projectSlug, "tasks"), taskId);
}

export function projectSessionPath(
  projectSlug: string,
  sessionId?: string,
  slotId?: string,
) {
  const sessions = projectPath(projectSlug, "sessions");
  if (!sessionId) return sessions;
  const session = `${sessions}/${encodeSegment(sessionId)}`;
  if (!slotId) return session;
  return `${session}/slots/${encodeSegment(slotId)}`;
}

export function projectTeamRolePath(projectSlug: string, roleId?: string) {
  const team = projectPath(projectSlug, "team");
  if (!roleId) return team;
  return `${team}/roles/${encodeSegment(roleId)}`;
}

export function projectTheaterInvitePath(token?: string) {
  return withChild(`${globalPaths.projects}/theater-invite`, token);
}

export function projectSettingsPath(projectSlug: string, bot = false) {
  const settings = projectPath(projectSlug, "settings");
  return bot ? `${settings}/bot` : settings;
}

export function accountingPath(collectionId?: string) {
  return withChild(globalPaths.accounting, collectionId);
}

export function theaterOrganizationPath(theaterId?: string) {
  if (!theaterId) return globalPaths.organizations;
  return `/organizations/theaters/${encodeSegment(theaterId)}`;
}

function theaterPage(theaterId: string, page: string) {
  return `${theaterOrganizationPath(theaterId)}/${page}`;
}

export function theaterOverviewPath(theaterId: string) {
  return theaterPage(theaterId, "overview");
}

export function theaterTroupePath(theaterId: string) {
  return theaterPage(theaterId, "troupe");
}

export function theaterRehearsalsPath(theaterId: string) {
  return theaterPage(theaterId, "rehearsals");
}

export function theaterAvailabilityPath(theaterId: string) {
  const id = theaterId.trim();
  if (!id) return globalPaths.organizations;
  return theaterPage(id, "availability");
}

export function theaterRehearsalSessionPath(
  theaterId: string,
  sessionId?: string,
  slotId?: string,
) {
  const rehearsals = theaterRehearsalsPath(theaterId);
  if (!sessionId) return rehearsals;
  const session = `${rehearsals}/${encodeSegment(sessionId)}`;
  if (!slotId) return session;
  return `${session}/slots/${encodeSegment(slotId)}`;
}

export function theaterTeamPath(theaterId: string) {
  return theaterPage(theaterId, "team");
}

export function theaterTeamRolePath(theaterId: string, roleId: string) {
  return `${theaterTeamPath(theaterId)}/roles/${encodeSegment(roleId)}`;
}

export function theaterPremisesPath(theaterId: string, premiseId?: string) {
  return withChild(theaterPage(theaterId, "premises"), premiseId);
}

export function troupeOrganizationPath(troupeId?: string) {
  if (!troupeId) return globalPaths.organizations;
  return `/organizations/troupes/${encodeSegment(troupeId)}`;
}

export function organizationsPath(type?: "theater" | "troupe" | "studio") {
  if (!type) return globalPaths.organizations;
  return `${globalPaths.organizations}?type=${type}`;
}

export function studioOrganizationPath(studioId?: string) {
  if (!studioId) return globalPaths.organizations;
  return `/organizations/studios/${encodeSegment(studioId)}`;
}

function studioOrgPage(studioId: string, page: string) {
  return `${studioOrganizationPath(studioId)}/${page}`;
}

export function studioOverviewPath(studioId: string) {
  return studioOrgPage(studioId, "overview");
}

export function studioMembersPath(studioId: string) {
  return studioOrgPage(studioId, "members");
}

export function studioInvitesPath(studioId: string) {
  return studioOrgPage(studioId, "invites");
}

export function studioProgramSectionPath(studioId: string) {
  return studioOrgPage(studioId, "program");
}

export function studioAssignmentsPath(studioId: string) {
  return studioOrgPage(studioId, "assignments");
}

export function studioVideosSectionPath(studioId: string) {
  return studioOrgPage(studioId, "videos");
}

export function studioOrgPremisesPath(studioId: string, premiseId?: string) {
  return withChild(studioOrgPage(studioId, "premises"), premiseId);
}

export function studioPath(studioId?: string) {
  return withChild(globalPaths.studios, studioId);
}

export function studioPremisesPath(studioId: string, premiseId?: string) {
  return withChild(`${studioPath(studioId)}/premises`, premiseId);
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

export function getProjectSlugFromPath(pathname: string) {
  const [root, slug] = pathSegments(pathname);
  if (root !== "projects" || !slug) return null;
  return decodePathSegment(slug);
}

export function getProjectSectionFromPath(pathname: string) {
  const [root, , section] = pathSegments(pathname);
  if (root !== "projects" || !section) return null;
  return section as ProjectSection;
}

export function isProjectPath(pathname: string) {
  return getProjectSlugFromPath(pathname) !== null;
}

export function getTheaterIdFromPath(pathname: string) {
  const [root, kind, theaterId] = pathSegments(pathname);
  if (root !== "organizations" || kind !== "theaters" || !theaterId) {
    return null;
  }
  return decodePathSegment(theaterId);
}

export function isTheaterOrganizationPath(pathname: string) {
  return getTheaterIdFromPath(pathname) !== null;
}

function isTheaterPage(pathname: string, page: string) {
  const [root, kind, theaterId, section] = pathSegments(pathname);
  return (
    root === "organizations" &&
    kind === "theaters" &&
    Boolean(theaterId) &&
    section === page
  );
}

export function isTheaterTeamPath(pathname: string) {
  return isTheaterPage(pathname, "team");
}

export function isTheaterTroupePath(pathname: string) {
  return isTheaterPage(pathname, "troupe");
}

export function isTheaterAvailabilityPath(pathname: string) {
  return isTheaterPage(pathname, "availability");
}

export function getStudioIdFromPath(pathname: string) {
  const parts = pathSegments(pathname);
  const [root, second, third] = parts;

  if (root === "organizations" && second === "studios" && third) {
    return decodePathSegment(third);
  }

  if (root === "studios" && second && second !== "invite") {
    return decodePathSegment(second);
  }

  return null;
}
