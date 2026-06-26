import { useMemo } from "react";
import { useProject } from "../../../features/project";
import { CustomSelect } from "../../core/custom-select/CustomSelect";

export function AppEditorMenubarProjectSelect() {
  const { projectItems, projects, projectName, projectsLoading, onProjectChange } = useProject();
  const hasProjects = projects.length > 0;

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

  return (
    <CustomSelect
      value={hasProjects ? projectName : ""}
      options={projectSelectOptions}
      onChange={onProjectChange}
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
