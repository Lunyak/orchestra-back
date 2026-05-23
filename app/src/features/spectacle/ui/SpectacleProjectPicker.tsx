import { CustomSelect } from "../../../shared/core/custom-select/CustomSelect";

export type SpectacleProjectPickerProps = {
  projects: string[];
  projectName: string;
  projectsLoading: boolean;
  onProjectChange: (slug: string) => void;
};

export function SpectacleProjectPicker({
  projects,
  projectName,
  projectsLoading,
  onProjectChange,
}: SpectacleProjectPickerProps) {
  const hasProjects = projects.length > 0;
  const projectSelectOptions = projects.map((slug) => ({ value: slug, label: slug }));

  return (
    <div className="spectacle-project-bar">
      <label className="spectacle-project-field">
        {/* <span className="spectacle-project-field-label">Проект</span> */}
        <CustomSelect
          value={hasProjects ? projectName : ""}
          options={projectSelectOptions}
          onChange={(nextValue) => onProjectChange(nextValue)}
          placeholder="Выберите проект"
          noOptionsLabel="Проектов нет"
          triggerClassName="spectacle-project-select"
          disabled={!hasProjects || projectsLoading}
          aria-label="Текущий проект"
        />
      </label>
    </div>
  );
}
