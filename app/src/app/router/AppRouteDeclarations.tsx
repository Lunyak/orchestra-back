import { UnderDevelopmentPage } from "@shared/components/under-development-page/UnderDevelopmentPage";
import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import {
  ENABLE_ACTOR_PAGE,
  ENABLE_ROLE_WORKBOOK_PAGE,
} from "../../shared/build-features";
import { isTheaterRouteEnabled } from "./routeMeta";

const SpectaclePage = lazy(() =>
  import("../../pages/spectacle/SpectaclePage").then((m) => ({
    default: m.SpectaclePage,
  })),
);

const DirectorSessionsPage = lazy(() =>
  import("../../pages/sessions/DirectorSessionsPage").then((m) => ({
    default: m.DirectorSessionsPage,
  })),
);

const DirectorSessionPage = lazy(() =>
  import("../../pages/sessions/DirectorSessionPage/DirectorSessionPage").then(
    (m) => ({
      default: m.DirectorSessionPage,
    }),
  ),
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
  import("../../pages/actor/ActorPage").then((m) => ({
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
      <Route path="/" element={<SpectaclePage />} />
      <Route
        path="/theater"
        element={
          isTheaterRouteEnabled() ? <SpectaclePage /> : <Navigate to="/" replace />
        }
      />
      <Route path="/light-plot" element={<SpectaclePage />} />
      <Route path="/notes-run" element={<SpectaclePage />} />
      <Route path="/board" element={<SpectaclePage />} />
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
      <Route
        path="/role-workbook/:roleId"
        element={roleWorkbookPageElement}
      />
      <Route path="/profile" element={<ProfilePage />} />
      <Route path="/troupe" element={<TroupePage />} />
      <Route path="/premises" element={<PremisesPage />} />
      <Route path="/premises/:premiseId" element={<PremiseDetailPage />} />
      <Route path="/roles" element={<Navigate to="/board" replace />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/settings/bot" element={<SettingsBotPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="*" element={<Navigate to="/profile" replace />} />
    </Routes>
  );
}
