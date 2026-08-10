import cn from "classnames";
import { useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import { useProject } from "../../project";
import {
  getProjectTaskFilterSnapshot,
  setProjectTaskFilter,
  subscribeProjectTaskFilter,
  type ProjectTaskFilterCounts,
} from "../../project-tasks/model/project-task-filter";
import type { ProjectTaskFilter } from "../../project-tasks/model/project-task-labels";
import {
  scriptUiActions,
  type LightPlotMode,
} from "../../script-ui/model/script-ui-slice";
import {
  showScriptMarkdownActions,
  type ShowScriptMarkdownMode,
  selectShowScriptMarkdownUi,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import {
  getProjectSectionFromPath,
  projectPath,
} from "../../../app/router/paths";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import { SpectacleScriptFormattingHost } from "./SpectacleScriptFormattingHost";
import {
  SpectacleTechChromeCenterSlot,
  SpectacleTechChromeLeftSlot,
} from "./spectacle-tech-chrome-slots";
import "./spectacle-direction-switch.css";

const SCRIPT_SCENE_NAME = "script";

const SCRIPT_MODE_ITEMS: ReadonlyArray<{
  mode: ShowScriptMarkdownMode;
  label: string;
}> = [
  { mode: "play", label: "Текст" },
  { mode: "explication", label: "Экспликация" },
  { mode: "comments", label: "Комментарии" },
];

const TECH_MODE_ITEMS: ReadonlyArray<{
  id: LightPlotMode;
  label: string;
}> = [
  { id: "rehearsal", label: "Сборка" },
  { id: "prog-run", label: "Прогон" },
];

const PLAN_MODE_ITEMS: ReadonlyArray<{
  id: "sessions" | "board" | "tasks";
  label: string;
}> = [
  {
    id: "sessions",
    label: "Сессии",
  },
  {
    id: "board",
    label: "Доска",
  },
  {
    id: "tasks",
    label: "Задачи",
  },
];

const TASK_MODE_ITEMS: ReadonlyArray<{
  id: ProjectTaskFilter;
  label: string;
  countKey: keyof ProjectTaskFilterCounts;
}> = [
  { id: "open", label: "Открытые", countKey: "open" },
  { id: "mine", label: "Мои", countKey: "mine" },
  { id: "all", label: "Все", countKey: "all" },
];

function SpectacleScriptModeSwitchList() {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();

  const markdownMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME)
          .markdownMode
      : "play",
  );

  const handleSelectMode = (mode: ShowScriptMarkdownMode) => {
    if (!projectName) return;

    try {
      localStorage.setItem(
        `showScript:markdownMode:${projectName}:${SCRIPT_SCENE_NAME}`,
        mode,
      );
    } catch {
      // ignore
    }

    dispatch(
      showScriptMarkdownActions.setMarkdownMode({
        projectSlug: projectName,
        sceneName: SCRIPT_SCENE_NAME,
        mode,
      }),
    );
  };

  return (
    <ul
      className="spectacle-direction-switch__modes"
      aria-label="Режим сцены"
    >
      {SCRIPT_MODE_ITEMS.map(({ mode, label }) => {
        const isActive = markdownMode === mode;
        return (
          <li key={mode}>
            <button
              type="button"
              className={cn(
                "spectacle-direction-switch__item",
                isActive && "spectacle-direction-switch__item--active",
              )}
              aria-pressed={isActive}
              disabled={!projectName}
              onClick={() => handleSelectMode(mode)}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SpectacleTechModeSwitchList() {
  const dispatch = useAppDispatch();
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);

  const handleSelectMode = (id: LightPlotMode) => {
    dispatch(scriptUiActions.setLightPlotMode({ mode: id }));
  };

  return (
    <ul
      className="spectacle-direction-switch__modes"
      aria-label="Режим техчасти"
    >
      {TECH_MODE_ITEMS.map(({ id, label }) => {
        const isActive = lightPlotMode === id;
        return (
          <li key={id}>
            <button
              type="button"
              className={cn(
                "spectacle-direction-switch__item",
                isActive && "spectacle-direction-switch__item--active",
              )}
              aria-pressed={isActive}
              onClick={() => handleSelectMode(id)}
            >
              {label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function SpectaclePlanModeSwitchList() {
  const { pathname } = useLocation();
  const { projectName } = useProject();
  const activeSection = getProjectSectionFromPath(pathname);

  return (
    <ul
      className="spectacle-direction-switch__modes"
      aria-label="Режим репетиций"
    >
      {PLAN_MODE_ITEMS.map(({ id, label }) => {
        const active = activeSection === id;
        return (
          <li key={id}>
            <Link
              to={projectPath(projectName, id)}
              className={cn(
                "spectacle-direction-switch__item",
                active && "spectacle-direction-switch__item--active",
              )}
              aria-current={active ? "page" : undefined}
            >
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SpectacleTasksModeSwitchList() {
  const snapshot = useSyncExternalStore(
    subscribeProjectTaskFilter,
    getProjectTaskFilterSnapshot,
    getProjectTaskFilterSnapshot,
  );

  return (
    <ul
      className="spectacle-direction-switch__modes"
      aria-label="Фильтр задач"
    >
      {TASK_MODE_ITEMS.map(({ id, label, countKey }) => {
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
              <span className="spectacle-direction-switch__count">
                {snapshot.counts[countKey]}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export function SpectacleDirectionSwitch() {
  const { pathname } = useLocation();
  const activeSection = getProjectSectionFromPath(pathname);
  const showScriptModes = activeSection === "script";
  const showTechModes = activeSection === "light-plot";
  const showPlanModes =
    activeSection === "sessions" ||
    activeSection === "board" ||
    activeSection === "tasks";
  const showTasksModes = activeSection === "tasks";
  const showSuferChrome = activeSection === "sufer";
  const showTechChrome = showTechModes || showSuferChrome;

  if (!showScriptModes && !showTechChrome && !showPlanModes) {
    return null;
  }

  const ariaLabel = showPlanModes
    ? "Режимы репетиций"
    : "Режимы спектакля";

  return (
    <nav
      className={cn(
        "spectacle-direction-switch",
        showTechChrome && "spectacle-direction-switch--tech",
      )}
      aria-label={ariaLabel}
    >
      <div className="spectacle-direction-switch__left">
        {showScriptModes ? <SpectacleScriptFormattingHost /> : null}
        {showTechChrome ? <SpectacleTechChromeLeftSlot /> : null}
        {showTasksModes ? <SpectacleTasksModeSwitchList /> : null}
      </div>
      {showTechChrome ? <SpectacleTechChromeCenterSlot /> : null}
      <div className="spectacle-direction-switch__right">
        {showScriptModes ? <SpectacleScriptModeSwitchList /> : null}
        {showTechModes ? <SpectacleTechModeSwitchList /> : null}
        {showPlanModes ? <SpectaclePlanModeSwitchList /> : null}
      </div>
    </nav>
  );
}
