import { MenubarPanelIcon } from "./MenubarPanelIcon";
import { AppEditorScriptPlayOriginalToggle } from "./AppEditorScriptPlayOriginalToggle";
import { AppEditorScriptTocToggle } from "./AppEditorScriptTocToggle";

export type AppEditorScriptModeNavProps = {
  isEditing: boolean;
  onToggleEditing: () => void;
  annotationsMode: boolean;
  onToggleAnnotations: () => void;
  playOriginalMode?: boolean;
  onTogglePlayOriginal?: () => void;
  editorTocEnabled?: boolean;
  onToggleEditorToc?: () => void;
};

const icons = {
  edit: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  ),
  annotations: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" />
    </svg>
  ),
};

export function AppEditorScriptModeNav({
  isEditing,
  onToggleEditing,
  annotationsMode,
  onToggleAnnotations,
  playOriginalMode,
  onTogglePlayOriginal,
  editorTocEnabled,
  onToggleEditorToc,
}: AppEditorScriptModeNavProps) {
  const showPlayOriginalToggle =
    onTogglePlayOriginal != null && playOriginalMode != null;
  const showEditorTocToggle =
    onToggleEditorToc != null && editorTocEnabled != null;

  return (
    <nav className="app-editor-menubar__mode-nav" aria-label="Режим сценария">
      <button
        type="button"
        className={[
          "app-editor-menubar__panel-btn",
          isEditing ? "app-editor-menubar__panel-btn--active" : "app-editor-menubar__panel-btn--muted",
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={onToggleEditing}
        title={isEditing ? "Режим редактирования" : "Режим чтения"}
        aria-label={isEditing ? "Режим редактирования" : "Режим чтения"}
        aria-pressed={isEditing}
      >
        <MenubarPanelIcon active={isEditing}>{icons.edit}</MenubarPanelIcon>
      </button>
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
      {showPlayOriginalToggle ? (
        <AppEditorScriptPlayOriginalToggle
          playOriginalMode={playOriginalMode}
          onToggle={onTogglePlayOriginal}
        />
      ) : null}
      {showEditorTocToggle ? (
        <AppEditorScriptTocToggle
          editorTocEnabled={editorTocEnabled}
          onToggle={onToggleEditorToc}
        />
      ) : null}
    </nav>
  );
}
