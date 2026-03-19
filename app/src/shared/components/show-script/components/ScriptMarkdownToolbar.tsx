import { Button } from "@shared/core/button/Button";

export function ScriptMarkdownToolbar({
  isEditing,
  onToggleEditing,
  markdownMode,
  onSetMarkdownMode,
  annotations,
  onInsertImage,
  onInsertKadr,
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
}) {
  const annotationsMode = annotations.mode;

  return (
    <div className="script-markdown-toolbar">

      <div className="script-markdown-tabs" role="tablist" aria-label="Режим шага">
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
            title={isEditing ? "Перейти в режим чтения" : "Перейти в режим редактирования"}
            // @ts-expect-error: ButtonProps is minimal; pass-through attributes are ok for DOM button
            aria-pressed={isEditing}
            // @ts-expect-error: ButtonProps is minimal; pass-through attributes are ok for DOM button
            data-active={isEditing ? "true" : "false"}
          >
            {isEditing ? "📖" : "✏️"}
          </Button>
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
            // @ts-expect-error: ButtonProps is minimal; pass-through attributes are ok for DOM button
            aria-pressed={annotationsMode}
            // @ts-expect-error: ButtonProps is minimal; pass-through attributes are ok for DOM button
            data-active={annotationsMode ? "true" : "false"}
          >
            🏷️
          </Button>
        </div>
      </div>
    </div>

  );
}

