import { UnderDevelopmentPage } from "@shared/components/under-development-page/UnderDevelopmentPage";
import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  ENABLE_ACTOR_PAGE,
  ENABLE_ROLE_WORKBOOK_PAGE,
} from "../../shared/build-features";
import {
  APP_HUB_ROUTE_PATH,
  isTheaterRouteEnabled,
  PROJECT_MEDIA_ROUTE_PATH,
  SPECTACLE_HUB_ROUTE_PATH,
  SUFER_ROUTE_PATH,
} from "./routeMeta";

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

const AppHubPage = lazy(() =>
  import("../../features/app-hub").then((m) => ({
    default: m.AppHubPage,
  })),
);

const DirectorSessionsPage = lazy(() =>
  import("../../features/director-sessions/ui/DirectorSessionsPage").then(
    (m) => ({
      default: m.DirectorSessionsPage,
    }),
  ),
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

const AdminRedirectPage = lazy(() =>
  import("../../pages/admin/AdminRedirectPage").then((m) => ({
    default: m.AdminRedirectPage,
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

  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/projector-output" element={<ProjectorOutputPage />} />
      <Route path={APP_HUB_ROUTE_PATH} element={<AppHubPage />} />
      <Route path={SPECTACLE_HUB_ROUTE_PATH} element={<SpectacleHubPage />} />
      <Route path="/" element={<SpectaclePage />} />
      <Route
        path="/theater"
        element={
          isTheaterRouteEnabled() ? <SpectaclePage /> : <Navigate to="/" replace />
        }
      />
      <Route path="/light-plot" element={<SpectaclePage />} />
      <Route path="/notes-run" element={<Navigate to={SUFER_ROUTE_PATH} replace />} />
      <Route path={SUFER_ROUTE_PATH} element={<SpectaclePage />} />
      <Route path={PROJECT_MEDIA_ROUTE_PATH} element={<SpectaclePage />} />
      <Route path="/board" element={<SpectaclePage />} />
      <Route path="/tasks" element={<SpectaclePage />}>
        <Route index element={<TasksPage />} />
        <Route path=":taskId" element={<TaskDetailPage />} />
      </Route>
      <Route path="/admin" element={<AdminRedirectPage />} />
      <Route path="/rehearsals" element={<Navigate to="/sessions" replace />} />
      <Route
        path="/rehearsals/:rehearsalId"
        element={<Navigate to="/sessions" replace />}
      />
      <Route path="/sessions" element={<SpectaclePage />}>
        <Route index element={<DirectorSessionsPage />} />
        <Route path=":sessionId/slots/:slotId" element={<DirectorSessionPage />} />
        <Route path=":sessionId" element={<DirectorSessionPage />} />
      </Route>
      <Route
        path="/actor"
        element={actorPageElement}
      />
      <Route path="/trainers" element={<TrainersPage />} />
      <Route path="/trainers/speech" element={<SpeechTrainerPage />} />
      <Route path="/trainers/diction" element={<DictionTrainerPage />} />
      <Route path="/studio" element={<StudiosPage />} />
      <Route path="/studio/invite/:token" element={<StudioInvitePage />} />
      <Route path="/studio/:studioId" element={<StudioDetailPage />} />
      <Route
        path="/studio/:studioId/programs/:programId"
        element={<StudioProgramPage />}
      />
      <Route
        path="/studio/:studioId/programs/:programId/lessons/:lessonId"
        element={<StudioLessonPage />}
      />
      <Route
        path="/studio/:studioId/assignments/:assignmentId"
        element={<StudioAssignmentPage />}
      />
      <Route
        path="/studio/:studioId/videos/:videoId"
        element={<StudioVideoPage />}
      />
      <Route
        path="/role-workbook/:roleId"
        element={roleWorkbookPageElement}
      />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/troupe" element={<TroupePage />} />
      <Route path="/troupe/roles/:roleId" element={<TeamRolePage />} />
      <Route path="/premises" element={<PremisesPage />} />
      <Route path="/premises/:premiseId" element={<PremiseDetailPage />} />
      <Route path="/accounting" element={<AccountingPage />} />
      <Route path="/accounting/:collectionId" element={<CollectionDetailPage />} />
      <Route path="/roles" element={<Navigate to="/board" replace />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/bot" element={<SettingsBotPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<Navigate to={APP_HUB_ROUTE_PATH} replace />} />
    </Routes>
  );
}
