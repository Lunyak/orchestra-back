import type { ShowScriptMarkdownMode } from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { ScriptMarkdownTabs } from "./ScriptMarkdownTabs";

export function ScriptMarkdownToolbar({
  markdownMode,
  onSetMarkdownMode,
  playOriginalMode,
  onTogglePlayOriginal,
  showTabs = true,
}: {
  markdownMode: ShowScriptMarkdownMode;
  onSetMarkdownMode: (mode: ShowScriptMarkdownMode) => void;
  playOriginalMode?: boolean;
  onTogglePlayOriginal?: () => void;
  showTabs?: boolean;
}) {
  if (!showTabs) return null;

  const showPlayOriginalToggle =
    markdownMode === "play" && onTogglePlayOriginal != null;

  return (
    <div className="script-markdown-toolbar">
      <ScriptMarkdownTabs
        markdownMode={markdownMode}
        onSetMarkdownMode={onSetMarkdownMode}
        tabsClassName="script-markdown-tabs"
        tabClassName="script-markdown-tab"
        activeTabClassName="script-markdown-tab--active"
      />
      {showPlayOriginalToggle ? (
        <button
          type="button"
          className={[
            "script-play-original-toggle",
            playOriginalMode ? "script-play-original-toggle--active" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onClick={onTogglePlayOriginal}
          title={
            playOriginalMode
              ? "Показан оригинал — нажмите для отредактированного"
              : "Показан отредактированный — нажмите для оригинала"
          }
          aria-pressed={playOriginalMode}
        >
          Оригинал
        </button>
      ) : null}
    </div>
  );
}
