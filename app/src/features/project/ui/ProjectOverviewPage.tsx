import { useProject } from "../model/project-context";
import { ProjectNavMindmap } from "./ProjectNavMindmap";
import "../../director-sessions/ui/director-sessions.css";
import "./project-overview.css";

export function ProjectOverviewPage() {
  const { currentProjectDisplayName, projectName } = useProject();

  return (
    <main className="project-overview">
      <div className="project-overview__content">
        <section
          className="project-overview__map"
          aria-labelledby="project-nav-map-title"
        >
          <ProjectNavMindmap
            projectSlug={projectName}
            rootLabel={currentProjectDisplayName}
          />
        </section>
      </div>
    </main>
  );
}
