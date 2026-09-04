import cn from "classnames";
import { useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getProjectSectionFromPath,
  projectPath,
} from "../../../app/router/paths";
import {
  getProjectTaskFilterSnapshot,
  setProjectTaskFilter,
  subscribeProjectTaskFilter,
  type ProjectTaskFilterCounts,
} from "../../project-tasks/model/project-task-filter";
import type { ProjectTaskFilter } from "../../project-tasks/model/project-task-labels";
import { useProject } from "../model/project-context";
import "../../spectacle/ui/spectacle-direction-switch.css";

const PLAN_SECTIONS = [
  { id: "sessions", label: "Сессии" },
  { id: "board", label: "Доска" },
  { id: "tasks", label: "Задачи" },
  { id: "availability", label: "Занятость" },
] as const;

const TASK_FILTERS: ReadonlyArray<{
  id: ProjectTaskFilter;
  label: string;
  countKey: keyof ProjectTaskFilterCounts;
}> = [
  { id: "open", label: "Открытые", countKey: "open" },
  { id: "mine", label: "Мои", countKey: "mine" },
  { id: "all", label: "Все", countKey: "all" },
];

function PlanSectionLinks() {
  const { pathname } = useLocation();
  const { projectName } = useProject();
  const activeSection = getProjectSectionFromPath(pathname);

  return (
    <ul
      className={cn("spectacle-direction-switch__modes")}
      aria-label="Режим репетиций"
    >
      {PLAN_SECTIONS.map(({ id, label }) => {
        const isActive = activeSection === id;

        return (
          <li key={id}>
            <Link
              to={projectPath(projectName, id)}
              className={cn(
                "spectacle-direction-switch__item",
                isActive && "spectacle-direction-switch__item--active",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function TaskFilterButtons() {
  const snapshot = useSyncExternalStore(
    subscribeProjectTaskFilter,
    getProjectTaskFilterSnapshot,
    getProjectTaskFilterSnapshot,
  );

  return (
    <ul
      className={cn("spectacle-direction-switch__modes")}
      aria-label="Фильтр задач"
    >
      {TASK_FILTERS.map(({ id, label, countKey }) => {
        const isActive = snapshot.filter === id;

        return (
          <li key={id}>
            <button
              type="button"
              className={cn(
                "spectacle-direction-switch__item",
                isActive && "spectacle-direction-switch__item--active",
              )}
              aria-pressed={isActive}
              onClick={() => setProjectTaskFilter(id)}
            >
              {label}
              <span className={cn("spectacle-direction-switch__count")}>
                {snapshot.counts[countKey]}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function ProjectRehearsalPlanNav() {
  const { pathname } = useLocation();
  const activeSection = getProjectSectionFromPath(pathname);
  const showTaskFilters = activeSection === "tasks";

  return (
    <nav
      className={cn("spectacle-direction-switch")}
      aria-label="Режимы репетиций"
    >
      <div className={cn("spectacle-direction-switch__left")}>
        <PlanSectionLinks />
      </div>
      <div className={cn("spectacle-direction-switch__right")}>
        {showTaskFilters ? <TaskFilterButtons /> : null}
      </div>
    </nav>
  );
}
