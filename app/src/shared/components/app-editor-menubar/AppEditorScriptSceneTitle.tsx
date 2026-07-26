import cn from "classnames";
import { MenubarPanelIcon } from "./MenubarPanelIcon";

export type AppEditorScriptSceneTitleProps = {
  title: string;
  /** Можно править текст названия (режим редактирования сценария). */
  titleEditable: boolean;
  onTitleChange: (title: string) => void;
  isModeEditing: boolean;
  onToggleModeEditing: () => void;
};

const editIcon = (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
);

export function AppEditorScriptSceneTitle({
  title,
  titleEditable,
  onTitleChange,
  isModeEditing,
  onToggleModeEditing,
}: AppEditorScriptSceneTitleProps) {
  const modeLabel = isModeEditing ? "Режим редактирования" : "Режим чтения";

  return (
    <div className="script-scene-title-block">
      {titleEditable ? (
        <input
          type="text"
          className="script-scene-title app-editor-menubar__scene-title app-editor-menubar__scene-title-input"
          value={title}
          onChange={(event) => onTitleChange(event.target.value)}
          placeholder="Название сцены"
          aria-label="Название сцены"
        />
      ) : title.trim() ? (
        <div className="script-scene-title app-editor-menubar__scene-title">{title}</div>
      ) : (
        <div className="script-scene-title script-scene-title--placeholder" aria-hidden>
          {"\u00a0"}
        </div>
      )}
      <button
        type="button"
        className={cn(
          "script-scene-title-mode-btn",
          isModeEditing && "script-scene-title-mode-btn--active",
        )}
        onClick={onToggleModeEditing}
        title={modeLabel}
        aria-label={modeLabel}
        aria-pressed={isModeEditing}
      >
        <MenubarPanelIcon active={isModeEditing}>{editIcon}</MenubarPanelIcon>
      </button>
    </div>
  );
}
