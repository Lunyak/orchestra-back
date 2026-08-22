import { Link, useParams } from "react-router-dom";
import {
  studioOrgPremisesPath,
  studioOverviewPath,
  theaterPremisesPath,
} from "../../app/router/paths";
import { useAuth } from "../../features/auth";
import { StudioSectionNav } from "../../features/organizations/ui/StudioSectionNav";
import { TheaterSectionNav } from "../../features/organizations/ui/TheaterSectionNav";
import "../../features/rehearsals/ui/rehearsals.css";
import "../../features/director-sessions/ui/director-sessions.css";
import { PremisesIndexPanel } from "./PremisesIndexPanel";
import "./style.css";

export function PremisesPage() {
  const { accessToken } = useAuth();
  const { theaterId = "", studioId = "" } = useParams();
  const organization = theaterId
    ? ({ type: "theater", id: theaterId } as const)
    : studioId
      ? ({ type: "studio", id: studioId } as const)
      : undefined;
  const detailPath = theaterId
    ? (premiseId: string) => theaterPremisesPath(theaterId, premiseId)
    : studioId
      ? (premiseId: string) => studioOrgPremisesPath(studioId, premiseId)
      : undefined;

  return (
    <div className="app-layout premises-layout">
      <div className="app-content">
        {theaterId ? (
          <TheaterSectionNav theaterId={theaterId} active="premises" />
        ) : null}
        {studioId ? (
          <StudioSectionNav studioId={studioId} active="premises" />
        ) : null}
        <main className="main-content main-content-premises">
          <div className="premises-view">
            {studioId ? (
              <Link
                className="director-session-page__back"
                to={studioOverviewPath(studioId)}
              >
                ← Студия
              </Link>
            ) : null}
            <div className="premises-page__header">
              <div>
                <h1 className="premises-page__title">Помещения</h1>
                <p className="premises-page__lead">
                  Календарь аренды и субаренды залов и студий
                </p>
              </div>
            </div>
            <div className="sessions-page rehearsals-page premises-page__body">
              <PremisesIndexPanel
                skip={!accessToken}
                organization={organization}
                detailPath={detailPath}
              />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
