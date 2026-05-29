import { useId, useState, type FormEvent } from "react";
import type { ScriptTokenizeMode } from "./script-tokenize-formatting";

export type AppEditorScriptFormattingMenuProps = {
  disabled?: boolean;
  onTokenizeMatches: (query: string, mode: ScriptTokenizeMode) => number;
};

export function AppEditorScriptFormattingMenu({
  disabled = false,
  onTokenizeMatches,
}: AppEditorScriptFormattingMenuProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [resultText, setResultText] = useState("");

  const trimmedQuery = query.trim();
  const canSubmit = !disabled && trimmedQuery.length > 0;

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
              disabled={disabled}
              placeholder="слово или фраза"
              onChange={(event) => {
                setQuery(event.target.value);
                setResultText("");
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
              ? "Доступно в редактировании текста"
              : resultText || "Можно обернуть все сразу или шагать по совпадениям."}
          </div>
        </form>
      </div>
    </div>
  );
}
