import { UnderDevelopmentPage } from "@shared/components/under-development-page/UnderDevelopmentPage";
import { lazy } from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import {
  ENABLE_ACTOR_PAGE,
  ENABLE_ACCOUNTING,
  ENABLE_ROLE_WORKBOOK_PAGE,
} from "../../shared/build-features";
import {
  isTheaterRouteEnabled,
  PROJECTS_ROUTE_PATH,
} from "./routeMeta";
import { accountingPath, DEFAULT_APP_PATH, globalPaths } from "./paths";
import {
  LegacyProjectRedirect,
  LegacyStudioRedirect,
  ProjectIndexRedirect,
  ProjectRouteBoundary,
} from "./ProjectRouteBoundary";

function ProjectAccountingRedirect() {
  const { collectionId } = useParams();
  return <Navigate to={accountingPath(collectionId)} replace />;
}

const SpectaclePage = lazy(() =>
  import("../../features/spectacle").then((m) => ({
    default: m.SpectaclePage,
  })),
);

const SpectacleHubPage = lazy(() =>
  import("../../features/spectacle").then((m) => ({
    default: m.SpectacleHubPage,
  })),
);

const MyProjectsPage = lazy(() =>
  import("../../features/app-hub").then((m) => ({
    default: m.MyProjectsPage,
  })),
);

const ProjectTheaterInvitePage = lazy(() =>
  import("../../features/project/ui/ProjectTheaterInvitePage").then((m) => ({
    default: m.ProjectTheaterInvitePage,
  })),
);

const GlobalDashboardPage = lazy(() =>
  import("../../features/global-dashboard").then((m) => ({
    default: m.GlobalDashboardPage,
  })),
);

const ProjectOverviewPage = lazy(() =>
  import("../../features/project/ui/ProjectOverviewPage").then((m) => ({
    default: m.ProjectOverviewPage,
  })),
);
const ProjectPlaybookDocksLayout = lazy(() =>
  import("../../features/project/ui/ProjectPlaybookDocksLayout").then((m) => ({
    default: m.ProjectPlaybookDocksLayout,
  })),
);

const OrganizationsPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then((m) => ({
    default: m.OrganizationsPage,
  })),
);

const TheatersIndexPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then((m) => ({
    default: m.TheatersIndexPage,
  })),
);

const TheaterOrganizationPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then((m) => ({
    default: m.TheaterOrganizationPage,
  })),
);

const TheaterOverviewPage = lazy(() =>
  import("../../features/organizations/ui/TheaterOverviewPage").then((m) => ({
    default: m.TheaterOverviewPage,
  })),
);

const TheaterRehearsalsPage = lazy(() =>
  import("../../features/organizations/ui/TheaterRehearsalsPage").then((m) => ({
    default: m.TheaterRehearsalsPage,
  })),
);

const TroupesIndexPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then((m) => ({
    default: m.TroupesIndexPage,
  })),
);

const TroupeOrganizationPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then((m) => ({
    default: m.TroupeOrganizationPage,
  })),
);

const StudioOrganizationPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then((m) => ({
    default: m.StudioOrganizationPage,
  })),
);

const StudiosIndexPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then((m) => ({
    default: m.StudiosIndexPage,
  })),
);

const StudioOverviewPage = lazy(() =>
  import("../../features/organizations/ui/StudioOverviewPage").then((m) => ({
    default: m.StudioOverviewPage,
  })),
);

const StudioMembersPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then((m) => ({
    default: m.StudioMembersPage,
  })),
);

const StudioInvitesPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then((m) => ({
    default: m.StudioInvitesPage,
  })),
);

const StudioProgramSectionPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then((m) => ({
    default: m.StudioProgramSectionPage,
  })),
);

const StudioAssignmentsSectionPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then((m) => ({
    default: m.StudioAssignmentsSectionPage,
  })),
);

const StudioVideosSectionPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then((m) => ({
    default: m.StudioVideosSectionPage,
  })),
);

const ProjectSessionsPage = lazy(() =>
  import("../../features/project/ui/ProjectSessionsPage").then((m) => ({
    default: m.ProjectSessionsPage,
  })),
);

const ProjectProductionTeamPage = lazy(() =>
  import("../../features/project/ui/ProjectProductionTeamPage").then((m) => ({
    default: m.ProjectProductionTeamPage,
  })),
);

const ProjectTeamRolePage = lazy(() =>
  import("../../features/project/ui/ProjectTeamRolePage").then((m) => ({
    default: m.ProjectTeamRolePage,
  })),
);

const ProjectRolesPage = lazy(() =>
  import("../../features/project/ui/ProjectRolesPage").then((m) => ({
    default: m.ProjectRolesPage,
  })),
);

const ProjectCastPage = lazy(() =>
  import("../../features/project/ui/ProjectCastPage").then((m) => ({
    default: m.ProjectCastPage,
  })),
);

const DirectorSessionPage = lazy(() =>
  import(
    "../../features/director-sessions/ui/DirectorSessionPage/DirectorSessionPage"
  ).then((m) => ({
    default: m.DirectorSessionPage,
  })),
);

const TasksPage = lazy(() =>
  import("../../features/project-tasks/ui/TasksPage").then((m) => ({
    default: m.TasksPage,
  })),
);

const TaskDetailPage = lazy(() =>
  import("../../features/project-tasks/ui/TaskDetailPage").then((m) => ({
    default: m.TaskDetailPage,
  })),
);

const ProfilePage = lazy(() =>
  import("../../pages/profile/ProfilePage").then((m) => ({
    default: m.ProfilePage,
  })),
);

const TroupePage = lazy(() =>
  import("../../pages/troupe/TroupePage").then((m) => ({
    default: m.TroupePage,
  })),
);

const TheaterTeamPage = lazy(() =>
  import("../../pages/troupe/TheaterTeamPage").then((m) => ({
    default: m.TheaterTeamPage,
  })),
);

const TeamRolePage = lazy(() =>
  import("../../pages/troupe/TeamRolePage").then((m) => ({
    default: m.TeamRolePage,
  })),
);

const PremisesPage = lazy(() =>
  import("../../pages/premises/PremisesPage").then((m) => ({
    default: m.PremisesPage,
  })),
);

const PremiseDetailPage = lazy(() =>
  import("../../pages/premises/PremiseDetailPage").then((m) => ({
    default: m.PremiseDetailPage,
  })),
);

const StudioInvitePage = lazy(() =>
  import("../../pages/studio/StudioInvitePage").then((m) => ({
    default: m.StudioInvitePage,
  })),
);

const StudiosPage = lazy(() =>
  import("../../pages/studio/StudiosPage").then((m) => ({
    default: m.StudiosPage,
  })),
);

const StudioDetailPage = lazy(() =>
  import("../../pages/studio/StudioDetailPage").then((m) => ({
    default: m.StudioDetailPage,
  })),
);

const StudioAssignmentPage = lazy(() =>
  import("../../pages/studio/StudioAssignmentPage").then((m) => ({
    default: m.StudioAssignmentPage,
  })),
);

const StudioProgramPage = lazy(() =>
  import("../../pages/studio/StudioProgramPage").then((m) => ({
    default: m.StudioProgramPage,
  })),
);

const StudioLessonPage = lazy(() =>
  import("../../pages/studio/StudioLessonPage").then((m) => ({
    default: m.StudioLessonPage,
  })),
);

const StudioVideoPage = lazy(() =>
  import("../../pages/studio/StudioVideoPage").then((m) => ({
    default: m.StudioVideoPage,
  })),
);

const AccountingPage = lazy(() =>
  import("../../pages/accounting/AccountingPage").then((m) => ({
    default: m.AccountingPage,
  })),
);

const CollectionDetailPage = lazy(() =>
  import("../../pages/accounting/CollectionDetailPage").then((m) => ({
    default: m.CollectionDetailPage,
  })),
);

const SettingsPage = lazy(() =>
  import("../../pages/settings/SettingsPage/SettingsPage").then((m) => ({
    default: m.SettingsPage,
  })),
);

const SettingsBotPage = lazy(() =>
  import("../../pages/settings/SettingsBotPage").then((m) => ({
    default: m.SettingsBotPage,
  })),
);

const ActorPage = lazy(() =>
  import("../../features/actor").then((m) => ({
    default: m.ActorPage,
  })),
);

const TrainersPage = lazy(() =>
  import("../../pages/trainers/TrainersPage").then((m) => ({
    default: m.TrainersPage,
  })),
);

const SpeechTrainerPage = lazy(() =>
  import("../../pages/trainers/SpeechTrainerPage").then((m) => ({
    default: m.SpeechTrainerPage,
  })),
);

const DictionTrainerPage = lazy(() =>
  import("../../pages/trainers/DictionTrainerPage").then((m) => ({
    default: m.DictionTrainerPage,
  })),
);

const RoleWorkbookPage = lazy(() =>
  import("../../pages/role-workbook/RoleWorkbookPage").then((m) => ({
    default: m.RoleWorkbookPage,
  })),
);

const PrivacyPage = lazy(() =>
  import("../../pages/legal/PrivacyPage").then((m) => ({
    default: m.PrivacyPage,
  })),
);

const TermsPage = lazy(() =>
  import("../../pages/legal/TermsPage").then((m) => ({
    default: m.TermsPage,
  })),
);

const ResetPasswordPage = lazy(() =>
  import("../../pages/login/ResetPasswordPage").then((m) => ({
    default: m.ResetPasswordPage,
  })),
);

const ProjectorOutputPage = lazy(() =>
  import("../../features/projector/ui/ProjectorOutputPage").then((m) => ({
    default: m.ProjectorOutputPage,
  })),
);

export function AppRouteDeclarations() {
  const actorPageElement = ENABLE_ACTOR_PAGE ? (
    <ActorPage />
  ) : (
    <UnderDevelopmentPage
      title="Актёр"
      description="Раздел тренажёров роли скоро будет доступен."
    />
  );

  const roleWorkbookPageElement = ENABLE_ROLE_WORKBOOK_PAGE ? (
    <RoleWorkbookPage />
  ) : (
    <UnderDevelopmentPage
      title="Работа над ролью"
      description="Страница тетрадки роли пока в разработке."
    />
  );

  const accountingPageElement = ENABLE_ACCOUNTING ? (
    <AccountingPage />
  ) : (
    <UnderDevelopmentPage
      title="Бухгалтерия"
      description="Раздел бухгалтерии временно недоступен в production."
    />
  );

  const collectionDetailPageElement = ENABLE_ACCOUNTING ? (
    <CollectionDetailPage />
  ) : (
    <UnderDevelopmentPage
      title="Бухгалтерия"
      description="Раздел бухгалтерии временно недоступен в production."
    />
  );

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/projector-output" element={<ProjectorOutputPage />} />
      <Route path={globalPaths.dashboard} element={<GlobalDashboardPage />} />
      <Route path={PROJECTS_ROUTE_PATH} element={<MyProjectsPage />} />
      <Route
        path={`${globalPaths.projects}/theater-invite/:token`}
        element={<ProjectTheaterInvitePage />}
      />
      <Route path="/home" element={<Navigate to={DEFAULT_APP_PATH} replace />} />
      <Route path={globalPaths.organizations} element={<OrganizationsPage />} />
      <Route
        path={`${globalPaths.organizations}/theaters`}
        element={<TheatersIndexPage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId`}
        element={<TheaterOrganizationPage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/overview`}
        element={<TheaterOverviewPage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/troupe`}
        element={<TroupePage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/rehearsals`}
        element={<TheaterRehearsalsPage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/rehearsals/:sessionId/slots/:slotId`}
        element={<DirectorSessionPage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/rehearsals/:sessionId`}
        element={<DirectorSessionPage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/team`}
        element={<TheaterTeamPage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/team/roles/:roleId`}
        element={<TeamRolePage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/premises`}
        element={<PremisesPage />}
      />
      <Route
        path={`${globalPaths.organizations}/theaters/:theaterId/premises/:premiseId`}
        element={<PremiseDetailPage />}
      />
      <Route
        path={`${globalPaths.organizations}/troupes`}
        element={<TroupesIndexPage />}
      />
      <Route
        path={`${globalPaths.organizations}/troupes/:troupeId`}
        element={<TroupeOrganizationPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios`}
        element={<StudiosIndexPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId`}
        element={<StudioOrganizationPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId/overview`}
        element={<StudioOverviewPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId/members`}
        element={<StudioMembersPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId/invites`}
        element={<StudioInvitesPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId/program`}
        element={<StudioProgramSectionPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId/assignments`}
        element={<StudioAssignmentsSectionPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId/videos`}
        element={<StudioVideosSectionPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId/premises`}
        element={<PremisesPage />}
      />
      <Route
        path={`${globalPaths.organizations}/studios/:studioId/premises/:premiseId`}
        element={<PremiseDetailPage />}
      />
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
        <Route path="tasks" element={<SpectaclePage />}>
          <Route index element={<TasksPage />} />
          <Route path=":taskId" element={<TaskDetailPage />} />
        </Route>
        <Route path="sessions" element={<SpectaclePage />}>
          <Route index element={<ProjectSessionsPage />} />
          <Route path=":sessionId/slots/:slotId" element={<DirectorSessionPage />} />
          <Route path=":sessionId" element={<DirectorSessionPage />} />
        </Route>
        <Route path="team" element={<SpectaclePage />}>
          <Route index element={<ProjectProductionTeamPage />} />
          <Route path="roles/:roleId" element={<ProjectTeamRolePage />} />
        </Route>
        <Route
          path="premises"
          element={<Navigate to={globalPaths.premises} replace />}
        />        <Route
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
      <Route
        path="/actor"
        element={actorPageElement}
      />
      <Route path="/trainers" element={<TrainersPage />} />
      <Route path="/trainers/speech" element={<SpeechTrainerPage />} />
      <Route path="/trainers/diction" element={<DictionTrainerPage />} />
      <Route path={globalPaths.studios} element={<StudiosPage />} />
      <Route path={globalPaths.premises} element={<PremisesPage />} />
      <Route
        path={`${globalPaths.premises}/:premiseId`}
        element={<PremiseDetailPage />}
      />
      <Route path={`${globalPaths.studios}/invite/:token`} element={<StudioInvitePage />} />
      <Route path={`${globalPaths.studios}/:studioId`} element={<StudioDetailPage />} />
      <Route
        path={`${globalPaths.studios}/:studioId/premises`}
        element={<PremisesPage />}
      />
      <Route
        path={`${globalPaths.studios}/:studioId/premises/:premiseId`}
        element={<PremiseDetailPage />}
      />
      <Route
        path={`${globalPaths.studios}/:studioId/programs/:programId`}
        element={<StudioProgramPage />}
      />
      <Route
        path={`${globalPaths.studios}/:studioId/programs/:programId/lessons/:lessonId`}
        element={<StudioLessonPage />}
      />
      <Route
        path={`${globalPaths.studios}/:studioId/assignments/:assignmentId`}
        element={<StudioAssignmentPage />}
      />
      <Route
        path={`${globalPaths.studios}/:studioId/videos/:videoId`}
        element={<StudioVideoPage />}
      />
      <Route path="/studio" element={<LegacyStudioRedirect />} />
      <Route path="/studio/*" element={<LegacyStudioRedirect />} />
      <Route
        path="/role-workbook/:roleId"
        element={roleWorkbookPageElement}
      />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/" element={<Navigate to={DEFAULT_APP_PATH} replace />} />
      <Route path="/spectacle/*" element={<LegacyProjectRedirect />} />
      <Route path="/light-plot/*" element={<LegacyProjectRedirect />} />
      <Route path="/notes-run/*" element={<LegacyProjectRedirect />} />
      <Route path="/sufer/*" element={<LegacyProjectRedirect />} />
      <Route path="/media/*" element={<LegacyProjectRedirect />} />
      <Route path="/theater/*" element={<LegacyProjectRedirect />} />
      <Route path="/board/*" element={<LegacyProjectRedirect />} />
      <Route path="/tasks/*" element={<LegacyProjectRedirect />} />
      <Route path="/sessions/*" element={<LegacyProjectRedirect />} />
      <Route path="/rehearsals/*" element={<LegacyProjectRedirect />} />
      <Route path="/troupe/*" element={<LegacyProjectRedirect />} />
      <Route path="/premises/*" element={<LegacyProjectRedirect />} />
      <Route path={globalPaths.accounting} element={accountingPageElement} />
      <Route
        path={`${globalPaths.accounting}/:collectionId`}
        element={collectionDetailPageElement}
      />
      <Route path="/settings/*" element={<LegacyProjectRedirect />} />
      <Route path="/roles/*" element={<LegacyProjectRedirect />} />
      <Route path="/admin/*" element={<LegacyProjectRedirect />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<Navigate to={DEFAULT_APP_PATH} replace />} />
    </Routes>
  );
}
