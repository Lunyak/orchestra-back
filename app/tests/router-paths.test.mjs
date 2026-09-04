import assert from "node:assert/strict";
import test from "node:test";
import {
  getProjectSectionFromPath,
  getProjectSlugFromPath,
  getStudioIdFromPath,
  getTheaterIdFromPath,
  isTheaterTeamPath,
  accountingPath,
  projectPath,
  projectSessionPath,
  projectTaskPath,
  studioLessonPath,
  studioOrganizationPath,
  studioPremisesPath,
  theaterPremisesPath,
  theaterRehearsalsPath,
  theaterTeamPath,
  theaterTeamRolePath,
  theaterTroupePath,
  theaterOrganizationPath,
  theaterOverviewPath,
  theaterAvailabilityPath,
  isTheaterAvailabilityPath,
  projectAvailabilityPath,
  studioAvailabilityPath,
  isTheaterTroupePath,
  projectTheaterInvitePath,
  projectTeamRolePath,
} from "../src/app/router/paths.ts";
import {
  resolveLegacyProjectPath,
  resolveLegacyStudioPath,
} from "../src/app/router/route-legacy.ts";
import {
  resolveAdminEntryPath,
  resolveAdminPlanEntryPath,
} from "../src/shared/settings/adminSection.ts";
import {
  resolveRehearsalPlanEntryPath,
} from "../src/shared/settings/rehearsalPlanTab.ts";
import {
  resolveProjectScopedBackPath,
  resolveScopedBackPath,
  resolveStudioScopedBackPath,
  resolveTheaterScopedBackPath,
} from "../src/app/router/route-nav.ts";
import {
  isSpectacleLayoutSection,
  shouldShowScriptStateForSection,
} from "../src/app/router/route-section-meta.ts";

test("builds canonical project detail paths", () => {
  assert.equal(projectPath("hamlet"), "/projects/hamlet/overview");
  assert.equal(projectTaskPath("hamlet", "task-1"), "/projects/hamlet/tasks/task-1");
  assert.equal(
    projectSessionPath("hamlet", "session 1", "slot/2"),
    "/projects/hamlet/sessions/session%201/slots/slot%2F2",
  );
  assert.equal(
    accountingPath("collection-1"),
    "/accounting/collection-1",
  );
  assert.equal(
    projectTheaterInvitePath("tok/en"),
    "/projects/theater-invite/tok%2Fen",
  );
  assert.equal(projectTeamRolePath("hamlet"), "/projects/hamlet/team");
  assert.equal(
    projectTeamRolePath("hamlet", "role/2"),
    "/projects/hamlet/team/roles/role%2F2",
  );
  assert.equal(
    projectAvailabilityPath("hamlet"),
    "/projects/hamlet/availability",
  );
});

test("builds theater troupe and team paths", () => {
  assert.equal(theaterOrganizationPath(), "/organizations");
  assert.equal(
    theaterOverviewPath("theater 1"),
    "/organizations/theaters/theater%201/overview",
  );
  assert.equal(
    theaterTroupePath("theater 1"),
    "/organizations/theaters/theater%201/troupe",
  );
  assert.equal(
    theaterRehearsalsPath("theater 1"),
    "/organizations/theaters/theater%201/rehearsals",
  );
  assert.equal(
    theaterAvailabilityPath("theater 1"),
    "/organizations/theaters/theater%201/availability",
  );
  assert.equal(theaterAvailabilityPath("  "), "/organizations");
  assert.equal(
    isTheaterAvailabilityPath(
      "/organizations/theaters/theater%201/availability",
    ),
    true,
  );
  assert.equal(
    theaterTeamPath("theater 1"),
    "/organizations/theaters/theater%201/team",
  );
  assert.equal(
    theaterTeamRolePath("theater 1", "role/2"),
    "/organizations/theaters/theater%201/team/roles/role%2F2",
  );
  assert.equal(
    theaterPremisesPath("theater 1", "hall/2"),
    "/organizations/theaters/theater%201/premises/hall%2F2",
  );
  assert.equal(
    getTheaterIdFromPath("/organizations/theaters/theater%201/troupe"),
    "theater 1",
  );
  assert.equal(
    getStudioIdFromPath("/organizations/studios/studio%201"),
    "studio 1",
  );
  assert.equal(
    getStudioIdFromPath("/studios/studio%201/programs/p1"),
    "studio 1",
  );
  assert.equal(getStudioIdFromPath("/studios/invite/token"), null);
  assert.equal(getTheaterIdFromPath("/organizations/theaters"), null);
  assert.equal(isTheaterTroupePath("/organizations/theaters/abc/troupe"), true);
  assert.equal(
    isTheaterTeamPath("/organizations/theaters/abc/team/roles/r1"),
    true,
  );
  assert.equal(isTheaterTeamPath("/organizations/theaters/abc"), false);
});

test("theater scoped back goes one level up", () => {
  assert.equal(
    resolveTheaterScopedBackPath("/organizations/theaters/theater%201/overview"),
    "/organizations",
  );
  assert.equal(
    resolveTheaterScopedBackPath(
      "/organizations/theaters/theater%201/availability",
    ),
    "/organizations/theaters/theater%201/overview",
  );
  assert.equal(
    resolveTheaterScopedBackPath(
      "/organizations/theaters/theater%201/rehearsals/s1",
    ),
    "/organizations/theaters/theater%201/rehearsals",
  );
  assert.equal(
    resolveTheaterScopedBackPath(
      "/organizations/theaters/theater%201/team/roles/r1",
    ),
    "/organizations/theaters/theater%201/team",
  );
  assert.equal(resolveTheaterScopedBackPath("/organizations"), null);
});

test("studio scoped back goes one level up", () => {
  assert.equal(
    resolveStudioScopedBackPath("/organizations/studios/studio%201/overview"),
    "/organizations",
  );
  assert.equal(
    resolveStudioScopedBackPath("/organizations/studios/studio%201/members"),
    "/organizations/studios/studio%201/overview",
  );
  assert.equal(
    resolveStudioScopedBackPath(
      "/organizations/studios/studio%201/availability",
    ),
    "/organizations/studios/studio%201/overview",
  );
  assert.equal(
    resolveStudioScopedBackPath(
      "/organizations/studios/studio%201/premises/hall-1",
    ),
    "/organizations/studios/studio%201/premises",
  );
  assert.equal(
    resolveStudioScopedBackPath("/studios/studio%201"),
    "/organizations",
  );
  assert.equal(
    resolveStudioScopedBackPath("/studios/studio%201/programs/program-1"),
    "/studios/studio%201",
  );
  assert.equal(
    resolveStudioScopedBackPath(
      "/studios/studio%201/programs/program-1/lessons/lesson-2",
    ),
    "/studios/studio%201/programs/program-1",
  );
  assert.equal(resolveStudioScopedBackPath("/organizations"), null);
  assert.equal(
    resolveScopedBackPath("/studios/studio%201/videos/video-1"),
    "/studios/studio%201",
  );
});

test("encodes studio route parameters", () => {
  assert.equal(
    studioLessonPath("studio 1", "program/2", "lesson 3"),
    "/studios/studio%201/programs/program%2F2/lessons/lesson%203",
  );
  assert.equal(
    studioOrganizationPath("studio 1"),
    "/organizations/studios/studio%201",
  );
  assert.equal(
    studioPremisesPath("studio 1", "hall/2"),
    "/studios/studio%201/premises/hall%2F2",
  );
  assert.equal(
    studioAvailabilityPath("studio 1"),
    "/organizations/studios/studio%201/availability",
  );
  assert.equal(resolveLegacyStudioPath("/studio"), "/studios");
  assert.equal(
    resolveLegacyStudioPath("/studio/studio-1/videos/video-2"),
    "/studios/studio-1/videos/video-2",
  );
});

test("reads project context from canonical paths", () => {
  const pathname = "/projects/my%20show/sessions/session-1";
  assert.equal(getProjectSlugFromPath(pathname), "my show");
  assert.equal(getProjectSectionFromPath(pathname), "sessions");
  assert.equal(
    getProjectSectionFromPath("/projects/hamlet/availability"),
    "availability",
  );
  assert.equal(getProjectSectionFromPath("/projects/my-show/unknown"), null);
  assert.equal(getProjectSlugFromPath("/organizations"), null);
});

test("project scoped back goes one level up", () => {
  assert.equal(
    resolveProjectScopedBackPath("/projects/hamlet/overview"),
    "/projects",
  );
  assert.equal(
    resolveProjectScopedBackPath("/projects/hamlet/tasks/task-1"),
    "/projects/hamlet/tasks",
  );
  assert.equal(
    resolveProjectScopedBackPath("/projects/hamlet/sessions/session-1"),
    "/projects/hamlet/sessions",
  );
  assert.equal(
    resolveProjectScopedBackPath(
      "/projects/hamlet/sessions/session-1/slots/slot-1",
    ),
    "/projects/hamlet/sessions/session-1",
  );
  assert.equal(
    resolveProjectScopedBackPath("/projects/hamlet/team/roles/role-1"),
    "/projects/hamlet/team",
  );
  assert.equal(
    resolveProjectScopedBackPath("/projects/hamlet/availability"),
    "/projects/hamlet/overview",
  );
  assert.equal(
    resolveProjectScopedBackPath("/projects/hamlet/settings/bot"),
    "/projects/hamlet/settings",
  );
  assert.equal(resolveProjectScopedBackPath("/projects"), null);
});

test("separates project operations from spectacle chrome", () => {
  assert.equal(shouldShowScriptStateForSection("tasks"), false);
  assert.equal(shouldShowScriptStateForSection("sessions"), false);
  assert.equal(shouldShowScriptStateForSection("availability"), false);
  assert.equal(shouldShowScriptStateForSection("team"), false);
  assert.equal(shouldShowScriptStateForSection("board"), true);
  assert.equal(isSpectacleLayoutSection("tasks"), false);
  assert.equal(isSpectacleLayoutSection("sessions"), false);
  assert.equal(isSpectacleLayoutSection("team"), false);
  assert.equal(isSpectacleLayoutSection("board"), true);
});

test("redirects flat project routes with detail suffixes", () => {
  assert.equal(
    resolveLegacyProjectPath("/tasks/task-1", "hamlet"),
    "/projects/hamlet/tasks/task-1",
  );
  assert.equal(
    resolveLegacyProjectPath("/troupe/roles/role-1", "hamlet"),
    "/projects/hamlet/team/roles/role-1",
  );
  assert.equal(
    resolveLegacyProjectPath("/settings/bot", "hamlet"),
    "/projects/hamlet/settings/bot",
  );
  assert.equal(
    resolveLegacyProjectPath("/roles", "hamlet"),
    "/projects/hamlet/roles",
  );
  assert.equal(
    resolveLegacyProjectPath("/rehearsals/legacy-id", "hamlet"),
    "/projects/hamlet/sessions",
  );
});

test("falls back to projects when no project is selected", () => {
  assert.equal(resolveLegacyProjectPath("/tasks/task-1", ""), "/projects");
  assert.equal(resolveLegacyProjectPath("/theater", null), "/projects");
});

test("builds canonical admin and rehearsal plan entry paths", () => {
  assert.equal(
    resolveRehearsalPlanEntryPath({ projectSlug: "hamlet" }),
    "/projects/hamlet/sessions",
  );
  assert.equal(
    resolveRehearsalPlanEntryPath({
      projectSlug: "hamlet",
      excludeTasks: true,
    }),
    "/projects/hamlet/sessions",
  );
  assert.equal(
    resolveAdminPlanEntryPath("hamlet"),
    "/projects/hamlet/sessions",
  );
  assert.equal(
    resolveAdminEntryPath("hamlet"),
    "/projects/hamlet/sessions",
  );
  assert.equal(resolveRehearsalPlanEntryPath(), "/projects");
  assert.equal(resolveAdminEntryPath(), "/projects");
});
