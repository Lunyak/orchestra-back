export type AppEditorScriptStepTitleProps = {
  title: string;
  isEditing: boolean;
  onTitleChange: (title: string) => void;
};

export function AppEditorScriptStepTitle({
  title,
  isEditing,
  onTitleChange,
}: AppEditorScriptStepTitleProps) {
  if (isEditing) {
    return (
      <input
        type="text"
        className="script-step-title app-editor-menubar__step-title app-editor-menubar__step-title-input"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Название шага"
        aria-label="Название шага"
      />
    );
  }

  if (!title.trim()) return null;

  return (
    <div className="script-step-title app-editor-menubar__step-title">{title}</div>
  );
}
