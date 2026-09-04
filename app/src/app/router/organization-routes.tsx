import { lazy } from "react";
import { Outlet, Route } from "react-router-dom";
import { globalPaths } from "./paths";

const OrganizationsPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then(
    (module) => ({ default: module.OrganizationsPage }),
  ),
);

const TheatersIndexPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then(
    (module) => ({ default: module.TheatersIndexPage }),
  ),
);

const TheaterOrganizationPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then(
    (module) => ({ default: module.TheaterOrganizationPage }),
  ),
);

const TheaterOverviewPage = lazy(() =>
  import("../../features/organizations/ui/TheaterOverviewPage").then(
    (module) => ({ default: module.TheaterOverviewPage }),
  ),
);

const TheaterRehearsalsPage = lazy(() =>
  import("../../features/organizations/ui/TheaterRehearsalsPage").then(
    (module) => ({ default: module.TheaterRehearsalsPage }),
  ),
);

const TroupesIndexPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then(
    (module) => ({ default: module.TroupesIndexPage }),
  ),
);

const TroupeOrganizationPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then(
    (module) => ({ default: module.TroupeOrganizationPage }),
  ),
);

const StudiosIndexPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then(
    (module) => ({ default: module.StudiosIndexPage }),
  ),
);

const StudioOrganizationPage = lazy(() =>
  import("../../features/organizations/ui/OrganizationsPages").then(
    (module) => ({ default: module.StudioOrganizationPage }),
  ),
);

const StudioOverviewPage = lazy(() =>
  import("../../features/organizations/ui/StudioOverviewPage").then(
    (module) => ({ default: module.StudioOverviewPage }),
  ),
);

const StudioMembersPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then(
    (module) => ({ default: module.StudioMembersPage }),
  ),
);

const StudioInvitesPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then(
    (module) => ({ default: module.StudioInvitesPage }),
  ),
);

const StudioProgramSectionPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then(
    (module) => ({ default: module.StudioProgramSectionPage }),
  ),
);

const StudioAssignmentsSectionPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then(
    (module) => ({ default: module.StudioAssignmentsSectionPage }),
  ),
);

const StudioVideosSectionPage = lazy(() =>
  import("../../features/organizations/ui/StudioOrgSectionPage").then(
    (module) => ({ default: module.StudioVideosSectionPage }),
  ),
);

const DirectorSessionPage = lazy(() =>
  import(
    "../../features/director-sessions/ui/DirectorSessionPage/DirectorSessionPage"
  ).then((module) => ({ default: module.DirectorSessionPage })),
);

const TroupePage = lazy(() =>
  import("../../pages/troupe/TroupePage").then((module) => ({
    default: module.TroupePage,
  })),
);

const TheaterAvailabilityPage = lazy(
  () => import("../../pages/troupe/TheaterAvailabilityPage"),
);

const StudioAvailabilityPage = lazy(
  () => import("../../pages/studio/StudioAvailabilityPage"),
);

const TheaterTeamPage = lazy(() =>
  import("../../pages/troupe/TheaterTeamPage").then((module) => ({
    default: module.TheaterTeamPage,
  })),
);

const TeamRolePage = lazy(() =>
  import("../../pages/troupe/TeamRolePage").then((module) => ({
    default: module.TeamRolePage,
  })),
);

const PremisesPage = lazy(() =>
  import("../../pages/premises/PremisesPage").then((module) => ({
    default: module.PremisesPage,
  })),
);

const PremiseDetailPage = lazy(() =>
  import("../../pages/premises/PremiseDetailPage").then((module) => ({
    default: module.PremiseDetailPage,
  })),
);

const StudioInvitePage = lazy(() =>
  import("../../pages/studio/StudioInvitePage").then((module) => ({
    default: module.StudioInvitePage,
  })),
);

const StudiosPage = lazy(() =>
  import("../../pages/studio/StudiosPage").then((module) => ({
    default: module.StudiosPage,
  })),
);

const StudioDetailPage = lazy(() =>
  import("../../pages/studio/StudioDetailPage").then((module) => ({
    default: module.StudioDetailPage,
  })),
);

const StudioAssignmentPage = lazy(() =>
  import("../../pages/studio/StudioAssignmentPage").then((module) => ({
    default: module.StudioAssignmentPage,
  })),
);

const StudioProgramPage = lazy(() =>
  import("../../pages/studio/StudioProgramPage").then((module) => ({
    default: module.StudioProgramPage,
  })),
);

const StudioLessonPage = lazy(() =>
  import("../../pages/studio/StudioLessonPage").then((module) => ({
    default: module.StudioLessonPage,
  })),
);

const StudioVideoPage = lazy(() =>
  import("../../pages/studio/StudioVideoPage").then((module) => ({
    default: module.StudioVideoPage,
  })),
);

export const organizationRoutes = (
  <>
    <Route path={globalPaths.organizations} element={<OrganizationsPage />} />
    <Route
      path={`${globalPaths.organizations}/theaters`}
      element={<TheatersIndexPage />}
    />
    <Route
      path={`${globalPaths.organizations}/theaters/:theaterId`}
      element={<Outlet />}
    >
      <Route index element={<TheaterOrganizationPage />} />
      <Route path="overview" element={<TheaterOverviewPage />} />
      <Route path="troupe" element={<TroupePage />} />
      <Route path="availability" element={<TheaterAvailabilityPage />} />
      <Route path="rehearsals" element={<TheaterRehearsalsPage />} />
      <Route
        path="rehearsals/:sessionId/slots/:slotId"
        element={<DirectorSessionPage />}
      />
      <Route
        path="rehearsals/:sessionId"
        element={<DirectorSessionPage />}
      />
      <Route path="team" element={<TheaterTeamPage />} />
      <Route path="team/roles/:roleId" element={<TeamRolePage />} />
      <Route path="premises" element={<PremisesPage />} />
      <Route path="premises/:premiseId" element={<PremiseDetailPage />} />
    </Route>

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
      path={`${globalPaths.organizations}/studios/:studioId/availability`}
      element={<StudioAvailabilityPage />}
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

    <Route path={globalPaths.studios} element={<StudiosPage />} />
    <Route path={globalPaths.premises} element={<PremisesPage />} />
    <Route
      path={`${globalPaths.premises}/:premiseId`}
      element={<PremiseDetailPage />}
    />
    <Route
      path={`${globalPaths.studios}/invite/:token`}
      element={<StudioInvitePage />}
    />
    <Route
      path={`${globalPaths.studios}/:studioId`}
      element={<StudioDetailPage />}
    />
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
  </>
);
