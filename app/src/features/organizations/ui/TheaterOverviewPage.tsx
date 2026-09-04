import { useEffect, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { PageBootLoader } from "@shared/components/page-loader/page-boot";
import { theaterOrganizationPath } from "../../../app/router/paths";
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

  if (loading) {
    return <PageBootLoader label="Загрузка театра…" />;
  }

  if (missing) {
    return <Navigate to={theaterOrganizationPath()} replace />;
  }

  const displayTitle = theaterTitle || "Театр";

  return (
    <main className="theater-overview">
      <div className="theater-overview__content">
        <section
          className="theater-overview__map"
          aria-labelledby="theater-nav-map-title"
        >
          <TheaterNavMindmap
            theaterId={theaterId}
            rootLabel={displayTitle}
          />
        </section>
      </div>
    </main>
  );
}
