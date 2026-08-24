import cn from "classnames";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Modal } from "../../../shared/core/modal/Modal";
import "./organization-create-modal.css";

export type OrganizationKind = "theater" | "troupe" | "studio";

const CREATE_KIND_OPTIONS: { id: OrganizationKind; label: string }[] = [
  { id: "theater", label: "Театр" },
  { id: "troupe", label: "Коллектив" },
  { id: "studio", label: "Студия" },
];

type OrganizationCreateModalProps = {
  isOpen: boolean;
  initialKind?: OrganizationKind;
  isSubmitting: boolean;
  error: string;
  onClose: () => void;
  onSubmit: (payload: { kind: OrganizationKind; title: string }) => void;
};

export function OrganizationCreateModal({
  isOpen,
  initialKind = "theater",
  isSubmitting,
  error,
  onClose,
  onSubmit,
}: OrganizationCreateModalProps) {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wasOpenRef = useRef(false);
  const [kind, setKind] = useState<OrganizationKind>(initialKind);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setKind(initialKind);
      setTitle("");
    }
    wasOpenRef.current = isOpen;
  }, [initialKind, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    if (!nextTitle || isSubmitting) return;
    onSubmit({ kind, title: nextTitle });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="organization-create-modal__panel"
      ariaLabelledBy={titleId}
    >
      <form className="organization-create-modal" onSubmit={handleSubmit}>
        <header className="organization-create-modal__header">
          <h2 id={titleId} className="organization-create-modal__title">
            Новая организация
          </h2>
        </header>

        <div className="organization-create-modal__field">
          <span className="organization-create-modal__label">Тип</span>
          <div
            className="organization-create-modal__kind"
            role="group"
            aria-label="Тип организации"
          >
            {CREATE_KIND_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                className="organization-create-modal__kind-btn"
                aria-pressed={kind === option.id}
                disabled={isSubmitting}
                onClick={() => setKind(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="organization-create-modal__field" htmlFor={`${titleId}-input`}>
          <span className="organization-create-modal__label">Название</span>
          <input
            ref={inputRef}
            id={`${titleId}-input`}
            className="organization-create-modal__input native-text-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Название организации"
            maxLength={120}
            disabled={isSubmitting}
          />
        </label>

        {error ? (
          <p className="organization-create-modal__error" role="alert">
            {error}
          </p>
        ) : null}

        <footer className="organization-create-modal__actions">
          <button
            type="button"
            className={cn(
              "organization-create-modal__btn",
              "organization-create-modal__btn--secondary",
            )}
            disabled={isSubmitting}
            onClick={onClose}
          >
            Отмена
          </button>
          <button
            type="submit"
            className={cn(
              "organization-create-modal__btn",
              "organization-create-modal__btn--primary",
            )}
            disabled={!title.trim() || isSubmitting}
          >
            {isSubmitting ? "Создание…" : "Создать"}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
