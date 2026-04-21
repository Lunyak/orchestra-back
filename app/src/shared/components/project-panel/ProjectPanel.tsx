import React from "react";
import "./style.css";
import { Button } from "@shared/core/button/Button";
import { Buttons } from "../buttons/Buttons";

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
      <Button type="button" className="" onClick={onCreateProject}>
        Создать
      </Button>
      <Buttons.DeleteButton type="button" className="" onClick={onDeleteProject}>

      </Buttons.DeleteButton>
    </div>
  );
};
