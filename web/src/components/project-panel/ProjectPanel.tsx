import React from "react";
import "./style.css";

interface ProjectPanelProps {
  projects: string[];
  projectName: string;
  newProjectName: string;
  view: "script" | "theater" | "light-plot" | "settings";
  onProjectChange: (name: string) => void;
  onNewProjectNameChange: (value: string) => void;
  onCreateProject: () => void;
  onDeleteProject: () => void;
  onViewChange: (view: "script" | "theater" | "light-plot" | "settings") => void;
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({
  projects,
  projectName,
  newProjectName,
  view,
  onProjectChange,
  onNewProjectNameChange,
  onCreateProject,
  onDeleteProject,
  onViewChange,
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
      <div className="project-view-toggle">
        <button
          type="button"
          data-active={view === "script"}
          onClick={() => onViewChange("script")}
        >
          Сценарий
        </button>
        {/* В desktop-версии скрываем 3D-театр и схему света */}
        <button
          type="button"
          data-active={view === "settings"}
          onClick={() => onViewChange("settings")}
        >
          Настройки
        </button>
      </div>
    </div>
  );
};

