import { ScriptPlayTextAppearanceForm } from "../../settings/ScriptPlayTextAppearanceForm";

export type AppEditorScriptMarkdownStylesMenuProps = {
  disabled?: boolean;
  onRequestEditing?: () => void;
};

export function AppEditorScriptMarkdownStylesMenu(_props: AppEditorScriptMarkdownStylesMenuProps) {
  return (
    <div
      className="app-editor-script-styles-menu"
      role="dialog"
      aria-label="Стили отображения markdown"
    >
      <ScriptPlayTextAppearanceForm compact />
    </div>
  );
}
