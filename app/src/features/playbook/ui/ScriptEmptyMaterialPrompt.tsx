import cn from "classnames";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../../../shared/core/button/Button";
import { readPlayTextFromFile } from "../model/read-play-text-file";
import "./script-empty-material-prompt.css";

export type ScriptEmptyMaterialPromptProps = {
  onImport: (text: string) => void;
};

export function ScriptEmptyMaterialPrompt({ onImport }: ScriptEmptyMaterialPromptProps) {
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasDraft = Boolean(draft);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const submitText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Вставьте текст пьесы или выберите файл");
      return;
    }
    setError(null);
    onImport(trimmed);
  };

  const applyPastedText = (text: string) => {
    if (!text.trim()) {
      setError("В буфере нет текста. Скопируйте пьесу и нажмите Ctrl+V");
      return;
    }
    setDraft(text);
    setError(null);
  };

  const handlePasteFromClipboard = async () => {
    textareaRef.current?.focus();
    try {
      const text = await navigator.clipboard.readText();
      applyPastedText(text);
    } catch {
      setError("Вставьте вручную: кликните в поле и нажмите Ctrl+V");
    }
  };

  const handleFile = async (file: File | null | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const text = await readPlayTextFromFile(file);
      setDraft(text);
      submitText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось прочитать файл");
    } finally {
      setBusy(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="script-empty-material">
      <div className="script-empty-material__card">
        <h2 className="script-empty-material__title">Вставьте пьесу</h2>
        <p className="script-empty-material__lead">
          Скопируйте текст пьесы и вставьте сюда копипастом. Потом его можно
          отформатировать и нарезать на сцены.
        </p>

        <div className="script-empty-material__label-row">
          <label className="script-empty-material__label" htmlFor={textareaId}>
            Текст пьесы
          </label>
          <button
            type="button"
            className="script-empty-material__paste-btn"
            onClick={() => {
              void handlePasteFromClipboard();
            }}
            disabled={busy}
          >
            Вставить из буфера
          </button>
        </div>

        <div
          className={cn(
            "script-empty-material__paste",
            hasDraft && "script-empty-material__paste--filled",
          )}
        >
          <textarea
            ref={textareaRef}
            id={textareaId}
            className="script-empty-material__textarea native-text-input"
            value={draft}
            placeholder=" "
            rows={12}
            disabled={busy}
            onChange={(event) => {
              setDraft(event.target.value);
              if (error) setError(null);
            }}
          />
          {hasDraft ? null : (
            <p className="script-empty-material__paste-hint">
              <span className="script-empty-material__kbd">Ctrl+V</span>
              Вставьте скопированный текст пьесы
            </p>
          )}
        </div>

        {error ? <p className="script-empty-material__error">{error}</p> : null}

        <div className="script-empty-material__actions">
          <Button
            variant="primary"
            disabled={busy || !draft.trim()}
            onClick={() => submitText(draft)}
          >
            Добавить в сценарий
          </Button>
          <span className="script-empty-material__or">или</span>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            Выбрать файл…
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            className="native-file-input--hidden"
            accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>

        <p className="script-empty-material__hint">Форматы файла: .txt, .docx</p>
      </div>
    </div>
  );
}
