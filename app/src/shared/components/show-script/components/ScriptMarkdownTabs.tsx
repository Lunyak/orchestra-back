import type { ShowScriptMarkdownMode } from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { SCRIPT_MARKDOWN_NOTES_TAB_LABEL } from "../script-markdown-tab-labels";

export const SCRIPT_MARKDOWN_TAB_ITEMS: ReadonlyArray<{
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

export type ScriptMarkdownTabsProps = {
  markdownMode: ShowScriptMarkdownMode;
  onSetMarkdownMode: (mode: ShowScriptMarkdownMode) => void;
  tabsClassName: string;
  tabClassName: string;
  activeTabClassName: string;
};

export function ScriptMarkdownTabs({
  markdownMode,
  onSetMarkdownMode,
  tabsClassName,
  tabClassName,
  activeTabClassName,
}: ScriptMarkdownTabsProps) {
  return (
    <div className={tabsClassName} role="tablist" aria-label="Режим сцены">
      {SCRIPT_MARKDOWN_TAB_ITEMS.map(({ mode, label }) => {
        const isActive = markdownMode === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={[tabClassName, isActive ? activeTabClassName : ""].filter(Boolean).join(" ")}
            onClick={() => onSetMarkdownMode(mode)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
