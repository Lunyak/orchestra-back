import { Link, Navigate, useParams } from "react-router-dom";
import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import {
  studioOrganizationPath,
  studioOverviewPath,
} from "../../app/router/paths";
import { useAuth } from "../../features/auth/model/auth-context";
import { PersonalAvailabilityEditor } from "../../features/profile/ui/PersonalAvailabilityEditor";
import { useGetStudioQuery } from "../../features/studio";
import { StudioSectionNav } from "../../features/organizations/ui/StudioSectionNav";
import "../../features/rehearsals/ui/rehearsals.css";
import "./style.css";

export function StudioAvailabilityPage() {
  const { studioId = "" } = useParams();
  const { accessToken } = useAuth();
  const { data: studio, isLoading, isError } = useGetStudioQuery(studioId, {
    skip: !accessToken || !studioId,
  });

  if (!studioId) {
    return <Navigate to={studioOrganizationPath()} replace />;
  }

  if (!accessToken) {
    return <div>Нужно войти, чтобы открыть занятость.</div>;
  }

  if (!isLoading && (isError || !studio)) {
    return <Navigate to={studioOrganizationPath()} replace />;
  }

  if (isLoading || !studio) {
    return <PageBootLoader label="Загрузка занятости…" />;
  }

  return (
    <div className="app-layout studio-layout">
      <div className="app-content">
        <StudioSectionNav studioId={studioId} active="availability" />
        <main className="main-content">
          <div className="studio-page">
            <Link className="studio-page__back" to={studioOverviewPath(studioId)}>
              ← Обзор
            </Link>
            <PersonalAvailabilityEditor
              accessToken={accessToken}
              title={`Занятость · ${studio.title}`}
              hint="Отметьте, когда вы свободны для этой студии. Сводка по всем площадкам — во вкладке «Занятость» профиля."
              storageMonthKey={`studio-availability:${studioId}`}
            />
          </div>
        </main>
      </div>
    </div>
  );
}

export default StudioAvailabilityPage;
