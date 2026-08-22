import { Link, Navigate, useParams } from "react-router-dom";
import { studioOrganizationPath } from "../../../app/router/paths";
import { useAuth } from "../../auth/model/auth-context";
import { useGetStudioQuery } from "../../studio";
import "../../director-sessions/ui/director-sessions.css";
import { StudioNavMindmap } from "./StudioNavMindmap";
import "./studio-overview.css";

export function StudioOverviewPage() {
  const { studioId = "" } = useParams();
  const { accessToken } = useAuth();
  const { data: studio, isLoading, isError } = useGetStudioQuery(studioId, {
    skip: !accessToken || !studioId,
  });

  if (!studioId) {
    return <Navigate to={studioOrganizationPath()} replace />;
  }

  if (!isLoading && (isError || !studio)) {
    return <Navigate to={studioOrganizationPath()} replace />;
  }

  const displayTitle = studio?.title || "Студия";

  return (
    <main className="studio-overview">
      <div className="studio-overview__content">
        <header className="studio-overview__header">
          <Link
            to={studioOrganizationPath()}
            className="studio-overview__back"
          >
            ← Студии
          </Link>
          <p className="studio-overview__eyebrow">Студия</p>
          <h1 className="studio-overview__title">
            {isLoading ? "Загрузка…" : displayTitle}
          </h1>
        </header>

        {!isLoading && studio ? (
          <section
            className="studio-overview__map"
            aria-labelledby="studio-nav-map-title"
          >
            <StudioNavMindmap
              studioId={studioId}
              rootLabel={displayTitle}
              imageUrl={studio.imageUrl}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
