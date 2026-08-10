import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getProjectSectionFromPath,
  projectPath,
  type ProjectSection,
} from "../../../app/router/paths";
import { useProject } from "../../../features/project";
import { CustomSelect } from "../../core/custom-select/CustomSelect";

export function AppEditorMenubarProjectSelect() {
  const { projectItems, projects, projectName, projectsLoading, onProjectChange } = useProject();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hasProjects = projects.length > 0;
  const activeSection =
    (getProjectSectionFromPath(pathname) as ProjectSection | null) ?? "overview";

  const projectSelectOptions = useMemo(
    () =>
      projectItems.length > 0
        ? projectItems.map((project) => ({
            value: project.slug,
            label: project.name || project.slug,
            searchText: project.slug,
          }))
        : projects.map((slug) => ({
            value: slug,
            label: slug,
            searchText: slug,
          })),
    [projectItems, projects],
  );

  const handleProjectChange = (slug: string) => {
    onProjectChange(slug);
    navigate(projectPath(slug, activeSection));
  };

  return (
    <CustomSelect
      value={hasProjects ? projectName : ""}
      options={projectSelectOptions}
      onChange={handleProjectChange}
      placeholder="Выберите проект"
      noOptionsLabel="Проектов нет"
      searchPlaceholder="Поиск проекта…"
      noSearchResultsLabel="Ничего не найдено"
      searchable
      minOptionsForSearch={1}
      className="app-editor-menubar__project-select"
      triggerClassName="app-editor-menubar__project-select-trigger"
      dropdownClassName="app-editor-menubar__project-select-dropdown"
      disabled={!hasProjects || projectsLoading}
      aria-label="Текущий проект"
    />
  );
}
