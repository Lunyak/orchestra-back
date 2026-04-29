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

  useEffect(() => {
    setText(annotation?.noteText ?? "");
    setError(null);
    setSaving(false);
  }, [annotation?.id]);

  if (!annotation) return null;

  return (
    <div className="actor-annotations-card">
      <div className="actor-annotations-card-head">
        <button type="button" className="actor-annotations-x" onClick={onClose}>
          ×
        </button>
      </div>
      {annotation.selectedText ? (
        <div className="actor-annotations-quote">
          “{String(annotation.selectedText).slice(0, 240)}”
        </div>
      ) : null}
      <textarea
        className="actor-annotations-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
      />
      {error ? <div className="actor-annotations-error">{error}</div> : null}
      <div className="actor-annotations-actions">
        <button
          type="button"
          disabled={saving}
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
          {saving ? "💾 cохраняю…" : "💾 cохранить"}
        </button>
        <button
          type="button"
          className="actor-annotations-btn-danger"
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
          🗑 Удалить
        </button>
      </div>
    </div>
  );
}

