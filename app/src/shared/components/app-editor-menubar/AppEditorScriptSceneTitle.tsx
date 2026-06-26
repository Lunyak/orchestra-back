export type AppEditorScriptSceneTitleProps = {
  title: string;
  isEditing: boolean;
  onTitleChange: (title: string) => void;
};

export function AppEditorScriptSceneTitle({
  title,
  isEditing,
  onTitleChange,
}: AppEditorScriptSceneTitleProps) {
  if (isEditing) {
    return (
      <input
        type="text"
        className="script-scene-title app-editor-menubar__scene-title app-editor-menubar__scene-title-input"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Название сцены"
        aria-label="Название сцены"
      />
    );
  }

  if (!title.trim()) return null;

  return (
    <div className="script-scene-title app-editor-menubar__scene-title">{title}</div>
  );
}
