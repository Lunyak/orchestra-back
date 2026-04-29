import { Button } from "@shared/core/button/Button";

export function ScriptMarkdownToolbar({
  isEditing,
  onToggleEditing,
  markdownMode,
  onSetMarkdownMode,
  annotations,
  onInsertImage,
  onInsertKadr,
  editorToggles,
}: {
  isEditing: boolean;
  onToggleEditing: () => void;
  markdownMode: "notes" | "play" | "explication";
  onSetMarkdownMode: (mode: "notes" | "play" | "explication") => void;
  annotations: {
    mode: boolean;
    onToggleMode: () => void;
    loading: boolean;
    error: string | null;
    count: number;
    onClearSelectionState: () => void;
  };
  onInsertImage?: () => void;
  onInsertKadr?: () => void;
  editorToggles?: null | {
    tocEnabled: boolean;
    onToggleToc: () => void;
  };
}) {
  const annotationsMode = annotations.mode;

  return (
    <div className="script-markdown-toolbar">
      <div
        className="script-markdown-tabs"
        role="tablist"
        aria-label="Режим шага"
      >
        <button
          type="button"
          role="tab"
          aria-selected={markdownMode === "notes"}
          className="script-markdown-tab"
          data-active={markdownMode === "notes"}
          onClick={() => onSetMarkdownMode("notes")}
        >
          Схема
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={markdownMode === "explication"}
          className="script-markdown-tab"
          data-active={markdownMode === "explication"}
          onClick={() => onSetMarkdownMode("explication")}
        >
          Экспликация
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={markdownMode === "play"}
          className="script-markdown-tab"
          data-active={markdownMode === "play"}
          onClick={() => onSetMarkdownMode("play")}
        >
          Текст
        </button>
        <div className="show-script__control-wrap">
          <Button
            variant="ghost"
            className="show-script__rail-btn"
            onClick={onToggleEditing}
            title={
              isEditing
                ? "Перейти в режим чтения"
                : "Перейти в режим редактирования"
            }
            aria-pressed={isEditing}
            data-active={isEditing ? "true" : "false"}
          >
            {isEditing ? "📖" : "✏️"}
          </Button>
          {isEditing && editorToggles ? (
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
          ) : null}
          <Button
            variant="ghost"
            className="show-script__rail-btn"
            disabled={isEditing}
            onClick={annotations.onToggleMode}
            title={
              isEditing
                ? "Метки работают в режиме чтения"
                : annotationsMode
                  ? "Выключить метки"
                  : "Включить метки"
            }
            aria-pressed={annotationsMode}
            data-active={annotationsMode ? "true" : "false"}
          >
            🏷️
          </Button>
        </div>
      </div>
    </div>
  );
}
