import cn from "classnames";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { SPECTACLE_HUB_ROUTE_PATH } from "../../../app/router/routeMeta";
import { useProject } from "../../project";
import {
  scriptUiActions,
  type LightPlotMode,
} from "../../script-ui/model/script-ui-slice";
import {
  showScriptMarkdownActions,
  type ShowScriptMarkdownMode,
  selectShowScriptMarkdownUi,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { SCRIPT_MARKDOWN_NOTES_TAB_LABEL } from "../../../shared/components/show-script/script-markdown-tab-labels";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  getSpectacleHubDirections,
  type SpectacleHubDirection,
} from "../model/spectacle-hub-directions";
import "./spectacle-direction-switch.css";

const SCRIPT_SCENE_NAME = "script";

const SCRIPT_MODE_ITEMS: ReadonlyArray<{
  mode: ShowScriptMarkdownMode;
  label: string;
}> = [
  { mode: "play", label: "Текст" },
  { mode: "explication", label: "Экспликация" },
  { mode: "notes", label: SCRIPT_MARKDOWN_NOTES_TAB_LABEL },
  { mode: "comments", label: "Комментарии" },
  { mode: "requisites", label: "Реквизит" },
  { mode: "light", label: "Свет" },
];

const TECH_MODE_ITEMS: ReadonlyArray<{
  id: LightPlotMode | "tech-card";
  label: string;
}> = [
  { id: "rehearsal", label: "Спектакль" },
  { id: "prog-run", label: "Прогон" },
  { id: "tech-card", label: SCRIPT_MARKDOWN_NOTES_TAB_LABEL },
];

function isDirectionActive(
  direction: SpectacleHubDirection,
  pathname: string,
) {
  if (direction.path === "/") {
    return pathname === "/";
  }
  return pathname === direction.path || pathname.startsWith(`${direction.path}/`);
}

export function SpectacleDirectionSwitchList() {
  const { pathname } = useLocation();
  const directions = getSpectacleHubDirections();
  const hubActive = pathname === SPECTACLE_HUB_ROUTE_PATH;

  return (
    <ul className="spectacle-direction-switch__list" aria-label="Направления">
      {directions.map((direction) => {
        const isActive = isDirectionActive(direction, pathname);
        return (
          <li key={direction.id}>
            <Link
              to={direction.path}
              className={cn(
                "spectacle-direction-switch__item",
                isActive && "spectacle-direction-switch__item--active",
              )}
              aria-current={isActive ? "page" : undefined}
            >
              {direction.label}
            </Link>
          </li>
        );
      })}
      <li>
        <Link
          to={SPECTACLE_HUB_ROUTE_PATH}
          className={cn(
            "spectacle-direction-switch__item",
            hubActive && "spectacle-direction-switch__item--active",
          )}
          aria-current={hubActive ? "page" : undefined}
        >
          Обзор
        </Link>
      </li>
    </ul>
  );
}

function SpectacleScriptModeSwitchList() {
  const dispatch = useAppDispatch();
  const { projectName } = useProject();

  const markdownMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME)
          .markdownMode
      : "notes",
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
  const navigate = useNavigate();
  const { projectName } = useProject();
  const lightPlotMode = useAppSelector((state) => state.scriptUi.lightPlotMode);

  const handleSelectMode = (id: LightPlotMode | "tech-card") => {
    if (id === "tech-card") {
      if (!projectName) return;
      try {
        localStorage.setItem(
          `showScript:markdownMode:${projectName}:${SCRIPT_SCENE_NAME}`,
          "notes",
        );
      } catch {
        // ignore
      }
      dispatch(
        showScriptMarkdownActions.setMarkdownMode({
          projectSlug: projectName,
          sceneName: SCRIPT_SCENE_NAME,
          mode: "notes",
        }),
      );
      navigate("/");
      return;
    }

    dispatch(scriptUiActions.setLightPlotMode({ mode: id }));
  };

  return (
    <ul
      className="spectacle-direction-switch__modes"
      aria-label="Режим техчасти"
    >
      {TECH_MODE_ITEMS.map(({ id, label }) => {
        const isActive = id !== "tech-card" && lightPlotMode === id;
        return (
          <li key={id}>
            <button
              type="button"
              className={cn(
                "spectacle-direction-switch__item",
                isActive && "spectacle-direction-switch__item--active",
              )}
              aria-pressed={isActive}
              disabled={id === "tech-card" ? !projectName : false}
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

export function SpectacleDirectionSwitch() {
  const { pathname } = useLocation();
  const showScriptModes = pathname === "/";
  const showTechModes = pathname === "/light-plot";

  return (
    <nav className="spectacle-direction-switch" aria-label="Направления спектакля">
      <SpectacleDirectionSwitchList />
      {showScriptModes ? <SpectacleScriptModeSwitchList /> : null}
      {showTechModes ? <SpectacleTechModeSwitchList /> : null}
    </nav>
  );
}
