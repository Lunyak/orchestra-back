import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APP_PATH,
  globalPaths,
  projectPath,
  projectTaskPath,
} from "../src/app/router/paths.ts";
import { resolveDashboardViewState } from "../src/features/global-dashboard/model/dashboard-view-state.ts";
import {
  inviteActionKey,
  isIncomingMailAction,
  isInviteAction,
  pickUnseenIncomingMails,
} from "../src/features/global-dashboard/model/dashboard-invite.ts";

test("dashboard has a stable global path and canonical project links", () => {
  assert.equal(globalPaths.dashboard, "/dashboard");
  assert.equal(DEFAULT_APP_PATH, "/dashboard");
  assert.equal(projectPath("show one", "sessions"), "/projects/show%20one/sessions");
  assert.equal(
    projectTaskPath("show one", "task/1"),
    "/projects/show%20one/tasks/task%2F1",
  );
});

test("resolves dashboard loading, error, empty and ready states", () => {
  assert.equal(
    resolveDashboardViewState({
      isLoading: true,
      isError: false,
      hasData: false,
      isEmpty: false,
    }),
    "loading",
  );
  assert.equal(
    resolveDashboardViewState({
      isLoading: false,
      isError: true,
      hasData: false,
      isEmpty: false,
    }),
    "error",
  );
  assert.equal(
    resolveDashboardViewState({
      isLoading: false,
      isError: false,
      hasData: true,
      isEmpty: true,
    }),
    "empty",
  );
  assert.equal(
    resolveDashboardViewState({
      isLoading: false,
      isError: false,
      hasData: true,
      isEmpty: false,
    }),
    "ready",
  );
});

test("picks unseen invitation mails for the overlay", () => {
  const projectInvite = {
    kind: "project_invite",
    id: "p1",
    title: "Приглашение в проект «А»",
    dueAt: null,
    description: "Роль: editor",
    invitedByEmail: "a@b.c",
    project: { id: "1", slug: "a", name: "А" },
    role: "editor",
  };
  const troupeInvite = {
    kind: "troupe_invite",
    id: "t1",
    title: "Приглашение в труппу «Б»",
    dueAt: null,
    description: "Участник: в составе",
    invitedByEmail: "a@b.c",
    troupe: { id: "2", title: "Б" },
    memberKind: "regular",
  };
  const session = {
    kind: "director_session_invitation",
    id: "s1",
    title: "Прогон",
    dueAt: "2026-08-28T10:00:00.000Z",
  };
  const assignment = {
    kind: "studio_assignment",
    id: "a1",
    title: "Этюд",
    dueAt: null,
    studioId: "st",
    studioTitle: "Студия",
  };

  assert.equal(isInviteAction(projectInvite), true);
  assert.equal(isIncomingMailAction(session), true);
  assert.equal(isIncomingMailAction(assignment), false);
  assert.equal(inviteActionKey(projectInvite), "project_invite:p1");
  assert.deepEqual(
    pickUnseenIncomingMails(
      [projectInvite, assignment, troupeInvite, session],
      ["project_invite:p1"],
    ).map((item) => item.id),
    ["t1", "s1"],
  );
});
