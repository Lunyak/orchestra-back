import assert from "node:assert/strict";
import test from "node:test";
import {
  getProjectSectionFromPath,
  getProjectSlugFromPath,
  getStudioIdFromPath,
  getTheaterIdFromPath,
  isTheaterTeamPath,
  projectAccountingPath,
  projectPath,
  projectSessionPath,
  projectTaskPath,
  resolveLegacyProjectPath,
  resolveLegacyStudioPath,
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
  isTheaterTroupePath,
  projectTheaterInvitePath,
  projectTeamRolePath,
} from "../src/app/router/paths.ts";

test("builds canonical project detail paths", () => {
  assert.equal(projectPath("hamlet"), "/projects/hamlet/overview");
  assert.equal(projectTaskPath("hamlet", "task-1"), "/projects/hamlet/tasks/task-1");
  assert.equal(
    projectSessionPath("hamlet", "session 1", "slot/2"),
    "/projects/hamlet/sessions/session%201/slots/slot%2F2",
  );
  assert.equal(
    projectAccountingPath("hamlet", "collection-1"),
    "/projects/hamlet/accounting/collection-1",
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
});

test("builds theater troupe and team paths", () => {
  assert.equal(theaterOrganizationPath(), "/organizations/theaters");
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
  assert.equal(getProjectSlugFromPath("/organizations"), null);
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
