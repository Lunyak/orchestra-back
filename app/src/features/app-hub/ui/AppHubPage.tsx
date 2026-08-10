import { useNavigate } from "react-router-dom";
import { projectPath } from "../../../app/router/paths";
import { ProjectWorkspace } from "../../project/ui/ProjectWorkspace";
import "./app-hub.css";

function ProjectsSection() {
  const navigate = useNavigate();

  return (
    <ProjectWorkspace onProjectOpen={(slug) => navigate(projectPath(slug))} />
  );
}

export function MyProjectsPage() {
  return (
    <div className="app-layout app-hub-layout app-hub-layout--projects">
      <div className="app-content">
        <main className="main-content">
          <div className="app-hub app-hub--projects">
            <ProjectsSection />
          </div>
        </main>
      </div>
    </div>
  );
}
