import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { ActorAnnotation } from "../../../../sync/api/actor-notes";
import { ActorAnnotationDetails } from "./ActorAnnotationDetails";

export type NewAnnotationDraft = {
  start: number;
  end: number;
  selectedText: string;
  noteText: string;
};

export function ActorAnnotationsPopover({
  position,
  popoverRef,
  newAnnotation,
  setNewAnnotation,
  activeAnnotationId,
  setActiveAnnotationId,
  annotations,
  onCreate,
  onUpdate,
  onDelete,
  onRequestClose,
}: {
  position: { top: number; left: number } | null;
  popoverRef: React.MutableRefObject<HTMLDivElement | null>;
  newAnnotation: NewAnnotationDraft | null;
  setNewAnnotation: React.Dispatch<React.SetStateAction<NewAnnotationDraft | null>>;
  activeAnnotationId: string | null;
  setActiveAnnotationId: React.Dispatch<React.SetStateAction<string | null>>;
  annotations: ActorAnnotation[];
  onCreate: (draft: NewAnnotationDraft) => Promise<void>;
  onUpdate: (id: string, noteText: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onRequestClose: () => void;
}) {
  const newAnnotationTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!newAnnotation) return;
    const t = window.setTimeout(() => newAnnotationTextareaRef.current?.focus(), 0);
    return () => window.clearTimeout(t);
  }, [newAnnotation?.start, newAnnotation?.end]);

  if (typeof document === "undefined") return null;
  if (!position) return null;
  if (!newAnnotation && !activeAnnotationId) return null;

  return createPortal(
    <div
      ref={(el) => {
        popoverRef.current = el;
      }}
      className="actor-annotations-popover"
      style={
        {
          "--actor-annotations-popover-top": `${position.top}px`,
          "--actor-annotations-popover-left": `${position.left}px`,
        } as React.CSSProperties
      }
      onMouseDown={(e) => e.stopPropagation()}
    >
      {newAnnotation ? (
        <div className="actor-annotations-card">
          <div className="actor-annotations-card-head">
            <button
              type="button"
              className="actor-annotations-x"
              onClick={() => {
                setNewAnnotation(null);
                onRequestClose();
              }}
            >
              ×
            </button>
          </div>
          <div className="actor-annotations-quote">
            “{newAnnotation.selectedText.slice(0, 240)}”
          </div>
          <textarea
            className="actor-annotations-input"
            ref={newAnnotationTextareaRef}
            value={newAnnotation.noteText}
            onChange={(e) =>
              setNewAnnotation((p) => (p ? { ...p, noteText: e.target.value } : p))
            }
            placeholder="Напиши заметку…"
            rows={3}
          />
          <div className="actor-annotations-actions">
            <button
              type="button"
              onClick={async () => {
                const noteText = newAnnotation.noteText.trim();
                if (!noteText) return;
                await onCreate({ ...newAnnotation, noteText });
                setNewAnnotation(null);
                onRequestClose();
              }}
            >
              Сохранить пометку
            </button>
            <button
              type="button"
              className="actor-annotations-btn-secondary"
              onClick={() => {
                setNewAnnotation(null);
                onRequestClose();
              }}
            >
              Отмена
            </button>
          </div>
        </div>
      ) : null}

      {activeAnnotationId ? (
        <ActorAnnotationDetails
          annotation={annotations.find((a) => a.id === activeAnnotationId) ?? null}
          onClose={() => {
            setActiveAnnotationId(null);
            onRequestClose();
          }}
          onUpdate={onUpdate}
          onDelete={async (id) => {
            await onDelete(id);
            setActiveAnnotationId(null);
            onRequestClose();
          }}
        />
      ) : null}
    </div>,
    document.body,
  );
}

