import cn from "classnames";
import { useLocation } from "react-router-dom";
import { useCompactKadrStrip } from "@shared/hooks/useCompactKadrStrip";
import { useProject } from "../../project";
import { ProjectRehearsalPlanNav } from "../../project/ui/ProjectRehearsalPlanNav";
import {
  scriptUiActions,
  type LightPlotMode,
} from "../../script-ui/model/script-ui-slice";
import {
  showScriptMarkdownActions,
  type ShowScriptMarkdownMode,
  selectShowScriptMarkdownUi,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { getProjectSectionFromPath } from "../../../app/router/paths";
import { useAppDispatch, useAppSelector } from "../../../shared/store/hooks";
import {
  SpectacleTechChromeCenterSlot,
  SpectacleTechChromeLeftSlot,
} from "./spectacle-tech-chrome-slots";
import {
  SCRIPT_MODE_ITEMS,
  SCRIPT_SCENE_NAME,
} from "./SpectacleScriptModeNav";
import "./spectacle-direction-switch.css";

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
  const compactStrip = useCompactKadrStrip();

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

  if (compactStrip) {
    return null;
  }

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
  const compactStrip = useCompactKadrStrip();
  const activeSection = getProjectSectionFromPath(pathname);
  const showScriptModes = activeSection === "script";
  const showTechModes = activeSection === "light-plot";
  const showPlanModes =
    activeSection === "sessions" ||
    activeSection === "board" ||
    activeSection === "tasks";
  const showSuferChrome = activeSection === "sufer";
  const showTechChrome = showTechModes || showSuferChrome;
  const showCenterChrome = showTechChrome || showScriptModes;

  if (showPlanModes) {
    return <ProjectRehearsalPlanNav />;
  }

  if (!showScriptModes && !showTechChrome && !showPlanModes) {
    return null;
  }

  return (
    <nav
      className={cn(
        "spectacle-direction-switch",
        showCenterChrome && "spectacle-direction-switch--centered",
      )}
      aria-label="Режимы спектакля"
    >
      <div className="spectacle-direction-switch__left">
        {showTechChrome ? <SpectacleTechChromeLeftSlot /> : null}
      </div>
      {showCenterChrome ? <SpectacleTechChromeCenterSlot /> : null}
      <div className="spectacle-direction-switch__right">
        {showScriptModes ? <SpectacleScriptModeSwitchList /> : null}
        {showTechModes && !compactStrip ? <SpectacleTechModeSwitchList /> : null}
      </div>
    </nav>
  );
}
