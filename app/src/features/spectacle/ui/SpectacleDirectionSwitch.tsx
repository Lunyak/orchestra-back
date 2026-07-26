import cn from "classnames";
import { useLocation } from "react-router-dom";
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

export function SpectacleDirectionSwitch() {
  const { pathname } = useLocation();
  const showScriptModes = pathname === "/";
  const showTechModes = pathname === "/light-plot";

  if (!showScriptModes && !showTechModes) {
    return null;
  }

  return (
    <nav
      className={cn(
        "spectacle-direction-switch",
        showTechModes && "spectacle-direction-switch--tech",
      )}
      aria-label="Режимы спектакля"
    >
      <div className="spectacle-direction-switch__left">
        {showScriptModes ? <SpectacleScriptFormattingHost /> : null}
        {showTechModes ? <SpectacleTechChromeLeftSlot /> : null}
      </div>
      {showTechModes ? <SpectacleTechChromeCenterSlot /> : null}
      <div className="spectacle-direction-switch__right">
        {showScriptModes ? <SpectacleScriptModeSwitchList /> : null}
        {showTechModes ? <SpectacleTechModeSwitchList /> : null}
      </div>
    </nav>
  );
}
