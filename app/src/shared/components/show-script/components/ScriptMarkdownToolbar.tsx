import { Button } from "@shared/core/button/Button";
import type { ShowScriptMarkdownMode } from "../../../../features/show-script-markdown/model/show-script-markdown-slice";
import { ScriptMarkdownTabs } from "./ScriptMarkdownTabs";

export function ScriptMarkdownToolbar({
  markdownMode,
  onSetMarkdownMode,
  playOriginalMode,
  onTogglePlayOriginal,
  showTabs = true,
  editorToggles,
}: {
  markdownMode: ShowScriptMarkdownMode;
  onSetMarkdownMode: (mode: ShowScriptMarkdownMode) => void;
  playOriginalMode?: boolean;
  onTogglePlayOriginal?: () => void;
  showTabs?: boolean;
  editorToggles?: null | {
    tocEnabled: boolean;
    onToggleToc: () => void;
  };
}) {
  if (!showTabs && !editorToggles) return null;

  const showPlayOriginalToggle =
    showTabs && markdownMode === "play" && onTogglePlayOriginal != null;

  return (
    <div className="script-markdown-toolbar">
      {showTabs ? (
        <ScriptMarkdownTabs
          markdownMode={markdownMode}
          onSetMarkdownMode={onSetMarkdownMode}
          tabsClassName="script-markdown-tabs"
          tabClassName="script-markdown-tab"
          activeTabClassName="script-markdown-tab--active"
        />
      ) : null}
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
      {editorToggles ? (
        <div className="show-script__control-wrap">
          <Button
            variant="ghost"
            className="show-script__rail-btn"
            data-role="toc-toggle"
            onClick={editorToggles.onToggleToc}
            title={
              editorToggles.tocEnabled
                ? "Скрыть оглавление"
                : "Показать оглавление"
            }
            aria-pressed={editorToggles.tocEnabled}
            data-active={editorToggles.tocEnabled ? "true" : "false"}
          >
            &#129526;
          </Button>
        </div>
      ) : null}
    </div>
  );
}
