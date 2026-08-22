import cn from "classnames";
import { useEffect, useState } from "react";
import type { ActorAnnotation } from "../../../../sync/api/actor-notes";

export function ActorAnnotationDetails({
  annotation,
  onClose,
  onUpdate,
  onDelete,
}: {
  annotation: ActorAnnotation | null;
  onClose: () => void;
  onUpdate: (id: string, noteText: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [text, setText] = useState(annotation?.noteText ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canSave = Boolean(text.trim());

  useEffect(() => {
    setText(annotation?.noteText ?? "");
    setError(null);
    setSaving(false);
  }, [annotation?.id]);

  if (!annotation) return null;

  return (
    <div className="actor-annotations-card">
      <header className="actor-annotations-card-head">
        <h2 className="actor-annotations-card-title">Метка</h2>
        <button
          type="button"
          className="actor-annotations-x"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </header>

      <div className="actor-annotations-body">
        {annotation.selectedText ? (
          <p className="actor-annotations-quote">
            “{String(annotation.selectedText).slice(0, 240)}”
          </p>
        ) : null}
        <label className="actor-annotations-field">
          <span className="actor-annotations-label">Заметка</span>
          <textarea
            className="actor-annotations-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
        </label>
        {error ? <div className="actor-annotations-error">{error}</div> : null}
      </div>

      <footer className="actor-annotations-actions">
        <button
          type="button"
          className={cn("actor-annotations-btn", "actor-annotations-btn--danger")}
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            setError(null);
            try {
              await onDelete(annotation.id);
            } catch {
              setError("Не удалось удалить");
            } finally {
              setSaving(false);
            }
          }}
        >
          Удалить
        </button>
        <button
          type="button"
          className={cn("actor-annotations-btn", "actor-annotations-btn--primary")}
          disabled={saving || !canSave}
          onClick={async () => {
            const next = text.trim();
            if (!next) return;
            setSaving(true);
            setError(null);
            try {
              await onUpdate(annotation.id, next);
            } catch {
              setError("Не удалось сохранить");
            } finally {
              setSaving(false);
            }
          }}
        >
          {saving ? "Сохранение…" : "Сохранить"}
        </button>
      </footer>
    </div>
  );
}
