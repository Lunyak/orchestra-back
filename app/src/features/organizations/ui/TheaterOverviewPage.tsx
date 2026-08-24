import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { globalPaths, theaterOrganizationPath } from "../../../app/router/paths";
import { fetchTheaters } from "../../../sync/api/workspaces";
import { useAuth } from "../../auth/model/auth-context";
import "../../director-sessions/ui/director-sessions.css";
import { TheaterNavMindmap } from "./TheaterNavMindmap";
import "./theater-overview.css";

export function TheaterOverviewPage() {
  const { theaterId = "" } = useParams();
  const { accessToken } = useAuth();
  const [theaterTitle, setTheaterTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    if (!accessToken || !theaterId) {
      setLoading(false);
      setMissing(!theaterId);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setMissing(false);

    fetchTheaters(accessToken)
      .then((theaters) => {
        if (cancelled) return;
        const theater = theaters.find((item) => item.id === theaterId);
        if (!theater) {
          setMissing(true);
          setTheaterTitle("");
          return;
        }
        setTheaterTitle(theater.title);
      })
      .catch(() => {
        if (!cancelled) {
          setMissing(true);
          setTheaterTitle("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, theaterId]);

  if (!theaterId) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  if (!loading && missing) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  const displayTitle = theaterTitle || "Театр";

  return (
    <main className="theater-overview">
      <div className="theater-overview__content">
        <header className="theater-overview__header">
          <Link
            to={globalPaths.organizations}
            className="theater-overview__back"
          >
            ← Организации
          </Link>
          <p className="theater-overview__eyebrow">Театр</p>
        </header>

        {!loading ? (
          <section
            className="theater-overview__map"
            aria-labelledby="theater-nav-map-title"
          >
            <TheaterNavMindmap
              theaterId={theaterId}
              rootLabel={displayTitle}
            />
          </section>
        ) : null}
      </div>
    </main>
  );
}
