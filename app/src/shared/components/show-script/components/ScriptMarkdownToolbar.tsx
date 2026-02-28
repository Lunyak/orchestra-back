import React from "react";

export function ScriptMarkdownToolbar({
  isEditing,
  onToggleEditing,
  markdownMode,
  onSetMarkdownMode,
  annotations,
  onInsertImage,
}: {
  isEditing: boolean;
  onToggleEditing: () => void;
  markdownMode: "notes" | "play";
  onSetMarkdownMode: (mode: "notes" | "play") => void;
  annotations: {
    mode: boolean;
    onToggleMode: () => void;
    loading: boolean;
    error: string | null;
    count: number;
    onClearSelectionState: () => void;
  };
  onInsertImage?: () => void;
}) {
  return (
    <div className="script-markdown-toggle">
      <button
        className="script-edit-toggle"
        onClick={onToggleEditing}
        title={isEditing ? "Режим чтения" : "Режим редактирования"}
      >
        {isEditing ? "Чтение" : "Редакт."}
      </button>
      <button
        type="button"
        className="script-markdown-toggle-btn"
        data-active={markdownMode === "notes"}
        onClick={() => onSetMarkdownMode("notes")}
      >
        Схема
      </button>
      <button
        type="button"
        className="script-markdown-toggle-btn"
        data-active={markdownMode === "play"}
        onClick={() => onSetMarkdownMode("play")}
      >
        Текст
      </button>

      {isEditing && onInsertImage ? (
        <button
          type="button"
          className="script-markdown-toggle-btn"
          data-active="false"
          onClick={onInsertImage}
          title="Загрузить картинку и вставить в markdown"
        >
          Картинка
        </button>
      ) : null}

      {isEditing ? (
        <div className="actor-annotations-toolbar">
          <button
            type="button"
            className="actor-annotations-btn"
            data-active="false"
            disabled
            title="Метки работают в режиме просмотра (выйдите из редактирования шага)"
          >
            Метки
          </button>
          <div className="actor-annotations-meta">
            Выйдите из редактирования, чтобы выделять текст и делать метки
          </div>
        </div>
      ) : (
        <div className="actor-annotations-toolbar">
          <button
            type="button"
            className="actor-annotations-btn"
            data-active={annotations.mode ? "true" : "false"}
            onClick={() => {
              annotations.onToggleMode();
              if (annotations.mode) {
                annotations.onClearSelectionState();
              }
            }}
            title="Включить режим пометок: выдели текст и добавь заметку"
          >
            Метки
          </button>
          <div className="actor-annotations-meta">
            {annotations.loading
              ? "загрузка…"
              : annotations.error
                ? annotations.error
                : `пометок: ${annotations.count}`}
          </div>
        </div>
      )}
    </div>
  );
}

