import { useProject } from "../model/project-context";
import { ProjectNavMindmap } from "./ProjectNavMindmap";
import "../../director-sessions/ui/director-sessions.css";
import "./project-overview.css";

export function ProjectOverviewPage() {
  const { currentProjectDisplayName, projectName } = useProject();

  return (
    <main className="project-overview">
      <div className="project-overview__content">
        <header className="project-overview__header">
          <p className="project-overview__eyebrow">Проект</p>
          <h1 className="project-overview__title">
            {currentProjectDisplayName || "Обзор"}
          </h1>
        </header>

        <section
          className="project-overview__map"
          aria-labelledby="project-nav-map-title"
        >
          <h2
            id="project-nav-map-title"
            className="project-overview__section-title"
          >
            Карта разделов
          </h2>
          <ProjectNavMindmap
            projectSlug={projectName}
            rootLabel={currentProjectDisplayName}
          />
        </section>

        <section
          className="project-overview__map"
          aria-labelledby="project-people-map-title"
        >
          <h2
            id="project-people-map-title"
            className="project-overview__section-title"
          >
            Команда и каст
          </h2>
          <ProjectNavMindmap projectSlug={projectName} kind="people" />
        </section>
      </div>
    </main>
  );
}
