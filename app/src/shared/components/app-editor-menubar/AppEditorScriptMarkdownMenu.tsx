import type { ShowScriptMarkdownMode } from "../../../features/show-script-markdown/model/show-script-markdown-slice";
import { SCRIPT_MARKDOWN_TAB_ITEMS } from "../show-script/components/ScriptMarkdownTabs";

export type AppEditorScriptMarkdownMenuProps = {
  markdownMode: ShowScriptMarkdownMode;
  onSetMarkdownMode: (mode: ShowScriptMarkdownMode) => void;
};

export function AppEditorScriptMarkdownMenu({
  markdownMode,
  onSetMarkdownMode,
}: AppEditorScriptMarkdownMenuProps) {
  const activeLabel =
    SCRIPT_MARKDOWN_TAB_ITEMS.find((item) => item.mode === markdownMode)?.label ?? "Сцена";

  return (
    <div className="theater-editor-menubar__menu">
      <span className="theater-editor-menubar__menu-title">{activeLabel}</span>
      <div className="theater-editor-menubar__options" role="menu" aria-label="Режим сцены">
        {SCRIPT_MARKDOWN_TAB_ITEMS.map(({ mode, label }) => {
          const isActive = markdownMode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={isActive}
              className={[
                "theater-editor-menubar__option",
                isActive ? "theater-editor-menubar__option--active" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => onSetMarkdownMode(mode)}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
