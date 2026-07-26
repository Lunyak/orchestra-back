import { useEffect, useId, useState, type FormEvent } from "react";
import {
  requestScriptFormatSearchHighlight,
  type ScriptTokenizeMode,
} from "./script-tokenize-formatting";

export type AppEditorScriptFormattingMenuProps = {
  disabled?: boolean;
  formatPlayDisabled?: boolean;
  onOpenFormatPlay: () => void;
  onTokenizeMatches: (query: string, mode: ScriptTokenizeMode) => number;
  /** Ввод в поиск в режиме чтения → перейти в редактирование. */
  onRequestEditing?: () => void;
};

export function AppEditorScriptFormattingMenu({
  disabled = false,
  formatPlayDisabled = false,
  onOpenFormatPlay,
  onTokenizeMatches,
  onRequestEditing,
}: AppEditorScriptFormattingMenuProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [resultText, setResultText] = useState("");

  const trimmedQuery = query.trim();
  const canSubmit = !disabled && trimmedQuery.length > 0;

  useEffect(() => {
    requestScriptFormatSearchHighlight(query);
    return () => requestScriptFormatSearchHighlight("");
  }, [query]);

  const runTokenize = (mode: ScriptTokenizeMode) => {
    if (!canSubmit) return;

    const count = onTokenizeMatches(trimmedQuery, mode);
    setResultText(
      count > 0
        ? mode === "all"
          ? `Заменено: ${count}`
          : "Заменено одно, курсор на следующем"
        : "Совпадений для замены нет",
    );
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    runTokenize("all");
  };

  return (
    <div className="theater-editor-menubar__menu app-editor-format-menu">
      <span className="theater-editor-menubar__menu-title">Форматирование</span>
      <div
        className="theater-editor-menubar__options app-editor-format-menu__options"
        role="menu"
        aria-label="Форматирование текста"
      >
        <form className="app-editor-format-menu__form" onSubmit={handleSubmit}>
          <label className="theater-editor-menubar__field-row" htmlFor={inputId}>
            <span className="theater-editor-menubar__field-label">Найти</span>
            <input
              id={inputId}
              className="theater-editor-menubar__field-input native-text-input"
              value={query}
              placeholder="слово или фраза"
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);
                setResultText("");
                if (disabled && nextQuery.length > 0) {
                  onRequestEditing?.();
                }
              }}
            />
          </label>
          <div className="app-editor-format-menu__actions">
            <button
              type="submit"
              className="theater-editor-menubar__field-action"
              disabled={!canSubmit}
            >
              Обернуть все
            </button>
            <button
              type="button"
              className="theater-editor-menubar__field-action"
              disabled={!canSubmit}
              onClick={() => runTokenize("next")}
            >
              По одному
            </button>
          </div>
          <div className="theater-editor-menubar__field-meta app-editor-format-menu__hint">
            {disabled
              ? "Введите текст — откроется редактирование"
              : resultText || "Можно обернуть все сразу или шагать по совпадениям."}
          </div>
        </form>
        <button
          type="button"
          role="menuitem"
          className="theater-editor-menubar__option"
          disabled={formatPlayDisabled}
          title={
            formatPlayDisabled
              ? "Откройте сцену на вкладке Текст или Экспликация"
              : undefined
          }
          onClick={() => {
            if (formatPlayDisabled) return;
            onOpenFormatPlay();
          }}
        >
          ФОРМАТ. ПЬЕСЫ
        </button>
      </div>
    </div>
  );
}
