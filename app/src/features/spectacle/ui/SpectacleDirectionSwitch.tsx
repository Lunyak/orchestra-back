import cn from "classnames";
import { useLocation, useNavigate } from "react-router-dom";
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
import { SpectacleScriptFormattingHost } from "./SpectacleScriptFormattingHost";
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

  if (!showScriptModes && !showTechModes) {
    return null;
  }

  return (
    <nav className="spectacle-direction-switch" aria-label="Режимы спектакля">
      <div className="spectacle-direction-switch__left">
        {showScriptModes ? <SpectacleScriptFormattingHost /> : null}
      </div>
      <div className="spectacle-direction-switch__right">
        {showScriptModes ? <SpectacleScriptModeSwitchList /> : null}
        {showTechModes ? <SpectacleTechModeSwitchList /> : null}
      </div>
    </nav>
  );
}
