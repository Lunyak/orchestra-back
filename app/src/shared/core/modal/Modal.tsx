import cn from "classnames";
import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import "./style.css";

export type ModalProps = {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  /** Доп. класс на панель (контейнер диалога). */
  panelClassName?: string;
  /** Id видимого заголовка внутри `children`. */
  ariaLabelledBy?: string;
  /** Краткое имя диалога для скринридеров. */
  ariaLabel?: string;
};

export function Modal({
  isOpen,
  onClose,
  children,
  panelClassName,
  ariaLabelledBy,
  ariaLabel,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const t = window.setTimeout(() => {
      panelRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(t);
  }, [isOpen]);

  if (!isOpen) return null;

  const dialog = (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        className={cn("modal-panel", panelClassName)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={ariaLabel ? undefined : ariaLabelledBy}
        aria-label={ariaLabel ?? (ariaLabelledBy ? undefined : "Диалог")}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(dialog, document.body);
  }

  return dialog;
}
