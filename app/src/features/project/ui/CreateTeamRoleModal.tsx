import { Button } from "@shared/core/button/Button";
import { CustomSelect } from "@shared/core/custom-select/CustomSelect";
import { InlineTextField } from "@shared/core/inline-text-field/InlineTextField";
import { Modal } from "@shared/core/modal/Modal";
import { useEffect, useRef, useState } from "react";
import "./create-team-role-modal.css";

export type CreateTeamRoleParentOption = {
  value: string;
  label: string;
};

type CreateTeamRoleModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    title: string;
    parentId: string | null;
  }) => Promise<void>;
  parentOptions: ReadonlyArray<CreateTeamRoleParentOption>;
  submitting?: boolean;
};

export function CreateTeamRoleModal({
  isOpen,
  onClose,
  onSubmit,
  parentOptions,
  submitting = false,
}: CreateTeamRoleModalProps) {
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setTitle("");
      setParentId("");
      setError(null);
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  const handleSubmit = async () => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setError("Введите название должности");
      return;
    }
    setError(null);
    try {
      await onSubmit({
        title: nextTitle,
        parentId: parentId || null,
      });
      onClose();
    } catch {
      setError("Не удалось создать должность");
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      panelClassName="create-team-role-modal"
      ariaLabelledBy="create-team-role-title"
    >
      <header className="create-team-role-modal__header">
        <h2 id="create-team-role-title" className="create-team-role-modal__title">
          Новая должность
        </h2>
        <button
          type="button"
          className="create-team-role-modal__close"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>
      </header>
      <div className="create-team-role-modal__body">
        <label className="create-team-role-modal__field">
          <span className="create-team-role-modal__label">Название</span>
          <InlineTextField
            className="create-team-role-modal__input"
            placeholder="Например, Режиссёр"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={80}
            autoFocus
          />
        </label>
        <label className="create-team-role-modal__field">
          <span className="create-team-role-modal__label">Родитель</span>
          <CustomSelect
            value={parentId}
            options={[...parentOptions]}
            onChange={setParentId}
            triggerClassName="create-team-role-modal__select"
            aria-label="Родительская должность"
          />
        </label>
        {error ? (
          <p className="create-team-role-modal__error">{error}</p>
        ) : null}
      </div>
      <footer className="create-team-role-modal__footer">
        <Button type="button" variant="ghost" onClick={onClose}>
          Отмена
        </Button>
        <Button
          type="button"
          disabled={submitting || !title.trim()}
          onClick={() => {
            void handleSubmit();
          }}
        >
          {submitting ? "Создание…" : "Создать"}
        </Button>
      </footer>
    </Modal>
  );
}
