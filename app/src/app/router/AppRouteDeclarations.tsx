import { UnderDevelopmentPage } from "@shared/components/under-development-page/UnderDevelopmentPage";
import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  ENABLE_ACCOUNTING,
  ENABLE_ACTOR_PAGE,
  ENABLE_ROLE_WORKBOOK_PAGE,
} from "../../shared/build-features";
import { organizationRoutes } from "./organization-routes";
import { DEFAULT_APP_PATH, globalPaths } from "./paths";
import { projectRoutes } from "./project-routes";
import {
  LegacyProjectRedirect,
  LegacyStudioRedirect,
} from "./ProjectRouteBoundary";
import { LEGACY_PROJECT_ROUTES } from "./route-legacy";
import { PROJECTS_ROUTE_PATH } from "./routeMeta";
import { RouteNotFoundPage } from "./RouteNotFoundPage";

const MyProjectsPage = lazy(() =>
  import("../../features/app-hub").then((module) => ({
    default: module.MyProjectsPage,
  })),
);

const ProjectTheaterInvitePage = lazy(() =>
  import("../../features/project/ui/ProjectTheaterInvitePage").then(
    (module) => ({ default: module.ProjectTheaterInvitePage }),
  ),
);

const GlobalDashboardPage = lazy(() =>
  import("../../features/global-dashboard").then((module) => ({
    default: module.GlobalDashboardPage,
  })),
);

const ProfilePage = lazy(() =>
  import("../../pages/profile/ProfilePage").then((module) => ({
    default: module.ProfilePage,
  })),
);

const PlanPage = lazy(() =>
  import("../../pages/billing/PlanPage").then((module) => ({
    default: module.PlanPage,
  })),
);

const AccountingPage = lazy(() =>
  import("../../pages/accounting/AccountingPage").then((module) => ({
    default: module.AccountingPage,
  })),
);

const CollectionDetailPage = lazy(() =>
  import("../../pages/accounting/CollectionDetailPage").then((module) => ({
    default: module.CollectionDetailPage,
  })),
);

const ActorPage = lazy(() =>
  import("../../features/actor").then((module) => ({
    default: module.ActorPage,
  })),
);

const TrainersPage = lazy(() =>
  import("../../pages/trainers/TrainersPage").then((module) => ({
    default: module.TrainersPage,
  })),
);

const SpeechTrainerPage = lazy(() =>
  import("../../pages/trainers/SpeechTrainerPage").then((module) => ({
    default: module.SpeechTrainerPage,
  })),
);

const DictionTrainerPage = lazy(() =>
  import("../../pages/trainers/DictionTrainerPage").then((module) => ({
    default: module.DictionTrainerPage,
  })),
);

const RoleWorkbookPage = lazy(() =>
  import("../../pages/role-workbook/RoleWorkbookPage").then((module) => ({
    default: module.RoleWorkbookPage,
  })),
);

const PrivacyPage = lazy(() =>
  import("../../pages/legal/PrivacyPage").then((module) => ({
    default: module.PrivacyPage,
  })),
);

const TermsPage = lazy(() =>
  import("../../pages/legal/TermsPage").then((module) => ({
    default: module.TermsPage,
  })),
);

const ResetPasswordPage = lazy(() =>
  import("../../pages/login/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);

const ProjectorOutputPage = lazy(() =>
  import("../../features/projector/ui/ProjectorOutputPage").then((module) => ({
    default: module.ProjectorOutputPage,
  })),
);

export function AppRouteDeclarations() {
  const actorPage = ENABLE_ACTOR_PAGE ? (
    <ActorPage />
  ) : (
    <UnderDevelopmentPage
      title="Актёр"
      description="Раздел тренажёров роли скоро будет доступен."
    />
  );

  const roleWorkbookPage = ENABLE_ROLE_WORKBOOK_PAGE ? (
    <RoleWorkbookPage />
  ) : (
    <UnderDevelopmentPage
      title="Работа над ролью"
      description="Страница тетрадки роли пока в разработке."
    />
  );

  const accountingPage = ENABLE_ACCOUNTING ? (
    <AccountingPage />
  ) : (
    <UnderDevelopmentPage
      title="Бухгалтерия"
      description="Раздел бухгалтерии временно недоступен в production."
    />
  );

  const collectionDetailPage = ENABLE_ACCOUNTING ? (
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

      {organizationRoutes}
      {projectRoutes}

      <Route path="/actor" element={actorPage} />
      <Route path="/trainers" element={<TrainersPage />} />
      <Route path="/trainers/speech" element={<SpeechTrainerPage />} />
      <Route path="/trainers/diction" element={<DictionTrainerPage />} />
      <Route
        path="/role-workbook/:roleId"
        element={roleWorkbookPage}
      />
      <Route path={globalPaths.profile} element={<ProfilePage />} />
      <Route path={globalPaths.billing} element={<PlanPage />} />
      <Route path={globalPaths.accounting} element={accountingPage} />
      <Route
        path={`${globalPaths.accounting}/:collectionId`}
        element={collectionDetailPage}
      />

      <Route path="/studio" element={<LegacyStudioRedirect />} />
      <Route path="/studio/*" element={<LegacyStudioRedirect />} />
      {LEGACY_PROJECT_ROUTES.map(({ path }) => (
        <Route
          key={path}
          path={`${path}/*`}
          element={<LegacyProjectRedirect />}
        />
      ))}

      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/" element={<Navigate to={DEFAULT_APP_PATH} replace />} />
      <Route path="*" element={<RouteNotFoundPage />} />
    </Routes>
  );
}
