import { lazy } from "react";
import { Navigate, Route, useParams } from "react-router-dom";
import { accountingPath, globalPaths } from "./paths";
import {
  ProjectIndexRedirect,
  ProjectRouteBoundary,
} from "./ProjectRouteBoundary";
import { isTheaterRouteEnabled } from "./routeMeta";

const SpectaclePage = lazy(() =>
  import("../../features/spectacle").then((module) => ({
    default: module.SpectaclePage,
  })),
);

const SpectacleHubPage = lazy(() =>
  import("../../features/spectacle").then((module) => ({
    default: module.SpectacleHubPage,
  })),
);

const ProjectOverviewPage = lazy(() =>
  import("../../features/project/ui/ProjectOverviewPage").then((module) => ({
    default: module.ProjectOverviewPage,
  })),
);

const ProjectPlaybookDocksLayout = lazy(() =>
  import("../../features/project/ui/ProjectPlaybookDocksLayout").then(
    (module) => ({
      default: module.ProjectPlaybookDocksLayout,
    }),
  ),
);

const ProjectOperationsLayout = lazy(() =>
  import("../../features/project/ui/ProjectOperationsLayout").then(
    (module) => ({
      default: module.ProjectOperationsLayout,
    }),
  ),
);

const ProjectSessionsPage = lazy(() =>
  import("../../features/project/ui/ProjectSessionsPage").then((module) => ({
    default: module.ProjectSessionsPage,
  })),
);

const ProjectAvailabilityPage = lazy(() =>
  import("../../features/project/ui/ProjectAvailabilityPage").then((module) => ({
    default: module.ProjectAvailabilityPage,
  })),
);

const ProjectProductionTeamPage = lazy(() =>
  import("../../features/project/ui/ProjectProductionTeamPage").then(
    (module) => ({
      default: module.ProjectProductionTeamPage,
    }),
  ),
);

const ProjectTeamRolePage = lazy(() =>
  import("../../features/project/ui/ProjectTeamRolePage").then((module) => ({
    default: module.ProjectTeamRolePage,
  })),
);

const ProjectRolesPage = lazy(() =>
  import("../../features/project/ui/ProjectRolesPage").then((module) => ({
    default: module.ProjectRolesPage,
  })),
);

const ProjectCastPage = lazy(() =>
  import("../../features/project/ui/ProjectCastPage").then((module) => ({
    default: module.ProjectCastPage,
  })),
);

const DirectorSessionPage = lazy(() =>
  import(
    "../../features/director-sessions/ui/DirectorSessionPage/DirectorSessionPage"
  ).then((module) => ({
    default: module.DirectorSessionPage,
  })),
);

const TasksPage = lazy(() =>
  import("../../features/project-tasks/ui/TasksPage").then((module) => ({
    default: module.TasksPage,
  })),
);

const TaskDetailPage = lazy(() =>
  import("../../features/project-tasks/ui/TaskDetailPage").then((module) => ({
    default: module.TaskDetailPage,
  })),
);

const SettingsPage = lazy(() =>
  import("../../pages/settings/SettingsPage/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

const SettingsBotPage = lazy(() =>
  import("../../pages/settings/SettingsBotPage").then((module) => ({
    default: module.SettingsBotPage,
  })),
);

function ProjectAccountingRedirect() {
  const { collectionId } = useParams();
  return <Navigate to={accountingPath(collectionId)} replace />;
}

export const projectRoutes = (
  <Route path="/projects/:projectSlug" element={<ProjectRouteBoundary />}>
    <Route index element={<ProjectIndexRedirect />} />
    <Route element={<ProjectPlaybookDocksLayout />}>
      <Route path="overview" element={<ProjectOverviewPage />} />
      <Route path="roles" element={<ProjectRolesPage />} />
      <Route path="cast" element={<ProjectCastPage />} />
      <Route path="spectacle" element={<SpectacleHubPage />} />
      <Route path="settings" element={<SettingsPage />} />
      <Route path="settings/bot" element={<SettingsBotPage />} />
    </Route>

    <Route path="script" element={<SpectaclePage />} />
    <Route path="light-plot" element={<SpectaclePage />} />
    <Route path="sufer" element={<SpectaclePage />} />
    <Route path="media" element={<SpectaclePage />} />
    <Route
      path="theater"
      element={
        isTheaterRouteEnabled() ? (
          <SpectaclePage />
        ) : (
          <Navigate to="../script" replace />
        )
      }
    />
    <Route path="board" element={<SpectaclePage />} />
    <Route element={<ProjectOperationsLayout />}>
      <Route path="tasks">
        <Route index element={<TasksPage />} />
        <Route path=":taskId" element={<TaskDetailPage />} />
      </Route>
      <Route path="sessions">
        <Route index element={<ProjectSessionsPage />} />
        <Route
          path=":sessionId/slots/:slotId"
          element={<DirectorSessionPage />}
        />
        <Route path=":sessionId" element={<DirectorSessionPage />} />
      </Route>
      <Route path="availability" element={<ProjectAvailabilityPage />} />
      <Route path="team">
        <Route index element={<ProjectProductionTeamPage />} />
        <Route path="roles/:roleId" element={<ProjectTeamRolePage />} />
      </Route>
    </Route>

    <Route
      path="premises"
      element={<Navigate to={globalPaths.premises} replace />}
    />
    <Route
      path="premises/:premiseId"
      element={<Navigate to={globalPaths.premises} replace />}
    />
    <Route
      path="accounting"
      element={<Navigate to={globalPaths.accounting} replace />}
    />
    <Route
      path="accounting/:collectionId"
      element={<ProjectAccountingRedirect />}
    />
  </Route>
);
