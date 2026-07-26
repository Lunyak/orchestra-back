import { useCallback } from "react";
import {
  AppEditorScriptFormattingMenu,
  requestScriptTokenizeMatches,
  type ScriptTokenizeMode,
} from "../../../shared/components/app-editor-menubar";
import { useProject } from "../../project";
import {
  selectActiveSceneMarkdownContext,
  selectShowScriptMarkdownUi,
} from "../../show-script-markdown/model/show-script-markdown-slice";
import { useScriptUI } from "../../script-ui";
import { useAppSelector } from "../../../shared/store/hooks";
import { requestOpenFormatPlay } from "../model/format-play-request";

const SCRIPT_SCENE_NAME = "script";

/** Форматирование у режимов Текст / Экспликация (левая сторона полосы). */
export function SpectacleScriptFormattingHost() {
  const { projectName } = useProject();
  const { isEditing, setIsEditing } = useScriptUI();

  const { currentScene } = useAppSelector((state) =>
    projectName
      ? selectActiveSceneMarkdownContext(state, projectName, SCRIPT_SCENE_NAME)
      : { currentScene: undefined, activeMarkdown: "", activeMarkdownField: "markdown" as const },
  );
  const markdownMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME).markdownMode
      : "play",
  );
  const playOriginalMode = useAppSelector((state) =>
    projectName
      ? selectShowScriptMarkdownUi(state, projectName, SCRIPT_SCENE_NAME).playOriginalMode
      : false,
  );

  const isTextOrExplication =
    markdownMode === "play" || markdownMode === "explication";

  const handleTokenizeMatches = useCallback(
    (query: string, mode: ScriptTokenizeMode) => {
      return requestScriptTokenizeMatches(query, mode)?.count ?? 0;
    },
    [],
  );

  if (!currentScene || !isTextOrExplication) return null;

  const canFormatPlayText = !(markdownMode === "play" && playOriginalMode);

  return (
    <div className="spectacle-direction-switch__formatting">
      <AppEditorScriptFormattingMenu
        disabled={!isEditing}
        formatPlayDisabled={!canFormatPlayText}
        onOpenFormatPlay={requestOpenFormatPlay}
        onTokenizeMatches={handleTokenizeMatches}
        onRequestEditing={() => setIsEditing(true)}
      />
    </div>
  );
}
