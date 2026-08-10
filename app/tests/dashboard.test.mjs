import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_APP_PATH,
  globalPaths,
  projectPath,
  projectTaskPath,
} from "../src/app/router/paths.ts";
import { resolveDashboardViewState } from "../src/features/global-dashboard/model/dashboard-view-state.ts";

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
