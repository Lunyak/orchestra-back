import {
  getProjectSlugFromPath,
  getStudioIdFromPath,
  getTheaterIdFromPath,
  globalPaths,
  isProjectPath,
  isTheaterOrganizationPath,
  pathSegments,
  projectPath,
  projectSessionPath,
  studioOrgPremisesPath,
  studioOverviewPath,
  studioPath,
  studioPremisesPath,
  studioProgramPath,
  theaterOverviewPath,
  theaterPremisesPath,
  theaterRehearsalSessionPath,
  theaterRehearsalsPath,
  theaterTeamPath,
} from "./paths";

function isSlotPage(rest: string[]) {
  const [sessionId, kind, slotId] = rest;
  return Boolean(sessionId && kind === "slots" && slotId);
}

export function isScopedWorkspacePath(pathname: string) {
  return (
    isProjectPath(pathname) ||
    isTheaterOrganizationPath(pathname) ||
    getStudioIdFromPath(pathname) !== null
  );
}

export function resolveProjectScopedBackPath(pathname: string): string | null {
  const slug = getProjectSlugFromPath(pathname);
  if (!slug) return null;

  // /projects/:slug/:section/...
  const parts = pathSegments(pathname);
  const section = parts[2];
  const rest = parts.slice(3);

  if (!section || section === "overview") {
    return globalPaths.projects;
  }

  if (section === "sessions") {
    if (isSlotPage(rest)) return projectSessionPath(slug, rest[0]);
    if (rest[0]) return projectPath(slug, "sessions");
  }

  if (section === "tasks" && rest[0]) return projectPath(slug, "tasks");
  if (section === "team" && rest[0] === "roles") return projectPath(slug, "team");
  if (section === "settings" && rest[0] === "bot") {
    return projectPath(slug, "settings");
  }

  return projectPath(slug, "overview");
}

export function resolveTheaterScopedBackPath(pathname: string): string | null {
  const theaterId = getTheaterIdFromPath(pathname);
  if (!theaterId) return null;

  // /organizations/theaters/:id/:section/...
  const parts = pathSegments(pathname);
  const section = parts[3];
  const rest = parts.slice(4);

  if (!section || section === "overview") {
    return globalPaths.organizations;
  }

  if (section === "rehearsals") {
    if (isSlotPage(rest)) return theaterRehearsalSessionPath(theaterId, rest[0]);
    if (rest[0]) return theaterRehearsalsPath(theaterId);
  }

  if (section === "team" && rest[0] === "roles") {
    return theaterTeamPath(theaterId);
  }

  if (section === "premises" && rest[0]) {
    return theaterPremisesPath(theaterId);
  }

  return theaterOverviewPath(theaterId);
}

function resolveStudioOrgBackPath(studioId: string, pathname: string) {
  // /organizations/studios/:id/:section/...
  const parts = pathSegments(pathname);
  const section = parts[3];
  const rest = parts.slice(4);

  if (!section || section === "overview") {
    return globalPaths.organizations;
  }

  if (section === "premises" && rest[0]) {
    return studioOrgPremisesPath(studioId);
  }

  return studioOverviewPath(studioId);
}

function resolveStudioAppBackPath(studioId: string, pathname: string) {
  // /studios/:id/:section/...
  const parts = pathSegments(pathname);
  const section = parts[2];
  const rest = parts.slice(3);

  if (!section) return globalPaths.organizations;

  const programId = rest[0];
  const isLessonPage = rest[1] === "lessons" && Boolean(rest[2]);
  if (section === "programs" && programId) {
    if (isLessonPage) return studioProgramPath(studioId, programId);
    return studioPath(studioId);
  }

  if (section === "premises" && rest[0]) {
    return studioPremisesPath(studioId);
  }

  return studioPath(studioId);
}

export function resolveStudioScopedBackPath(pathname: string): string | null {
  const studioId = getStudioIdFromPath(pathname);
  if (!studioId) return null;

  const [root, kind] = pathSegments(pathname);
  if (root === "organizations" && kind === "studios") {
    return resolveStudioOrgBackPath(studioId, pathname);
  }

  return resolveStudioAppBackPath(studioId, pathname);
}

export function resolveScopedBackPath(pathname: string): string | null {
  return (
    resolveProjectScopedBackPath(pathname) ??
    resolveTheaterScopedBackPath(pathname) ??
    resolveStudioScopedBackPath(pathname)
  );
}
