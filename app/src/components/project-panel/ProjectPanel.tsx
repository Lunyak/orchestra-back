import React from "react";
import "./style.css";

interface ProjectPanelProps {
  projects: string[];
  projectName: string;
  newProjectName: string;
  onProjectChange: (name: string) => void;
  onNewProjectNameChange: (value: string) => void;
  onCreateProject: () => void;
  onDeleteProject: () => void;
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  projects,
  projectName,
  newProjectName,
  onProjectChange,
  onNewProjectNameChange,
  onCreateProject,
  onDeleteProject,
}) => {
  return (
    <div className="project-panel">
      <label htmlFor="project-select">Проект</label>
      <select
        id="project-select"
        value={projectName}
        onChange={(event) => onProjectChange(event.target.value)}
        disabled={projects.length === 0}
      >
        {projects.length === 0 && <option value="">Проектов нет</option>}
        {projects.map((project) => (
          <option key={project} value={project}>
            {project}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={newProjectName}
        onChange={(event) => onNewProjectNameChange(event.target.value)}
        placeholder="Новый проект"
      />
      <button type="button" onClick={onCreateProject}>
        Создать
      </button>
      <button type="button" className="project-delete" onClick={onDeleteProject}>
        Удалить
      </button>
    </div>
  );
};
