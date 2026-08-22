import { useEffect, useId, useState, type FormEvent } from "react";
import {
  requestScriptCollapseBlankLines,
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
  variant?: "menu" | "panel";
};

function FormattingPanelBody({
  inputId,
  query,
  resultText,
  disabled,
  canSubmit,
  formatPlayDisabled,
  onQueryChange,
  onSubmit,
  onTokenizeNext,
  onOpenFormatPlay,
  onCollapseBlankLines,
}: {
  inputId: string;
  query: string;
  resultText: string;
  disabled: boolean;
  canSubmit: boolean;
  formatPlayDisabled: boolean;
  onQueryChange: (next: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onTokenizeNext: () => void;
  onOpenFormatPlay: () => void;
  onCollapseBlankLines: () => void;
}) {
  return (
    <>
      <form className="app-editor-format-menu__form" onSubmit={onSubmit}>
        <label className="theater-editor-menubar__field-row" htmlFor={inputId}>
          <span className="theater-editor-menubar__field-label">Найти</span>
          <input
            id={inputId}
            className="theater-editor-menubar__field-input native-text-input"
            value={query}
            placeholder="слово или фраза"
            onChange={(event) => onQueryChange(event.target.value)}
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
            onClick={onTokenizeNext}
          >
            По одному
          </button>
        </div>
        <div className="theater-editor-menubar__field-meta app-editor-format-menu__hint">
          {disabled
            ? "Введите текст — откроется редактирование"
            : resultText || "Обернуть все или шагать по совпадениям"}
        </div>
      </form>
      <button
        type="button"
        role="menuitem"
        className="theater-editor-menubar__option"
        title="Убрать пустые строки, сохранив переносы"
        onClick={onCollapseBlankLines}
      >
        Убрать пустые строки
      </button>
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
        Формат. пьесы
      </button>
    </>
  );
}

export function AppEditorScriptFormattingMenu({
  disabled = false,
  formatPlayDisabled = false,
  onOpenFormatPlay,
  onTokenizeMatches,
  onRequestEditing,
  variant = "menu",
}: AppEditorScriptFormattingMenuProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [resultText, setResultText] = useState("");

  const trimmedQuery = query.trim();
  const canSubmit = !disabled && trimmedQuery.length > 0;
  const isPanel = variant === "panel";

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

  const handleQueryChange = (nextQuery: string) => {
    setQuery(nextQuery);
    setResultText("");
    if (disabled && nextQuery.length > 0) {
      onRequestEditing?.();
    }
  };

  const handleCollapseBlankLines = () => {
    const applied = requestScriptCollapseBlankLines();
    if (disabled) {
      onRequestEditing?.();
    }

    const changed = Boolean(applied?.changed);
    const removed = applied?.removed ?? 0;

    setResultText(
      changed
        ? removed > 0
          ? `Убрано пустых строк: ${removed}`
          : "Пробелы по краям строк убраны"
        : "Лишних пустых строк нет",
    );
  };

  const body = (
    <FormattingPanelBody
      inputId={inputId}
      query={query}
      resultText={resultText}
      disabled={disabled}
      canSubmit={canSubmit}
      formatPlayDisabled={formatPlayDisabled}
      onQueryChange={handleQueryChange}
      onSubmit={handleSubmit}
      onTokenizeNext={() => runTokenize("next")}
      onOpenFormatPlay={onOpenFormatPlay}
      onCollapseBlankLines={handleCollapseBlankLines}
    />
  );

  if (isPanel) {
    return (
      <div
        className="app-editor-format-menu__panel"
        role="menu"
        aria-label="Форматирование текста"
      >
        {body}
      </div>
    );
  }

  return (
    <div className="theater-editor-menubar__menu app-editor-format-menu">
      <span className="theater-editor-menubar__menu-title">Форматирование</span>
      <div
        className="theater-editor-menubar__options app-editor-format-menu__options"
        role="menu"
        aria-label="Форматирование текста"
      >
        {body}
      </div>
    </div>
  );
}
