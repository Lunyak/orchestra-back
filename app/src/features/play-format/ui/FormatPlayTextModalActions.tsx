import { Button } from "../../../shared/core/button/Button";

export type FormatPlayTextModalActionsProps = {
  onClose: () => void;
  canApply: boolean;
  applyDisabledTitle?: string;
  onApply: () => void;
};

export function FormatPlayTextModalActions({
  onClose,
  canApply,
  applyDisabledTitle,
  onApply,
}: FormatPlayTextModalActionsProps) {
  return (
    <footer className="format-play-text-modal__actions">
      <Button variant="ghost" onClick={onClose}>
        Отмена
      </Button>
      <Button
        variant="primary"
        disabled={!canApply}
        title={applyDisabledTitle}
        onClick={onApply}
      >
        Применить
      </Button>
    </footer>
  );
}
