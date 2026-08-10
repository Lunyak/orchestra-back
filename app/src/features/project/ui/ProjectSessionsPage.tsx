import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { theaterRehearsalsPath } from "../../../app/router/paths";
import { RehearsalPlanSectionChrome } from "../../../shared/components/rehearsal-plan/RehearsalPlanSectionChrome";
import {
  fetchProjectLinks,
  type ProjectLinks,
} from "../../../sync/api/projects";
import { useAuth } from "../../auth/model/auth-context";
import { DirectorSessionsPage } from "../../director-sessions/ui/DirectorSessionsPage";
import { useProject } from "../model/project-context";
import "../../director-sessions/ui/director-sessions.css";
import "./project-sessions-page.css";

type LinkedTheater = ProjectLinks["theaters"][number]["theater"];

export function ProjectSessionsPage() {
  const { accessToken } = useAuth();
  const { projectName } = useProject();
  const [resolvedProjectSlug, setResolvedProjectSlug] = useState("");
  const [linkedTheaters, setLinkedTheaters] = useState<LinkedTheater[]>([]);

  useEffect(() => {
    if (!accessToken || !projectName) return;

    let cancelled = false;
    fetchProjectLinks(accessToken, projectName)
      .then((links) => {
        if (cancelled) return;
        setLinkedTheaters(links.theaters.map((link) => link.theater));
      })
      .catch(() => {
        if (cancelled) return;
        setLinkedTheaters([]);
      })
      .finally(() => {
        if (!cancelled) setResolvedProjectSlug(projectName);
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, projectName]);

  if (!accessToken || !projectName) {
    return <DirectorSessionsPage />;
  }

  if (resolvedProjectSlug !== projectName) {
    return (
      <div className="sessions-page rehearsals-page">
        <div className="rehearsals-muted">Проверяем связи проекта…</div>
      </div>
    );
  }

  if (!linkedTheaters.length) {
    return <DirectorSessionsPage />;
  }

  return (
    <div className="sessions-page rehearsals-page project-sessions-page">
      <RehearsalPlanSectionChrome activeTab="sessions">
        <div className="project-sessions-page__content">
          <div className="project-sessions-page__panel">
            <p className="project-sessions-page__eyebrow">Репетиции проекта</p>
            <h1 className="project-sessions-page__title">
              Расписание ведётся в театре{" "}
              {linkedTheaters.map((theater, index) => (
                <span key={theater.id}>
                  {index > 0 ? ", " : null}
                  <Link
                    className="project-sessions-page__theater-link"
                    to={theaterRehearsalsPath(theater.id)}
                  >
                    {theater.title}
                  </Link>
                </span>
              ))}
            </h1>
            <p className="project-sessions-page__hint">
              Проект прикреплён к театру. Смотрите и планируйте его репетиции в
              расписании театра.
            </p>
          </div>
        </div>
      </RehearsalPlanSectionChrome>
    </div>
  );
}
