import cn from "classnames";
import type { ReactNode } from "react";

export type AppEditorScriptSceneTitleProps = {
  title: string;
  /** Можно править текст названия (режим редактирования сценария). */
  titleEditable: boolean;
  onTitleChange: (title: string) => void;
  isModeEditing: boolean;
  onToggleModeEditing: () => void;
  /** Кнопка карандаша рядом с названием. По умолчанию true. */
  showModeToggle?: boolean;
  /** Доп. кнопка под переключателем режима (например оригинал/правка). */
  belowModeToggle?: ReactNode;
};

const editIcon = (
  <svg
    width="16"
    height="16"
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

const bookIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
  </svg>
);

export type AppEditorScriptModeToggleProps = {
  isModeEditing: boolean;
  onToggleModeEditing: () => void;
  className?: string;
};

export function AppEditorScriptModeToggle({
  isModeEditing,
  onToggleModeEditing,
  className,
}: AppEditorScriptModeToggleProps) {
  const modeLabel = isModeEditing ? "Перейти в режим чтения" : "Перейти в режим редактирования";

  return (
    <button
      type="button"
      className={cn(
        "script-chrome-dock-btn",
        "script-scene-title-mode-btn",
        isModeEditing && "script-chrome-dock-btn--active",
        isModeEditing && "script-scene-title-mode-btn--active",
        className,
      )}
      onClick={onToggleModeEditing}
      title={modeLabel}
      aria-label={modeLabel}
      aria-pressed={isModeEditing}
    >
      {isModeEditing ? bookIcon : editIcon}
    </button>
  );
}

export function AppEditorScriptSceneTitle({
  title,
  titleEditable,
  onTitleChange,
  isModeEditing,
  onToggleModeEditing,
  showModeToggle = true,
  belowModeToggle = null,
}: AppEditorScriptSceneTitleProps) {
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
      {showModeToggle ? (
        <AppEditorScriptModeToggle
          isModeEditing={isModeEditing}
          onToggleModeEditing={onToggleModeEditing}
        />
      ) : null}
      {belowModeToggle}
    </div>
  );
}
