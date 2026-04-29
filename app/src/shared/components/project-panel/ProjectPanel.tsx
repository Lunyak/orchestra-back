import React from "react";
import "./style.css";
import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
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
  const projectOptions = projects.map((project) => ({
    value: project,
    label: project,
  }));

  return (
    <div className="project-panel">
      <CustomSelect
        id="project-select"
        value={projectName}
        options={projectOptions}
        onChange={onProjectChange}
        placeholder="Выберите проект"
        noOptionsLabel="Проектов нет"
        disabled={projects.length === 0}
      />
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
