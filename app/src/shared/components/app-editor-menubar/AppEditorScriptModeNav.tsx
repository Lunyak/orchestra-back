import { MenubarPanelIcon } from "./MenubarPanelIcon";

export type AppEditorScriptModeNavProps = {
  isEditing: boolean;
  annotationsMode: boolean;
  onToggleAnnotations: () => void;
};

const icons = {
  annotations: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  ),
};

export function AppEditorScriptModeNav({
  isEditing,
  annotationsMode,
  onToggleAnnotations,
}: AppEditorScriptModeNavProps) {
  return (
    <nav className="app-editor-menubar__mode-nav" aria-label="Режим сценария">
      <button
        type="button"
        className={[
          "app-editor-menubar__panel-btn",
          annotationsMode ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onToggleAnnotations}
        disabled={isEditing}
        title={
          isEditing
            ? "Метки недоступны в режиме редактирования"
            : annotationsMode
              ? "Скрыть метки"
              : "Показать метки"
        }
        aria-label={
          isEditing
            ? "Метки недоступны в режиме редактирования"
            : annotationsMode
              ? "Скрыть метки"
              : "Показать метки"
        }
        aria-pressed={annotationsMode}
      >
        <MenubarPanelIcon active={annotationsMode}>{icons.annotations}</MenubarPanelIcon>
      </button>
    </nav>
  );
}
