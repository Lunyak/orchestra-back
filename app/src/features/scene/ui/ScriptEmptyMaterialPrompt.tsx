import { useId, useRef, useState } from "react";
import { Button } from "../../../shared/core/button/Button";
import { readPlayTextFromFile } from "../model/read-play-text-file";
import "./script-empty-material-prompt.css";

export type ScriptEmptyMaterialPromptProps = {
  onImport: (text: string) => void;
};

export function ScriptEmptyMaterialPrompt({ onImport }: ScriptEmptyMaterialPromptProps) {
  const textareaId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submitText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("Вставьте текст пьесы или выберите файл");
      return;
    }
    setError(null);
    onImport(trimmed);
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
        <h2 className="script-empty-material__title">Добавьте материал</h2>
        <p className="script-empty-material__lead">
          Сценарий пока пустой. Вставьте текст пьесы целиком в первый шаг — потом его можно
          отформатировать и нарезать на шаги.
        </p>

        <label className="script-empty-material__label" htmlFor={textareaId}>
          Текст пьесы
        </label>
        <textarea
          id={textareaId}
          className="script-empty-material__textarea native-text-input"
          value={draft}
          placeholder="Вставьте сюда текст пьесы (Ctrl+V)…"
          rows={12}
          disabled={busy}
          onChange={(event) => {
            setDraft(event.target.value);
            if (error) setError(null);
          }}
        />

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
            className="script-empty-material__file-input"
            accept=".txt,.docx,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            onChange={(event) => void handleFile(event.target.files?.[0])}
          />
        </div>

        <p className="script-empty-material__hint">Форматы: .txt, .docx</p>
      </div>
    </div>
  );
}
