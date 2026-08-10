import cn from "classnames";
import { Link, useLocation } from "react-router-dom";
import {
  getProjectSectionFromPath,
  isProjectPath,
  projectPath,
} from "../../../app/router/paths";
import { useProject } from "../../../features/project";

export function AppEditorProjectDirectionsNav() {
  const { pathname } = useLocation();
  const { projectName } = useProject();

  if (!isProjectPath(pathname)) {
    return null;
  }

  const activeSection = getProjectSectionFromPath(pathname);
  const settingsPath = projectPath(projectName, "settings");
  const isSettingsActive = activeSection === "settings";

  return (
    <nav className="app-editor-menubar__project-nav" aria-label="Разделы проекта">
      <Link
        to={settingsPath}
        className={cn(
          "app-editor-menubar__home",
          isSettingsActive && "app-editor-menubar__home--active",
        )}
        aria-current={isSettingsActive ? "page" : undefined}
      >
        Настройки
      </Link>
    </nav>
  );
}
