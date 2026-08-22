import type { ShowScriptMarkdownMode } from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { ScriptMarkdownTabs } from "./ScriptMarkdownTabs";

export function ScriptMarkdownToolbar({
  markdownMode,
  onSetMarkdownMode,
  showTabs = true,
}: {
  markdownMode: ShowScriptMarkdownMode;
  onSetMarkdownMode: (mode: ShowScriptMarkdownMode) => void;
  showTabs?: boolean;
}) {
  if (!showTabs) return null;

  return (
    <div className="script-markdown-toolbar">
      <ScriptMarkdownTabs
        markdownMode={markdownMode}
        onSetMarkdownMode={onSetMarkdownMode}
        tabsClassName="script-markdown-tabs"
        tabClassName="script-markdown-tab"
        activeTabClassName="script-markdown-tab--active"
      />
    </div>
  );
}
